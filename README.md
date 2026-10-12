# Core Metal website

A responsive, multi-page website for Core Metal L.L.C. It is plain HTML, CSS
and JavaScript. Render hosts the static pages and locally stored product
photographs. Supabase stores website enquiries through a protected Edge Function.
The public site contains neither the Supabase service-role key nor a database
credential.

## Preview

To run the source files locally:

```powershell
node scripts/preview-server.mjs
```

Visit [http://127.0.0.1:4173](http://127.0.0.1:4173) and stop the server with
**Ctrl+C**. Before testing submissions, add `http://127.0.0.1:4173` to the
Edge Function's `ALLOWED_ORIGINS` secret. To build a configured local copy,
set `COREMETAL_SUPABASE_FUNCTION_URL` to your public function URL and run
`node scripts/build-static-site.mjs`. The unconfigured development version
deliberately warns and does **not** claim that an enquiry was submitted.

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
catalogue images current, run the asset-download command above and include the
resulting local assets in the next commit.

## Supabase setup

1. The website is configured for the Coremetal project
   (`fjdshfvngnlssdhtfgoq`). Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Link the repository to your project and apply the private enquiries schema:

   ```powershell
   npx supabase login
   npx supabase link --project-ref fjdshfvngnlssdhtfgoq
   npx supabase db push
   ```

3. Allow **only the final Render site origin** to submit enquiries. For a
   Render domain, this is `https://YOUR_SERVICE.onrender.com`. Add your
   production custom domain if you use one; add the local origin only during
   local development. Generate a random 32-byte secret using Node.js:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   In **Supabase Dashboard → Edge Functions → Secrets**, set `RATE_LIMIT_SECRET`
   to the generated value and `ALLOWED_ORIGINS` to the comma-separated allowed
   origin list. Never put either secret in the website, this repository,
   Render's public build output or a support message. Use a secret with at
   least 32 characters.

4. Deploy the enquiry function:

   ```powershell
   npx supabase functions deploy submit-enquiry
   ```

The function uses Supabase's injected `SUPABASE_URL` and the server-only
`SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS` environment values. The
migration enables row-level security, denies public table access and grants
the database submission function to `service_role` only. It also rate-limits
submissions per one-way, secret-keyed hash of the proxy-provided client IP and
prunes expired rate limit records. The Edge Function fails closed if the
trusted proxy does not provide a client IP.

## Render setup

1. Push the site to your Git repository and in Render choose **New → Blueprint**,
   then connect the repository. The root [render.yaml](render.yaml) declares
   the static site, runs the Node.js build script and publishes only `dist/`.
2. The Blueprint configures the public Supabase enquiry-function endpoint for
   the site build. No Supabase database key or password belongs in Render's
   environment or website files.
3. Deploy the site and include its final `https://YOUR_SERVICE.onrender.com`
   origin in Supabase's `ALLOWED_ORIGINS`. If you change the domain, update
   that secret before accepting enquiries.

The build **fails** if the Supabase function URL is missing or malformed,
instead of silently deploying a contact form that loses enquiries.

## Data protection and enquiry flow

The contact, careers and product-quote forms all submit to the same Supabase
function. Contact enquiries are stored as contact records; product quotations
include product slugs, names, categories and quantities. Forms require explicit
consent. The database is not publicly readable, submissions are validated and
size-limited, website origins are allowlisted and repeat submissions are
rate-limited. The function has no JWT requirement because this static website
has no visitor accounts; protection comes from the origin allowlist, server-
side validation and rate limiting. A hidden honeypot field is also checked.

The website's local product-selection list stays in the visitor's browser
until the enquiry is successfully submitted. On submission, contact details
and enquiry details are sent to Supabase so Core Metal can respond; the form
shows an explicit error if the database cannot confirm that it saved them.
There is no email-program or unrecorded-submit fallback.

Only the Render build receives the public Edge Function **URL**. The Supabase
service-role key and rate-limit secret stay in the Supabase Edge Function's
environment and never enter the static files.
