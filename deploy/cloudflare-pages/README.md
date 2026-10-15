# Cloudflare Pages upload archives

Latest PWA: **PassKey Local 0.1.3** — [download passkeylocal-cloudflare-pages-0.1.3.zip](passkeylocal-cloudflare-pages-0.1.3.zip) using GitHub **Download raw file**. Upload through Cloudflare Pages **Direct Upload**. This fixes favicon retries after temporary endpoint failures; existing 0.1.2 release assets remain historical.

**Choose Pages, not Workers' static-files uploader.** For an existing Pages site,
open that project → **Create a new deployment**. For a new site, **Workers & Pages**
→ **Create application** → the **Pages / Looking to deploy Pages? Get started**
option → **Drag and drop your files**. If you see **"Pages _routes.json is not
supported"**, check the selected product before removing files. See the
[upload troubleshooting and Pages CLI alternative](../../docs/DEPLOYMENT.md#cloudflare-upload-says-pages-_routesjson-is-not-supported).
Keep your existing hostname when updating; a different origin has separate
browser vault storage. No replacement archive is needed to select Pages.
If your current site is already a **Worker**, use the separate
[Workers package for application 0.1.3](../cloudflare-workers/) instead of
creating another site; that package uses Wrangler to connect the API handler.
For an existing Worker, [browser-only upload/build instructions](../cloudflare-workers/BROWSER-DEPLOY.md)
explain both static ZIP upload and the complete GitHub-connected deployment
without installing anything on the owner's PC.

Archive: 227,766 bytes; SHA-256 `8d72abc0a7c4f0ec9f3366b087561389c9bb87ccf6a552dd00b04a54fc179420`. Verify with `sha256sum -c passkeylocal-cloudflare-pages-0.1.3.zip.sha256`. All 12 entries match verified production output and sit at the ZIP root. Keep `_worker.js` and `_routes.json`: these add the optional same-origin icon endpoint. Cloudflare supports this advanced-mode Worker in dashboard drag-and-drop and Wrangler; no separate service URL/build command is needed. Only `/api/favicon` invokes the endpoint; it uses the hosting account's Functions quota. A host without that endpoint still runs the vault, cached icons and initials.

Enable **Settings → Website icons → Download website icons** explicitly. Website takes priority; otherwise Title must be a bare domain. The setting explains domain disclosure. Cache content is encrypted locally and available offline. See [the exact behavior](../../docs/FAVICONS.md).

Version/title **PassKey Local (0.1.3)**. Built from the current 0.1.3 application source; `python deploy/cloudflare-pages/package.py` packages production output reproducibly. Windows installer/File Safe/native Hello IPC remain separate. [Release 0.1.2](https://github.com/kurasis/passkeylocal/releases/tag/desktop-v0.1.2) and [release evidence](../../docs/RELEASE_EVIDENCE.md).

Use HTTPS and a stable hostname; local vault data and passkeys belong to that origin. Disable Cloudflare Web Analytics/Rocket Loader. [Deployment instructions](../../docs/DEPLOYMENT.md). No direct deployment to a live server was performed. Previous versioned ZIPs remain historical.
