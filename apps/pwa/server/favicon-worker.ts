/** Cloudflare Pages advanced-mode endpoint. No remote cache, cookies, logs or analytics. */
import { publicDomain } from '../src/favicon/domain.ts';
import { MAX_ICON_BYTES, iconDimensions, safeRaster } from '../src/favicon/image.ts';

import { canonicalIconTarget, DOCUMENT_LIMIT, MANIFEST_LIMIT, pageIcons, manifestIcons, rankedIcons } from './icon-discovery.ts';

type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const unavailable = () => new Response(null, { status: 404, headers });

export async function faviconRequest(request: Request, upstream: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403, headers });
  if (request.headers.get('sec-fetch-site') === 'cross-site' ||
    !request.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 403, headers });
  // A streaming cap applies even without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return unavailable();
  let body = '';
  try {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (body.length + value.length > 1024) return unavailable();
      body += decoder.decode(value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
  let domain: string | null;
  try { const parsed = JSON.parse(body); domain = typeof parsed.domain === 'string' ? publicDomain(parsed.domain) : null; }
  catch { return unavailable(); }
  if (!domain) return unavailable();
  const signal = AbortSignal.timeout(12_000);
  let remaining = 12;
  let temporaryFailure = false;
  let pageStatus = 0;
  async function get(target: string, limit: number, prefix = false): Promise<{ url: string; bytes: Uint8Array } | null> {
    for (let hop = 0; hop < 2 && remaining > 0 && !signal.aborted; hop++) {
      remaining--;
      try {
        const response = await upstream(target, {
          redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer',
          signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]), cache: 'no-store',
          headers: { Accept: prefix ? 'text/html' : 'image/png,image/x-icon,image/vnd.microsoft.icon,application/manifest+json' }
        });
        if (prefix) pageStatus = response.status;
        const canonical = hop === 0 && [301, 302, 303, 307, 308].includes(response.status)
          ? canonicalIconTarget(target, response.headers.get('location')) : null;
        if (canonical) { await response.body?.cancel(); target = canonical; continue; }
        if (!response.ok) {
          if (![404, 410].includes(response.status)) temporaryFailure = true;
          await response.body?.cancel(); return null;
        }
        if (!prefix && Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); return null; }
        const reader = response.body?.getReader();
        if (!reader) return null;
        const bytes = new Uint8Array(limit);
        let size = 0, overflow = false;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const length = Math.min(value.length, limit - size);
            bytes.set(value.subarray(0, length), size); size += length;
            if (length < value.length || size === limit && prefix) { overflow = !prefix; break; }
          }
        } finally { await reader.cancel().catch(() => {}); }
        return overflow ? null : { url: target, bytes: bytes.slice(0, size) };
      } catch { temporaryFailure = true; return null; }
    }
    return null;
  }
  const websiteRoot = `https://${domain}/`;
  const page = await get(websiteRoot, DOCUMENT_LIMIT, true);
  const base = page?.url ?? websiteRoot;
  const metadata = page ? pageIcons(new TextDecoder().decode(page.bytes), base) : { icons: [], manifest: null };
  if (metadata.manifest && remaining > 4) {
    const manifest = await get(metadata.manifest, MANIFEST_LIMIT);
    if (manifest) metadata.icons.push(...manifestIcons(new TextDecoder().decode(manifest.bytes), manifest.url));
  }
  let best: Uint8Array | null = null, quality = 0;
  for (const url of rankedIcons(metadata.icons, base)) {
    // Reserve the last two attempts for the ordinary ICO fallback.
    if (remaining <= 2 && new URL(url).pathname !== '/favicon.ico') continue;
    const image = await get(url, MAX_ICON_BYTES);
    if (!image || !safeRaster(image.bytes)) continue;
    const dimensions = iconDimensions(image.bytes)!;
    const edge = Math.min(dimensions.width, dimensions.height);
    if (Math.max(dimensions.width, dimensions.height) > edge * 2) continue;
    const candidateQuality = edge * 2 + Number(dimensions.png);
    if (candidateQuality > quality) { best = image.bytes; quality = candidateQuality; }
    if (dimensions.png && edge >= 128) break;
  }
  if (best) {
    const dimensions = iconDimensions(best)!;
    return new Response(new Uint8Array(best), { headers: { ...headers, 'Content-Type': dimensions.png ? 'image/png' : 'image/x-icon',
      'X-PassKey-Icon-Width': String(dimensions.width), 'X-PassKey-Icon-Height': String(dimensions.height),
      'X-PassKey-Icon-Discovery': `page=${pageStatus};bytes=${page?.bytes.length ?? 0};icons=${metadata.icons.length};requests=${12 - remaining}` } });
  }
  return temporaryFailure
    ? new Response(null, { status: 503, headers })
    : new Response(null, { status: 404, headers: { ...headers, 'X-PassKey-Favicon': 'missing' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/api/favicon') return env.ASSETS.fetch(request);
    try { return await faviconRequest(request); }
    catch { return unavailable(); }
  }
};
