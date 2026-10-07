/** Browser platform; desktop builds alias this module to the native adapter. */
export function bindStorageBridge(_worker: Worker): () => void { return () => {}; }
export function subscribeNativeLock(_lock: () => void): () => void { return () => {}; }
export const desktop = false;
export async function pickNativeFile(): Promise<File | null> { return null; }
export async function exportNativeFile(_file: { bytes: Uint8Array; fileName: string }): Promise<'export-offered' | 'export-cancelled' | 'export-failed'> { return 'export-failed'; }
export function openNativeExternal(_url: string): void { /* Browser adapter uses window.open. */ }
export async function nativeStatus(): Promise<{ backup: string; hello: string; retention?: number }> { return { backup: 'unconfigured', hello: 'unavailable' }; }
export async function nativeHelloStatus(): Promise<import('./hello-protocol.ts').HelloStatus> { return { available: false, enrolled: false, reason: 'protected-key-proof-required', helloConfiguration: 'not-probed', mode: 'off' }; }
export async function verifyNativeHello(): Promise<import('./hello-protocol.ts').HelloVerification> { return { result: 'unknown', purpose: 'diagnostic-only', unlocked: false, enrolled: false }; }
export async function proveNativeHelloKey(): Promise<import('./hello-protocol.ts').HelloKeyProof> { throw new Error('Native Hello proof is not available in browsers'); }
export async function openNativeHelloSettings(): Promise<void> { /* Not applicable to browsers. */ }
export async function configureNativeBackup(): Promise<void> { /* Not applicable to browsers. */ }
export async function retryNativeBackup(): Promise<void> { /* Not applicable to browsers. */ }
export async function setNativeRetention(_retention: number): Promise<void> { /* Not applicable to browsers. */ }
export function configureNativeClose(_canClose: () => Promise<boolean>): () => void { return () => {}; }
export function nativeActivity(): void { /* Browser auto-lock already observes activity. */ }
export const fileSafe: import('./file-safe-protocol.ts').FileSafeApi | null = null;
