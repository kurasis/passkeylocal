/** Parse public metadata inertly. The stored entry URL never reaches this module. */
import { Parser } from 'htmlparser2';
import { publicDomain } from '../src/favicon/domain.ts';

export const DOCUMENT_LIMIT = 131_072;
export const MANIFEST_LIMIT = 32_768;
export type IconCandidate = { url: string; size: number; png: boolean };

export function publicIconUrl(reference: string, base: string): string | null {
  if (!reference || reference.length > 2048 || /[\\\x00-\x1f\x7f]/.test(reference)) return null;
  try {
    const url = new URL(reference.trim(), base);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !publicDomain(url.hostname)) return null;
    url.hash = '';
    if (url.href.length > 2048) return null;
    return url.href;
  } catch { return null; }
}

export function canonicalIconTarget(target: string, location: string | null): string | null {
  if (!location) return null;
  const source = new URL(target);
  source.hostname = source.hostname.startsWith('www.') ? source.hostname.slice(4) : `www.${source.hostname}`;
  return publicDomain(source.hostname) && location === source.href ? source.href : null;
}

function candidate(href: string, base: string, sizes = '', type = '', apple = false): IconCandidate | null {
  const url = publicIconUrl(href, base);
  if (!url || /svg|jpeg|webp|gif/i.test(type) || /\.(?:svg|jpe?g|webp|gif)$/i.test(new URL(url).pathname)) return null;
  const edges = sizes.split(/\s+/).slice(0, 16).map(value => {
    const match = /^(\d{1,4})x(\d{1,4})$/i.exec(value);
    return match && Math.max(+match[1]!, +match[2]!) <= 1024 ? Math.min(+match[1]!, +match[2]!) : 0;
  });
  return { url, size: Math.max(apple ? 180 : 0, ...edges), png: apple || type.toLowerCase() === 'image/png' || /\.png$/i.test(new URL(url).pathname) };
}

export function pageIcons(html: string, base: string): { icons: IconCandidate[]; manifest: string | null } {
  const icons: IconCandidate[] = [];
  let manifest: string | null = null;
  const inert = new Set(['template', 'noscript', 'svg', 'math']);
  let inertDepth = 0;
  const parser = new Parser({
    onopentag(name, attrs) {
      if (inert.has(name)) inertDepth++;
      if (inertDepth || icons.length >= 32 && name !== 'link') return;
      if (name === 'meta' && (attrs.itemprop ?? '').toLowerCase().split(/\s+/).some(p => p === 'image' || p === 'logo')) {
        const icon = candidate(attrs.content ?? '', base, '128x128');
        if (icon?.png) icons.push(icon);
      }
      if (name === 'img' && /(?:^|[-_\s])(?:logo|brand)(?:$|[-_\s])/i.test(`${attrs.id ?? ''} ${attrs.class ?? ''}`)) {
        const icon = candidate(attrs.src ?? '', base, '96x96');
        if (icon?.png) icons.push(icon);
      }
      if (name !== 'link') return;
      const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('manifest') && !manifest) manifest = publicIconUrl(attrs.href ?? '', base);
      if (icons.length < 32 && rel.some(r => ['icon', 'apple-touch-icon', 'apple-touch-icon-precomposed'].includes(r))) {
        const icon = candidate(attrs.href ?? '', base, attrs.sizes, attrs.type, rel.some(r => r.startsWith('apple-touch-icon')));
        if (icon) icons.push(icon);
      }
    },
    onclosetag(name) { if (inert.has(name) && inertDepth) inertDepth--; }
  }, { decodeEntities: true });
  parser.end(html);
  return { icons, manifest };
}

export function manifestIcons(text: string, base: string): IconCandidate[] {
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value?.icons)) return [];
    return value.icons.slice(0, 32).flatMap((icon: Record<string, unknown>) => {
      if (!icon || typeof icon.src !== 'string') return [];
      const result = candidate(icon.src, base, typeof icon.sizes === 'string' ? icon.sizes : '', typeof icon.type === 'string' ? icon.type : '');
      return result ? [result] : [];
    });
  } catch { return []; }
}

export function rankedIcons(icons: IconCandidate[], base: string): string[] {
  const unique = new Map<string, IconCandidate>();
  for (const icon of icons) {
    const old = unique.get(icon.url);
    if (!old || icon.size + Number(icon.png) > old.size + Number(old.png)) unique.set(icon.url, icon);
  }
  const score = (icon: IconCandidate) => Math.min(icon.size, 512) + (icon.png ? 16 : 0);
  const selected = [...unique.values()].sort((a, b) => score(b) - score(a)).slice(0, 4).map(i => i.url);
  // Verified from Google's public image metadata; usable when its root page is a regional/blocked variant.
  if (['google.com', 'www.google.com'].includes(new URL(base).hostname)) {
    selected.push('https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png');
  }
  return [...new Set([...selected, new URL('/apple-touch-icon.png', base).href, new URL('/favicon.png', base).href, new URL('/favicon.ico', base).href])];
}
