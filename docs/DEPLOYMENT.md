# Deployment

The PWA is a static site. Anything that can serve files over HTTPS with custom
response headers works (for example Cloudflare Pages or Netlify, which read
`_headers`). There is no server-side code and no backend.

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
