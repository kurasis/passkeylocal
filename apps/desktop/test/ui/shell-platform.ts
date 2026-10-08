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
let directAttestations = 0;
let tpmCapabilities = 0;
let tpmProofs = 0;
let tpmLocalBindings = 0;
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
export async function testNativeHelloDirectAttestation(): Promise<HelloKeyProof> {
  directAttestations++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  const capability = await nativeWebauthnCapability(); webauthn--;
  return { ...capability, purpose: 'synthetic-webauthn-direct-attestation', algorithm: 'webauthn-es256-direct-attestation',
    outcome: proofCleanupFailed ? 'blocked' : 'direct-attestation-not-provided',
    directAttestation: { requested: 'direct', format: 'none', decodeType: 0, statementBytes: 0, objectBytes: 128,
      verification: 'not-performed', subject: 'synthetic-webauthn-prf-credential', prfSecretProtection: 'not-verified', innerRsaKey: 'not-attested' },
    checks: [...capability.checks, { test: 'webauthn-direct-create', status: 'passed' },
      { test: 'test-passkey-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
}
export async function nativeTpmCapability(): Promise<HelloKeyProof> {
  tpmCapabilities++;
  return { version: 1, purpose: 'tpm-inner-capability', algorithm: 'platform-rsa-oaep-sha256', eligible: false, enrolled: false, unlocked: false,
    outcome: 'tpm-capability-observed', tpm: { implementationFlags: 1, tpmVersion: 2, interfaceType: 3 }, perKeyTpmEvidence: 'not-verified', authorization: 'no-hello-authorization', processScope: 'same-process',
    remaining: ['per-key-tpm-proof', 'fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'],
    checks: [{ test: 'tpm-provider-open', status: 'passed' }, { test: 'tpm-provider-properties', status: 'passed' }] };
}
export async function proveNativeTpmInner(): Promise<HelloKeyProof> {
  tpmProofs++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  const capability = await nativeTpmCapability(); tpmCapabilities--;
  return { ...capability, purpose: 'synthetic-tpm-inner', outcome: proofCleanupFailed ? 'blocked' : 'tpm-inner-roundtrip-passed',
    tpm: { ...capability.tpm, keyNameBytes: 34, exportPolicy: 0, keyUsage: 1 },
    exportChecks: (['rsa-private', 'rsa-full-private', 'pkcs8-private'] as const).map((format) => ({ format, result: 'refused', nativeCode: '0x80090010' })),
    checks: [...capability.checks, ...(['tpm-key-create', 'tpm-key-policy', 'tpm-key-readback', 'tpm-public-wrap', 'tpm-unwrap-first', 'tpm-reopen-unwrap', 'tpm-negative-controls', 'private-export'] as const).map((test) => ({ test, status: 'passed' as const })),
      { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
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
  counts() { return { settingsOpened, checks, verifies, proofs, capabilities, compatibilities, behaviors, attestations, webauthn, prf, directAttestations, tpmCapabilities, tpmProofs, tpmLocalBindings }; },
} });

export async function testNativeTpmLocalBinding(): Promise<HelloKeyProof> {
  tpmLocalBindings++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  const capability = await nativeTpmCapability(); tpmCapabilities--;
  return { ...capability, purpose: 'synthetic-tpm-local-binding',
    outcome: proofCleanupFailed ? 'blocked' : 'tpm-local-binding-observed',
    perKeyTpmEvidence: proofCleanupFailed ? 'not-verified' : 'local-read-public-observed', exportChecks: [],
    tpm: { ...capability.tpm, keyNameBytes: 34, exportPolicy: 0, keyUsage: 1, objectAttributes: 0x20072 },
    checks: [...capability.checks, ...(['tpm-key-create', 'tpm-key-policy', 'tpm-key-readback', 'tpm-read-public', 'tpm-public-wrap', 'tpm-unwrap-first', 'tpm-reopen-unwrap', 'tpm-reopen-read-public', 'tpm-negative-controls'] as const).map((test) => ({ test, status: 'passed' as const })),
      { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
}

let combinedState: NonNullable<HelloKeyProof['combinedState']> = 'no-test';
let combinedPrepares = 0;
let combinedResumes = 0;
let combinedCleanups = 0;
function combinedReport(outcome: HelloKeyProof['outcome'] = combinedState): HelloKeyProof {
  return { version: 1, purpose: 'synthetic-combined-restart', algorithm: 'webauthn-prf-aes256gcm-tpm-oaep-sha256', eligible: false, enrolled: false, unlocked: false, outcome, combinedState, checks: [], remaining: ['fresh-authorization-proof', 'fresh-process-proof', 'account-machine-copy-proof'] };
}
export async function nativeCombinedHelloStatus(): Promise<HelloKeyProof> { return combinedReport(); }
export async function prepareNativeCombinedHello(): Promise<HelloKeyProof> {
  combinedPrepares++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  combinedState = 'restart-required'; return combinedReport();
}
export async function resumeNativeCombinedHello(): Promise<HelloKeyProof> {
  combinedResumes++;
  if (proofOutcome === 'cancelled') return combinedReport('cancelled');
  combinedState = proofCleanupFailed ? 'cleanup-required' : 'no-test';
  return { ...combinedReport(proofCleanupFailed ? 'blocked' : 'combined-restart-passed'), processScope: 'fresh-process',
    checks: [{ test: 'combined-unwrap-first', status: 'passed' }, { test: 'combined-unwrap-second', status: 'passed' }, { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
}
export async function cleanupNativeCombinedHello(): Promise<HelloKeyProof> {
  combinedCleanups++;
  combinedState = proofCleanupFailed ? 'cleanup-required' : 'no-test';
  return combinedReport(proofCleanupFailed ? 'blocked' : 'combined-cleaned');
}
let keyLossCalls = 0;
export async function testNativeCombinedKeyLoss(): Promise<HelloKeyProof> {
  keyLossCalls++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  combinedState = proofCleanupFailed ? 'cleanup-required' : 'no-test';
  return { ...combinedReport(proofCleanupFailed ? 'blocked' : proofOutcome === 'cancelled' ? 'cancelled' : 'combined-key-loss-passed'),
    purpose: 'synthetic-combined-key-loss', processScope: 'same-process',
    checks: [{ test: 'loss-passkey-reopen', status: 'passed', operation: 'combined-credential-missing' },
      { test: 'loss-tpm-reopen', status: 'passed', operation: 'tpm-reopen-exact-test-key', nativeCode: '0x80090016' },
      { test: 'test-key-delete', status: proofCleanupFailed ? 'failed' : 'passed' }] };
}
Object.assign((window as any).helloTest, {
  keyLossCalls() { return keyLossCalls; },
  combinedState(value: typeof combinedState) { combinedState = value; },
  combinedCounts() { return { combinedPrepares, combinedResumes, combinedCleanups }; },
});

let copyChecks = 0;
let copyRelation: NonNullable<HelloKeyProof['copyEvidence']>['contextRelation'] = 'different-installation';
const copyEvidence = (): NonNullable<HelloKeyProof['copyEvidence']> => ({ fileSha256: 'ab'.repeat(32), originSourceCommit: 'cd'.repeat(20), contextRelation: copyRelation, correlation: 'match-export-and-source-recheck', tpmAccess: copyRelation === 'same-account-and-installation' ? 'opened' : 'missing', passkeyAccess: copyRelation === 'same-account-and-installation' ? 'opened' : 'missing' });
export async function prepareNativeHelloCopy(): Promise<HelloKeyProof> {
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  combinedState = 'copy-ready';
  return { ...combinedReport('copy-exported'), purpose: 'synthetic-combined-copy', copyEvidence: { ...copyEvidence(), contextRelation: 'same-account-and-installation' } };
}
export async function exportNativeHelloCopy(): Promise<HelloKeyProof> { return prepareNativeHelloCopy(); }
export async function checkNativeHelloCopy(): Promise<HelloKeyProof> {
  copyChecks++;
  if (defer) await new Promise<void>((resolve) => { release = resolve; });
  const report = combinedReport(proofOutcome === 'cancelled' ? 'cancelled' : copyRelation === 'same-account-and-installation' ? 'copy-source-roundtrip-passed' : 'copy-isolation-observed');
  delete report.combinedState;
  return { ...report, purpose: 'synthetic-combined-copy', processScope: 'not-measured', copyEvidence: copyEvidence(), checks: [{test: 'copy-file-validate', status: 'passed'}, {test: 'copy-tpm-open', status: 'passed', nativeCode: copyRelation === 'same-account-and-installation' ? undefined : '0x80090016'}] };
}
Object.assign((window as any).helloTest, {
  copyRelation(value: typeof copyRelation) { copyRelation = value; },
  copyChecks() { return copyChecks; },
});
