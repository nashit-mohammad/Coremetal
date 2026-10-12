const companyEmail = "mail@coremetal.net";
const companyPhone = "+97165013111";
const submissionEndpoint = window.COREMETAL_CONFIG?.supabaseFunctionUrl ?? "";
const page = document.querySelector("#site")?.dataset.page ?? "home";
const pages = [
  {id: "home", label: "Home", href: "index.html"},
  {id: "about", label: "About", href: "about.html"},
  {id: "products", label: "Products", href: "products.html"},
  {id: "specifications", label: "Specifications", href: "specifications.html"},
  {id: "industries", label: "Industries", href: "industries.html"},
  {id: "careers", label: "Careers", href: "careers.html"},
  {id: "contact", label: "Contact", href: "contact.html"},
];
const iconPaths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  arrowUp: '<path d="m7 17 10-10M7 7h10v10"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  box: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 9 9-4M12 12v9m0-9L3 8m4-1 10 10"/>',
  briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4m-7-12h.01M12 9h.01M15 9h.01M9 13h.01M12 13h.01M15 13h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18m-9-9a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  minus: '<path d="M5 12h14"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 11.19 18a19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-2.91-8.67A2 2 0 0 1 4.27 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.24 8.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69a2 2 0 0 1 1.58 2.05Z"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>',
  trash: '<path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-5 4v6m4-6v6"/>',
};

function icon(name, className = "") {
  const path = iconPaths[name];
  if (!path) return "";
  return `<svg class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function readQuote() {
  try {
    const parsed = JSON.parse(localStorage.getItem("coremetal-quote") || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(item =>
        typeof item.slug === "string"
        && Number.isInteger(item.quantity)
        && item.quantity > 0)
      : [];
  } catch (error) {
    console.error("Could not load the saved quotation:", error);
    showNotice("Your saved quotation could not be loaded from this browser.");
    return [];
  }
}

let quote = readQuote();

function saveQuote() {
  try {
    localStorage.setItem("coremetal-quote", JSON.stringify(quote));
    return true;
  } catch (error) {
    console.error("Could not save the quotation to this browser:", error);
    showNotice("The browser could not save your changes. Please keep this page open while preparing your enquiry.");
    return false;
  }
}

function showNotice(message, kind = "") {
  const status = document.querySelector("#site-notice");
  if (!status) return;
  status.textContent = message;
  status.className = `site-notice is-visible${kind ? ` ${kind}` : ""}`;
  window.clearTimeout(showNotice.timeout);
  showNotice.timeout = window.setTimeout(() => {
    status.className = "site-notice";
  }, 4200);
}

function quoteQuantity() {
  return quote.reduce((total, item) => total + item.quantity, 0);
}

function header() {
  const links = pages.map(link => `
    <a class="nav-link${page === link.id ? " is-current" : ""}"${page === link.id ? ' aria-current="page"' : ""} href="${link.href}">${link.label}</a>
  `).join("");
  return `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="utility-bar">
      <div class="container utility-inner">
        <span><span class="utility-dot"></span> Structural steel, thoughtfully supplied.</span>
        <div class="utility-right">
          <span>${icon("globe")} Sharjah, UAE</span>
          <a href="tel:${companyPhone}">${icon("phone")} +971 6 5013 111</a>
          <a class="utility-email" href="contact.html">${icon("mail")} Email our team</a>
        </div>
      </div>
    </div>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="Core Metal home">
          <span class="brand-icon" aria-hidden="true"><span></span><span></span><span></span></span>
          <span class="brand-name">core<span>metal</span><small>L.L.C. · SHARJAH</small></span>
        </a>
        <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-navigation">${icon("menu")}<span>Menu</span></button>
        <nav class="primary-navigation" id="primary-navigation" aria-label="Main navigation">
          ${links}
          <a class="quote-nav" href="quote.html">My enquiry <span class="quote-badge" aria-label="${quoteQuantity()} items">${quoteQuantity()}</span></a>
        </nav>
      </div>
    </header>
    <div id="site-notice" class="site-notice" role="status" aria-live="polite"></div>
  `;
}

function footer() {
  return `
    <section class="footer-cta">
      <div class="container footer-cta-inner">
        <div><span class="eyebrow eyebrow-light">LET'S GET YOUR PROJECT MOVING</span><h2>Looking for the right steel?</h2><p>Tell us what you need. Our team will help you find a fit for your specification and timeline.</p></div>
        <a class="button button-light" href="products.html">Explore our products ${icon("arrowUp")}</a>
      </div>
    </section>
    <footer class="site-footer">
      <div class="container footer-main">
        <div class="footer-brand"><a class="brand brand-inverse" href="index.html"><span class="brand-icon" aria-hidden="true"><span></span><span></span><span></span></span><span class="brand-name">core<span>metal</span><small>L.L.C. · SHARJAH</small></span></a><p>A reliable supply partner for structural steel, pipes and metal products in the UAE and beyond.</p><span class="certification">${icon("shield")} ISO 9001:2015 certified company</span></div>
        <div class="footer-column"><span class="footer-title">Explore</span><a href="about.html">About Core Metal</a><a href="products.html">Steel products</a><a href="specifications.html">Specifications</a><a href="industries.html">Industries we serve</a></div>
        <div class="footer-column"><span class="footer-title">Get in touch</span><a href="contact.html">Contact our team</a><a href="careers.html">Careers</a><a href="contact.html">${companyEmail}</a><a href="tel:${companyPhone}">+971 6 5013 111</a></div>
        <div class="footer-column footer-location"><span class="footer-title">Visit us</span><span>Core Metal L.L.C.</span><span>P.O. Box 95801</span><span>Sharjah, United Arab Emirates</span><a href="quote.html" class="footer-quote">Start an enquiry ${icon("arrowUp")}</a></div>
      </div>
      <div class="container footer-bottom"><span>© ${new Date().getFullYear()} Core Metal L.L.C. All rights reserved.</span><a href="privacy.html">Privacy</a><span>Built on trust. Forged to last.</span></div>
    </footer>
  `;
}

function eyebrow(label) {
  return `<span class="eyebrow"><span class="eyebrow-line"></span>${escapeHtml(label)}</span>`;
}

function banner({eyebrowText, title, description, pageLabel = ""}) {
  const breadcrumbLabel = pageLabel || title.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return `
    <section class="page-banner">
      <div class="container">
        <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span aria-current="page">${escapeHtml(breadcrumbLabel)}</span></nav>
        ${eyebrow(eyebrowText)}
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
    </section>
  `;
}

function imageTag(source, alt = "", className = "") {
  return `<img class="${className}" src="${escapeHtml(source || "assets/product-placeholder.svg")}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

function productHref(product) {
  return `product.html?item=${encodeURIComponent(product.slug)}`;
}

function productCard(product) {
  const name = escapeHtml(product.name);
  const detail = escapeHtml(product.description || "Get in touch with our team to discuss the available grades and sizes.");
  const href = productHref(product);
  return `
    <article class="product-card">
      <a class="product-image" href="${href}" aria-label="View ${name} details">
        ${imageTag(product.image, name)}
        <span class="product-image-arrow" aria-hidden="true">${icon("arrowUp")}</span>
      </a>
      <div class="product-card-content">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <h3><a href="${href}">${name}</a></h3>
        <p class="product-description">${detail}</p>
        <button class="text-action add-to-quote" type="button" data-product="${escapeHtml(product.slug)}">Add to enquiry ${icon("plus")}</button>
      </div>
    </article>
  `;
}

function productGrid(items, extraClass = "") {
  if (!items.length) {
    return `<div class="empty-results"><span class="empty-results-icon">${icon("layers")}</span><strong>No products found just yet.</strong><span>Try another search term or select a different category.</span></div>`;
  }
  return `<div class="product-grid${extraClass ? ` ${extraClass}` : ""}">${items.map(productCard).join("")}</div>`;
}

function homePage(products, companyImages) {
  const categories = [
    {label: "Structural steel", description: "The essential shapes for strong, dependable structures.", image: products.find(item => /Universal Beams|Universal Columns|H Beam/i.test(item.name))?.image},
    {label: "Pipes & hollow sections", description: "Versatile pipe and section solutions for real-world projects.", image: products.find(item => /Hollow Sections/i.test(item.name))?.image},
    {label: "Stainless steel", description: "Sheets and pipes selected for lasting performance.", image: products.find(item => /Stainless Steel Sheet/i.test(item.name))?.image},
    {label: "Galvanized steel", description: "GI products for dependable, practical protection.", image: products.find(item => /Hot Dipped GI Sheet/i.test(item.name))?.image},
    {label: "Aluminium", description: "Lightweight sheets and coils to support your specification.", image: products.find(item => /Aluminium Sheets/i.test(item.name))?.image},
    {label: "Special shapes", description: "Unusual shapes and sizes for projects that need something different.", image: products.find(item => /Special pipes|Elliptical Tube/i.test(item.name))?.image},
  ];
  const featured = ["universal-beams", "hollow-sections", "mild-steel-plate", "stainless-steel-sheet"]
    .map(slug => products.find(item => item.slug === slug))
    .filter(Boolean);
  const heroImage = products.find(item => /Hollow Sections|MS ERW|Seamless Pipes/i.test(item.name))?.image
    || products.find(Boolean)?.image
    || "assets/product-placeholder.svg";

  return `
    <section class="hero">
      <div class="hero-visual" aria-hidden="true">${imageTag(heroImage, "Steel pipe stock ready for a project")}<div class="hero-image-shade"></div><div class="hero-grid-overlay"></div></div>
      <div class="container hero-content">
        <div class="hero-copy">
          ${eyebrow("STEEL. EXPERIENCE. RELIABILITY.")}
          <h1>Good steel.<br>Good people.<br><span>Built around you.</span></h1>
          <p>Your dependable partner for structural steel and metal products, serving projects across the UAE and beyond.</p>
          <div class="hero-actions">
            <a class="button button-accent" href="products.html">Explore our products ${icon("arrowUp")}</a>
            <a class="button button-outline-light" href="contact.html">Talk to our team ${icon("arrow")}</a>
          </div>
          <div class="hero-proof"><span class="proof-mark">${icon("shield")}</span><span><strong>Quality you can build on</strong><small>ISO 9001:2015 certified company</small></span></div>
        </div>
        <div class="hero-note"><span class="hero-note-index">01 / UAE</span><span>Grounded in Sharjah.<br>Connected to the world.</span></div>
      </div>
    </section>
    <div class="trust-strip" aria-label="Company strengths">
      <div class="container trust-strip-inner">
        <span>${icon("globe")} UAE & GCC supply</span><span>${icon("box")} Broad product range</span><span>${icon("shield")} Quality-led service</span><span>${icon("spark")} A real team, here to help</span>
      </div>
    </div>
    <section class="section section-categories">
      <div class="container">
        <div class="section-heading">
          <div>${eyebrow("A GOOD PLACE TO START")}<h2>Steel for the work<br>you need to do.</h2></div>
          <div class="section-heading-aside"><p>From everyday requirements to project-specific enquiries, browse our material range and tell us what you're looking for.</p><a class="text-action" href="products.html">Browse all products ${icon("arrow")}</a></div>
        </div>
        <div class="category-grid">
          ${categories.map((category, index) => `
            <a class="category-card category-card-${index + 1}" href="products.html">
              ${imageTag(category.image, "", "category-image")}
              <span class="category-shade"></span><span class="category-number">0${index + 1}</span>
              <span class="category-copy"><strong>${category.label}</strong><span>${category.description}</span></span>
              <span class="category-arrow">${icon("arrowUp")}</span>
            </a>
          `).join("")}
        </div>
      </div>
    </section>
    <section class="section section-about">
      <div class="container about-home-grid">
        <div class="about-picture">
          ${imageTag(companyImages[0]?.file || heroImage, companyImages[0]?.description || "Steel ready for supply to a project")}
          <div class="about-picture-label"><span class="about-picture-mark">${icon("building")}</span><span><strong>Proud to be from Sharjah</strong><small>Serving projects from the UAE and beyond</small></span></div>
        </div>
        <div class="about-home-copy">
          ${eyebrow("A PARTNER, NOT JUST A SUPPLIER")}
          <h2>Steel supply should feel straightforward.</h2>
          <p>Core Metal L.L.C. is a professionally managed steel supplier based in Sharjah, United Arab Emirates. We pair a broad range of materials with personal service and the experience to support different project requirements.</p>
          <p>From making sense of a product range to asking the right questions about your specification, our team is here to make the process easier from the first conversation.</p>
          <ul class="check-list">
            <li>${icon("check")} Based in Sharjah, UAE</li>
            <li>${icon("check")} Quality-conscious, responsive service</li>
            <li>${icon("check")} A wide range of steel and metal products</li>
          </ul>
          <a class="button button-dark" href="about.html">Get to know us ${icon("arrowUp")}</a>
        </div>
      </div>
    </section>
    <section class="section section-featured">
      <div class="container">
        <div class="section-heading">
          <div>${eyebrow("A FEW PLACES TO BEGIN")}<h2>Popular starting points.</h2></div>
          <a class="text-action" href="products.html">See the full product range ${icon("arrow")}</a>
        </div>
        ${productGrid(featured, "featured-grid")}
      </div>
    </section>
    <section class="section section-process">
      <div class="container">
        <div class="process-heading">${eyebrow("A SIMPLE WAY TO GET STARTED")}<h2>Your project. Your requirements.<br><span>A conversation that gets it.</span></h2><p>Tell us a little about what you need. We’ll guide you from an enquiry to the information your team needs to move forward.</p></div>
        <div class="process-steps">
          <article class="process-step"><span class="step-number">01</span><span class="process-icon">${icon("mail")}</span><h3>Tell us about it</h3><p>Share the products, sizes, grades and quantities you’re looking for.</p></article>
          <article class="process-step"><span class="step-number">02</span><span class="process-icon">${icon("layers")}</span><h3>We’ll work through it</h3><p>Our team will review your enquiry and confirm the details with you.</p></article>
          <article class="process-step"><span class="step-number">03</span><span class="process-icon">${icon("arrow")}</span><h3>Plan your next step</h3><p>Get in touch to discuss availability, specifications and delivery.</p></article>
        </div>
        <div class="process-cta"><a class="button button-accent" href="quote.html">Start a product enquiry ${icon("arrowUp")}</a><span>No commitment. Just a conversation.</span></div>
      </div>
    </section>
    <section class="section section-industries-preview">
      <div class="container">
        <div class="section-heading"><div>${eyebrow("DIFFERENT PROJECTS, DIFFERENT NEEDS")}<h2>Here when your industry<br>needs a steel partner.</h2></div><a class="text-action" href="industries.html">See who we serve ${icon("arrow")}</a></div>
        <div class="industry-pills"><span>General contracting</span><span>Steel fabrication</span><span>Oil & gas</span><span>Petrochemical</span><span>Pipelines</span><span>Engineering</span></div>
      </div>
    </section>
  `;
}

function aboutPage(companyImages) {
  return `
    ${banner({
      eyebrowText: "A LITTLE ABOUT US",
      title: 'A trusted name<br>in <span class="accent-text">steel supply.</span>',
      description: "Good business is about more than materials. It’s how you show up, listen and see a project through.",
    })}
    <section class="section">
      <div class="container about-page-grid">
        <div class="about-page-photo">${imageTag(companyImages[0]?.file || "assets/product-placeholder.svg", companyImages[0]?.description || "Core Metal products for UAE projects")}</div>
        <div class="about-page-copy">${eyebrow("ROOTED IN SHARJAH. READY FOR WHAT'S NEXT.")}<h2>Experience that makes the conversation easier.</h2>
          <p>Core Metal L.L.C. is a professionally managed company serving the steel requirements of customers throughout the United Arab Emirates and neighbouring GCC countries.</p>
          <p>Established as the steel importing and trading arm of Greenland Group, Core Metal has grown into a supplier of mild steel, structural steel, pipes and a broader selection of metal products. Our work covers everyday material requirements as well as larger project enquiries.</p>
          <p>Our role is to help customers navigate that selection with responsive service, a practical approach and a focus on getting the specification right.</p>
          <div class="company-fact-row"><div><strong>Sharjah</strong><span>Our home in the UAE</span></div><div><strong>Quality-led</strong><span>Our way of working</span></div></div>
        </div>
      </div>
    </section>
    <section class="section section-values">
      <div class="container">
        <div class="section-heading"><div>${eyebrow("WHAT WE STAND FOR")}<h2>Good work begins<br>with good principles.</h2></div><p class="section-heading-aside">Clear communication, consistent quality and continual improvement shape how we work with our customers.</p></div>
        <div class="value-grid">
          <article class="value-card"><span class="value-icon">${icon("globe")}</span><span class="eyebrow">01 · VISION</span><h3>Be the partner you come back to.</h3><p>Build lasting relationships by making it easier for customers to find the right products and support for the job.</p></article>
          <article class="value-card"><span class="value-icon">${icon("arrow")}</span><span class="eyebrow">02 · MISSION</span><h3>Do the work properly, together.</h3><p>Achieve customer satisfaction through good products, attentive service, teamwork and continuous improvement.</p></article>
          <article class="value-card"><span class="value-icon">${icon("shield")}</span><span class="eyebrow">03 · QUALITY</span><h3>Put care into every detail.</h3><p>Work to an ISO 9001:2015 quality management system, and take our commitment to quality seriously.</p></article>
        </div>
      </div>
    </section>
    <section class="section section-story">
      <div class="container story-row">
        <div>${eyebrow("STRAIGHTFORWARD SUPPORT")}<h2>A real person on the other end.</h2></div>
        <div><p>When you are choosing material, asking about sizes or putting an order together, having someone who will listen matters. Our team is here to hear about your requirements and help you find the right next step.</p><a class="text-action" href="contact.html">Meet us in a conversation ${icon("arrow")}</a></div>
      </div>
    </section>
  `;
}

function productsPage(products) {
  return `
    ${banner({
      eyebrowText: "EXPLORE THE RANGE",
      title: 'The right material<br>for <span class="accent-text">the right job.</span>',
      description: "Browse our steel and metal products. Need a particular grade or size? Tell us what you're looking for.",
    })}
    <section class="section section-catalog">
      <div class="container">
        <div class="catalog-topline"><span class="catalog-count">${products.length} product groups to explore</span><a class="text-action" href="specifications.html">Need the specs? ${icon("arrow")}</a></div>
        <form class="catalog-search" role="search">
          ${icon("layers")}<label class="visually-hidden" for="product-search">Search products</label><input type="search" id="product-search" placeholder="Search by product, material or size…" autocomplete="off"><span class="search-shortcut">⌕</span>
        </form>
        <div class="catalog-filters" role="group" aria-label="Filter products by material"><button type="button" class="filter-chip is-selected" data-category="all">All products <span>${products.length}</span></button>${[...new Set(products.map(item => item.category))].sort().map(category => `<button type="button" class="filter-chip" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}</div>
        <p class="catalog-result" id="catalog-result" aria-live="polite">${products.length} products</p>
        <div id="product-results">${productGrid(products)}</div>
        <div class="catalog-help"><div class="catalog-help-icon">${icon("spark")}</div><div><strong>Looking for a less common product or specification?</strong><span>Tell us what your project needs and our team can help point you in the right direction.</span></div><a class="button button-dark" href="contact.html">Ask us a question ${icon("arrowUp")}</a></div>
      </div>
    </section>
  `;
}

function specificationsPage(products) {
  const groups = [...new Set(products.map(item => item.category))].sort();
  return `
    ${banner({
      eyebrowText: "THE DETAIL THAT MATTERS",
      title: 'Good decisions<br>start with <span class="accent-text">good information.</span>',
      description: "See a selection of the product details available across our range. Tell us about your project for a specific requirement.",
    })}
    <section class="section section-specs">
      <div class="container">
        <div class="specs-note"><span class="specs-note-icon">${icon("shield")}</span><div><strong>Project-specific details? Let’s check together.</strong><p>Grades, dimensions, standards, finishes and stock availability can vary. Use the product information as a starting point and confirm your exact requirements with our team.</p></div><a class="button button-dark" href="contact.html">Ask our team ${icon("arrowUp")}</a></div>
        ${groups.map(category => `
          <section class="specs-group" aria-label="${escapeHtml(category)} specifications">
            <div class="specs-group-heading"><span class="product-category">${escapeHtml(category)}</span><h2>${escapeHtml(category.replace(/Products/i, "Product"))}</h2></div>
            <div class="spec-list">${products.filter(item => item.category === category).map(item => `
              <article class="spec-row"><span class="spec-product">${escapeHtml(item.name)}</span><span class="spec-description">${escapeHtml(item.description || "Contact us for available grades, specifications and sizes.")}</span><a class="spec-enquire" href="quote.html" data-quick-quote="${escapeHtml(item.slug)}">Enquire ${icon("arrow")}</a></article>
            `).join("")}</div>
          </section>
        `).join("")}
      </div>
    </section>
  `;
}

function productPage(products, product) {
  if (!product) {
    return `
      <section class="page-banner"><div class="container"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><a href="products.html">Products</a><span>/</span><span aria-current="page">Product not found</span></nav><span class="eyebrow">PRODUCT NOT FOUND</span><h1>This product isn’t on<br>the list.</h1><p>Browse our catalogue or contact us if you were looking for a particular size or product.</p></div></section>
      <section class="section"><div class="container"><a class="button button-dark" href="products.html">Browse products ${icon("arrowUp")}</a></div></section>
    `;
  }

  const specifications = (product.description || "")
    .split(/\s*(?:·|\|)\s*/)
    .filter(Boolean);
  const specificationCards = specifications.map(specification => {
    const separator = specification.indexOf(":");
    if (separator < 0) {
      return `<li>${escapeHtml(specification)}</li>`;
    }
    return `<li><span>${escapeHtml(specification.slice(0, separator).trim())}</span><strong>${escapeHtml(specification.slice(separator + 1).trim())}</strong></li>`;
  }).join("");
  const related = products
    .filter(item => item.slug !== product.slug && item.category === product.category)
    .slice(0, 3);

  return `
    ${banner({
      eyebrowText: escapeHtml(product.category.toUpperCase()),
      title: `${escapeHtml(product.name)}<br><span class="accent-text">Find the right fit.</span>`,
      description: "See the available product details, then talk with our team about your project and exact specification.",
      pageLabel: product.name,
    })}
    <section class="section section-product-detail">
      <div class="container">
        <nav class="product-back-link" aria-label="Product navigation"><a href="products.html">${icon("arrow")} Back to all products</a><span>/</span><a href="specifications.html">Specifications</a></nav>
        <div class="product-detail-layout">
          <div class="product-detail-image">${imageTag(product.image, product.name, "product-main-image")}</div>
          <div class="product-detail-copy">
            <span class="product-category">${escapeHtml(product.category)}</span>
            <h2>${escapeHtml(product.name)}</h2>
            <p>${escapeHtml(product.description || "Tell us what your project needs and our team can confirm the available grades, dimensions and specifications.")}</p>
            ${specificationCards
              ? `<div class="product-specification"><span class="spec-heading">PRODUCT INFORMATION</span><ul>${specificationCards}</ul></div>`
              : `<div class="product-specification product-specification-note">${icon("shield")} Contact our team to confirm the product specifications, grades and available sizes for your project.</div>`}
            <div class="product-detail-actions"><button class="button button-dark add-to-quote" type="button" data-product="${escapeHtml(product.slug)}">${icon("plus")} Add to product enquiry</button><a class="button button-quiet" href="contact.html">Ask about this product ${icon("arrowUp")}</a></div>
            <p class="product-detail-footnote">${icon("shield")} Product details are indicative; confirm your exact requirements and availability with our team.</p>
          </div>
        </div>
      </div>
    </section>
    ${related.length ? `<section class="section related-products"><div class="container"><div class="section-heading"><div>${eyebrow("MORE TO EXPLORE")}<h2>Related products.</h2></div><a class="text-action" href="products.html">Browse the full range ${icon("arrow")}</a></div>${productGrid(related, "related-grid")}</div></section>` : ""}
  `;
}

const industries = [
  {name: "General contracting", number: "01", text: "From building works to large project supply, source the structural and mild steel that your teams need on site.", icon: "building"},
  {name: "Steel fabrication", number: "02", text: "Practical steel choices for workshops and fabrication teams working to a drawing, schedule and deadline.", icon: "layers"},
  {name: "Oil & gas", number: "03", text: "Explore pipes, structural products and materials for demanding energy and industrial environments.", icon: "shield"},
  {name: "Petrochemical", number: "04", text: "Enquire about steel product types that support complex process facilities and their contractors.", icon: "spark"},
  {name: "Pipelines", number: "05", text: "Find out more about pipe and hollow-section options for infrastructure and pipeline projects.", icon: "globe"},
  {name: "Engineering & industry", number: "06", text: "A broad material range to support equipment, infrastructure and day-to-day engineering requirements.", icon: "box"},
];

function industriesPage() {
  return `
    ${banner({
      eyebrowText: "INDUSTRIES WE SUPPORT",
      title: 'Built for the<br>industries <span class="accent-text">building tomorrow.</span>',
      description: "Every project is different. We help contractors, fabricators and industry find a material range that fits the work.",
    })}
    <section class="section">
      <div class="container">
        <div class="industry-intro"><span>ONE PARTNER.</span><span>MANY TYPES OF WORK.</span><p>From steel on a workshop drawing to materials for a major project, we take the time to understand the requirements behind every enquiry.</p></div>
        <div class="industries-grid">${industries.map(item => `
          <article class="industry-card"><div class="industry-card-top"><span class="industry-number">${item.number}</span><span class="industry-icon">${icon(item.icon)}</span></div><h2>${item.name}</h2><p>${item.text}</p><a class="text-action" href="quote.html">Discuss your project ${icon("arrow")}</a></article>
        `).join("")}</div>
        <div class="industry-bottom"><p>Have a specialist or hard-to-place requirement?<br><span>Start with a conversation. We’ll help you explore the available options.</span></p><a class="button button-dark" href="contact.html">Talk through your project ${icon("arrowUp")}</a></div>
      </div>
    </section>
  `;
}

function careersPage() {
  return `
    ${banner({
      eyebrowText: "WORK WITH US",
      title: 'Good people make<br><span class="accent-text">good teams.</span>',
      description: "We value people who bring care, integrity and a collaborative spirit to their work.",
    })}
    <section class="section section-careers"><div class="container careers-grid">
      <div class="careers-message"><span class="careers-icon">${icon("briefcase")}</span>${eyebrow("CAREERS AT CORE METAL")}<h2>Build your next chapter with us.</h2><p>Core Metal serves customers from Sharjah across the UAE and GCC. We believe the way we work as a team matters just as much as the products we supply.</p><p>We do not currently publish open positions on this website. If you’d like us to keep your details in mind for future opportunities, introduce yourself to our team.</p><a class="button button-dark" href="contact.html?subject=Careers">Introduce yourself ${icon("arrowUp")}</a></div>
      <aside class="careers-panel"><span class="eyebrow eyebrow-light">SAY HELLO</span><h3>Interested in joining the team?</h3><p>Tell us a little about yourself and the kind of role you’re interested in. We’ll pass your message along to the right people.</p><a href="contact.html?subject=Careers">${icon("mail")} Contact our team ${icon("arrowUp", "career-mail-arrow")}</a><span class="careers-response">Your career enquiry will go straight to our team.</span></aside>
    </div></section>
  `;
}

function contactPage() {
  return `
    ${banner({
      eyebrowText: "LET'S TALK STEEL",
      title: 'Tell us a little<br>about <span class="accent-text">what you need.</span>',
      description: "An enquiry, a product question or simply an introduction. Our team in Sharjah would be glad to hear from you.",
    })}
    <section class="section section-contact">
      <div class="container contact-grid">
        <div class="contact-details">${eyebrow("HERE WHEN YOU NEED US")}<h2>A real conversation is a good place to start.</h2><p>Reach us directly using the contact details below, or send your enquiry and we’ll get back to you.</p>
          <a class="contact-channel" href="tel:${companyPhone}"><span class="contact-icon">${icon("phone")}</span><span><small>GIVE US A CALL</small><strong>+971 6 5013 111</strong></span><span class="contact-channel-arrow">${icon("arrowUp")}</span></a>
          <a class="contact-channel" href="#contact-form"><span class="contact-icon">${icon("mail")}</span><span><small>DROP US AN EMAIL</small><strong>${companyEmail}</strong></span><span class="contact-channel-arrow">${icon("arrowUp")}</span></a>
          <div class="contact-address"><span class="contact-icon">${icon("building")}</span><span><small>COME SAY HELLO</small><strong>Core Metal L.L.C.</strong><span>P.O. Box 95801<br>Sharjah, United Arab Emirates</span></span></div>
          <p class="contact-hours">ISO 9001:2015 certified company · serving customers across the UAE and GCC</p>
          <a class="text-action" href="staff.html">Core Metal team sign in ${icon("arrowUp")}</a>
        </div>
        <form class="contact-form" id="contact-form">
          <div class="contact-form-heading">${eyebrow("SEND AN ENQUIRY")}<h2>How can we help?</h2><p>Fill in the details below to send your enquiry securely to our team.</p></div>
          <label class="honeypot-control" aria-hidden="true">Leave this field blank<input name="website_url" type="text" tabindex="-1" autocomplete="off"></label>
          <label for="contact-name">Your name <span aria-hidden="true">*</span><input id="contact-name" name="name" autocomplete="name" required placeholder="e.g. Samir Ahmed"></label>
          <div class="form-row"><label for="contact-email">Work email <span aria-hidden="true">*</span><input id="contact-email" name="email" type="email" autocomplete="email" required placeholder="you@company.com"></label><label for="contact-phone">Phone <span class="optional-label">(optional)</span><input id="contact-phone" name="phone" type="tel" autocomplete="tel" placeholder="+971"></label></div>
          <label for="contact-subject">What is this about? <span aria-hidden="true">*</span><select id="contact-subject" name="subject" required><option value="" disabled selected>Choose an enquiry type</option><option>Products or availability</option><option>Specifications and grades</option><option>Quotation or project enquiry</option><option>Careers</option><option>Privacy or data request</option><option>Something else</option></select></label>
          <label for="contact-message">A little more about what you need <span aria-hidden="true">*</span><textarea id="contact-message" name="message" rows="5" required placeholder="Products, sizes, quantities, project location — include whatever details you have."></textarea></label>
          <div class="consent-row"><label class="consent-control"><input name="consent" type="checkbox" required><span>I agree that Core Metal may use my details to respond to this enquiry.</span></label><a class="consent-privacy" href="privacy.html">Privacy details</a></div>
          <button class="button button-dark form-submit" type="submit">Send your enquiry ${icon("arrowUp")}</button>
          <p class="form-privacy">Your details are sent securely to Core Metal’s enquiry database so our team can respond.</p>
          <p class="form-feedback" id="contact-feedback" aria-live="polite"></p>
        </form>
      </div>
    </section>
  `;
}

function quotePage(products) {
  return `
    ${banner({
      eyebrowText: "YOUR PROJECT STARTS HERE",
      title: 'Let’s get your<br><span class="accent-text">requirements together.</span>',
      description: "Review the products you’re interested in, add quantities and prepare an enquiry for our team.",
    })}
    <section class="section section-quote">
      <div class="container quote-layout">
        <div class="quote-items-panel"><div class="quote-panel-heading"><div>${eyebrow("YOUR PRODUCT ENQUIRY")}<h2>What are you looking for?</h2></div><a href="products.html" class="text-action">Add a product ${icon("arrow")}</a></div>
          ${quote.length
            ? `<div class="quote-items">${quote.map(item => {
              const product = products.find(entry => entry.slug === item.slug);
              if (!product) return "";
              return `<article class="quote-item"><div class="quote-item-image">${imageTag(product.image, product.name)}</div><div class="quote-item-detail"><span class="product-category">${escapeHtml(product.category)}</span><h3>${escapeHtml(product.name)}</h3><button class="remove-quote" type="button" data-remove="${escapeHtml(product.slug)}">${icon("trash")} Remove</button></div><label class="quantity-control">Quantity<input type="number" min="1" max="100000000" step="1" value="${item.quantity}" data-quantity="${escapeHtml(product.slug)}" aria-label="${escapeHtml(product.name)} quantity"></label></article>`;
            }).join("")}</div><button type="button" class="clear-quote" data-action="clear-quote">${icon("trash")} Clear enquiry</button>`
            : `<div class="quote-empty"><span class="quote-empty-icon">${icon("box")}</span><h3>Your enquiry is ready to take shape.</h3><p>Add one or more products and note your quantities. Your selection is saved on this browser as you work.</p><a class="button button-dark" href="products.html">Explore steel products ${icon("arrowUp")}</a></div>`}
        </div>
        <aside class="quote-summary"><span class="eyebrow eyebrow-light">ENQUIRY SUMMARY</span><h2>A little more detail<br>helps us help you.</h2><p>Our team will confirm your specific grades, availability, specifications and delivery requirements with you.</p>
          <div class="summary-count"><span>Product groups</span><strong>${quote.length}</strong></div><div class="summary-count"><span>Total quantity requested</span><strong>${quoteQuantity()}</strong></div>
          <a class="button button-accent button-summary${quote.length ? "" : " is-disabled"}" ${quote.length ? 'href="#quote-details"' : 'href="products.html"'}>${quote.length ? "Continue with this enquiry" : "Choose a product"} ${icon("arrowUp")}</a>
          <span class="summary-secure">${icon("shield")} No payment or account required</span>
          <a class="summary-email" href="contact.html">${icon("mail")} Prefer to send a message? Contact us</a>
        </aside>
      </div>
      ${quote.length ? `<div class="container"><div class="quote-details-panel" id="quote-details"><form class="quote-form" id="quote-form"><div class="quote-form-heading">${eyebrow("ALMOST THERE")}<h2>Where should we get back to you?</h2><p>Add your contact details and optional project information. We’ll securely save your enquiry to our database so our team can respond.</p></div>
        <label for="quote-name">Your name <span aria-hidden="true">*</span><input id="quote-name" name="name" autocomplete="name" required placeholder="Your full name"></label>
        <div class="form-row"><label for="quote-email">Work email <span aria-hidden="true">*</span><input id="quote-email" name="email" type="email" autocomplete="email" required placeholder="you@company.com"></label><label for="quote-phone">Phone <span class="optional-label">(optional)</span><input id="quote-phone" name="phone" type="tel" autocomplete="tel" placeholder="+971"></label></div>
        <label for="quote-project">Project or delivery details <span class="optional-label">(optional)</span><textarea id="quote-project" name="project" rows="4" placeholder="Project location, preferred delivery date, grade or other specifications."></textarea></label>
        <label class="honeypot-control" aria-hidden="true">Leave this field blank<input name="website_url" type="text" tabindex="-1" autocomplete="off"></label>
        <div class="consent-row"><label class="consent-control"><input name="consent" type="checkbox" required><span>I agree that Core Metal may use my details to respond to this quotation enquiry.</span></label><a class="consent-privacy" href="privacy.html">Privacy details</a></div>
        <button type="submit" class="button button-dark">Send product enquiry ${icon("arrowUp")}</button><p class="form-privacy">Your enquiry and selected products are securely sent to Core Metal’s enquiry database.</p><p class="form-feedback" id="quote-feedback" aria-live="polite"></p>
      </form></div></div>` : ""}
    </section>
  `;
}

function privacyPage() {
  return `
    ${banner({
      eyebrowText: "YOUR INFORMATION",
      title: 'Privacy,<br><span class="accent-text">explained plainly.</span>',
      description: "A straightforward explanation of how this redesigned website handles your information.",
    })}
    <section class="section privacy-section"><div class="container privacy-copy">
      <p class="privacy-updated">Website privacy information · ${new Date().toLocaleDateString("en-GB", {month: "long", year: "numeric"})}</p>
      <h2>Information you choose to send</h2><p>When you submit a contact or product enquiry, your name, contact details and message are sent to Core Metal through a protected Supabase Edge Function and stored in the company’s Supabase enquiry database so the team can respond. Product enquiries also include your selected products and quantities. We ask for your consent before you send an enquiry.</p>
      <h2>Products saved on your device</h2><p>While preparing a product enquiry, your selected products and quantities are saved in your browser’s local storage. This allows you to continue the enquiry after navigating to another page. The website sends these selections to Core Metal only when you submit the completed enquiry. Your saved selection stays in this browser until you clear it or clear this site’s browser data.</p>
      <h2>Keeping your details private</h2><p>The enquiry database is not publicly readable: the website cannot browse or download enquiries, and its public pages do not contain a Supabase service-role key or database credential. The enquiry function uses an allowlist of website origins, validates submissions, limits repeat submissions by a one-way, secret-keyed network-address hash, and does not store the original address.</p>
      <h2>Third-party services and media</h2><p>Product photographs, the logo and design assets are stored locally alongside the website code. When you submit an enquiry, your browser connects to Core Metal’s Supabase-hosted enquiry function. Viewing pages or products does not require a third-party image host, external font service, analytics tool or embedded map.</p>
      <h2>Your choices and questions</h2><p>You can remove products from your enquiry list or clear the list in your browser. To ask about an enquiry you have submitted, or request its deletion, use our <a href="contact.html?subject=Privacy%20or%20data%20request">contact form</a> or call +971 6 5013 111. Submission consent covers the handling of information necessary to respond to your enquiry.</p>
      <p class="privacy-disclaimer">This notice describes how the enquiry and product-quote features of this website work. For questions about the retention or handling of your enquiry, contact Core Metal directly.</p>
    </div></section>
  `;
}

function updateNavigationCount() {
  const badge = document.querySelector(".quote-badge");
  if (badge) {
    badge.textContent = quoteQuantity();
    badge.setAttribute("aria-label", `${quoteQuantity()} items`);
  }
}

function addToQuote(slug) {
  const existing = quote.find(item => item.slug === slug);
  if (existing) {
    existing.quantity += 1;
  } else {
    quote.push({slug, quantity: 1});
  }
  saveQuote();
  updateNavigationCount();
  showNotice("Added to your enquiry list.");
}

async function submitEnquiry(event, formId, feedbackId, buildRequest) {
  event.preventDefault();
  const form = document.getElementById(formId);
  if (!form.reportValidity()) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const feedback = document.getElementById(feedbackId);
  if (!submissionEndpoint) {
    feedback.textContent = `Online enquiry storage hasn’t been configured yet. Your enquiry has not been sent. Please call ${companyPhone.replace(/^(\+\d{3})(\d)/, "$1 $2")} to get in touch.`;
    return;
  }

  const formData = new FormData(form);
  const request = buildRequest(formData);
  if (String(formData.get("website_url") || "").trim()) {
    form.reset();
    feedback.textContent = "Thank you. Your enquiry has been received.";
    return;
  }

  submitButton.disabled = true;
  feedback.classList.remove("is-error");
  feedback.textContent = "Sending your enquiry securely…";
  try {
    const response = await fetch(submissionEndpoint, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(request),
      credentials: "omit",
      referrerPolicy: "strict-origin-when-cross-origin",
      signal: AbortSignal.timeout(20000),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The enquiry service returned an unexpected response. Your enquiry has not been sent.");
    }
    if (!response.ok || result.success !== true) {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : "The enquiry service couldn't save your message. Your enquiry has not been sent.",
      );
    }

    const reference = typeof result.reference === "string"
      ? ` Your reference is ${result.reference}.`
      : "";
    feedback.textContent = `Thank you. Your enquiry has been saved securely.${reference} Our team will be in touch.`;
    if (typeof result.reference === "string") {
      const successHeading = document.createElement("span");
      successHeading.className = "form-reference";
      successHeading.textContent = `Reference: ${result.reference}`;
      feedback.append(successHeading);
    }
    if (formId === "quote-form") {
      quote = [];
      saveQuote();
      updateNavigationCount();
      document.querySelector(".quote-items-panel").innerHTML = `
        <div class="quote-confirmation">
          <span class="quote-empty-icon">${icon("check")}</span>
          <h2>Thank you. Your enquiry is with our team.</h2>
          <p>Your product request has been securely recorded. Our team will be in touch to discuss your requirements.</p>
          <a class="button button-dark" href="products.html">Continue browsing products ${icon("arrowUp")}</a>
        </div>`;
      document.querySelectorAll(".summary-count").forEach((row, index) => {
        const value = row.querySelector("strong");
        if (value) value.textContent = "0";
        if (index === 0) row.querySelector("span").textContent = "Product groups";
        if (index === 1) row.querySelector("span").textContent = "Total quantity requested";
      });
    } else {
      form.reset();
    }
  } catch (error) {
    console.error("Core Metal enquiry submission failed:", error);
    feedback.classList.add("is-error");
    feedback.textContent = error instanceof DOMException && error.name === "TimeoutError"
      ? "The enquiry service timed out. Your enquiry has not been confirmed or saved. Please try again, or call our team."
      : `${error.message || "We couldn't save your enquiry."} If the problem continues, please call our team.`;
  } finally {
    submitButton.disabled = false;
  }
}

function renderProductResults(products) {
  const search = document.querySelector("#product-search");
  const selected = document.querySelector(".filter-chip.is-selected")?.dataset.category ?? "all";
  const query = search?.value.trim().toLocaleLowerCase() ?? "";
  const filtered = products.filter(product => {
    const categoryMatches = selected === "all" || product.category === selected;
    const queryMatches = !query
      || `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase().includes(query);
    return categoryMatches && queryMatches;
  });
  const result = document.querySelector("#catalog-result");
  const grid = document.querySelector("#product-results");
  if (result) result.textContent = `${filtered.length} ${filtered.length === 1 ? "product" : "products"}`;
  if (grid) grid.innerHTML = productGrid(filtered);
}

function attachInteractions(products) {
  if (page === "contact") {
    const subject = new URLSearchParams(window.location.search).get("subject");
    const field = document.querySelector("#contact-subject");
    if (field && (subject === "Careers" || subject === "Privacy or data request")) {
      field.value = subject;
    }
  }

  document.querySelector(".menu-toggle")?.addEventListener("click", event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    button.setAttribute("aria-label", expanded ? "Open navigation" : "Close navigation");
    document.querySelector(".primary-navigation")?.classList.toggle("is-open", !expanded);
  });

  document.addEventListener("click", event => {
    const addButton = event.target.closest(".add-to-quote");
    if (addButton) {
      addToQuote(addButton.dataset.product);
      return;
    }

    const categoryButton = event.target.closest(".filter-chip");
    if (categoryButton) {
      document.querySelector(".filter-chip.is-selected")?.classList.remove("is-selected");
      categoryButton.classList.add("is-selected");
      renderProductResults(products);
      return;
    }

    const quickQuote = event.target.closest("[data-quick-quote]");
    if (quickQuote) {
      event.preventDefault();
      addToQuote(quickQuote.dataset.quickQuote);
      window.location.assign("quote.html");
      return;
    }

    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      quote = quote.filter(item => item.slug !== removeButton.dataset.remove);
      saveQuote();
      window.location.reload();
      return;
    }

    if (event.target.closest("[data-action='clear-quote']")) {
      quote = [];
      saveQuote();
      window.location.reload();
    }
  });

  document.querySelector("#product-search")?.addEventListener("input", () => {
    renderProductResults(products);
  });
  document.querySelector(".catalog-search")?.addEventListener("submit", event => {
    event.preventDefault();
  });

  document.addEventListener("change", event => {
    const input = event.target.closest("[data-quantity]");
    if (!input) return;
    const quantity = Number(input.value);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000000) {
      input.reportValidity();
      return;
    }
    const item = quote.find(entry => entry.slug === input.dataset.quantity);
    if (!item) {
      showNotice("This product is no longer in your enquiry. Please add it again.");
      window.location.reload();
      return;
    }
    item.quantity = quantity;
    saveQuote();
    window.location.reload();
  });

  document.querySelector("#contact-form")?.addEventListener("submit", event => {
    void submitEnquiry(event, "contact-form", "contact-feedback", data => ({
      request_type: "contact",
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone") || null,
      subject: data.get("subject"),
      message: data.get("message"),
      project_details: null,
      items: [],
      consent: data.get("consent") === "on",
      website_url: data.get("website_url"),
    }));
  });

  document.querySelector("#quote-form")?.addEventListener("submit", event => {
    void submitEnquiry(event, "quote-form", "quote-feedback", data => ({
      request_type: "quote",
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone") || null,
      subject: "Product quotation enquiry",
      message: data.get("project") || "Product quotation request.",
      project_details: data.get("project") || null,
      items: quote.map(item => {
        const product = products.find(entry => entry.slug === item.slug);
        return product
          ? {
            slug: item.slug,
            name: product.name,
            category: product.category,
            quantity: item.quantity,
          }
          : null;
      }).filter(Boolean),
      consent: data.get("consent") === "on",
      website_url: data.get("website_url"),
    }));
  });
}

function setPageTitle() {
  const labels = Object.fromEntries(pages.map(item => [item.id, item.label]));
  const titles = {
    home: "Core Metal | Steel, supplied with confidence",
    about: "About us | Core Metal",
    products: "Steel products | Core Metal",
    product: "Product details | Core Metal",
    specifications: "Specifications | Core Metal",
    industries: "Industries | Core Metal",
    careers: "Careers | Core Metal",
    contact: "Contact us | Core Metal",
    quote: "Request a quotation | Core Metal",
    privacy: "Privacy | Core Metal",
  };
  document.title = titles[page] ?? `Core Metal | ${labels[page] || "Steel supply"}`;
}

async function initialise() {
  const mount = document.querySelector("#site");
  if (!mount) return;
  setPageTitle();

  let products = [];
  let companyImages = [];
  if (["home", "about", "products", "product", "specifications", "quote"].includes(page)) {
    try {
      const [productsResponse, imagesResponse] = await Promise.all([
        fetch("assets/products.json"),
        page === "home" || page === "about" ? fetch("assets/company-images.json") : null,
      ]);
      if (!productsResponse.ok) {
        throw new Error(`Could not load the local product catalogue (${productsResponse.status}).`);
      }
      products = await productsResponse.json();
      if (!Array.isArray(products)) {
        throw new Error("The local product catalogue is not in the expected format.");
      }
      if (imagesResponse) {
        if (!imagesResponse.ok) {
          throw new Error(`Could not load the local company photographs (${imagesResponse.status}).`);
        }
        companyImages = await imagesResponse.json();
        if (!Array.isArray(companyImages)) {
          throw new Error("The local company photo catalogue is not in the expected format.");
        }
      }
    } catch (error) {
      console.error("Could not load the local Core Metal catalogue:", error);
      mount.innerHTML = `${header()}<main id="main" class="load-error"><div class="container"><span class="eyebrow">A MOMENT PLEASE</span><h1>We couldn’t load the local product catalogue.</h1><p>${escapeHtml(error.message)}</p><a class="button button-dark" href="contact.html">Contact our team ${icon("arrowUp")}</a><a class="text-action" href="index.html">Return home</a></div></main>${footer()}`;
      attachInteractions(products);
      return;
    }
  }

  const requestedProduct = page === "product"
    ? products.find(item => item.slug === new URLSearchParams(window.location.search).get("item"))
    : null;
  if (requestedProduct) {
    document.title = `${requestedProduct.name} | Steel products | Core Metal`;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = `${requestedProduct.name}: ${requestedProduct.description || "Explore product details from Core Metal L.L.C."} Enquire about grades and sizes in Sharjah, UAE.`;
    }
  }
  const pageContent = {
    home: homePage(products, companyImages),
    about: aboutPage(companyImages),
    products: productsPage(products),
    product: productPage(products, requestedProduct),
    specifications: specificationsPage(products),
    industries: industriesPage(),
    careers: careersPage(),
    contact: contactPage(),
    quote: quotePage(products),
    privacy: privacyPage(),
  }[page] ?? homePage(products, companyImages);

  mount.innerHTML = `${header()}<main id="main">${pageContent}</main>${footer()}`;
  attachInteractions(products);
}

initialise().catch(error => {
  console.error("Could not load the Core Metal website:", error);
  const mount = document.querySelector("#site");
  if (mount) {
    mount.innerHTML = `<main class="load-error"><div class="container"><h1>We couldn’t load this page.</h1><p>${escapeHtml(error.message)}</p><a href="index.html">Return to the homepage</a></div></main>`;
  }
});
