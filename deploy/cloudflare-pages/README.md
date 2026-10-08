# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-8d2d95b.zip](passkeylocal-cloudflare-pages-8d2d95b.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`8d2d95b4d074cb37fd6f7c0f78cfa9468a9e9a47`](https://github.com/kurasis/passkeylocal/commit/8d2d95b4d074cb37fd6f7c0f78cfa9468a9e9a47), whose application tree equals tested PR source `9200a4b0bb3d4fc33b9e50fc356cc355b3ff51ae`. Shared translations changed for the desktop recovery test; native IPC and File Safe remain absent from this web build. Existing browser features are preserved.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 215,568 bytes; SHA-256 `0528aec8d4fdb193f17393048e3e1ec99d8f1c4cd04717b749947d101024338b`. All eight production PWA scenarios passed in [CI 37795750725](https://github.com/kurasis/passkeylocal/actions/runs/37795750725). Verify with `sha256sum -c passkeylocal-cloudflare-pages-8d2d95b.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
