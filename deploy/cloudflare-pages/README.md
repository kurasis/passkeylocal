# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-02c0d06.zip](passkeylocal-cloudflare-pages-02c0d06.zip)
by opening the file on GitHub and choosing **Download raw file** (the download
icon), then upload the ZIP through Cloudflare Pages **Direct Upload**.

This production build comes from source commit
[`02c0d06`](https://github.com/kurasis/passkeylocal/commit/02c0d069adc35a7c344c90f5a798797b7c048d62)
and includes Face ID / passkey unlock. The archive has `index.html`, `_headers`,
`sw.js`, the manifest, icons and compiled assets at the site root. No build
command or Node.js runtime is needed on the server.

The adjacent `.zip.sha256` file contains the archive checksum. To verify a
download with a SHA-256 tool:

```sh
sha256sum -c passkeylocal-cloudflare-pages-02c0d06.zip.sha256
```

Use HTTPS and a stable hostname; passkeys and local vault data belong to that
origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable
**Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md)
for security headers, updates and domain migration.

These are versioned build artifacts. After changing application code, build
again and add a new archive named for its source commit; an older archive does
not automatically include later changes.
