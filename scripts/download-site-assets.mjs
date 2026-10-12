import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

const api = "https://coremetal.net/wp-json/wp/v2/";
const imageDirectory = path.resolve("assets", "products");

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  const responseText = await response.text();
  const jsonStart = responseText.search(/[\[{]/);
  if (jsonStart < 0) {
    throw new Error(`Response did not contain JSON: ${url}`);
  }

  const opening = responseText[jsonStart];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let jsonEnd = -1;
  for (let index = jsonStart; index < responseText.length; index += 1) {
    const character = responseText[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
    } else if (character === "{" || character === "[") {
      depth += 1;
    } else if (character === "}" || character === "]") {
      depth -= 1;
      if (depth === 0) {
        jsonEnd = index + 1;
        break;
      }
    }
  }
  if (!opening || jsonEnd < 0) {
    throw new Error(`Response contained incomplete JSON: ${url}`);
  }
  if (jsonStart !== 0 || jsonEnd !== responseText.length) {
    console.warn(`Removed non-JSON output surrounding the API response: ${url}`);
  }
  return JSON.parse(responseText.slice(jsonStart, jsonEnd));
}

async function downloadImage(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status}): ${url}`);
  }
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function main() {
  await mkdir(imageDirectory, {recursive: true});

  const [products, categories] = await Promise.all([
    getJson(`${api}product?per_page=100&_fields=id,slug,title,excerpt,product_cat,featured_media`),
    getJson(`${api}product_cat?per_page=100&_fields=id,name,slug`),
  ]);

  const categoryNames = new Map(categories.map(category => [category.id, category.name]));
  const mediaIds = [...new Set(products.map(product => product.featured_media).filter(Boolean))];
  const media = mediaIds.length
    ? await getJson(`${api}media?include=${mediaIds.join(",")}&per_page=100&_fields=id,source_url`)
    : [];
  const photosById = new Map(media.filter(Boolean).map(photo => [photo.id, photo]));

  const catalogue = products.map(product => {
    const photo = photosById.get(product.featured_media);
    const extension = photo?.source_url
      ? path.extname(new URL(photo.source_url).pathname).toLowerCase() || ".jpg"
      : "";
    const excerpt = (product.excerpt?.rendered ?? "")
      .replace(/<br\s*\/?>/gi, " · ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&#8211;|&ndash;/g, "–")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/\s+/g, " ")
      .trim();

    return {
      slug: product.slug,
      name: product.title?.rendered ?? product.slug,
      category: product.product_cat
        ?.map(id => categoryNames.get(id))
        .find(Boolean) ?? "Steel Products",
      description: excerpt,
      image: photo?.source_url
        ? `assets/products/${product.slug}${extension}`
        : "",
      sourceImage: photo?.source_url ?? "",
    };
  });

  for (const product of catalogue) {
    if (product.sourceImage) {
      await downloadImage(
        product.sourceImage,
        path.resolve(product.image),
      );
    }
    delete product.sourceImage;
  }

  await writeFile(
    path.resolve("assets", "products.json"),
    `${JSON.stringify(catalogue, null, 2)}\n`,
  );
  console.log(`Saved ${catalogue.length} catalogue entries and ${catalogue.filter(item => item.image).length} product photographs.`);

  await writeFile(
    path.resolve("assets", "company-images.json"),
    "[]\n",
  );
  console.log("The local photo catalogue is ready.");
}

main().catch(error => {
  console.error(`Asset download failed: ${error.message}`);
  process.exitCode = 1;
});
