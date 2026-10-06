import { NativeVaultStorage, type VaultStore } from '@passkey-local/vault-core';

/** Workers have no window IPC bridge. The host thread forwards ciphertext only. */
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
  return new NativeVaultStorage((operation, args) => new Promise((resolve, reject) => {
    const nativeId = ++next;
    pending.set(nativeId, { resolve, reject });
    self.postMessage({ channel: 'native-storage', nativeId, operation, args });
  }));
}
