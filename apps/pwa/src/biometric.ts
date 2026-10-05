/** WebAuthn stays on the UI thread; only the worker unwraps the vault password. */
import type { BiometricCredential } from './protocol.ts';

export class BiometricError extends Error {
  readonly code: 'biometricUnavailable' | 'biometricCancelled' | 'biometricFailed';
  constructor(code: BiometricError['code']) {
    super(code);
    this.code = code;
  }
}

export async function biometricAvailable(): Promise<boolean> {
  if (!globalThis.isSecureContext || !globalThis.PublicKeyCredential || !navigator.credentials) return false;
  // Secure-context IP loopbacks still cannot be WebAuthn relying-party domains.
  if (/^[\d.]+$/.test(location.hostname) || location.hostname.includes(':')) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

function random(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32));
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extensions(salt: Uint8Array): AuthenticationExtensionsClientInputs {
  return { prf: { eval: { first: new Uint8Array(salt) } } } as AuthenticationExtensionsClientInputs;
}

type PrfResult = { enabled?: boolean; results?: { first: ArrayBuffer } };

function prfResult(c: PublicKeyCredential): PrfResult | undefined {
  return (c.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & { prf?: PrfResult }).prf;
}

/** Validate assertion context and user verification before handing the PRF secret to the worker. */
async function assertVerified(c: PublicKeyCredential, challenge: Uint8Array, id: Uint8Array): Promise<void> {
  const response = c.response as AuthenticatorAssertionResponse;
  const raw = new Uint8Array(c.rawId);
  if (raw.length !== id.length || !raw.every((b, i) => b === id[i])) throw new BiometricError('biometricFailed');
  const data = JSON.parse(new TextDecoder().decode(response.clientDataJSON));
  if (data.type !== 'webauthn.get' || data.challenge !== base64url(challenge) || data.origin !== location.origin || data.crossOrigin === true) {
    throw new BiometricError('biometricFailed');
  }
  const auth = new Uint8Array(response.authenticatorData);
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(location.hostname)));
  if (auth.length < 37 || (auth[32]! & 5) !== 5 || !rpHash.every((b, i) => auth[i] === b)) {
    throw new BiometricError('biometricFailed');
  }
}

function safeError(e: unknown): BiometricError {
  if (e instanceof BiometricError) return e;
  if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return new BiometricError('biometricCancelled');
  if (e instanceof DOMException && e.name === 'NotSupportedError') return new BiometricError('biometricUnavailable');
  return new BiometricError('biometricFailed');
}

export async function biometricSecret(credential: BiometricCredential, signal: AbortSignal): Promise<Uint8Array> {
  let secret: Uint8Array | undefined;
  try {
    const challenge = random();
    const c = await navigator.credentials.get({ signal, publicKey: {
      challenge, rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: new Uint8Array(credential.credentialId) }],
      userVerification: 'required', timeout: 60_000, extensions: extensions(credential.salt)
    } }) as PublicKeyCredential | null;
    if (!c) throw new BiometricError('biometricCancelled');
    const first = prfResult(c)?.results?.first;
    if (!first || first.byteLength !== 32) throw new BiometricError('biometricUnavailable');
    secret = new Uint8Array(first);
    await assertVerified(c, challenge, credential.credentialId);
    if (signal.aborted) throw new BiometricError('biometricCancelled');
    return secret;
  } catch (e) {
    secret?.fill(0);
    throw safeError(e);
  }
}

export async function enrollBiometric(signal: AbortSignal): Promise<{ credential: BiometricCredential; prf: Uint8Array }> {
  try {
    if (!(await biometricAvailable())) throw new BiometricError('biometricUnavailable');
    const salt = random();
    const c = await navigator.credentials.create({ signal, publicKey: {
      challenge: random(), rp: { id: location.hostname, name: 'PassKey Local' },
      user: { id: random(), name: 'local-vault', displayName: 'PassKey Local vault' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
      attestation: 'none', timeout: 60_000, extensions: extensions(salt)
    } }) as PublicKeyCredential | null;
    if (!c) throw new BiometricError('biometricCancelled');
    const created = prfResult(c);
    // Creation may itself return the evaluated secret; only the later get result is needed.
    if (created?.results?.first) new Uint8Array(created.results.first).fill(0);
    if (!created?.enabled) throw new BiometricError('biometricUnavailable');
    // Use a get assertion even if create returns PRF output: validates the exact later-unlock path.
    const credential = { credentialId: new Uint8Array(c.rawId), salt };
    return { credential, prf: await biometricSecret(credential, signal) };
  } catch (e) { throw safeError(e); }
}
