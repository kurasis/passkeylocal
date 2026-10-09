# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-e63a285.zip](passkeylocal-cloudflare-pages-e63a285.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`e63a2859b9f6757603f63a73a5e1e7b474a8826c`](https://github.com/kurasis/passkeylocal/commit/e63a2859b9f6757603f63a73a5e1e7b474a8826c), whose application tree equals tested PR source `db201b1edae9dbee69bcd38e54ffc1ba97d8833d`. Native Windows Hello enrollment/IPC and File Safe remain absent from this web build. Existing browser features are preserved.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 218,294 bytes; SHA-256 `e514033b6d390ebb52a73e2dc2e09dd283474c0862bdafa124984cef3707206c`. All eight production PWA scenarios passed in [CI 37911616095](https://github.com/kurasis/passkeylocal/actions/runs/37911616095). Verify with `sha256sum -c passkeylocal-cloudflare-pages-e63a285.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
