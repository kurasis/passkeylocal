/** Exact domains only. Never guess a service from a human-readable title. */
export function publicDomain(raw: string): string | null {
  if (!raw || raw.length > 253 || raw !== raw.toLowerCase() || raw.endsWith('.')) return null;
  const labels = raw.split('.');
  if (labels.length < 2 || labels.some((s) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s))) return null;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(labels.at(-1)!)) return null;
  if (['localhost', 'local', 'internal', 'lan', 'home', 'arpa', 'test', 'invalid', 'example', 'onion'].includes(labels.at(-1)!)) return null;
  return raw;
}

export function faviconDomain(title: string, website: string): string | null {
  const explicit = website.trim();
  const input = explicit || title.trim();
  if (!input || /\s/.test(input)) return null;
  // Titles must be bare domains. Websites may have a scheme/path/port.
  if (!explicit && /[/:?#@\\]/.test(input)) return null;
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || input.includes('\\')) return null;
    return publicDomain(url.hostname);
  } catch { return null; }
}
