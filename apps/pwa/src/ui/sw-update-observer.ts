/** Observe existing/late installs without activating or reloading them. */
export function pendingUpdate(container: ServiceWorkerContainer, registration: ServiceWorkerRegistration): ServiceWorker | null {
  // A hard-reloaded page can be uncontrolled while another tab keeps an old
  // active worker alive. That is still an update, not a first installation.
  if (!container.controller && !registration.active || registration.installing && registration.installing.state !== 'installed') return null;
  const worker = registration.waiting ?? registration.installing;
  return worker?.state === 'installed' ? worker : null;
}

export function observeUpdate(
  container: ServiceWorkerContainer,
  registration: ServiceWorkerRegistration,
  changed: (worker: ServiceWorker | null) => void
): () => void {
  let stopped = false;
  const workers = new Map<ServiceWorker, () => void>();
  const sync = () => {
    if (stopped) return;
    for (const worker of [registration.waiting, registration.installing]) {
      if (worker && !workers.has(worker)) {
        worker.addEventListener('statechange', sync);
        workers.set(worker, () => worker.removeEventListener('statechange', sync));
      }
    }
    for (const [worker, remove] of workers) {
      if (worker.state === 'redundant' || worker.state === 'activated') { remove(); workers.delete(worker); }
    }
    changed(pendingUpdate(container, registration));
  };
  registration.addEventListener('updatefound', sync);
  container.addEventListener('controllerchange', sync);
  sync(); // updatefound may have fired before getRegistration resolved.
  return () => {
    stopped = true;
    registration.removeEventListener('updatefound', sync);
    container.removeEventListener('controllerchange', sync);
    for (const remove of workers.values()) remove();
    workers.clear();
  };
}

export function installationReady(worker: ServiceWorker | null, signal: AbortSignal): Promise<void> {
  if (!worker) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', changed);
      signal.removeEventListener('abort', aborted);
      if (ok) resolve(); else reject(new Error('UPDATE_UNAVAILABLE'));
    };
    const changed = () => {
      if (worker.state === 'installed' || worker.state === 'activated') done(true);
      else if (worker.state === 'redundant') done(false);
    };
    const aborted = () => done(false);
    const timer = setTimeout(aborted, 30_000);
    worker.addEventListener('statechange', changed);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted(); else changed();
  });
}
