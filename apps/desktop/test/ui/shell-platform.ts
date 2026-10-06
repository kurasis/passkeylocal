/** Native API doubles used exclusively by the isolated browser harness. */
export * from '../../../pwa/src/platform.ts';
import type { HelloConfiguration, HelloStatus, HelloVerification, HelloVerificationResult } from '../../../pwa/src/hello-protocol.ts';
import type { FileSafeApi } from '../../../pwa/src/file-safe-protocol.ts';
export const desktop = true;
export const fileSafe = { lockAll: async () => {} } as FileSafeApi;
export async function nativeStatus() { return { backup: 'verified', hello: 'unavailable', retention: 30 }; }
let configuration: HelloConfiguration = 'available';
let verification: HelloVerificationResult = 'verified';
let settingsOpened = 0;
let checks = 0;
let verifies = 0;
let release: (() => void) | null = null;
let defer = false;
let settingsFail = false;
export async function nativeHelloStatus(): Promise<HelloStatus> {
  checks++;
  return { available: false, enrolled: false, reason: 'protected-key-proof-required', helloConfiguration: configuration, mode: 'off' };
}
export async function verifyNativeHello(): Promise<HelloVerification> {
  verifies++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  return { result: verification, purpose: 'diagnostic-only', unlocked: false, enrolled: false };
}
export async function openNativeHelloSettings() { settingsOpened++; if (settingsFail) throw new Error('Synthetic OS settings failure'); }
Object.assign(window, { helloTest: {
  configure(value: HelloConfiguration) { configuration = value; },
  outcome(value: HelloVerificationResult) { verification = value; },
  defer() { defer = true; },
  failSettings() { settingsFail = true; },
  release() { release?.(); },
  counts() { return { settingsOpened, checks, verifies }; },
} });
