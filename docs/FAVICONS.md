# Optional Website Icons

Implemented for application 0.1.2 at the owner's explicit request on 2026-10-15.
This narrows the original no-favicon/no-network policy; vault encryption,
interchange limits, independent recovery and offline operation remain unchanged.

## User Experience

Settings → Website icons → Download website icons is off by default. The same
localized control works in Windows, the browser and an installed PWA. The
control explains domain disclosure before enabling it. Disable removes the
local cache and stops loading. Clear downloaded icons removes cached hits and
misses; reopening the list downloads them again. It does not delete entries.

Website takes priority whenever nonempty, including when it is invalid. An
invalid Website does not cause a guessed fallback to Title. If Website is empty,
Title must be a bare domain. Normalize case and international domains through
URL hostname processing. Accept HTTP/HTTPS Websites, but request icons only
through HTTPS on the default port. Strip paths, ports, queries and fragments;
reject embedded credentials, other schemes, IP literals, local/reserved suffixes,
backslashes and malformed domains. A title such as `GitHub work` is not a domain.
Subdomains remain distinct; do not guess a registrable parent or remove `www`.

Fetch only fixed `/favicon.ico` and `/apple-touch-icon.png` paths, without
following redirects. Do not read website HTML, execute scripts, scrape login
pages or use Google/DuckDuckGo/other logo directories. Bounded PNG and ICO
rasters are supported; SVG, JPEG, WebP, oversized or invalid images retain
generated initials. Valid images are rasterized to a 32 × 32 PNG before caching.
This deliberately does not promise an icon for every site.

List loading observes nearby visible rows, deduplicates domains, allows three
concurrent loads and aborts browser requests when leaving the list or locking.
Image URLs are local Blob URLs, revoked on replacement/unmount. Images are
fixed-size decorative companions to the existing visible entry text. Failures
keep the initial without interrupting editing, search or unlocking.

## Encrypted Disposable Cache

The first explicit enable for a vault commits a random 256-bit key in encrypted
KDBX Meta/CustomData under `LocalVault.FaviconCacheKey`. This is ordinary supported
text custom data, not an attachment/custom binary icon or a format change. It
creates one vault revision and therefore makes the current backup out of date.
It creates no entry history. Downloads, expiry and cache deletion create no vault
revision. An imported/older vault without the key shows the setting off until an
explicit enable; merely unlocking or opening a list never changes its KDBX.

The crypto worker uses this random key with Web Crypto AES-256-GCM, a fresh
96-bit IV per write and the version-specific AAD `PassKey Local favicon cache v1`.
Neither the master password nor a fast password-derived hash is a cache key.
An auxiliary preference contains only version, an opaque SHA-256 key identifier,
IV and ciphertext, encoded as base64. The authenticated plaintext contains
domains, timestamps, misses and icon bytes. No plaintext domains/icon bytes are
stored in IndexedDB, native state JSON, Web Storage or Cache Storage.

The cache is bounded to 64 rows and 64 KiB of serialized plaintext; oldest rows
are evicted. The envelope stays within the native metadata size ceiling. Writes
are serialized, recheck consent/session liveness, and use the current generation
check. Lock terminates the crypto worker; UI epoch checks discard late results.
A damaged cache is disposable and cannot block vault recovery. Another vault
key cannot open it. A copied KDBX/old backup includes its encrypted cache key:
anyone able to decrypt that backup and obtain the cache can also decrypt those
icons. This cache offers no separate password protection or secure-erasure claim.

Hits refresh after 30 days, misses after one day. Stale hits remain visible
offline; a background refresh becomes visible on the next list mount. Cache data
is local auxiliary state, not part of backup completeness or vault recovery.
Missing cached data simply downloads again when enabled and online. Clear and
disable overwrite the preference with null; neither claims physical secure erasure.

## Network Boundary and Hosting

Windows uses a fixed native command scoped to the local main window, active
native session and persisted opt-in. It validates public DNS results, pins those
addresses for the HTTPS request, uses the operating system TLS verifier, disables
proxies/redirects/cookies and limits time and response size. Blocking native I/O
may finish after UI cancellation; its result cannot repopulate a locked screen.

PWA uses a credential-free, no-referrer, no-store same-origin POST to
`/api/favicon`, with only `{ "domain": "…" }` in its body. A domain never appears
in the application's request URL or browser HTTP cache. The endpoint rejects
cross-origin browser requests, bounds request/response streams and forwards no
cookies/authentication/referrer. No application logging or remote icon caching
is added. The website and Cloudflare necessarily see the requested domain;
Cloudflare also handles the existing app hosting traffic. The proxy inherits
Cloudflare's public fetch isolation (no private network bindings); it must not
be ported to an unrestricted server without DNS/IP isolation equivalent to the
Windows loader. Host-side logging, rate limits and account quotas remain host
configuration; do not enable request-body logging for this route.

The PWA production build includes advanced-mode `_worker.js` and a narrowly
scoped `_routes.json`; neither is in the offline shell precache. `connect-src`
remains self-only. Only `img-src` additionally permits Blob URLs for validated
local rasters. Windows receives no service worker or Pages endpoint.
A static server without Pages Functions still runs the vault and existing cache;
new requests fall back to initials. No Cloudflare deployment is claimed by local
tests. Real-site availability, iPhone installed-PWA rendering and native Windows
requests require platform checks; synthetic browser tests do not prove these.

## Sources and Verification

- [Cloudflare Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [Direct upload: Functions](https://developers.cloudflare.com/pages/get-started/direct-upload/#functions)
  explicitly supports `_worker.js` with dashboard drag-and-drop as well as Wrangler.
- [Current Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)

These addresses were fetched successfully during implementation. Behavioral,
privacy and deployment evidence is recorded in [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md).
