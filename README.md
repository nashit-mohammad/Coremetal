# Core Metal website

A responsive, multi-page website for Core Metal L.L.C. It is plain HTML, CSS
and JavaScript, with no package installation, build step, third-party font,
image-hosting or analytics dependency.

## Preview

Use Node.js to run the built-in local preview server:

```powershell
node scripts/preview-server.mjs
```

Visit [http://127.0.0.1:4173](http://127.0.0.1:4173). Stop the server with
**Ctrl+C**. Open the other pages through their site routes so the browser can
load the product catalogue and locally stored photographs over HTTP.

## Pages

- `index.html` — home
- `about.html` — about Core Metal
- `products.html` — searchable and filterable product catalogue
- `product.html?item=universal-beams` — individual product details
- `specifications.html` — specifications grouped by product category
- `industries.html` — industries served
- `careers.html` — careers enquiries
- `contact.html` — contact details and enquiry form
- `quote.html` — saved product enquiry
- `privacy.html` — website privacy information

Each catalogue card links to its own product page; the query string selects
the product in `assets/products.json`.

## Product images and catalogue

Product descriptions and product images are stored locally in `assets/`.
To refresh them from the public Core Metal product catalogue, run:

```powershell
node scripts/download-site-assets.mjs
```

The site itself never loads product images from the public website. To keep
the enquiry flow self-contained and avoid sending customer details to a form
provider, the contact and quote forms prepare an email in the visitor's own
email application; the visitor reviews and sends that message.

## Static hosting

Host this directory with any static web server. The HTML pages, stylesheet,
JavaScript and product photographs all load from the same site directory.
