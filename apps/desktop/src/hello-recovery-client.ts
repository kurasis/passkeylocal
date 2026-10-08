import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { HelloKeyProof } from '../../pwa/src/hello-protocol.ts';
import type { RecoveryReply } from './hello-recovery.ts';
let running = false;
/** Only public synthetic credential bytes travel through this private bridge. */
export async function testNativeHelloRecovery(signal?: AbortSignal): Promise<HelloKeyProof> {
  if (running || signal?.aborted) throw new Error('BUSY_OR_INTERRUPTED');
  running = true;
  let worker: Worker | undefined;
  let ticket: string | undefined;
  let live = true;
  let nativeBusy = false;
  let stop: (() => void) | undefined;
  let abort = () => {};
  const stopListening = () => {
    const unlisten = stop; stop = undefined;
    // Listener disposal can race destruction of the WebView. It must not skip
    // our worker/key cleanup or leave this client permanently single-flighted.
    try { void Promise.resolve(unlisten?.()).catch(() => {}); } catch { /* window closed */ }
  };
  const dispose = async () => {
    if (!ticket) return;
    const owned = ticket; ticket = undefined;
    // Errors leave the durable journal for the existing explicit cleanup action.
    await invoke('hello_recovery_revoke', { ticket: owned }).catch(() => {});
  };
  try {
    return await new Promise<HelloKeyProof>((resolve, reject) => {
      abort = () => { live = false; worker?.terminate(); reject(new Error('INTERRUPTED')); };
      signal?.addEventListener('abort', abort, { once: true });
      void listen('native-lock', abort).then(unlisten => {
        stop = unlisten;
        if (!live) { stopListening(); return; }
        worker = new Worker(new URL('./hello-recovery.worker.ts', import.meta.url), { type: 'module', name: 'synthetic-hello-recovery' });
        worker.onerror = () => reject(new Error('WORKER_FAILED'));
        worker.onmessage = async event => {
          const m = event.data;
          if (!live) return;
          if (m?.kind === 'result') {
            // The worker has reported its explicit cleanup result. Do not silently
            // retry it after publishing a cleanup-required status to the user.
            ticket = undefined; resolve(m.report); return;
          }
          if (m?.kind !== 'native' || nativeBusy || !['prepare','revoke'].includes(m.action)) { reject(new Error('INVALID_WORKER_MESSAGE')); return; }
          nativeBusy = true;
          let reply: RecoveryReply | undefined;
          try {
            if (m.action === 'prepare') {
              if (ticket) throw new Error('EXISTING_TEST');
              reply = await invoke<RecoveryReply>('hello_recovery_prepare');
              ticket = reply.ticket;
            } else {
              if (!ticket || ticket !== m.ticket) throw new Error('INVALID_TICKET');
              reply = await invoke<RecoveryReply>('hello_recovery_revoke', { ticket });
              if (reply.report.combinedState === 'no-test') ticket = undefined;
            }
            if (live) worker!.postMessage({ id: m.id, ok: true, reply });
          } catch {
            if (live) worker!.postMessage({ id: m.id, ok: false });
          } finally {
            reply?.passwordHash?.fill(0);
            nativeBusy = false;
            if (!live) await dispose(); // Handles a late successful prepare after lock.
          }
        };
      }).catch(() => reject(new Error('UNAVAILABLE')));
      if (signal?.aborted) abort();
    });
  } finally {
    live = false; worker?.terminate(); stopListening(); signal?.removeEventListener('abort', abort);
    if (!nativeBusy) await dispose();
    running = false;
  }
}
