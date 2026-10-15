import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { EntryView } from '@passkey-local/vault-adapter';
import { fetchFavicon } from '@platform';
import { faviconDomain } from '../favicon/domain.ts';
import { normalizeIcon } from '../favicon/image.ts';
import { useApp } from './common.tsx';

type Load = (entry: EntryView) => Promise<Uint8Array | null>;
const Icons = createContext<Load | null>(null);

export function FaviconProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { client } = useApp();
  const [loadIcon, setLoadIcon] = useState<Load | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const epoch = client.epoch;
    const pending = new Map<string, Promise<Uint8Array | null>>();
    const waiters: (() => void)[] = [];
    let active = 0;
    const live = () => !controller.signal.aborted && client.epoch === epoch;
    const release = () => {
      const next = waiters.shift();
      if (next) next(); else active--;
    };
    async function limited<T>(work: () => Promise<T>): Promise<T | null> {
      if (active >= 3) await new Promise<void>((resolve) => waiters.push(resolve));
      else active++;
      if (!live()) { release(); return null; }
      try { return await work(); }
      finally { release(); }
    }
    async function update(entry: EntryView, domain: string): Promise<Uint8Array | null> {
      if (!live()) return null;
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
      try {
        const bytes = await fetchFavicon(domain, signal);
        if (!live() || signal.aborted) return null;
        const png = bytes ? await normalizeIcon(bytes) : null;
        if (!live() || signal.aborted) return null;
        await client.call('storeFavicon', { uuid: entry.uuid, domain, png });
        return live() ? png : null;
      } catch { return null; }
    }
    const load: Load = (entry) => {
      const domain = faviconDomain(entry.title, entry.url);
      if (!enabled || !domain || !live()) return Promise.resolve(null);
      let request = pending.get(domain);
      if (!request) {
        request = limited(async () => {
          const cached = await client.call('favicon', { uuid: entry.uuid });
          if (!live() || cached.domain !== domain) return null;
          if (cached.png) {
            // A stale icon remains useful offline; refresh without delaying paint.
            if (cached.refresh) void limited(() => update(entry, domain));
            return cached.png;
          }
          return cached.refresh ? update(entry, domain) : null;
        }).catch(() => null);
        pending.set(domain, request);
      }
      return request;
    };
    setLoadIcon(() => enabled ? load : null);
    return () => controller.abort();
  }, [client, enabled]);
  return <Icons.Provider value={enabled ? loadIcon : null}>{children}</Icons.Provider>;
}

export function EntryAvatar({ entry }: { entry: EntryView }) {
  const load = useContext(Icons);
  const ref = useRef<HTMLSpanElement>(null);
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    setSource(null);
    if (!load || !ref.current) return;
    let live = true;
    let url: string | null = null;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      void load(entry).then((bytes) => {
        if (!live || !bytes) return;
        url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
        setSource(url);
      });
    };
    const observer = new IntersectionObserver((items) => { if (items.some((i) => i.isIntersecting)) { start(); observer.disconnect(); } }, { rootMargin: '160px' });
    observer.observe(ref.current);
    return () => { live = false; observer.disconnect(); if (url) URL.revokeObjectURL(url); };
  }, [load, entry.uuid, entry.title, entry.url]);
  const title = entry.title.trim();
  return <span ref={ref} className={`avatar avatar-tone-${(entry.title.codePointAt(0) ?? 0) % 4}`} aria-hidden="true">
    {source ? <img src={source} alt="" width={32} height={32} loading="lazy" onError={() => setSource(null)} /> : title ? [...title][0]!.toUpperCase() : '•'}
  </span>;
}
