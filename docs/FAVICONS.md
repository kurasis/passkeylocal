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

Starting in 0.1.7, the owner's request for sharper images authorizes reading the
public HTTPS homepage, its declared manifest and image hosts/CDNs. Only the
normalized domain reaches the loader; stored Website paths, credentials, queries
and fragments are never forwarded. HTML is parsed inertly (no script, CSS or
embedded resource execution). Icon/apple-touch links, PNG image/logo metadata,
explicit PNG logo images and manifest icons are ranked by advertised size;
actual raster dimensions decide quality. A suitable PNG of at least 128px wins.
The ordinary touch-icon, favicon.png and favicon.ico paths remain fallbacks.
One exact same-path bare/www redirect is allowed per request. Discovered image
hosts must be public HTTPS domains, without credentials or non-default ports.
No external logo directory is used. Template/noscript/foreign markup is ignored.

Discovery allows at most 12 requests, 128 KiB of homepage metadata, 32 KiB of
manifest JSON, 256 KiB per image and 512px source dimensions. It stops on a
12-second network deadline with a three-second per-request cap; the browser's
outer deadline is 15 seconds. Native DNS uses the OS resolver, then separately
validates and pins every host's public addresses. The website and its declared
image/CDN hosts necessarily see those requests. No downloaded HTML is persisted.
Unsupported/oversized images keep a usable fallback or the generated initial.

The largest ICO frame is selected explicitly, instead of letting a decoder
choose a tiny frame. Valid rasters are normalized to a lossless PNG up to
128 × 128, preserving smaller originals rather than inventing detail. Display
size remains 32 CSS pixels. The 16 KiB cache-entry cap may require a smaller
96/64/32px normalization for unusually complex images. Old thumbnails remain
visible/offline while a background quality refresh replaces them in the same
list. A failed refresh cannot discard a valid old image.

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

Hits refresh after 30 days, misses after one day. Quality policy 1 marks icons
checked by the 0.1.7 discovery path; earlier cached hits are rechecked while
remaining available offline. Miss policy 4 retries older absent-icon rows. Stale hits remain visible
offline; successful background refreshes notify current list avatars. Cache data
is local auxiliary state, not part of backup completeness or vault recovery.
Missing cached data simply downloads again when enabled and online. Clear and
disable overwrite the preference with null; neither claims physical secure erasure.

Starting in 0.1.3, the browser only persists a miss when the endpoint explicitly
returns `404` with `X-PassKey-Favicon: missing`. Unmarked 404s (including missing
deployments), WAF/rate-limit/server errors and HTML/static fallback responses
are retryable failures, not negative-cache entries. Returning to the list retries
them. The endpoint returns 503 for temporary upstream failures and never forwards
upstream cookies or error details. Legacy negative-cache rows are rechecked once
after upgrading; valid cached icons remain usable offline. This fixes delayed
recovery after a static upload or an endpoint outage without changing KDBX data.

## Network Boundary and Hosting

Windows uses a fixed native command scoped to the local main window, active
native session and persisted opt-in. It validates public DNS results, pins those
addresses for the HTTPS request, uses the operating system TLS verifier, disables
proxies/automatic redirects/cookies and limits time and response size. Blocking native I/O
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

This output targets **Pages**, not Workers' static-files dashboard uploader.
The warning "Pages _routes.json is not supported" requires checking the selected
product, not deleting invocation-route metadata. See [deployment troubleshooting](DEPLOYMENT.md#cloudflare-upload-says-pages-_routesjson-is-not-supported)
for the Pages dashboard path and the Pages Wrangler alternative. Workers needs
an explicitly configured script entry, assets binding and invocation routing.
The separate [Workers distribution](../deploy/cloudflare-workers/) supplies
that configuration without changing the released 0.1.2 application bytes.

## Sources and Verification

- [Cloudflare Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [Direct upload: Functions](https://developers.cloudflare.com/pages/get-started/direct-upload/#functions)
  explicitly supports `_worker.js` with dashboard drag-and-drop as well as Wrangler.
- [Current Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)

These addresses were fetched successfully during implementation. Behavioral,
privacy and deployment evidence is recorded in [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md).

## Discovery parsers

The Worker uses pinned `htmlparser2` 10.0.0 (MIT), a streaming metadata parser
without a DOM or Node compatibility requirement. Native Windows uses `scraper`
0.24.0 (ISC) with `url` 2.5.8; inputs remain bounded and inert. A shared synthetic
HTML/manifest fixture checks ranking, public URL validation and ignored markup
on both implementations. New dependencies are pinned in the existing lockfiles.

- https://github.com/fb55/htmlparser2
- https://docs.rs/scraper/0.24.0/scraper/
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel#icon
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons
