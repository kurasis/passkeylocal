/*
 * PassKey Local service worker (PRODUCT_AND_ARCHITECTURE.md section 6).
 *
 * - Caches only application assets from the build manifest below; vault bytes
 *   live in IndexedDB and never pass through here.
 * - Install succeeds only when every asset is cached (offline readiness).
 * - A new version waits until the user taps "Update now" (no unconditional
 *   skipWaiting). Old caches are removed only after the new one is complete.
 * - Never touches IndexedDB, never handles cross-origin or non-GET requests.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `pkl-shell-${VERSION}`;
const PREFIX = 'pkl-shell-';

// Safari refuses to answer a navigation with a response that followed a
// redirect, so redirected responses are stored as fresh copies.
async function unredirected(res) {
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const responses = await Promise.all(
        PRECACHE.map(async (path) => {
          const res = await fetch(new Request(path, { cache: 'reload' }));
          if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
          return [path, res.redirected ? await unredirected(res) : res];
        })
      );
      await Promise.all(responses.map(([path, res]) => cache.put(path, res)));
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'activate-update') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match('/');
        if (cached) return cached;
        return fetch(req);
      })()
    );
    return;
  }
  if (!PRECACHE.includes(url.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(url.pathname)) || fetch(req);
    })()
  );
});
