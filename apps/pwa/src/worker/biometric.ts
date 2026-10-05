/** Encrypt the master password with a WebAuthn PRF secret, never with an origin-stored key. */
import { openVault, VaultError } from '@passkey-local/vault-adapter';
import { StorageError, type VaultController, type VaultStorage } from '@passkey-local/vault-core';
import type { BiometricCredential } from '../protocol.ts';

const SLOT = 'biometricUnlock';
interface Record extends BiometricCredential {
  version: 1;
  passwordEpoch: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

function validCredential(c: BiometricCredential): boolean {
  return c?.credentialId instanceof Uint8Array && c.credentialId.length > 0 && c.credentialId.length <= 1024 &&
    c.salt instanceof Uint8Array && c.salt.length === 32;
}

function aad(r: Pick<Record, 'credentialId' | 'salt' | 'passwordEpoch'>): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(['PassKey Local biometric v1', [...r.credentialId], [...r.salt], r.passwordEpoch]));
}

async function key(prf: Uint8Array): Promise<CryptoKey> {
  if (!(prf instanceof Uint8Array) || prf.length !== 32) throw new VaultError('INVALID_INPUT', 'biometric-prf');
  const material = new Uint8Array(prf);
  try { return await crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  finally { material.fill(0); }
}

export class BiometricVault {
  private readonly storage: VaultStorage;
  private readonly controller: VaultController;

  constructor(storage: VaultStorage, controller: VaultController) {
    this.storage = storage;
    this.controller = controller;
  }

  private async record(): Promise<Record | null> {
    const r = await this.storage.getPreference<Record | null>(SLOT);
    const head = await this.storage.readHead();
    if (!r || !head || r.version !== 1 || !validCredential(r) || r.passwordEpoch !== head.passwordEpoch ||
      !(r.iv instanceof Uint8Array) || r.iv.length !== 12 || !(r.ciphertext instanceof Uint8Array) ||
      r.ciphertext.length < 17 || r.ciphertext.length > 4112) return null;
    return r;
  }

  async credential(): Promise<BiometricCredential | null> {
    const r = await this.record();
    return r ? { credentialId: r.credentialId, salt: r.salt } : null;
  }

  async enable(password: string, credential: BiometricCredential, prf: Uint8Array): Promise<void> {
    let plaintext: Uint8Array<ArrayBuffer> | undefined;
    try {
      const session = this.controller.current;
      if (!session || session.invalidated || session.hasUnsavedChanges) throw new StorageError('INVALID_STATE', 'locked-or-unsaved');
      if (!validCredential(credential)) throw new VaultError('INVALID_INPUT', 'biometric-credential');
      const current = await this.storage.readCurrent();
      if (!current || current.head.generation !== session.head.generation) throw new StorageError('CONFLICT', 'generation');
      // Re-entered password must open the committed head, not an unrelated backup.
      await openVault(current.blob.bytes, password);
      const r: Record = { ...credential, version: 1, passwordEpoch: current.head.passwordEpoch,
        iv: crypto.getRandomValues(new Uint8Array(12)), ciphertext: new Uint8Array() };
      plaintext = new TextEncoder().encode(password);
      r.ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(r.iv), additionalData: aad(r) }, await key(prf), plaintext));
      if (session.invalidated || this.controller.current !== session) throw new StorageError('INVALID_STATE', 'locked');
      // Atomic check prevents a concurrent vault replacement/rotation from installing a stale wrapper.
      await this.storage.setPreference(SLOT, r, current.head.generation);
    } finally {
      plaintext?.fill(0);
      prf.fill(0);
    }
  }

  async unlock(credentialId: Uint8Array, prf: Uint8Array) {
    let plaintext: Uint8Array | undefined;
    try {
      const r = await this.record();
      if (!r || credentialId.length !== r.credentialId.length || !credentialId.every((b, i) => b === r.credentialId[i])) {
        throw new VaultError('AUTH_FAILED', 'biometric-credential');
      }
      try {
        plaintext = new Uint8Array(await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(r.iv), additionalData: aad(r) }, await key(prf), new Uint8Array(r.ciphertext)));
      } catch {
        throw new VaultError('AUTH_FAILED', 'biometric-secret');
      }
      // The password and KDBX KDF remain authoritative; no authentication-only shortcut.
      const result = await this.controller.unlock(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
      return { warnings: result.warnings };
    } finally {
      plaintext?.fill(0);
      prf.fill(0);
    }
  }

  disable(): Promise<void> {
    return this.storage.setPreference(SLOT, null);
  }
}
