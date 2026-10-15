# Cloudflare Pages upload archives

Latest: **PassKey Local 0.1.1** — [download passkeylocal-cloudflare-pages-0.1.1.zip](passkeylocal-cloudflare-pages-0.1.1.zip) using GitHub **Download raw file**, or [download from release](https://github.com/kurasis/passkeylocal/releases/download/desktop-v0.1.1/passkeylocal-cloudflare-pages-0.1.1.zip). Upload through Cloudflare Pages **Direct Upload**.

Archive: 220,762 bytes; SHA-256 `1a34d313fb61fa0eb88f79c9593697b9afbbe7920a7c58c078ac6d80f85b6ba7`. Verify with `sha256sum -c passkeylocal-cloudflare-pages-0.1.1.zip.sha256`. All ten entries match validated production output; index, security headers, service worker, manifest, icons and compiled assets are at the ZIP root. No Node.js/server build command is needed.

Source: `29a045fa7fa2cb0dc04ffc9beef3c8fda187ea1d`. Version 0.1.1 includes all prior web UI fixes and displays `PassKey Local (0.1.1)` in the browser title. The independent Windows installer/File Safe/native Hello IPC are separate from this web output. [Release 0.1.1](https://github.com/kurasis/passkeylocal/releases/tag/desktop-v0.1.1) and [release evidence](../../docs/RELEASE_EVIDENCE.md).

Use HTTPS and a stable hostname; local data and passkeys belong to that origin. Disable Cloudflare Web Analytics/Rocket Loader and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed. Previous versioned ZIPs remain historical.
