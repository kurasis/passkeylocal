# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-bd35939.zip](passkeylocal-cloudflare-pages-bd35939.zip) using GitHub **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

Production source: [`bd359391d4a42a42fd3b0dbdec8e7af128972522`](https://github.com/kurasis/passkeylocal/commit/bd359391d4a42a42fd3b0dbdec8e7af128972522), whose application tree equals tested PR source `98a714b4335cb91fed752ad1d4880601f8eb39a5`. Native Windows Hello enrollment/IPC and File Safe remain absent from this web build. Existing browser features are preserved.

All ten ZIP files equal freshly rebuilt production output. Site-root contents include index, security headers, service worker, manifest, icons and compiled assets. No Node.js or server build command is required. Archive: 218,995 bytes; SHA-256 `309b5dd3d4cd2bf5e1405cf4a97584f447eb46c493c424e1e5f9e2677badf6cc`. All eight production PWA scenarios passed in [CI 37936825771](https://github.com/kurasis/passkeylocal/actions/runs/37936825771). Verify with `sha256sum -c passkeylocal-cloudflare-pages-bd35939.zip.sha256`.

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md). No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is separate; do not upload an EXE to Pages. Previous versioned ZIPs remain historical.
