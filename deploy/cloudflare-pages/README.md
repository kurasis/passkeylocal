# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-0eb2a19.zip](passkeylocal-cloudflare-pages-0eb2a19.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`0eb2a195a15567bba124fc0cd2591a5028b5ac50`](https://github.com/kurasis/passkeylocal/commit/0eb2a195a15567bba124fc0cd2591a5028b5ac50), whose application tree equals tested PR source `4b3ba340f684fc6adefc5b5e2a2e0295add18249`. Shared translations changed for the desktop key-loss test; native IPC and File Safe remain absent from this web build. Existing browser features are preserved.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 213,004 bytes; SHA-256 `bc357044cde261cefa8db26e46eb34cdab3168e81f5be5e1d5f23012c90fd967`. All eight production PWA scenarios passed in [CI 37773038077](https://github.com/kurasis/passkeylocal/actions/runs/37773038077). Verify with `sha256sum -c passkeylocal-cloudflare-pages-0eb2a19.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
