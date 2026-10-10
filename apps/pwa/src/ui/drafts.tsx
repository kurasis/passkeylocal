import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useT } from '../i18n.ts';

export function useDraftRegistry(message: string) {
  const guards = useRef(new Set<() => boolean>());
  const register = useCallback((guard: () => boolean) => {
    guards.current.add(guard);
    return () => { guards.current.delete(guard); };
  }, []);
  const hasUnsaved = useCallback(() => [...guards.current].some((guard) => guard()), []);
  const confirmLeave = useCallback(() => !hasUnsaved() || window.confirm(message), [hasUnsaved, message]);
  return useMemo(() => ({ register, hasUnsaved, confirmLeave }), [register, hasUnsaved, confirmLeave]);
}

export const DraftContext = createContext<ReturnType<typeof useDraftRegistry> | null>(null);

/** Drafts live only in mounted views. Locking never waits for this navigation guard. */
export function useDraftGuard(dirty: boolean) {
  const registry = useContext(DraftContext);
  const current = useRef(dirty);
  current.current = dirty;
  useEffect(() => registry?.register(() => current.current), [registry]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!current.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty]);
  return { markSaved: () => { current.current = false; } };
}

/** Register a nested workspace so module switches also protect its drafts. */
export function useDraftScope() {
  const parent = useContext(DraftContext);
  const t = useT();
  const registry = useDraftRegistry(t('discardDraftConfirm'));
  useEffect(() => parent?.register(registry.hasUnsaved), [parent, registry.hasUnsaved]);
  return registry;
}
