# Cloudflare Workers package — application 0.1.7

**Browser-only deployment:** [instructions without installing programs on your PC](BROWSER-DEPLOY.md).
Use Cloudflare's GitHub build integration for the complete app with new icon
downloads. The [separate static-only 0.1.7 ZIP](passkeylocal-cloudflare-workers-static-0.1.7.zip)
fits the dashboard's static upload screen but cannot install the icon endpoint.
The local CLI instructions below are optional, not a prerequisite for hosting.

[Download passkeylocal-cloudflare-workers-0.1.7.zip](https://github.com/kurasis/passkeylocal/raw/refs/heads/main/deploy/cloudflare-workers/passkeylocal-cloudflare-workers-0.1.7.zip).

259,714 bytes; SHA-256
`ad56c459babb6b0156e0c88b5e898a31ef9e07465f46f350ca1bd12d406ab655`.

Use this package if your existing site is a **Worker**, as shown by **Upload
static files to update your Worker** in the dashboard. That screen accepts
static assets only and cannot connect the optional icon endpoint. **This ZIP
must be extracted and deployed with Wrangler; it is not a dashboard-upload ZIP.**

With Node.js 22.12+ installed, open a terminal in the extracted folder:

```sh
npm install
npm run login
npm run deploy -- YOUR_EXISTING_WORKER_NAME
```

Replace the placeholder with the exact existing Worker name. Keep the existing
hostname; moving origins creates separate browser storage. Export and verify
your encrypted backup first. If you have configured other Worker bindings,
routes or triggers, merge them into `wrangler.json` before deployment.
The [included instructions](UPLOAD.md) describe verification and limits.

This is a hosting package for the **existing 0.1.7 release**, not a new app
release. All application, endpoint, service-worker and header bytes come from
the verified Pages 0.1.7 ZIP (SHA-256
`3664ddc9374571438f6cbb44f227cebbdcadd9593681933fb4db41414316830b`).
The Worker module is outside `public/`; Wrangler explicitly connects `ASSETS`
and runs the handler first only for `/api/favicon`. Observability is disabled.

Reproduce from the repository root with `node deploy/cloudflare-workers/package.mjs`
(Node.js and Python required). The script verifies the source ZIP checksum,
copies application bytes, emits deterministic ZIP timestamps and writes a
SHA-256 sidecar. Check with `sha256sum -c passkeylocal-cloudflare-workers-0.1.7.zip.sha256`
in this folder. `source.json` inside the ZIP records source checksum/tool version.

Local Wrangler 4.151.0 dry-run and runtime checks passed for static byte identity,
CSP/cache headers, API method routing, cross-origin rejection and invalid-domain
rejection. The previous connected production build and
[live 0.1.6 probe](cloudflare-check-0.1.6-live.json) confirmed exact 0.1.6
HTML, service-worker and all precache bytes, plus a successful GitHub icon
and canonical Google responses on `passkeylocal.top`.
Display in the owner's browser after applying the app update remains unconfirmed.
See [release evidence](../../docs/RELEASE_EVIDENCE.md). For **Pages**, use the
[separate Pages archive](../cloudflare-pages/).
