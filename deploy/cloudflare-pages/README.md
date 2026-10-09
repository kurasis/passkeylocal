# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-58084c4.zip](passkeylocal-cloudflare-pages-58084c4.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`58084c47377d17e634a0d1839baf7cff24a96d46`](https://github.com/kurasis/passkeylocal/commit/58084c47377d17e634a0d1839baf7cff24a96d46), whose application tree equals tested PR source `5369fadd0dc35c03cb568125cae7c444ec9e8472`. Native Windows Hello enrollment/IPC and File Safe remain absent from this web build. Existing browser features are preserved.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 217,566 bytes; SHA-256 `ebf4fe5dc264712fde436356535c74350fbf8c94130c954cd259b46d0dc78459`. All eight production PWA scenarios passed in [CI 37893262472](https://github.com/kurasis/passkeylocal/actions/runs/37893262472). Verify with `sha256sum -c passkeylocal-cloudflare-pages-58084c4.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
