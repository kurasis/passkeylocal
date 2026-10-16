# Deployment

The vault PWA is a static site. Anything that can serve files over HTTPS with
custom response headers works (for example Cloudflare Pages or Netlify, which
read `_headers`). Optional website icon downloads added in 0.1.2 use a separate
same-origin endpoint; the distributed ZIP includes its Cloudflare Pages handler.
The vault itself needs no backend or account.

## Requirements

- **A dedicated origin.** Use a hostname that serves nothing else: no blog, CMS,
  uploads or other apps. Paths on one origin are not separate security
  boundaries, and the vault's IndexedDB belongs to the origin.
- **HTTPS** with HSTS. Service workers, WebCrypto and installation require a
  secure context.
- **The response headers in `apps/pwa/public/_headers`**, applied to every
  response, including `sw.js` and the worker script. They set the CSP from the
  security specification (`script-src 'self' 'wasm-unsafe-eval'`, no inline
  script or style, `connect-src 'self'`), `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`, a restrictive `Permissions-Policy`, and
  caching rules (`/`, `index.html` and `sw.js` revalidate, hashed assets are
  immutable).
- **Correct MIME types**: `text/javascript` for `.js`, `application/manifest+json`
  for the manifest.

## Build and publish

```sh
npm ci
npm run build -w @passkey-local/pwa
# publish apps/pwa/dist/ (it contains index.html, assets/, icons/, sw.js, manifest, _headers)
```

`scripts/serve.mjs` serves `dist/` with the same header rules and is what the
browser tests use. After publishing, check the real responses, not the dev
server:

```sh
curl -sI https://vault.example/ | grep -iE 'content-security-policy|referrer-policy|x-content-type-options|permissions-policy'
curl -sI https://vault.example/sw.js | grep -iE 'content-type|cache-control'
```

The app shell is requested and cached as `/`, never `/index.html`. Cloudflare
Pages answers `/index.html` with a 308 redirect to `/`; `scripts/serve.mjs`
emulates that redirect so the browser tests cover it.
On Cloudflare, also turn off zone features that inject scripts into pages
(Web Analytics beacon, Rocket Loader, Email Obfuscation, Zaraz, JS challenges):
the CSP blocks them, and none belongs next to a vault. Web Analytics on a
Pages project is switched on per project (Pages project, Metrics). Also enable
"Always Use HTTPS" (SSL/TLS, Edge Certificates) so plain HTTP redirects.

To run the browser tests against the deployed site instead of the local server:

```sh
cd apps/pwa
E2E_BASE_URL=https://passkeylocal.top npx playwright test
```

The analytics beacon is only injected into responses for browsers
(`Accept: text/html`), so a plain `curl` of `/` can match the build while the
e2e still reports a CSP violation.

## Updates

Each build produces a new `sw.js` whose precache list names every asset and
whose version is derived from their contents. A browser fetches it on its own
schedule; the new version installs in the background only if every asset can be
cached, then waits. The app shows "An app update is available" on the locked
screen, and the update is applied only when the user taps "Update now". Old
asset caches are deleted only after the new version is active. Updates never
touch IndexedDB.

From 0.1.4 the locked screen also has **Check for updates**, with progress,
current-version and actionable failure messages. Discovery handles an existing
installing/waiting worker and late registration, and rechecks on return/online
without reloading an unlocked editor. Applying is still explicit and locked.
If an older cached interface never shows the offer, desktop Chrome/Edge can
use Ctrl+Shift+R once to load the current page; closing all site/PWA windows
also releases an old worker. Neither recovery path requires deleting site data.
See [0.1.4 recovery instructions](releases/0.1.4.md). Native EXE updates are
separate from publishing the PWA.

A user-confirmed update does not make a hostile host trustworthy: whoever
controls the origin can ship different code. Protect the hosting account, DNS
and build credentials, review release diffs, and keep encrypted backup files
plus the offline recovery kit independent of the website.

## Moving to a different domain

A new domain is a new origin with empty storage. Migrate by exporting an
encrypted backup on the old site, opening the new site, and choosing "Restore
from a backup file". Nothing moves automatically.

## What must not be deployed

No analytics, error reporting, remote fonts, CDNs, or remote configuration.
Production builds contain no demo data or debug endpoints.


## Optional website icons (0.1.2)

The production Pages ZIP includes `_worker.js` and `_routes.json` for the
same-origin `/api/favicon` endpoint. Keep both files when uploading. Cloudflare
Pages supports advanced-mode `_worker.js` for dashboard drag-and-drop and Wrangler;
no separate Worker URL, account for the application, or external icon directory
is required. Only that route invokes a Function; static assets retain their
normal headers and service-worker behavior. Functions use the host's request
quota. A plain static server without the endpoint still supports the entire
vault, cached icons and generated initials, but cannot download new icons.
See [website icons](FAVICONS.md) for privacy, supported formats and verification
limits. The application does not automatically deploy this code to a live host.

## Cloudflare upload says "Pages _routes.json is not supported"

The **0.1.2** archive is a **Pages** deployment, not a Workers static-assets
upload. This warning is a reason to check which product's uploader is open;
it is not evidence that the JSON is malformed. Pages and Workers share the
**Workers & Pages** dashboard area but have different deployment formats.

If the heading says **Upload static files to update your Worker**, the existing
project is a Worker. To preserve its address, use the separate
[Workers package for application 0.1.2](../deploy/cloudflare-workers/), extract
it and follow its Wrangler instructions. The static-only dashboard uploader
cannot install the executable favicon handler. No migration to Pages is needed
for an existing Worker.
For a browser-only workflow, use the [static upload or Cloudflare-hosted GitHub
build instructions](../deploy/cloudflare-workers/BROWSER-DEPLOY.md). Local
Node.js/Wrangler installation is optional. Static upload alone does not install
the favicon endpoint; the complete hosted build does.

For an existing Pages site, open that project and choose **Create a new
deployment**, then upload `passkeylocal-cloudflare-pages-0.1.2.zip`. Keep the
existing hostname. For a new site, use **Create application**, select the
**Pages** option (the dashboard may label its link **Looking to deploy Pages?
Get started**), then **Drag and drop your files** / **Direct Upload** and
**Deploy site**. Do not choose the Workers **Upload your static files** flow.
An existing Git-integrated Pages project uses its Git workflow or Wrangler;
Cloudflare does not support dashboard drag-and-drop for that project type.

Keep `_worker.js`, `_routes.json` and `_headers` at the ZIP root alongside
`index.html`. Do not remove metadata merely to silence the warning. Removing
`_routes.json` loses the restriction that only `/api/favicon` invokes a
Function. Uploading `_worker.js` as an ordinary Workers asset does not connect
the executable endpoint. Moving to Workers requires an explicit script entry,
assets binding and routing configuration; it is a separate deployment change.

If the **Pages** uploader still rejects the complete archive, use Pages'
documented CLI path instead. Extract the ZIP into a directory first (Wrangler
does not accept a ZIP). From that directory, with Node/npm installed:

```sh
npx wrangler@4 login
npx wrangler@4 pages deploy . --project-name YOUR_EXISTING_PAGES_PROJECT --branch main
```

Replace the project name and use the project's actual production branch.
These are deployment instructions, not a command executed against the owner's
account during development. Do not delete an existing project or change its
hostname to work around an uploader error: browser vault storage belongs to
the origin. Export and verify an encrypted backup before any deliberate move.

After deployment, check the real response headers as described above and test
opt-in icon loading in the browser. A `GET /api/favicon` should return **405**
with `Allow: POST` and `Cache-Control: no-store`; HTML or a static JavaScript
file at that URL indicates the endpoint is not connected. This method check
alone does not prove a successful upstream icon download.

Sources: [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/),
[Pages invocation routes](https://developers.cloudflare.com/pages/functions/routing/#functions-invocation-routes),
and [migration from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).
