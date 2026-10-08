import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const desktop = true;

export function bindStorageBridge(worker: Worker): () => void {
  let live = true;
  const session = invoke<string>('session_begin');
  const receive = async (event: MessageEvent) => {
    const m = event.data;
    if (!['native-storage', 'native-hello'].includes(m?.channel) || !live) return;
    try {
      const token = await session;
      if (!live) return;
      let result: unknown;
      try {
        result = m.channel === 'native-hello'
          ? await invoke('hello_enrollment', { token, request: m.request })
          : await invoke('storage', { token, operation: m.operation, args: m.args ?? {} });
        if (live) worker.postMessage({ channel: 'native-storage-result', nativeId: m.nativeId, ok: true, result });
      } finally {
        // Only the bridge and crypto worker see this short-lived material.
        m.request?.component?.fill(0);
        (result as { component?: number[] } | undefined)?.component?.fill(0);
      }
    } catch (error) {
      if (live) worker.postMessage({ channel: 'native-storage-result', nativeId: m.nativeId, ok: false, error });
    } finally { m.request?.component?.fill(0); }
  };
  worker.addEventListener('message', receive);
  return () => {
    live = false;
    worker.removeEventListener('message', receive);
    void session.then((token) => invoke('session_end', { token })).catch(() => {});
  };
}

export function subscribeNativeLock(lock: () => void): () => void {
  let live = true;
  const subscription = listen('native-lock', () => { if (live) lock(); });
  return () => { live = false; void subscription.then((stop) => stop()); };
}

export async function pickNativeFile(): Promise<File | null> {
  const bytes = await invoke<number[] | null>('pick_import');
  return bytes ? new File([new Uint8Array(bytes)], 'selected-backup.kdbx', { type: 'application/octet-stream' }) : null;
}

export async function exportNativeFile(file: { bytes: Uint8Array; fileName: string }): Promise<'export-offered' | 'export-cancelled' | 'export-failed'> {
  try { return await invoke<boolean>('export_backup', { bytes: Array.from(file.bytes) }) ? 'export-offered' : 'export-cancelled'; }
  catch { return 'export-failed'; }
}
export function openNativeExternal(url: string): void { void invoke('open_external', { url }).catch(() => {}); }
export async function nativeStatus(): Promise<{ backup: string; hello: string; retention?: number }> { return invoke('native_status'); }
export async function nativeHelloStatus(): Promise<import('../../pwa/src/hello-protocol.ts').HelloStatus> { return invoke('hello_status'); }
export async function verifyNativeHello(): Promise<import('../../pwa/src/hello-protocol.ts').HelloVerification> { return invoke('hello_verify'); }
export async function proveNativeHelloKey(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_key_proof'); }
export async function testNativeHelloOaep(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_oaep_capability'); }
export async function testNativeHelloPkcs1(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_pkcs1_compatibility'); }
export async function testNativeHelloPkcs1Behavior(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_pkcs1_behavior'); }
export async function testNativeHelloAttestation(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_attestation_capability'); }
export async function nativeWebauthnCapability(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_webauthn_capability'); }
export async function proveNativeHelloPrf(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_prf_proof'); }
export async function testNativeHelloDirectAttestation(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_webauthn_attestation'); }
export async function nativeTpmCapability(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_tpm_capability'); }
export async function proveNativeTpmInner(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_tpm_proof'); }
export async function openNativeHelloSettings(): Promise<void> { await invoke('hello_settings'); }
export async function configureNativeBackup(): Promise<void> { await invoke('configure_backup'); }
export async function retryNativeBackup(): Promise<void> { await invoke('retry_backup'); }
export async function setNativeRetention(retention: number): Promise<void> { await invoke('backup_retention', { retention }); }
let lastActivity = 0;
export function nativeActivity(): void {
  if (performance.now() - lastActivity < 1000) return;
  lastActivity = performance.now();
  void invoke('native_activity').catch(() => {});
}

export function configureNativeClose(canClose: () => Promise<boolean>): () => void {
  let live = true;
  let deciding = false;
  const win = getCurrentWindow();
  const stop = win.onCloseRequested(async (event) => {
    event.preventDefault();
    if (!live || deciding) return;
    deciding = true;
    try { if (await canClose()) await win.destroy(); }
    catch { /* Failed or invalidated save cancels normal close. */ }
    finally { deciding = false; }
  });
  return () => { live = false; void stop.then((dispose) => dispose()); };
}
export { fileSafe } from './file-safe.ts';

export async function testNativeTpmLocalBinding(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_tpm_local_binding'); }

export async function nativeCombinedHelloStatus(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_combined_status'); }
export async function prepareNativeCombinedHello(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_combined_prepare'); }
export async function resumeNativeCombinedHello(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_combined_resume'); }
export async function cleanupNativeCombinedHello(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_combined_cleanup'); }

export async function testNativeCombinedKeyLoss(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_combined_key_loss'); }

export async function prepareNativeHelloCopy(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_copy_prepare'); }

export async function exportNativeHelloCopy(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_copy_export'); }

export async function checkNativeHelloCopy(): Promise<import('../../pwa/src/hello-protocol.ts').HelloKeyProof> { return invoke('hello_copy_check'); }

export { testNativeHelloRecovery } from './hello-recovery-client.ts';
