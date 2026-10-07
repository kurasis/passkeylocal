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
let compatibilities = 0;
let behaviors = 0;
let attestations = 0;
let webauthn = 0;
let prf = 0;
let attestationResult: 'returned-unverified' | 'unavailable' = 'returned-unverified';
let behaviorFailure: 'silent-before' | 'private-export' | 'test-key-delete' | null = null;
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
export async function testNativeHelloPkcs1(): Promise<HelloKeyProof> {
  compatibilities++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  return { version: 1, purpose: 'synthetic-pkcs1-compatibility', algorithm: 'rsa-pkcs1-v1_5', eligible: false, unlocked: false, enrolled: false,
    outcome: 'compatibility-passed', remaining: ['per-key-tpm-proof', 'fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'],
    checks: [{ test: 'public-wrap', status: 'passed' }, { test: 'silent-before', status: 'not-run' },
      { test: 'unwrap-first', status: 'passed' }, { test: 'unwrap-second', status: 'not-run' }, { test: 'private-export', status: 'not-run' },
      { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
}
export async function testNativeHelloPkcs1Behavior(): Promise<HelloKeyProof> {
  behaviors++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  const stages: HelloKeyProof['checks'][number]['test'][] = ['hello-configuration', 'provider-open', 'key-create', 'key-policy', 'policy-readback', 'public-wrap', 'silent-before', 'unwrap-first', 'silent-after-first', 'unwrap-second', 'silent-after-second', 'private-export', 'test-key-delete'];
  let stopped = false;
  return { version: 1, purpose: 'synthetic-pkcs1-behavior', algorithm: 'rsa-pkcs1-v1_5', eligible: false, enrolled: false, unlocked: false,
    outcome: behaviorFailure ? 'blocked' : 'behavior-passed', remaining: ['per-key-tpm-proof', 'fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'],
    exportChecks: behaviorFailure === 'private-export' ? [
      { format: 'rsa-private', result: 'unsupported-format', nativeCode: '0x8009000A' },
      { format: 'rsa-full-private', result: 'refused', nativeCode: '0x80090010' },
      { format: 'pkcs8-private', result: 'failed', nativeCode: '0x80090029' },
    ] : undefined,
    checks: stages.map((test) => {
      if (test === behaviorFailure) { stopped = true; return { test, status: 'failed', operation: test === 'silent-before' ? 'silent-decrypt-unexpected-success' : test === 'private-export' ? 'private-export-rsa' : 'delete-test-key' }; }
      return { test, status: stopped && test !== 'test-key-delete' ? 'not-run' : 'passed' };
    }) };
}
export async function testNativeHelloAttestation(): Promise<HelloKeyProof> {
  attestations++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  return { version: 1, purpose: 'synthetic-attestation-capability', algorithm: 'rsa-2048-decrypt-only',
    eligible: false, enrolled: false, unlocked: false,
    outcome: attestationResult === 'returned-unverified' ? 'attestation-capability-observed' : 'blocked',
    remaining: ['per-key-tpm-proof', 'fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'],
    checks: [{ test: 'hello-configuration', status: 'passed' },
      { test: 'attestation-claim', status: attestationResult === 'returned-unverified' ? 'passed' : 'failed',
        ...(attestationResult === 'unavailable' ? { nativeCode: '0x80090029', operation: 'create-subject-only-attestation-claim' } : {}) },
      { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }],
    attestationClaim: { api: 'NCryptCreateClaim', claimType: 'subject-only', verification: 'not-performed',
      result: attestationResult, ...(attestationResult === 'returned-unverified' ? { bytes: 1234 } : {}) } };
}
export async function nativeWebauthnCapability(): Promise<HelloKeyProof> {
  webauthn++;
  return { version: 1, purpose: 'webauthn-prf-capability', algorithm: 'webauthn-prf-aes256gcm',
    eligible: false, enrolled: false, unlocked: false, outcome: 'webauthn-capability-observed',
    remaining: ['per-key-tpm-proof', 'fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'],
    checks: ['webauthn-load', 'webauthn-api', 'hello-platform', 'hello-route'].map((test) => ({ test: test as HelloKeyProof['checks'][number]['test'], status: 'passed' })),
    webauthn: { osBuild: 26200, apiVersion: 9, platformAvailable: true, helloCandidates: 1, helloLocked: false, routing: 'display-name-candidate', tpmBinding: 'not-verified' } };
}
export async function proveNativeHelloPrf(): Promise<HelloKeyProof> {
  prf++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  const capability = await nativeWebauthnCapability();
  webauthn--;
  return { ...capability, purpose: 'synthetic-webauthn-prf', outcome: proofCleanupFailed ? 'blocked' : 'prf-roundtrip-passed',
    checks: [...capability.checks, ...(['prf-create', 'prf-first', 'prf-repeat', 'prf-changed', 'prf-roundtrip'] as const).map((test) => ({ test, status: 'passed' as const })),
      { test: 'test-passkey-delete', status: proofCleanupFailed ? 'failed' : 'passed', ...(proofCleanupFailed ? { nativeCode: '0x80090029', operation: 'delete-prf-test-passkey' } : {}) }] };
}
Object.assign(window, { helloTest: {
  configure(value: HelloConfiguration) { configuration = value; },
  outcome(value: HelloVerificationResult) { verification = value; },
  defer() { defer = true; },
  failSettings() { settingsFail = true; },
  proofOutcome(value: HelloKeyProof['outcome']) { proofOutcome = value; },
  failCleanup() { proofCleanupFailed = true; },
  behaviorFailure(value: typeof behaviorFailure) { behaviorFailure = value; },
  attestationResult(value: typeof attestationResult) { attestationResult = value; },
  release() { release?.(); },
  counts() { return { settingsOpened, checks, verifies, proofs, capabilities, compatibilities, behaviors, attestations, webauthn, prf }; },
} });
