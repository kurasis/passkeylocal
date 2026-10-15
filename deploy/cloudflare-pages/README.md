# Cloudflare Pages upload archives

Latest: **PassKey Local 0.1.2** — [download passkeylocal-cloudflare-pages-0.1.2.zip](passkeylocal-cloudflare-pages-0.1.2.zip) using GitHub **Download raw file**, or [download from release](https://github.com/kurasis/passkeylocal/releases/download/desktop-v0.1.2/passkeylocal-cloudflare-pages-0.1.2.zip). Upload through Cloudflare Pages **Direct Upload**.

Archive: 226,982 bytes; SHA-256 `1ec5828b25574df4daf07f375d41a6fe6b8908822779bc74a43af272acad7429`. Verify with `sha256sum -c passkeylocal-cloudflare-pages-0.1.2.zip.sha256`. All 12 entries match verified production output and sit at the ZIP root. Keep `_worker.js` and `_routes.json`: these add the optional same-origin icon endpoint. Cloudflare supports this advanced-mode Worker in dashboard drag-and-drop and Wrangler; no separate service URL/build command is needed. Only `/api/favicon` invokes the endpoint; it uses the hosting account's Functions quota. A host without that endpoint still runs the vault, cached icons and initials.

Enable **Settings → Website icons → Download website icons** explicitly. Website takes priority; otherwise Title must be a bare domain. The setting explains domain disclosure. Cache content is encrypted locally and available offline. See [the exact behavior](../../docs/FAVICONS.md).

Source: `12bf0ec38f98283a8f65bd3e5bbd975187a23aca`; version/title **PassKey Local (0.1.2)**. Windows installer/File Safe/native Hello IPC remain separate. [Release 0.1.2](https://github.com/kurasis/passkeylocal/releases/tag/desktop-v0.1.2) and [release evidence](../../docs/RELEASE_EVIDENCE.md).

Use HTTPS and a stable hostname; local vault data and passkeys belong to that origin. Disable Cloudflare Web Analytics/Rocket Loader. [Deployment instructions](../../docs/DEPLOYMENT.md). No direct deployment to a live server was performed. Previous versioned ZIPs remain historical.
