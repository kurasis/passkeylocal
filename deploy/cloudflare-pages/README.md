# Cloudflare Pages upload archives

Download [passkeylocal-cloudflare-pages-582813c.zip](passkeylocal-cloudflare-pages-582813c.zip)
by opening the file on GitHub and choosing **Download raw file** (the download
icon), then upload the ZIP through Cloudflare Pages **Direct Upload**.

This production build comes from source commit
[`582813c`](https://github.com/kurasis/passkeylocal/commit/582813c)
and retains the responsive navigation/layout fix, restore completion, 6 / 12 / 24 hour inactivity choices,
continued auto-lock after changing language, Colorful / Light / Dark themes and
Face ID / passkey unlock. See [design previews](../../docs/DESIGN.md). The archive has `index.html`, `_headers`,
`sw.js`, the manifest, icons and compiled assets at the site root. No build
command or Node.js runtime is needed on the server.

All ten archive files match the current production output byte for byte.
Archive size: 208,644 bytes; SHA-256:
`6324fd41e57729a0b13e638f2bca4b2284b6958e667ef5129bb229b60ad6e47e`.
The eight production PWA e2e scenarios passed for this source, including
passkeys, backup replacement and the 6 / 12 / 24 hour inactivity choices.

The adjacent `.zip.sha256` file contains the archive checksum. To verify a
download with a SHA-256 tool:

```sh
sha256sum -c passkeylocal-cloudflare-pages-582813c.zip.sha256
```

Use HTTPS and a stable hostname; passkeys and local vault data belong to that
origin. Turn off Cloudflare Web Analytics and Rocket Loader, and enable
**Always Use HTTPS**. See [deployment instructions](../../docs/DEPLOYMENT.md)
for security headers, updates and domain migration.

Native Windows Hello PRF/protected-key diagnostics and the encrypted File Safe are Windows desktop features; they are not loaded by this web build. Its storage/recovery documentation is in [the operating guide](../../docs/file-safe/OPERATING_GUIDE.md). The Windows installer is distributed separately through the Windows Actions workflow; do not upload an `.exe` to Cloudflare Pages.

These are versioned build artifacts. After changing application code, build
again and add a new archive named for its source commit; an older archive does
not automatically include later changes.
