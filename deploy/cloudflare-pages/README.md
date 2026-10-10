# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-666c2d7.zip](passkeylocal-cloudflare-pages-666c2d7.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`666c2d79e7fc44cd9e3db4d2ba880b4c7bed37f5`](https://github.com/kurasis/passkeylocal/commit/666c2d79e7fc44cd9e3db4d2ba880b4c7bed37f5). This includes the shared UI audit fixes: guarded entry drafts, private browser history, public section links, accessible form errors, pointer-aware autofocus and matching theme-color. Native Windows Hello enrollment/IPC and File Safe remain absent from this web build.

All ten ZIP entries equal the locally validated production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 220,760 bytes; SHA-256 `5032c9df81a6de53910d71f9de90e5f0658c4defb153518f9770b9f330c9779c`. Ten production browser scenarios and 71 isolated desktop UI scenarios passed in [CI 38047856360](https://github.com/kurasis/passkeylocal/actions/runs/38047856360). Verify with `sha256sum -c passkeylocal-cloudflare-pages-666c2d7.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
