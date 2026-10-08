# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-536e5f7.zip](passkeylocal-cloudflare-pages-536e5f7.zip) by opening the file on GitHub and choosing **Download raw file**, then upload the ZIP through Cloudflare Pages **Direct Upload**.

This production build comes from merged source [`536e5f7d0be4de4d27a8f2066b1a9db17fbad05a`](https://github.com/kurasis/passkeylocal/commit/536e5f7d0be4de4d27a8f2066b1a9db17fbad05a), whose application tree equals tested PR source `bdb2a034e15f483dcbaadb29781234248a26dfed`. It retains responsive navigation, restore completion, 6 / 12 / 24 hour inactivity choices, language-change auto-lock, Colorful / Light / Dark themes and Face ID / passkey unlock. See [design previews](../../docs/DESIGN.md). The latest change adds shared translations for the desktop-only Windows Hello attestation action; native IPC and File Safe remain absent from this web bundle.

All ten archive files match the freshly rebuilt production output byte for byte. The archive contains `index.html`, `_headers`, `sw.js`, manifest, icons and compiled assets at the site root. No build command or Node.js runtime is needed on the server.

Archive size: 210,033 bytes; SHA-256: `2ec7eada082d614c6d9c11e33d004cfb0a98061e137644efe28202da899cc627`. All eight production PWA scenarios passed in [CI 37745006594](https://github.com/kurasis/passkeylocal/actions/runs/37745006594).

The adjacent `.zip.sha256` file contains the checksum:

```sh
sha256sum -c passkeylocal-cloudflare-pages-536e5f7.zip.sha256
```

Use HTTPS and a stable hostname; passkeys and local vault data belong to that origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable **Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md) for security headers, updates and domain migration. No direct server deployment was performed.

The [Windows installer](../windows-desktop/) is distributed separately through Actions. Do not upload an `.exe` to Cloudflare Pages. [File Safe operating guide](../../docs/file-safe/OPERATING_GUIDE.md).

[Previous dcd058a archive](passkeylocal-cloudflare-pages-dcd058a.zip) remains historical. These versioned artifacts do not automatically include later application changes; rebuild and publish a new source-named archive after future code changes.
