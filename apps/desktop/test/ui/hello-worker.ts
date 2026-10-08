// Test server only. Real vault worker/KDBX/bridge, explicitly synthetic native IPC.
import { openStorage } from '@passkey-local/vault-core';
import { bindStorageBridge } from '../../src/platform.ts';
const w = window as any;
const backing = await openStorage({ name: 'hello-worker-' + crypto.randomUUID() });
let token = '';
let component: number[] | undefined;
let cancelled = false;
let blocked = false;
let release: (() => void) | undefined;
let delivered: number[] | undefined;
const calls: string[] = [];
w.__TAURI_INTERNALS__ = { async invoke(command: string, args: any) {
  if (command === 'session_begin') return token = crypto.randomUUID();
  if (command === 'session_end') { if (token === args.token) token = ''; return; }
  if (args.token !== token) throw { code: 'STALE' };
  if (command === 'storage') {
    const a = args.args;
    if (args.operation === 'commit') return backing.commit({ ...a, bytes: Uint8Array.from(a.bytes) });
    if (args.operation === 'readHead') return backing.readHead();
    if (args.operation === 'readBlob') { const b = await backing.readBlob(a.id); return { ...b, bytes: [...new Uint8Array(b.bytes)] }; }
    if (args.operation === 'getPreference') return backing.getPreference(a.key);
    if (args.operation === 'setPreference') return backing.setPreference(a.key, a.value);
    throw new Error('unexpected storage operation ' + args.operation);
  }
  if (command === 'hello_enrollment') {
    const r = args.request; calls.push(r.operation);
    const status = { state: component ? 'enabled' : 'off', mode: 'session', expiresAt: 123456789 };
    if (r.operation === 'enroll') { component = [...r.component]; return { status: { ...status, state: 'enabled' } }; }
    if (r.operation === 'status') return { status };
    if (r.operation === 'revoke') { component = undefined; return { status: { ...status, state: 'off' } }; }
    if (r.operation === 'unlock') {
      if (blocked) await new Promise<void>(resolve => release = resolve);
      if (cancelled) throw { code: 'HELLO_CANCELLED' };
      if (!component) throw { code: 'HELLO_UNAVAILABLE' };
      delivered = [...component];
      const current = (await backing.readCurrent())!;
      return { status, component: delivered, binding: { generation: current.head.generation, sha256: current.blob.sha256 } };
    }
  }
  throw new Error('unexpected native command ' + command);
} };
let worker: Worker;
let dispose: () => void;
let next = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
function start() {
  worker = new Worker(new URL('../../../pwa/src/worker/vault.worker.ts', import.meta.url), { type: 'module' });
  dispose = bindStorageBridge(worker);
  worker.onmessage = (ev: MessageEvent) => {
    if (ev.data.channel) return;
    const p = pending.get(ev.data.id); if (!p) return; pending.delete(ev.data.id);
    if (ev.data.ok) p.resolve(ev.data.result); else p.reject(ev.data.error);
  };
}
function call(op: string, args?: unknown) {
  return new Promise((resolve, reject) => { const id = next++; pending.set(id, { resolve, reject }); worker.postMessage({ id, op, args }); });
}
start();
w.helloWorker = { call, calls, block() { blocked = true; }, release() { release?.(); }, cancel() { cancelled = true; }, wiped() { return delivered?.every(v => v === 0); }, restart() {
  dispose(); worker.terminate(); for (const p of pending.values()) p.reject({ code: 'LOCKED' }); pending.clear(); start();
} };
