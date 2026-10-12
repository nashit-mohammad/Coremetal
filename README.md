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
**Ctrl+C**. To build a configured local copy, set both
`COREMETAL_SUPABASE_FUNCTION_URL` and `COREMETAL_DASHBOARD_FUNCTION_URL` to
the public URLs of their respective Edge Functions, then run
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
- `staff.html` — private staff sign-in, enquiry management and administrator tools

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
2. Link the repository to your project and apply the private enquiries and
   staff-dashboard migrations:

   ```powershell
   npx supabase login
   npx supabase link --project-ref fjdshfvngnlssdhtfgoq
   ```

   Check the remote migration history before pushing:

   ```powershell
   npx supabase migration list
   ```

   The original enquiries migration may already have been applied in the
   Supabase dashboard rather than through the CLI. If `20261012000000` appears
   pending **and** you have confirmed its enquiries tables and function are
   already present, register that migration as applied before pushing:

   ```powershell
   npx supabase migration repair --status applied 20261012000000
   ```

   Do not mark it applied if the original migration has not actually run. Once
   the history matches the database, apply pending migrations:

   ```powershell
   npx supabase db push
   ```

3. Allow **only the final Render site origin** to use the enquiry and staff
   functions. For a Render domain, this is `https://YOUR_SERVICE.onrender.com`.
   Add your production custom domain if you use one. Generate random secrets
   using Node.js:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   In **Supabase Dashboard → Edge Functions → Secrets**, set:

   - `RATE_LIMIT_SECRET` to a random value of at least 32 characters.
   - `ALLOWED_ORIGINS` to the comma-separated, exact website origins.
   - `DASHBOARD_BOOTSTRAP_SECRET` to a separate random value of at least 32
     characters. Keep it private and enter it only once on the dashboard's
     initial setup page.
   - `DASHBOARD_ADMIN_EMAILS` to the comma-separated email addresses of the
     three initial administrators. These must match the three addresses
     provided for Core Metal's initial admin accounts.

   Never put a secret in the website, this repository, Render's public build
   output or a support message.

4. Deploy both Edge Functions:

   ```powershell
   npx supabase functions deploy submit-enquiry
   npx supabase functions deploy coremetal-dashboard
   ```

Apply the new migration before deploying the dashboard function. The staff
dashboard intentionally uses its own administrator-provisioned password
accounts, not Supabase Auth. Passwords are bcrypt-hashed in Postgres; public
sign-up is unavailable. The initial bootstrap secret and administrator-email
list are used only to create the three initial administrators and should be
removed from Edge Function secrets after setup. Each initial administrator
chooses an initial password during setup and must change it at first sign-in.

Administrators can create staff/admin accounts, set or reset initial passwords
and disable access. Newly created or reset accounts must change the initial
password at first sign-in. Staff may review every enquiry and set its status
to Open, Contacted or Closed. Status changes are recorded with the acting
staff account. Passwords must be 14–72 characters; temporary passwords should
be shared privately and not sent in the dashboard or by email. Staff sessions
expire after 12 hours, are held only in the current browser tab, and are
revoked when an account is disabled or its password is reset.

All staff APIs validate hashed random session tokens server-side. The enquiry,
user, session, rate-limit and status-history tables have row-level security
enabled; direct access and dashboard database functions are revoked from
`anon` and `authenticated`. Only the Edge Function's server-side key can call
the narrowly scoped database functions. Sign-in attempts are rate-limited by
both account and network. Do not expose the Supabase service-role/secret key.

## Render setup

1. Push the site to your Git repository and in Render choose **New → Blueprint**,
   then connect the repository. The root [render.yaml](render.yaml) declares
   the static site, runs the Node.js build script and publishes only `dist/`.
2. The Blueprint configures the public Supabase enquiry and dashboard-function
   endpoints for the site build. No Supabase database key, dashboard password
   or bootstrap secret belongs in Render's environment or website files.
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

The enquiry dashboard is at `/staff.html`. It is not linked in the public
navigation and has a `noindex` directive, but its privacy does not depend on
the URL being secret: every enquiry read and update requires an active,
authorized staff account. The first-setup page works only once and requires
the separate bootstrap secret plus all three configured administrator
addresses. Remove `DASHBOARD_BOOTSTRAP_SECRET` and `DASHBOARD_ADMIN_EMAILS`
after the administrators have been created.
