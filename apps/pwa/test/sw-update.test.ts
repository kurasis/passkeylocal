import { describe, expect, it, vi } from 'vitest';
import { installationReady, observeUpdate } from '../src/ui/sw-update-observer.ts';

class Worker extends EventTarget {
  state: ServiceWorkerState = 'installing';
  stateTo(state: ServiceWorkerState) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}
class Registration extends EventTarget {
  waiting: Worker | null = null;
  installing: Worker | null = null;
}
class Container extends EventTarget { controller: Worker | null = new Worker(); }
function watch(container: Container, registration: Registration) {
  const changes: (ServiceWorker | null)[] = [];
  const stop = observeUpdate(container as unknown as ServiceWorkerContainer,
    registration as unknown as ServiceWorkerRegistration, worker => changes.push(worker));
  return { changes, stop };
}

describe('service worker update observation', () => {
  it('detects installation that began before the listener was attached', () => {
    const container = new Container(), reg = new Registration(), worker = new Worker();
    reg.installing = worker;
    const { changes, stop } = watch(container, reg);
    worker.stateTo('installed');
    expect(changes.at(-1)).toBe(worker);
    stop();
  });
  it('detects an already waiting update and never offers a first installation', () => {
    const container = new Container(), reg = new Registration(), worker = new Worker();
    worker.state = 'installed'; reg.waiting = worker;
    const old = watch(container, reg);
    expect(old.changes.at(-1)).toBe(worker); old.stop();
    container.controller = null;
    const first = watch(container, reg);
    expect(first.changes.filter(Boolean)).toEqual([]); first.stop();
  });
  it('clears a superseded update and observes the replacement', () => {
    const container = new Container(), reg = new Registration(), old = new Worker(), next = new Worker();
    old.state = 'installed'; reg.waiting = old;
    const { changes, stop } = watch(container, reg);
    reg.waiting = null; reg.installing = next;
    old.stateTo('redundant');
    reg.dispatchEvent(new Event('updatefound'));
    expect(changes.at(-1)).toBeNull();
    next.stateTo('installed');
    expect(changes.at(-1)).toBe(next); stop();
  });
  it('removes listeners on cleanup, including workers already installing', () => {
    const container = new Container(), reg = new Registration(), worker = new Worker();
    reg.installing = worker;
    const { changes, stop } = watch(container, reg);
    stop(); const before = changes.length;
    reg.dispatchEvent(new Event('updatefound')); worker.stateTo('installed');
    container.dispatchEvent(new Event('controllerchange'));
    expect(changes).toHaveLength(before);
  });

  it('waits for a complete install and rejects a failed install', async () => {
    const worker = new Worker(), abort = new AbortController();
    const result = installationReady(worker as unknown as ServiceWorker, abort.signal);
    worker.stateTo('installed'); await expect(result).resolves.toBeUndefined();
    const failed = new Worker();
    const error = expect(installationReady(failed as unknown as ServiceWorker, abort.signal)).rejects.toThrow('UPDATE_UNAVAILABLE');
    failed.stateTo('redundant'); await error;
  });
  it('cancels installation waits on teardown and bounds a stalled download', async () => {
    const worker = new Worker(), abort = new AbortController();
    const cancelled = expect(installationReady(worker as unknown as ServiceWorker, abort.signal)).rejects.toThrow();
    abort.abort(); await cancelled;
    vi.useFakeTimers();
    try {
      const timeout = expect(installationReady(worker as unknown as ServiceWorker, new AbortController().signal)).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(30_000); await timeout;
    } finally { vi.useRealTimers(); }
  });
});
