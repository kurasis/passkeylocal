# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-241e2b5.zip](passkeylocal-cloudflare-pages-241e2b5.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`241e2b515914089754a1815219eec74b4ad85a36`](https://github.com/kurasis/passkeylocal/commit/241e2b515914089754a1815219eec74b4ad85a36), whose application tree equals tested PR source `cdcc9542b891b808824c1ca7ce471a260ef176b5`. Shared translations/styles changed for the desktop copy test; native IPC and File Safe remain absent from this web build. Existing browser features are preserved.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 214,600 bytes; SHA-256 `78374ea220b914d45a99b827417addf0a7679f177773d546f41e67d413549442`. All eight production PWA scenarios passed in [CI 37783742796](https://github.com/kurasis/passkeylocal/actions/runs/37783742796). Verify with `sha256sum -c passkeylocal-cloudflare-pages-241e2b5.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
