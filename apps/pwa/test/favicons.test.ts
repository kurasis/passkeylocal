import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { openStorage, VaultController } from '@passkey-local/vault-core';
import { faviconDomain, publicDomain } from '../src/favicon/domain.ts';
import { MAX_ICON_BYTES, iconDimensions, safeRaster } from '../src/favicon/image.ts';
import { browserFavicon } from '../src/favicon/transport.ts';
import { FaviconCache, FAVICON_KEY, decode64, encode64 } from '../src/worker/favicon-cache.ts';
import { VaultWorkerHandlers } from '../src/worker/handlers.ts';
import { faviconRequest } from '../server/favicon-worker.ts';
import { pageIcons, manifestIcons, rankedIcons, publicIconUrl } from '../server/icon-discovery.ts';

const DOMAIN = 'synthetic-icon-fixture.com';
const PW = 'synthetic favicon test passphrase';
const PNG = decode64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMIMVj1HwAEOAIuIYFLowAAAABJRU5ErkJggg==');
const input = { title: 'synthetic-title-fixture.com', username: 'synthetic-user', password: 'secret', url: `https://${DOMAIN}/private?marker=secret`, notes: '', tags: [], customFields: [], expiresAt: null };

describe('favicon domain and image boundary', () => {
  it('prioritizes Website and only accepts a bare domain as Title', () => {
    expect(faviconDomain('github.com', 'https://accounts.example.org/private?q=secret#fragment')).toBe('accounts.example.org');
    expect(faviconDomain('github.com', 'example.org:8443/private')).toBe('example.org');
    expect(faviconDomain(' GitHub.COM ', '')).toBe('github.com');
    expect(faviconDomain('пример.рф', '')).toBe('xn--e1afmkfd.xn--p1ai');
    for (const title of ['GitHub work', 'https://github.com', 'github.com/path', 'github.com?x=1', 'github.com@evil.com', 'localhost', '127.0.0.1', '0x7f000001', 'foo.local', 'foo.test', 'foo.internal']) expect(faviconDomain(title, ''), title).toBeNull();
    for (const website of ['not a website', 'javascript:alert(1)', 'https://user:pw@github.com', 'https://127.0.0.1', 'https://github.com\\@evil.com']) expect(faviconDomain('github.com', website), website).toBeNull();
    expect(publicDomain('example.com.')).toBeNull();
  });

  it('rejects active formats, oversized rasters and disguised ICO dimensions', () => {
    expect(safeRaster(PNG)).toBe(true);
    expect(safeRaster(new TextEncoder().encode('<svg xmlns="x" onload="alert(1)"></svg>'))).toBe(false);
    const enormous = PNG.slice(); new DataView(enormous.buffer).setUint32(16, 100_000);
    expect(safeRaster(enormous)).toBe(false);
    expect(safeRaster(new Uint8Array(MAX_ICON_BYTES + 1))).toBe(false);
    const ico = new Uint8Array(22 + PNG.length);
    const v = new DataView(ico.buffer);
    v.setUint16(2, 1, true); v.setUint16(4, 1, true); ico[6] = ico[7] = 1;
    v.setUint32(14, PNG.length, true); v.setUint32(18, 22, true); ico.set(PNG, 22);
    expect(safeRaster(ico)).toBe(true);
    ico[6] = 2;
    expect(safeRaster(ico)).toBe(false);
  });
});

describe('optional encrypted per-vault favicon cache', () => {
  it('requires consent, preserves entry/history data, survives re-unlock and never stores plaintext domains or icons', async () => {
    const storage = await openStorage({ indexedDB: new IDBFactory() });
    const controller = new VaultController(storage);
    const h = new VaultWorkerHandlers(storage, controller);
    await h.handle('create', { password: PW });
    const { uuid } = await h.handle('saveEntry', { uuid: null, input });
    const before = (await h.handle('overview', undefined)).generation;
    expect((await h.handle('getPreferences', undefined)).faviconsEnabled).toBe(false);
    expect(await h.handle('favicon', { uuid })).toEqual({ domain: null, png: null, refresh: false });
    expect(controller.current!.db.meta.customData.has(FAVICON_KEY)).toBe(false);
    await h.handle('setPreference', { key: 'faviconsEnabled', value: true });
    expect((await h.handle('overview', undefined)).generation).toBe(before + 1);
    expect(await h.handle('favicon', { uuid })).toEqual({ domain: DOMAIN, png: null, refresh: true });
    await h.handle('storeFavicon', { uuid, domain: DOMAIN, png: PNG });
    expect((await h.handle('favicon', { uuid })).png).toEqual(PNG);
    const stored = JSON.stringify(await storage.getPreference('faviconCache'));
    for (const marker of [DOMAIN, 'synthetic-title-fixture', 'synthetic-user', 'secret', 'iVBORw0KGgo', controller.current!.db.meta.customData.get(FAVICON_KEY)!.value]) expect(stored).not.toContain(marker);
    expect((await h.handle('overview', undefined)).generation).toBe(before + 1);
    expect(await h.handle('history', { uuid })).toHaveLength(0);
    controller.lock();
    await expect(h.handle('favicon', { uuid })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await h.handle('unlock', { password: PW });
    expect((await h.handle('favicon', { uuid })).png).toEqual(PNG);
    await h.handle('setPreference', { key: 'faviconsEnabled', value: false });
    expect(await storage.getPreference('faviconCache')).toBeNull();
    expect((await h.handle('favicon', { uuid })).domain).toBeNull();
    await h.handle('storeFavicon', { uuid, domain: DOMAIN, png: PNG });
    expect(await storage.getPreference('faviconCache')).toBeNull();
    await h.handle('setPreference', { key: 'faviconsEnabled', value: true });
    expect((await h.handle('overview', undefined)).generation).toBe(before + 1);
    await expect(h.handle('storeFavicon', { uuid, domain: 'other.com', png: PNG })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(h.handle('storeFavicon', { uuid, domain: DOMAIN, png: new Uint8Array(8193) })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    // Current encrypted KDBX still independently carries ordinary custom data, no binary icons.
    const backup = await h.handle('prepareExport', undefined);
    const { openVault } = await import('@passkey-local/vault-adapter');
    const opened = await openVault(backup.bytes, PW);
    expect(opened.db.meta.customData.get(FAVICON_KEY)?.value).toBe(controller.current!.db.meta.customData.get(FAVICON_KEY)?.value);
    expect(opened.db.meta.customIcons.size).toBe(0);
  });

  it('serializes concurrent writes, bounds cache size, expires misses, tolerates tampering and discards late writes', async () => {
    const storage = await openStorage({ indexedDB: new IDBFactory() });
    const controller = new VaultController(storage);
    const h = new VaultWorkerHandlers(storage, controller);
    await h.handle('create', { password: PW });
    await h.handle('setPreference', { key: 'faviconsEnabled', value: true });
    const s = controller.current!, cache = new FaviconCache(storage);
    await Promise.all([cache.put(s, 'one.com', PNG), cache.put(s, 'two.com', PNG)]);
    expect((await cache.get(s, 'one.com')).png).toEqual(PNG);
    expect((await cache.get(s, 'two.com')).png).toEqual(PNG);
    await cache.put(s, 'missing.com', null);
    expect((await cache.get(s, 'missing.com')).refresh).toBe(false);
    vi.setSystemTime(Date.now() + 31 * 86_400_000);
    try {
      expect((await cache.get(s, 'missing.com')).refresh).toBe(true);
      expect(await cache.get(s, 'one.com')).toEqual({ png: PNG, refresh: true });
    } finally { vi.useRealTimers(); }
    for (let n = 0; n < 70; n++) await cache.put(s, `site-${n}.com`, PNG);
    expect((await cache.get(s, 'site-0.com')).png).toBeNull();
    expect((await cache.get(s, 'site-69.com')).png).toEqual(PNG);
    const e = await storage.getPreference<any>('faviconCache');
    expect(JSON.stringify(e).length).toBeLessThan(90_000);
    await storage.setPreference('faviconCache', { ...e, ciphertext: 'AAAA' + e.ciphertext.slice(4) });
    expect((await cache.get(s, 'site-69.com')).png).toBeNull();
    const late = cache.put(s, 'late.com', PNG);
    controller.lock();
    await expect(late).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await cache.clear();
    expect(await storage.getPreference('faviconCache')).toBeNull();
  });

  it.each([undefined, 2])('retries legacy miss policy %s after upgrading while preserving downloaded icons', async (policy) => {
    const storage = await openStorage({ indexedDB: new IDBFactory() });
    const controller = new VaultController(storage);
    const h = new VaultWorkerHandlers(storage, controller);
    await h.handle('create', { password: PW });
    await h.handle('setPreference', { key: 'faviconsEnabled', value: true });
    const s = controller.current!, cache = new FaviconCache(storage);
    await cache.put(s, 'found.com', PNG);
    await cache.put(s, 'missing.com', null);
    // Recreate the encrypted row written before miss/error classification existed.
    const raw = decode64(s.db.meta.customData.get(FAVICON_KEY)!.value!);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    raw.fill(0);
    const e = await storage.getPreference<{ version: number; id: string; iv: string; ciphertext: string }>('faviconCache');
    const additionalData = new TextEncoder().encode('PassKey Local favicon cache v1');
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(e!.iv), additionalData }, key, decode64(e!.ciphertext));
    const rows = JSON.parse(new TextDecoder().decode(plaintext));
    for (const row of rows) row.missPolicy = policy;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, new TextEncoder().encode(JSON.stringify(rows)));
    await storage.setPreference('faviconCache', { ...e, iv: encode64(iv), ciphertext: encode64(new Uint8Array(ciphertext)) });
    expect(await cache.get(s, 'missing.com')).toEqual({ png: null, refresh: true });
    expect(await cache.get(s, 'found.com')).toEqual({ png: PNG, refresh: false });
    await cache.put(s, 'missing.com', null);
    expect(await cache.get(s, 'missing.com')).toEqual({ png: null, refresh: false });
  });
});

describe('high-resolution cache upgrade', () => {
  it('keeps an old thumbnail offline while marking it for one quality upgrade', async () => {
    const storage = await openStorage({ indexedDB: new IDBFactory() });
    const controller = new VaultController(storage);
    const h = new VaultWorkerHandlers(storage, controller);
    await h.handle('create', { password: PW });
    await h.handle('setPreference', { key: 'faviconsEnabled', value: true });
    const s = controller.current!, cache = new FaviconCache(storage);
    await cache.put(s, DOMAIN, PNG);
    const raw = decode64(s.db.meta.customData.get(FAVICON_KEY)!.value!);
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); raw.fill(0);
    const e = await storage.getPreference<any>('faviconCache');
    const additionalData = new TextEncoder().encode('PassKey Local favicon cache v1');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(e.iv), additionalData }, key, decode64(e.ciphertext));
    const rows = JSON.parse(new TextDecoder().decode(plain)); delete rows[0].imagePolicy;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, new TextEncoder().encode(JSON.stringify(rows)));
    await storage.setPreference('faviconCache', { ...e, iv: encode64(iv), ciphertext: encode64(new Uint8Array(encrypted)) });
    expect(await cache.get(s, DOMAIN)).toEqual({ png: PNG, refresh: true });
    const large = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/icons/retina-192.png', import.meta.url)));
    await cache.put(s, DOMAIN, large);
    expect(await cache.get(s, DOMAIN)).toEqual({ png: large, refresh: false });
    expect(JSON.stringify(await storage.getPreference('faviconCache'))).not.toContain(DOMAIN);
  });
});

describe('Cloudflare favicon endpoint and browser transport', () => {
  const request = (domain = DOMAIN, extra: RequestInit = {}) => new Request('https://vault.example.test/api/favicon', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://vault.example.test' }, body: JSON.stringify({ domain }), ...extra
  });

  it('loads a canonical icon redirect and keeps unsupported redirects retryable', async () => {
    for (const [domain, alias] of [[DOMAIN, `www.${DOMAIN}`], [`www.${DOMAIN}`, DOMAIN]]) {
      const upstream = vi.fn<typeof fetch>().mockImplementation(async url => {
        if (String(url) === `https://${domain}/favicon.ico`) return new Response(null, { status: 301, headers: { Location: `https://${alias}/favicon.ico` } });
        return String(url) === `https://${alias}/favicon.ico` ? new Response(PNG) : new Response(null, { status: 404 });
      });
      const response = await faviconRequest(request(domain), upstream);
      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
      expect(upstream.mock.calls.map(([url]) => url)).toContain(`https://${alias}/favicon.ico`);
      for (const [, init] of upstream.mock.calls) expect(init).toMatchObject({ redirect: 'manual', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    }
    for (const location of ['https://other-site.com/favicon.ico', 'http://127.0.0.1/favicon.ico', `https://user:pw@www.${DOMAIN}/favicon.ico`, `https://www.${DOMAIN}/private`, `https://www.${DOMAIN}:8443/favicon.ico`]) {
      const upstream = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 302, headers: { Location: location } }));
      const response = await faviconRequest(request(), upstream);
      expect(response.status).toBe(503);
      expect(response.headers.has('X-PassKey-Favicon')).toBe(false);
      expect(upstream.mock.calls.every(([url]) => String(url).startsWith(`https://${DOMAIN}/`))).toBe(true);
      expect(upstream.mock.calls.length).toBeLessThanOrEqual(12);
    }
  });

  it('only sends public domain-derived requests, drops cookies and never caches plaintext', async () => {
    const upstream = vi.fn<typeof fetch>().mockImplementation(async url => String(url).endsWith('/apple-touch-icon.png')
      ? new Response(PNG, { headers: { 'Set-Cookie': 'untrusted=1' } }) : new Response(null, { status: 404 }));
    const response = await faviconRequest(request(), upstream);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
    for (const [, init] of upstream.mock.calls) expect(init).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store', referrerPolicy: 'no-referrer' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('matches the native public metadata fixture and prefers a real large PNG over ICO', async () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../tests/fixtures/icons/discovery.json', import.meta.url), 'utf8'));
    const metadata = pageIcons(fixture.html, fixture.base);
    expect(metadata.manifest).toBe('https://www.synthetic-icon-fixture.com/assets/app.webmanifest');
    expect(rankedIcons([...metadata.icons, ...manifestIcons(fixture.manifest, metadata.manifest!)], fixture.base)).toEqual(fixture.expected);
    for (const input of ['https://127.0.0.1/a.png', 'https://u:pw@site.com/a.png', 'https://site.com:8443/a.png', 'file:///secret', 'data:image/png,abc', 'https://foo.local/a.png']) expect(publicIconUrl(input, fixture.base)).toBeNull();
    const large = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/icons/retina-192.png', import.meta.url)));
    const upstream = vi.fn<typeof fetch>().mockImplementation(async url => {
      const path = new URL(String(url)).pathname;
      if (path === '/') return new Response(fixture.html);
      if (path === '/assets/app.webmanifest') return new Response(fixture.manifest);
      if (path === '/assets/retina.png') return new Response(large);
      return new Response(PNG);
    });
    const response = await faviconRequest(request('www.' + DOMAIN), upstream);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(iconDimensions(bytes)).toEqual({ width: 192, height: 192, png: true });
    expect(response.headers.get('X-PassKey-Icon-Width')).toBe('192');
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([fixture.base, metadata.manifest, fixture.expected[0]]);
  });

  it('bounds metadata, image bodies and request count while retaining the ICO fallback', async () => {
    const requests: string[] = [];
    const upstream = vi.fn<typeof fetch>().mockImplementation(async url => {
      const target = String(url); requests.push(target);
      if (target === `https://${DOMAIN}/`) return new Response('<link rel="manifest" href="/manifest.json">' + Array.from({ length: 40 }, (_, i) => `<link rel="icon" sizes="512x512" href="/bad-${i}.png">`).join(''));
      if (target.endsWith('/manifest.json')) return new Response('x'.repeat(32_769));
      if (target.endsWith('/favicon.ico')) return new Response(PNG);
      return new Response(new Uint8Array(MAX_ICON_BYTES + 1));
    });
    const response = await faviconRequest(request(), upstream);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
    expect(requests.length).toBeLessThanOrEqual(12);
    expect(requests).toContain(`https://${DOMAIN}/favicon.ico`);
    expect(requests.every(url => url.startsWith(`https://${DOMAIN}/`))).toBe(true);
  });

  it('rejects invalid/private targets, cross-site requests, active/huge images and unsupported methods', async () => {
    const upstream = vi.fn<typeof fetch>();
    for (const domain of ['127.0.0.1', 'example.com/path', 'user@github.com', 'foo.local', 'foo.test']) expect((await faviconRequest(request(domain), upstream)).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
    expect((await faviconRequest(request(DOMAIN, { headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.test' } }), upstream)).status).toBe(403);
    expect((await faviconRequest(new Request('https://vault.example.test/api/favicon'), upstream)).status).toBe(405);
    upstream.mockImplementation(async () => new Response('<svg onload="alert(1)"/>'));
    expect((await faviconRequest(request(), upstream)).status).toBe(404);
    upstream.mockImplementation(async () => new Response(new Uint8Array(MAX_ICON_BYTES + 1)));
    expect((await faviconRequest(request(), upstream)).status).toBe(404);
    const oversized = request(DOMAIN, { body: ' '.repeat(1025) });
    expect((await faviconRequest(oversized, upstream)).status).toBe(404);
  });

  it('uses same-origin POST without credentials, URL queries or persistent browser HTTP caching', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(new Response(PNG));
    vi.stubGlobal('fetch', mock);
    try {
      expect(await browserFavicon(DOMAIN, new AbortController().signal)).toEqual(PNG);
      expect(mock).toHaveBeenCalledWith('/api/favicon', expect.objectContaining({ method: 'POST', body: JSON.stringify({ domain: DOMAIN }), cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' }));
      expect(await browserFavicon('127.0.0.1', new AbortController().signal)).toBeNull();
      expect(mock).toHaveBeenCalledTimes(1);
      mock.mockResolvedValue(new Response(new Uint8Array(MAX_ICON_BYTES + 1)));
      await expect(browserFavicon(DOMAIN, new AbortController().signal)).rejects.toThrow();
    } finally { vi.unstubAllGlobals(); }
  });

  it('does not mistake a blocked, missing or broken endpoint for a cacheable absent icon', async () => {
    const mock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', mock);
    try {
      for (const status of [403, 404, 429, 500, 503]) {
        mock.mockResolvedValue(new Response(null, { status }));
        await expect(browserFavicon(DOMAIN, new AbortController().signal), String(status)).rejects.toThrow();
      }
      mock.mockResolvedValue(new Response('<!doctype html><html>SPA fallback, not an icon</html>'));
      await expect(browserFavicon(DOMAIN, new AbortController().signal)).rejects.toThrow();
      mock.mockResolvedValue(new Response(null, { status: 404, headers: { 'X-PassKey-Favicon': 'missing' } }));
      expect(await browserFavicon(DOMAIN, new AbortController().signal)).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });

  it('distinguishes confirmed absent icons from temporary upstream failures', async () => {
    const missing = await faviconRequest(request(), vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 404 })));
    expect(missing.status).toBe(404);
    expect(missing.headers.get('X-PassKey-Favicon')).toBe('missing');
    for (const status of [403, 429, 500, 503]) {
      const response = await faviconRequest(request(), vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status })));
      expect(response.status, String(status)).toBe(503);
      expect(response.headers.has('X-PassKey-Favicon')).toBe(false);
    }
    const network = await faviconRequest(request(), vi.fn<typeof fetch>().mockRejectedValue(new Error('synthetic network failure')));
    expect(network.status).toBe(503);
  });
});
