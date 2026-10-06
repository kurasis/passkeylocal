/// <reference lib="webworker" />
/**
 * Dedicated vault worker. The UI terminates it on every lock, which drops the
 * decrypted database, keys and any in-flight KDF work with it.
 */

import { openPlatformStorage } from '@platform-storage';
import type { RequestMessage, ResponseMessage } from '../protocol.ts';
import { VaultWorkerHandlers, toSafeError } from './handlers.ts';

declare const self: DedicatedWorkerGlobalScope;

let handlers: Promise<VaultWorkerHandlers> | null = null;

function getHandlers(): Promise<VaultWorkerHandlers> {
  handlers ??= openPlatformStorage().then((storage) => new VaultWorkerHandlers(storage));
  return handlers;
}

function transferables(result: unknown): Transferable[] {
  if (result && typeof result === 'object' && 'bytes' in result) {
    const bytes = (result as { bytes: unknown }).bytes;
    if (bytes instanceof Uint8Array && bytes.buffer instanceof ArrayBuffer) return [bytes.buffer];
  }
  return [];
}

self.onmessage = async (ev: MessageEvent<RequestMessage>) => {
  if ('channel' in ev.data) return; // Native-storage replies have their own listener.
  const { id, op, args } = ev.data;
  let msg: ResponseMessage;
  try {
    const h = await getHandlers();
    const result = await h.handle(op, args as never);
    msg = { id, ok: true, result };
  } catch (e) {
    msg = { id, ok: false, error: toSafeError(e) };
  }
  self.postMessage(msg, msg.ok ? transferables(msg.result) : []);
};
