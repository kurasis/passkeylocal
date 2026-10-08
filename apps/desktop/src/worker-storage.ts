import { NativeHelloVault, type NativeHelloReply } from './hello-vault.ts';
import { NativeVaultStorage, type VaultStore, type VaultController } from '@passkey-local/vault-core';

/** Ciphertext storage and a separate, narrowly scoped Hello credential bridge. */
let helloTransport: ((request: Record<string, unknown>) => Promise<NativeHelloReply>) | undefined;
export function createPlatformHello(storage: VaultStore, controller: VaultController) {
  if (!helloTransport) throw new Error('UNAVAILABLE');
  return new NativeHelloVault(storage, controller, helloTransport);
}
export async function openPlatformStorage(): Promise<VaultStore> {
  let next = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
  self.addEventListener('message', (event: MessageEvent) => {
    const m = event.data;
    if (m?.channel !== 'native-storage-result') return;
    const request = pending.get(m.nativeId);
    if (!request) return;
    pending.delete(m.nativeId);
    if (m.ok) request.resolve(m.result); else request.reject(m.error);
  });
  helloTransport = (request) => new Promise((resolve, reject) => {
    const nativeId = ++next; pending.set(nativeId, { resolve: resolve as (v: unknown) => void, reject });
    self.postMessage({ channel: 'native-hello', nativeId, request });
  });
  return new NativeVaultStorage((operation, args) => new Promise((resolve, reject) => {
    const nativeId = ++next;
    pending.set(nativeId, { resolve, reject });
    self.postMessage({ channel: 'native-storage', nativeId, operation, args });
  }));
}
