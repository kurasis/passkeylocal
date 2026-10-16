/**
 * App updates (PRODUCT_AND_ARCHITECTURE.md section 6): a waiting service
 * worker is offered while locked and activated only after an explicit tap.
 * No unconditional skipWaiting, no reload during editing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { installationReady, observeUpdate, pendingUpdate } from './sw-update-observer.ts';

type Status = 'idle' | 'checking' | 'current' | 'available' | 'failed' | 'applying';

export function useServiceWorkerUpdate(locked: boolean) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const checkRef = useRef<(manual: boolean) => void>(() => {});
  const lockedRef = useRef(locked);
  const requested = useRef(false);
  const needsReload = useRef(false);
  lockedRef.current = locked;
  const supported = !__DESKTOP__ && 'serviceWorker' in navigator;

  const reloadIfLocked = useCallback(() => {
    if (needsReload.current && lockedRef.current) {
      needsReload.current = false;
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    const sw = navigator.serviceWorker;
    const abort = new AbortController();
    const observers = new Map<ServiceWorkerRegistration, () => void>();
    let busy = false, lastCheck = -Infinity;
    const bind = (reg: ServiceWorkerRegistration | undefined) => {
      if (!reg || abort.signal.aborted) return;
      registration.current = reg;
      if (!observers.has(reg)) observers.set(reg, observeUpdate(sw, reg, (worker) => {
        if (abort.signal.aborted) return;
        setWaiting(worker);
        if (worker) setStatus('available');
      }));
    };
    const check = async (manual: boolean) => {
      if (busy || requested.current || abort.signal.aborted || !manual && Date.now() - lastCheck < 60_000) return;
      busy = true; lastCheck = Date.now();
      setStatus('checking');
      try {
        const reg = await sw.getRegistration();
        if (abort.signal.aborted) return;
        if (!reg) throw new Error('UPDATE_UNAVAILABLE');
        bind(reg);
        await reg.update();
        if (abort.signal.aborted) return;
        await installationReady(reg.installing, abort.signal);
        if (abort.signal.aborted) return;
        const worker = pendingUpdate(sw, reg);
        setWaiting(worker);
        setStatus(worker ? 'available' : manual ? 'current' : 'idle');
      } catch {
        if (!abort.signal.aborted) setStatus(manual ? 'failed' : 'idle');
      } finally { busy = false; }
    };
    checkRef.current = manual => { void check(manual); };
    void sw.getRegistration().then(reg => { bind(reg); if (reg) void check(false); }).catch(() => {});
    // Registration may finish after the first getRegistration call.
    void sw.ready.then(reg => { bind(reg); void check(false); }).catch(() => {});
    const visible = () => { if (document.visibilityState === 'visible') void check(false); };
    const online = () => { void check(false); };
    const controlled = () => {
      if (requested.current) { needsReload.current = true; reloadIfLocked(); }
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', visible);
    window.addEventListener('online', online);
    sw.addEventListener('controllerchange', controlled);
    return () => {
      abort.abort();
      checkRef.current = () => {};
      for (const stop of observers.values()) stop();
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', visible);
      window.removeEventListener('online', online);
      sw.removeEventListener('controllerchange', controlled);
    };
  }, [supported, reloadIfLocked]);

  useEffect(() => {
    reloadIfLocked();
    if (locked) checkRef.current(false);
  }, [locked, reloadIfLocked]);

  useEffect(() => {
    if (status !== 'applying') return;
    const timer = setTimeout(() => {
      requested.current = false;
      needsReload.current = false;
      setStatus('failed');
    }, 15_000);
    return () => clearTimeout(timer);
  }, [status]);

  const check = useCallback(() => checkRef.current(true), []);
  const apply = () => {
    if (!lockedRef.current || requested.current || !registration.current) return;
    const worker = pendingUpdate(navigator.serviceWorker, registration.current);
    if (!worker) return;
    requested.current = true;
    setStatus('applying');
    worker.postMessage({ type: 'activate-update' });
  };
  return { supported, available: !!waiting, status, check, apply };
}
