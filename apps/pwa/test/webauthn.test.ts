import { afterEach, describe, expect, it, vi } from 'vitest';
import { biometricSecret } from '../src/biometric.ts';

const credential = { credentialId: new Uint8Array([1, 2, 3]), salt: new Uint8Array(32) };
afterEach(() => vi.unstubAllGlobals());

function base64url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url');
}

async function assertion(challenge: Uint8Array) {
  const auth = new Uint8Array(37);
  auth.set(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('localhost'))));
  auth[32] = 5; // user presence and user verification
  const client = { type: 'webauthn.get', origin: 'http://localhost:4173', challenge: base64url(challenge) };
  return { auth, client, id: credential.credentialId.slice(), secret: new Uint8Array(32).fill(81) };
}

type Assertion = Awaited<ReturnType<typeof assertion>>;
function mockGet(mutate: (a: Assertion) => void) {
  vi.stubGlobal('location', { hostname: 'localhost', origin: 'http://localhost:4173' });
  vi.stubGlobal('navigator', { credentials: { get: async ({ publicKey }: { publicKey: PublicKeyCredentialRequestOptions }) => {
    expect(publicKey.userVerification).toBe('required');
    const a = await assertion(new Uint8Array(publicKey.challenge as ArrayBuffer));
    mutate(a);
    return {
      rawId: a.id.buffer,
      response: { clientDataJSON: new TextEncoder().encode(JSON.stringify(a.client)).buffer, authenticatorData: a.auth.buffer },
      getClientExtensionResults: () => ({ prf: { results: { first: a.secret.buffer } } })
    };
  } } });
}

describe('WebAuthn assertion context', () => {
  it('accepts a matching user-verified assertion and maps cancellation to a safe message', async () => {
    mockGet(() => {});
    expect(await biometricSecret(credential, new AbortController().signal)).toEqual(new Uint8Array(32).fill(81));
    vi.stubGlobal('navigator', { credentials: { get: () => Promise.reject(new DOMException('private detail', 'NotAllowedError')) } });
    await expect(biometricSecret(credential, new AbortController().signal)).rejects.toMatchObject({ code: 'biometricCancelled', message: 'biometricCancelled' });
  });

  it.each(['origin', 'challenge', 'type', 'rp', 'uv', 'up', 'credential'] as const)('rejects mismatched %s and overwrites the returned PRF', async (field) => {
    let secret: Uint8Array | undefined;
    mockGet((a) => {
      secret = a.secret;
      if (field === 'origin') a.client.origin = 'https://other.example';
      if (field === 'challenge') a.client.challenge = 'unrelated';
      if (field === 'type') a.client.type = 'webauthn.create';
      if (field === 'rp') a.auth[0]! ^= 1;
      if (field === 'uv') a.auth[32] = 1;
      if (field === 'up') a.auth[32] = 4;
      if (field === 'credential') a.id[0]! ^= 1;
    });
    await expect(biometricSecret(credential, new AbortController().signal)).rejects.toMatchObject({ code: 'biometricFailed' });
    expect(secret!.every((b) => b === 0)).toBe(true);
  });

  it('discards a result received after cancellation', async () => {
    const abort = new AbortController();
    let secret: Uint8Array | undefined;
    mockGet((a) => { secret = a.secret; abort.abort(); });
    await expect(biometricSecret(credential, abort.signal)).rejects.toMatchObject({ code: 'biometricCancelled' });
    expect(secret!.every((b) => b === 0)).toBe(true);
  });
});
