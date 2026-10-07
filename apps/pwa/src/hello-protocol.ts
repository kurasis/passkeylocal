/** Nonsensitive diagnostics, separate from protected vault unlock. */
export type HelloConfiguration = 'available' | 'device-not-present' | 'not-configured' | 'disabled-by-policy' | 'device-busy' | 'unknown' | 'not-probed';
export type HelloVerificationResult = Exclude<HelloConfiguration, 'available' | 'not-probed'> | 'verified' | 'cancelled' | 'retries-exhausted';
export interface HelloStatus {
  available: false;
  enrolled: false;
  reason: 'protected-key-proof-required';
  helloConfiguration: HelloConfiguration;
  mode: 'off';
}
export interface HelloVerification {
  result: HelloVerificationResult;
  purpose: 'diagnostic-only';
  unlocked: false;
  enrolled: false;
}

export type HelloProofStage = 'hello-configuration' | 'provider-open' | 'key-create' | 'key-policy' | 'policy-readback' | 'attestation-claim' | 'public-wrap' | 'private-export' | 'silent-before' | 'unwrap-first' | 'silent-after-first' | 'unwrap-second' | 'silent-after-second' | 'test-key-delete';
export interface HelloKeyProof {
  version: 1;
  sourceCommit?: string;
  purpose: 'synthetic-key-proof' | 'synthetic-oaep-capability' | 'synthetic-pkcs1-compatibility' | 'synthetic-pkcs1-behavior' | 'synthetic-attestation-capability';
  algorithm?: 'rsa-oaep-sha256' | 'rsa-pkcs1-v1_5' | 'rsa-2048-decrypt-only';
  eligible: false;
  unlocked: false;
  enrolled: false;
  outcome: 'roundtrip-passed' | 'capability-passed' | 'compatibility-passed' | 'behavior-passed' | 'attestation-capability-observed' | 'blocked' | 'cancelled' | 'interrupted';
  checks: { test: HelloProofStage; status: 'passed' | 'failed' | 'cancelled' | 'interrupted' | 'not-run'; nativeCode?: string; operation?: string }[];
  exportChecks?: { format: 'rsa-private' | 'rsa-full-private' | 'pkcs8-private'; result: 'refused' | 'unsupported-format' | 'unexpected-success' | 'failed' | 'not-run'; nativeCode?: string }[];
  attestationClaim?: { api: 'NCryptCreateClaim'; claimType: 'subject-only'; result: 'returned-unverified' | 'unavailable' | 'invalid-length'; verification: 'not-performed'; bytes?: number };
  remaining: ('per-key-tpm-proof' | 'fresh-authorization-proof' | 'fresh-process-proof' | 'account-machine-copy-proof')[];
}
