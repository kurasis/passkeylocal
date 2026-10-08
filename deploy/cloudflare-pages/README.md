# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-cedae01.zip](passkeylocal-cloudflare-pages-cedae01.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`cedae01de4a19b8810c4bf6a3a0bbc9d3323f170`](https://github.com/kurasis/passkeylocal/commit/cedae01de4a19b8810c4bf6a3a0bbc9d3323f170), whose application tree equals tested PR source `a7f56d80d6029bcd4185ca6d3ad22d08f957561a`. Shared translations changed for the new desktop Hello test; native IPC and File Safe remain absent from this web build. Responsive navigation, restore status, 6 / 12 / 24 hour inactivity choices, Colorful / Light / Dark themes and browser Face ID/passkeys remain available.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 212,202 bytes; SHA-256 `2d91e4089a647ce117688f98c065d04bc2c484c36975917693c6e202eaead045`. All eight production PWA scenarios passed in [CI 37764316873](https://github.com/kurasis/passkeylocal/actions/runs/37764316873). Verify with `sha256sum -c passkeylocal-cloudflare-pages-cedae01.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical and do not automatically include later changes.
