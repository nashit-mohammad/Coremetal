import {cp, mkdir, readFile, rm, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const supabaseFunctionUrl = process.env.COREMETAL_SUPABASE_FUNCTION_URL?.trim() ?? "";
const dashboardFunctionUrl = process.env.COREMETAL_DASHBOARD_FUNCTION_URL?.trim() ?? "";
const pages = [
  "index.html",
  "about.html",
  "products.html",
  "product.html",
  "specifications.html",
  "industries.html",
  "careers.html",
  "contact.html",
  "quote.html",
  "privacy.html",
  "staff.html",
];

function validateFunctionUrl(value) {
  if (!value) {
    throw new Error(
      "Set COREMETAL_SUPABASE_FUNCTION_URL in the Render Static Site build environment. "
      + "Use your Supabase project URL followed by /functions/v1/submit-enquiry.",
    );
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("COREMETAL_SUPABASE_FUNCTION_URL must be a valid HTTPS URL.");
  }
  if (
    parsed.protocol !== "https:"
    || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname)
    || parsed.port !== ""
    || parsed.pathname !== "/functions/v1/submit-enquiry"
    || parsed.search
    || parsed.hash
  ) {
    throw new Error(
      "COREMETAL_SUPABASE_FUNCTION_URL must look like "
      + "https://<project-ref>.supabase.co/functions/v1/submit-enquiry.",
    );
  }
}

function validateDashboardFunctionUrl(value) {
  if (!value) {
    throw new Error(
      "Set COREMETAL_DASHBOARD_FUNCTION_URL in the Render Static Site build environment. "
      + "Use your Supabase project URL followed by /functions/v1/coremetal-dashboard.",
    );
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("COREMETAL_DASHBOARD_FUNCTION_URL must be a valid HTTPS URL.");
  }
  if (
    parsed.protocol !== "https:"
    || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname)
    || parsed.port !== ""
    || parsed.pathname !== "/functions/v1/coremetal-dashboard"
    || parsed.search
    || parsed.hash
  ) {
    throw new Error(
      "COREMETAL_DASHBOARD_FUNCTION_URL must look like "
      + "https://<project-ref>.supabase.co/functions/v1/coremetal-dashboard.",
    );
  }
}

async function main() {
  validateFunctionUrl(supabaseFunctionUrl);
  validateDashboardFunctionUrl(dashboardFunctionUrl);
  await rm(output, {recursive: true, force: true});
  await mkdir(output, {recursive: true});

  for (const page of pages) {
    await cp(path.join(root, page), path.join(output, page));
  }
  await cp(path.join(root, "styles.css"), path.join(output, "styles.css"));
  await cp(path.join(root, "app.js"), path.join(output, "app.js"));
  await cp(path.join(root, "staff-dashboard.js"), path.join(output, "staff-dashboard.js"));
  await cp(path.join(root, "assets"), path.join(output, "assets"), {recursive: true});

  const config = {
    supabaseFunctionUrl,
    dashboardFunctionUrl,
  };
  await writeFile(
    path.join(output, "assets", "config.js"),
    `window.COREMETAL_CONFIG = Object.freeze(${JSON.stringify(config)});\n`,
  );

  const productList = JSON.parse(
    await readFile(path.join(output, "assets", "products.json"), "utf8"),
  );
  let productsWithPhotos = 0;
  for (const product of productList) {
    if (
      typeof product.image !== "string"
      || !product.image.startsWith("assets/products/")
      || path.isAbsolute(product.image)
    ) {
      throw new Error(`Product "${product.slug}" does not have a local product photo.`);
    }
    const imagePath = path.resolve(output, product.image);
    const relativeImagePath = path.relative(path.join(output, "assets", "products"), imagePath);
    if (
      relativeImagePath.startsWith(`..${path.sep}`)
      || relativeImagePath === ".."
    ) {
      throw new Error(`Product "${product.slug}" has an invalid product-photo path.`);
    }
    let imageStats;
    try {
      imageStats = await stat(imagePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Product "${product.slug}" is missing its bundled photograph.`);
      }
      throw error;
    }
    if (!imageStats.isFile()) {
      throw new Error(`Product "${product.slug}" is missing its bundled photograph.`);
    }
    productsWithPhotos += 1;
  }
  if (productList.length === 0) {
    throw new Error(
      `The local product catalogue or photographs are incomplete `
      + `(${productList.length} products, ${productsWithPhotos} photographs).`,
    );
  }
  const dashboardScript = await readFile(path.join(output, "staff-dashboard.js"), "utf8");
  if (dashboardScript.includes("SUPABASE_SERVICE_ROLE_KEY") || dashboardScript.includes("RATE_LIMIT_SECRET")) {
    throw new Error("A private database credential was found in the public staff dashboard.");
  }

  console.log(
    `Built ${pages.length} HTML pages, ${productList.length} products and `
    + `${productsWithPhotos} local product photographs in dist/.`,
  );
  console.log("No Supabase service key or database credential is included in the static site.");
}

main().catch(error => {
  console.error(`Static site build failed: ${error.message}`);
  process.exitCode = 1;
});
