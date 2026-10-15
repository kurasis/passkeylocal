import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { openStorage, VaultController } from '@passkey-local/vault-core';
import { faviconDomain, publicDomain } from '../src/favicon/domain.ts';
import { safeRaster } from '../src/favicon/image.ts';
import { browserFavicon } from '../src/favicon/transport.ts';
import { FaviconCache, FAVICON_KEY, decode64 } from '../src/worker/favicon-cache.ts';
import { VaultWorkerHandlers } from '../src/worker/handlers.ts';
import { faviconRequest } from '../server/favicon-worker.ts';

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
    expect(safeRaster(new Uint8Array(65_537))).toBe(false);
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
});

describe('Cloudflare favicon endpoint and browser transport', () => {
  const request = (domain = DOMAIN, extra: RequestInit = {}) => new Request('https://vault.example.test/api/favicon', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://vault.example.test' }, body: JSON.stringify({ domain }), ...extra
  });

  it('only sends a domain to fixed HTTPS paths, drops upstream cookies and never caches plaintext', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/' } }))
      .mockResolvedValueOnce(new Response(PNG, { headers: { 'Set-Cookie': 'untrusted=1' } }));
    const response = await faviconRequest(request(), upstream);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
    expect(upstream.mock.calls.map((call) => call[0])).toEqual([`https://${DOMAIN}/favicon.ico`, `https://${DOMAIN}/apple-touch-icon.png`]);
    for (const [, init] of upstream.mock.calls) expect(init).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store', referrerPolicy: 'no-referrer' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('rejects invalid/private targets, cross-site requests, active/huge images and unsupported methods', async () => {
    const upstream = vi.fn<typeof fetch>();
    for (const domain of ['127.0.0.1', 'example.com/path', 'user@github.com', 'foo.local', 'foo.test']) expect((await faviconRequest(request(domain), upstream)).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
    expect((await faviconRequest(request(DOMAIN, { headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example.test' } }), upstream)).status).toBe(403);
    expect((await faviconRequest(new Request('https://vault.example.test/api/favicon'), upstream)).status).toBe(405);
    upstream.mockImplementation(async () => new Response('<svg onload="alert(1)"/>'));
    expect((await faviconRequest(request(), upstream)).status).toBe(404);
    upstream.mockImplementation(async () => new Response(new Uint8Array(65_537)));
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
      mock.mockResolvedValue(new Response(new Uint8Array(65_537)));
      expect(await browserFavicon(DOMAIN, new AbortController().signal)).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
});
