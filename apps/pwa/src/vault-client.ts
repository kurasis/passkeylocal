/**
 * UI-side client of the vault worker. `lock()` terminates the worker: the
 * decrypted vault, keys and in-flight work disappear with it, and every
 * pending request rejects so late results can never repopulate the screen.
 */

import type { Args, Op, RequestMessage, ResponseMessage, Result, SafeError } from './protocol.ts';
import { bindStorageBridge } from '@platform';

export class VaultRequestError extends Error {
  readonly code: string;
  readonly detail: string | undefined;

  constructor(err: SafeError) {
    super(err.code);
    this.name = 'VaultRequestError';
    this.code = err.code;
    this.detail = err.detail;
  }
}

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

export class VaultClient {
  private worker: Worker | null = null;
  private next = 1;
  private pending = new Map<number, Pending>();
  private disposeBridge: (() => void) | null = null;
  /** Increments on every lock; callers compare it to drop stale UI updates. */
  epoch = 0;

  private ensure(): Worker {
    if (!this.worker) {
      const w = new Worker(new URL('./worker/vault.worker.ts', import.meta.url), { type: 'module', name: 'vault' });
      w.onmessage = (ev: MessageEvent<ResponseMessage>) => {
        const p = this.pending.get(ev.data.id);
        if (!p) return;
        this.pending.delete(ev.data.id);
        if (ev.data.ok) p.resolve(ev.data.result);
        else p.reject(new VaultRequestError(ev.data.error));
      };
      w.onerror = () => this.failAll('WORKER_FAILED');
      this.worker = w;
      this.disposeBridge = bindStorageBridge(w);
    }
    return this.worker;
  }

  call<O extends Op>(op: O, ...args: Args<O> extends void ? [] : [Args<O>]): Promise<Result<O>> {
    const w = this.ensure();
    const id = this.next++;
    const arg = args[0];
    const transfer: Transferable[] = [];
    if (arg && typeof arg === 'object' && 'bytes' in arg && (arg as { bytes: unknown }).bytes instanceof Uint8Array) {
      transfer.push(((arg as { bytes: Uint8Array }).bytes.buffer as ArrayBuffer));
    }
    return new Promise<Result<O>>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      const msg: RequestMessage = { id, op, args: arg };
      w.postMessage(msg, transfer);
    });
  }

  /** Immediate lock: terminate the worker and reject everything in flight. */
  lock(): void {
    this.epoch++;
    this.disposeBridge?.();
    this.disposeBridge = null;
    this.worker?.terminate();
    this.worker = null;
    this.failAll('LOCKED');
  }

  private failAll(code: string): void {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) p.reject(new VaultRequestError({ code }));
  }
}
