/** The only browser network exception: optional, same-origin, domain-only POST. */
import { publicDomain } from './domain.ts';
import { MAX_ICON_BYTES } from './image.ts';

export async function browserFavicon(domain: string, signal: AbortSignal): Promise<Uint8Array | null> {
  if (!publicDomain(domain)) return null;
  const response = await fetch('/api/favicon', {
    method: 'POST', body: JSON.stringify({ domain }), signal,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error'
  });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_ICON_BYTES) return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_ICON_BYTES) return null;
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
