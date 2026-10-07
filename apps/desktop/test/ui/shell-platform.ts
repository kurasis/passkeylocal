/** Native API doubles used exclusively by the isolated browser harness. */
export * from '../../../pwa/src/platform.ts';
import type { HelloConfiguration, HelloStatus, HelloVerification, HelloVerificationResult, HelloKeyProof } from '../../../pwa/src/hello-protocol.ts';
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
let proofOutcome: HelloKeyProof['outcome'] = 'blocked';
let proofCleanupFailed = false;
let proofs = 0;
let capabilities = 0;
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
export async function proveNativeHelloKey(): Promise<HelloKeyProof> {
  proofs++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  return { version: 1, purpose: 'synthetic-key-proof', eligible: false, unlocked: false, enrolled: false,
    outcome: proofOutcome, remaining: ['per-key-tpm-proof', 'fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'],
    checks: [{ test: 'hello-configuration', status: 'passed' },
      { test: 'key-policy', status: proofOutcome === 'roundtrip-passed' ? 'passed' : 'failed', nativeCode: '0x80090029' },
      { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
}
export async function testNativeHelloOaep(): Promise<HelloKeyProof> {
  capabilities++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  return { version: 1, purpose: 'synthetic-oaep-capability', eligible: false, unlocked: false, enrolled: false,
    outcome: 'capability-passed', remaining: ['per-key-tpm-proof', 'fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'],
    checks: [{ test: 'public-wrap', status: 'passed' }, { test: 'silent-before', status: 'not-run' },
      { test: 'unwrap-first', status: 'passed' }, { test: 'private-export', status: 'not-run' },
      { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
}
Object.assign(window, { helloTest: {
  configure(value: HelloConfiguration) { configuration = value; },
  outcome(value: HelloVerificationResult) { verification = value; },
  defer() { defer = true; },
  failSettings() { settingsFail = true; },
  proofOutcome(value: HelloKeyProof['outcome']) { proofOutcome = value; },
  failCleanup() { proofCleanupFailed = true; },
  release() { release?.(); },
  counts() { return { settingsOpened, checks, verifies, proofs, capabilities }; },
} });
