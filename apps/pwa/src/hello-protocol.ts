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

export type HelloProofStage = 'hello-configuration' | 'provider-open' | 'key-create' | 'key-policy' | 'policy-readback' | 'attestation-claim' | 'public-wrap' | 'private-export' | 'silent-before' | 'unwrap-first' | 'silent-after-first' | 'unwrap-second' | 'silent-after-second' | 'test-key-delete' | 'webauthn-load' | 'webauthn-api' | 'hello-platform' | 'hello-route' | 'prf-create' | 'prf-first' | 'prf-repeat' | 'prf-changed' | 'prf-roundtrip' | 'test-passkey-delete' | 'webauthn-direct-create' | 'tpm-provider-open' | 'tpm-provider-properties' | 'tpm-key-create' | 'tpm-key-policy' | 'tpm-key-readback' | 'tpm-public-wrap' | 'tpm-unwrap-first' | 'tpm-reopen-unwrap' | 'tpm-negative-controls';
export interface HelloKeyProof {
  version: 1;
  sourceCommit?: string;
  purpose: 'synthetic-key-proof' | 'synthetic-oaep-capability' | 'synthetic-pkcs1-compatibility' | 'synthetic-pkcs1-behavior' | 'synthetic-attestation-capability' | 'webauthn-prf-capability' | 'synthetic-webauthn-prf' | 'tpm-inner-capability' | 'synthetic-tpm-inner' | 'synthetic-webauthn-direct-attestation';
  algorithm?: 'rsa-oaep-sha256' | 'rsa-pkcs1-v1_5' | 'rsa-2048-decrypt-only' | 'webauthn-prf-aes256gcm' | 'platform-rsa-oaep-sha256' | 'webauthn-es256-direct-attestation';
  eligible: false;
  unlocked: false;
  enrolled: false;
  outcome: 'roundtrip-passed' | 'capability-passed' | 'compatibility-passed' | 'behavior-passed' | 'attestation-capability-observed' | 'webauthn-capability-observed' | 'prf-roundtrip-passed' | 'tpm-capability-observed' | 'tpm-inner-roundtrip-passed' | 'direct-attestation-not-provided' | 'direct-attestation-returned-unverified' | 'blocked' | 'cancelled' | 'interrupted';
  checks: { test: HelloProofStage; status: 'passed' | 'failed' | 'cancelled' | 'interrupted' | 'not-run'; nativeCode?: string; operation?: string }[];
  exportChecks?: { format: 'rsa-private' | 'rsa-full-private' | 'pkcs8-private'; result: 'refused' | 'unsupported-format' | 'unexpected-success' | 'failed' | 'not-run'; nativeCode?: string }[];
  attestationClaim?: { api: 'NCryptCreateClaim'; claimType: 'subject-only'; result: 'returned-unverified' | 'unavailable' | 'invalid-length'; verification: 'not-performed'; bytes?: number };
  webauthn?: { osBuild?: number; apiVersion?: number; platformAvailable?: boolean; helloCandidates?: number; helloLocked?: boolean; routing: 'display-name-candidate'; tpmBinding: 'not-verified' };
  tpm?: { implementationFlags?: number; tpmVersion?: number; interfaceType?: number; keyNameBytes?: number; exportPolicy?: number; keyUsage?: number; keyLengthBits?: number; pcpKeyUsage?: number; pcpUsageKind?: number; pcpUsageFlags?: number };
  directAttestation?: { requested: 'direct'; format: 'none' | 'tpm' | 'packed' | 'fido-u2f' | 'unsupported'; decodeType: number; statementBytes: number; objectBytes: number; signatureBytes?: number; coseAlgorithm?: number; certificateCount?: number; certificateBytes?: number; certifyInfoBytes?: number; publicAreaBytes?: number; verification: 'not-performed'; subject: 'synthetic-webauthn-prf-credential'; prfSecretProtection: 'not-verified'; innerRsaKey: 'not-attested' };
  perKeyTpmEvidence?: 'not-verified';
  authorization?: 'no-hello-authorization';
  processScope?: 'same-process';
  remaining: ('per-key-tpm-proof' | 'fresh-authorization-proof' | 'fresh-process-proof' | 'account-machine-copy-proof')[];
}
