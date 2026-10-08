import { expect, test } from 'vitest';
import { createVault, serializeVerified, openVault, openVaultWithPasswordHash, changeMasterPassword, toRecoveryModel } from '../src/index.ts';
const password = 'Synthetic password component Ж 🔐';
const hash = async (p: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p)));
test('password component reopens multiple fresh-salt saves and survives ordinary password recovery', async () => {
  const created = createVault({ password });
  let bytes = (await serializeVerified(created.db)).bytes;
  for (let i=0; i<2; i++) {
    const component = await hash(password);
    const opened = await openVaultWithPasswordHash(bytes, component);
    expect(component.every(v => v===0)).toBe(true);
    expect(toRecoveryModel(opened.db)).toEqual(toRecoveryModel(created.db));
    bytes = (await serializeVerified(opened.db)).bytes;
  }
  expect(toRecoveryModel((await openVault(bytes, password)).db)).toEqual(toRecoveryModel(created.db));
  const changed = await changeMasterPassword(bytes, password, password+' changed');
  await expect(openVaultWithPasswordHash(changed.serialized.bytes, await hash(password))).rejects.toMatchObject({code:'AUTH_FAILED'});
  await expect(openVaultWithPasswordHash(changed.serialized.bytes, await hash(password+' changed'))).resolves.toBeTruthy();
}, 60_000);
test('invalid and wrong components are consumed without modifying ciphertext', async () => {
  const bytes = (await serializeVerified(createVault({password}).db)).bytes;
  const before = bytes.slice();
  for (const n of [0,31,33,32]) {
    const component = new Uint8Array(n).fill(17);
    await expect(openVaultWithPasswordHash(bytes, component)).rejects.toMatchObject({code:n===32?'AUTH_FAILED':'INVALID_INPUT'});
    expect(component.every(v=>v===0)).toBe(true); expect(bytes).toEqual(before);
  }
});
