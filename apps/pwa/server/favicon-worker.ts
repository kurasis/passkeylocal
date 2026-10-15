/** Cloudflare Pages advanced-mode endpoint. No remote cache, cookies, logs or analytics. */
import { publicDomain } from '../src/favicon/domain.ts';
import { MAX_ICON_BYTES, safeRaster } from '../src/favicon/image.ts';

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
  const signal = AbortSignal.timeout(8000);
  for (const path of ['/favicon.ico', '/apple-touch-icon.png']) {
    try {
      // Fixed HTTPS paths, no redirect following: never forward stored URLs or credentials.
      const response = await upstream(`https://${domain}${path}`, {
        redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
        cache: 'no-store', headers: { Accept: 'image/png,image/x-icon,image/vnd.microsoft.icon' }
      });
      if (!response.ok || Number(response.headers.get('content-length')) > MAX_ICON_BYTES) {
        await response.body?.cancel(); continue;
      }
      const stream = response.body?.getReader();
      if (!stream) continue;
      const bytes = new Uint8Array(MAX_ICON_BYTES);
      let size = 0, overflow = false;
      try {
        while (true) {
          const { done, value } = await stream.read();
          if (done) break;
          if (size + value.length > bytes.length) { overflow = true; break; }
          bytes.set(value, size); size += value.length;
        }
      } finally { await stream.cancel().catch(() => {}); }
      const icon = bytes.slice(0, size);
      if (!overflow && safeRaster(icon)) return new Response(icon, { headers: { ...headers, 'Content-Type': 'application/octet-stream' } });
    } catch { /* Missing, blocked or unsupported icon keeps generated initials. */ }
  }
  return unavailable();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/api/favicon') return env.ASSETS.fetch(request);
    try { return await faviconRequest(request); }
    catch { return unavailable(); }
  }
};
