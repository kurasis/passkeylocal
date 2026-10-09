# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-5afdfa2.zip](passkeylocal-cloudflare-pages-5afdfa2.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`5afdfa27839e49a4ba3c9cf7418b45f0251f97ac`](https://github.com/kurasis/passkeylocal/commit/5afdfa27839e49a4ba3c9cf7418b45f0251f97ac), whose application tree equals tested PR source `69eee39f6908ef26dc80b635d865f6a1624323d6`. Native Windows Hello enrollment/IPC and File Safe remain absent from this web build. Existing browser features are preserved.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 218,828 bytes; SHA-256 `0db4906f5b46e9fcba222d599e99bbc047549ed81144654ca58af0c7b108ee42`. All eight production PWA scenarios passed in [CI 37928379128](https://github.com/kurasis/passkeylocal/actions/runs/37928379128). Verify with `sha256sum -c passkeylocal-cloudflare-pages-5afdfa2.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
