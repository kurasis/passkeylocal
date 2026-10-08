# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-c5e3481.zip](passkeylocal-cloudflare-pages-c5e3481.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`c5e3481a118fd9c50cb2adcb3cc741cacba1ea2a`](https://github.com/kurasis/passkeylocal/commit/c5e3481a118fd9c50cb2adcb3cc741cacba1ea2a), whose application tree equals tested PR source `bbead0731ae5fc1bbb4171e861306c70b5257369`. Shared translations changed for the desktop TPM-binding action; native IPC and File Safe remain absent from this web build. Responsive navigation, restore status, 6 / 12 / 24 hour inactivity choices, Colorful / Light / Dark themes and browser Face ID/passkeys remain available.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 210,513 bytes; SHA-256 `a5a7d447186f855d9770efa40af6bdc53a6d0e315a0320d90875f7b9847f9a5b`. All eight production PWA scenarios passed in [CI 37755898901](https://github.com/kurasis/passkeylocal/actions/runs/37755898901). Verify with `sha256sum -c passkeylocal-cloudflare-pages-c5e3481.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical and do not automatically include later changes.
