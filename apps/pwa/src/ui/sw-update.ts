/**
 * App updates (PRODUCT_AND_ARCHITECTURE.md section 6): a waiting service
 * worker is offered while locked and activated only after an explicit tap.
 * No unconditional skipWaiting, no reload during editing.
 */

import { useEffect, useState } from 'react';

export function useServiceWorkerUpdate(): (() => void) | null {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (__DESKTOP__) return;
    const sw = navigator.serviceWorker;
    if (!sw) return;
    let cancelled = false;
    sw.getRegistration().then((reg) => {
      if (!reg || cancelled) return;
      if (reg.waiting && sw.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && sw.controller) setWaiting(installing);
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting) return null;
  return () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'activate-update' });
  };
}
