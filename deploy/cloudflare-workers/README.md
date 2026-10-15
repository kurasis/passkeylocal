# Cloudflare Workers package — application 0.1.3

**Browser-only deployment:** [instructions without installing programs on your PC](BROWSER-DEPLOY.md).
Use Cloudflare's GitHub build integration for the complete app with new icon
downloads. The [separate static-only 0.1.3 ZIP](passkeylocal-cloudflare-workers-static-0.1.3.zip)
fits the dashboard's static upload screen but cannot install the icon endpoint.
The local CLI instructions below are optional, not a prerequisite for hosting.

[Download passkeylocal-cloudflare-workers-0.1.3.zip](https://github.com/kurasis/passkeylocal/raw/refs/heads/main/deploy/cloudflare-workers/passkeylocal-cloudflare-workers-0.1.3.zip).

230,987 bytes; SHA-256
`189f19f5efb8e44394ec0e5c286a8039cc521f02acc8f475f14f8eed2ee4896e`.

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

This is a hosting package for the **existing 0.1.3 release**, not a new app
release. All application, endpoint, service-worker and header bytes come from
the verified Pages 0.1.3 ZIP (SHA-256
`8d72abc0a7c4f0ec9f3366b087561389c9bb87ccf6a552dd00b04a54fc179420`).
The Worker module is outside `public/`; Wrangler explicitly connects `ASSETS`
and runs the handler first only for `/api/favicon`. Observability is disabled.

Reproduce from the repository root with `node deploy/cloudflare-workers/package.mjs`
(Node.js and Python required). The script verifies the source ZIP checksum,
copies application bytes, emits deterministic ZIP timestamps and writes a
SHA-256 sidecar. Check with `sha256sum -c passkeylocal-cloudflare-workers-0.1.3.zip.sha256`
in this folder. `source.json` inside the ZIP records source checksum/tool version.

Local Wrangler 4.151.0 dry-run and runtime checks passed for static byte identity,
CSP/cache headers, API method routing, cross-origin rejection and invalid-domain
rejection. No deployment to the owner's Cloudflare account was performed.
See [release evidence](../../docs/RELEASE_EVIDENCE.md). For **Pages**, use the
[separate Pages archive](../cloudflare-pages/).
