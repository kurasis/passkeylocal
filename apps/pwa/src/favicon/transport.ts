/** The only browser network exception: optional, same-origin, domain-only POST. */
import { publicDomain } from './domain.ts';
import { MAX_ICON_BYTES, safeRaster } from './image.ts';

export async function browserFavicon(domain: string, signal: AbortSignal): Promise<Uint8Array | null> {
  if (!publicDomain(domain)) return null;
  const response = await fetch('/api/favicon', {
    method: 'POST', body: JSON.stringify({ domain }), signal,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error'
  });
  // Only the endpoint's explicit, confirmed miss is eligible for negative caching.
  // A WAF page, missing deployment, rate limit or outage must remain retryable.
  if (response.status === 404 && response.headers.get('X-PassKey-Favicon') === 'missing') return null;
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_ICON_BYTES) {
    await response.body?.cancel();
    throw new Error('FAVICON_UNAVAILABLE');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('FAVICON_UNAVAILABLE');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_ICON_BYTES) throw new Error('FAVICON_UNAVAILABLE');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (!safeRaster(bytes)) throw new Error('FAVICON_UNAVAILABLE');
  return bytes;
}
