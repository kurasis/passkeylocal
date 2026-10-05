import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { openStorage, VaultController } from '@passkey-local/vault-core';
import { BiometricVault } from '../src/worker/biometric.ts';
import { VaultWorkerHandlers } from '../src/worker/handlers.ts';

const PASSWORD = 'synthetic biometric master password';
const credential = { credentialId: new Uint8Array([1, 2, 3, 4]), salt: new Uint8Array(32).fill(7) };
const secret = new Uint8Array(32).fill(91);

async function setup() {
  const storage = await openStorage({ indexedDB: new IDBFactory() });
  const controller = new VaultController(storage);
  const biometric = new BiometricVault(storage, controller);
  const handlers = new VaultWorkerHandlers(storage, controller);
  await controller.create(PASSWORD);
  return { storage, controller, biometric, handlers };
}

describe('PRF-protected local unlock', () => {
  it('persists only an authenticated wrapper, wipes PRF input, and unlocks across worker restarts and edits', async () => {
    const { storage, controller, biometric, handlers } = await setup();
    const prf = secret.slice();
    await biometric.enable(PASSWORD, credential, prf);
    expect(prf.every((b) => b === 0)).toBe(true);
    const stored = await storage.getPreference<Record<string, unknown>>('biometricUnlock');
    expect(Object.keys(stored!).sort()).toEqual(['ciphertext', 'credentialId', 'iv', 'passwordEpoch', 'salt', 'version']);
    expect(new TextDecoder().decode(stored!.ciphertext as Uint8Array)).not.toContain(PASSWORD);
    await handlers.handle('createGroup', { name: 'Synthetic group' });
    controller.lock();
    const fresh = new VaultController(storage);
    const restarted = new BiometricVault(storage, fresh);
    expect(await restarted.credential()).toEqual(credential);
    await restarted.unlock(credential.credentialId, secret.slice());
    expect(fresh.current).not.toBeNull();
    await restarted.disable();
    fresh.lock();
    await expect(restarted.unlock(credential.credentialId, secret.slice())).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    await fresh.unlock(PASSWORD);
    expect(fresh.current).not.toBeNull();
  });

  it('requires an unlocked session and the correct master password before enrolling', async () => {
    const { controller, biometric } = await setup();
    await expect(biometric.enable('incorrect synthetic password', credential, secret.slice())).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(await biometric.credential()).toBeNull();
    controller.lock();
    await expect(biometric.enable(PASSWORD, credential, secret.slice())).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('refuses the wrong PRF, credential, and modified authenticated metadata/ciphertext', async () => {
    const { storage, controller, biometric } = await setup();
    await biometric.enable(PASSWORD, credential, secret.slice());
    controller.lock();
    await expect(biometric.unlock(credential.credentialId, new Uint8Array(32).fill(92))).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    await expect(biometric.unlock(new Uint8Array([9]), secret.slice())).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    const stored = (await storage.getPreference<{ ciphertext: Uint8Array; salt: Uint8Array }>('biometricUnlock'))!;
    stored.salt[0]! ^= 1;
    await storage.setPreference('biometricUnlock', stored);
    await expect(biometric.unlock(credential.credentialId, secret.slice())).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    stored.salt[0]! ^= 1;
    stored.ciphertext[0]! ^= 1;
    await storage.setPreference('biometricUnlock', stored);
    await expect(biometric.unlock(credential.credentialId, secret.slice())).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(controller.current).toBeNull();
  });

  it('does not enroll after lock or a concurrent head change during encryption', async () => {
    const { storage, controller, biometric } = await setup();
    const original = crypto.subtle.encrypt.bind(crypto.subtle);
    const spy = vi.spyOn(crypto.subtle, 'encrypt').mockImplementation(async (...args) => {
      const result = await original(...args);
      controller.lock();
      return result;
    });
    try { await expect(biometric.enable(PASSWORD, credential, secret.slice())).rejects.toMatchObject({ code: 'INVALID_STATE' }); }
    finally { spy.mockRestore(); }
    expect(await biometric.credential()).toBeNull();
    const generation = (await storage.readHead())!.generation;
    await controller.unlock(PASSWORD);
    await controller.current!.change((db) => { db.meta.name = 'synthetic changed name'; });
    await expect(storage.setPreference('biometricUnlock', { stale: true }, generation)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await storage.getPreference('biometricUnlock')).toBeUndefined();
  });

  it('invalidates enrollment on password rotation, snapshot restore, and file replacement', async () => {
    const { storage, biometric, handlers } = await setup();
    await biometric.enable(PASSWORD, credential, secret.slice());
    const next = 'synthetic rotated biometric master password';
    await handlers.handle('changePassword', { current: PASSWORD, next });
    expect(await biometric.credential()).toBeNull();
    await biometric.enable(next, credential, secret.slice());
    const head = (await storage.readHead())!;
    await handlers.handle('restoreSnapshot', { blobId: head.blobId, password: next });
    expect(await biometric.credential()).toBeNull();
    await biometric.enable(next, credential, secret.slice());
    const backup = await handlers.handle('prepareExport', undefined);
    await handlers.handle('openCandidate', { bytes: backup.bytes, password: next });
    await handlers.handle('adoptCandidate', { confirmReplace: true });
    expect(await biometric.credential()).toBeNull();
  });
});
