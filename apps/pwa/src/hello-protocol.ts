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
