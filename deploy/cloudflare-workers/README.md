# Cloudflare Workers package — application 0.1.2

[Download passkeylocal-cloudflare-workers-0.1.2.zip](https://github.com/kurasis/passkeylocal/raw/refs/heads/main/deploy/cloudflare-workers/passkeylocal-cloudflare-workers-0.1.2.zip).

230,823 bytes; SHA-256
`6336f8beabbfbc7173136df263e6e5b9211ddc6be7258b6bf766b121068cd4ee`.

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

This is a hosting package for the **existing 0.1.2 release**, not a new app
release. All application, endpoint, service-worker and header bytes come from
the verified Pages 0.1.2 ZIP (SHA-256
`1ec5828b25574df4daf07f375d41a6fe6b8908822779bc74a43af272acad7429`).
The Worker module is outside `public/`; Wrangler explicitly connects `ASSETS`
and runs the handler first only for `/api/favicon`. Observability is disabled.

Reproduce from the repository root with `node deploy/cloudflare-workers/package.mjs`
(Node.js and Python required). The script verifies the source ZIP checksum,
copies application bytes, emits deterministic ZIP timestamps and writes a
SHA-256 sidecar. Check with `sha256sum -c passkeylocal-cloudflare-workers-0.1.2.zip.sha256`
in this folder. `source.json` inside the ZIP records source checksum/tool version.

Local Wrangler 4.151.0 dry-run and runtime checks passed for static byte identity,
CSP/cache headers, API method routing, cross-origin rejection and invalid-domain
rejection. No deployment to the owner's Cloudflare account was performed.
See [release evidence](../../docs/RELEASE_EVIDENCE.md). For **Pages**, use the
[separate Pages archive](../cloudflare-pages/).
