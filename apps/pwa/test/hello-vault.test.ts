import { IDBFactory } from 'fake-indexeddb';
import { expect, test } from 'vitest';
import { createEntry, listEntries, updateEntry } from '@passkey-local/vault-adapter';
import { VaultController, openStorage } from '@passkey-local/vault-core';
import { NativeHelloVault, type NativeHelloReply } from '../../desktop/src/hello-vault.ts';
const password = 'Synthetic Hello component password 2026!';
const enabled = { state: 'enabled' as const, mode: 'session' as const, expiresAt: 12345678 };
async function rig() {
  const storage = await openStorage({ indexedDB: new IDBFactory() });
  const controller = new VaultController(storage);
  await controller.create(password);
  return { storage, controller };
}
async function hash() { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)))]; }
test('fresh password verification precedes enrollment, sends only component and clears its wire copy', async () => {
  const { storage, controller } = await rig();
  const seen: Record<string, unknown>[] = [];
  let atCall: Record<string, unknown> | undefined;
  const hello = new NativeHelloVault(storage, controller, async request => { seen.push(request); atCall = structuredClone(request); return { status: enabled }; });
  await expect(hello.enable('wrong', 'session')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  expect(seen).toHaveLength(0);
  await expect(hello.enable(password, 'session')).resolves.toEqual(enabled);
  expect(atCall).toMatchObject({ operation: 'enroll', mode: 'session', generation: 1, component: await hash() });
  expect(JSON.stringify(atCall)).not.toContain(password);
  expect((seen[0]!.component as number[]).every(v => v === 0)).toBe(true);
});
test('Hello component opens normal saved revisions with history, then password recovery still works', async () => {
  const { storage, controller } = await rig();
  const input = { title: 'Synthetic Hello entry', username: '', password: 'first', url: '', notes: '', tags: [], customFields: [], expiresAt: null };
  const id = await controller.current!.change(db => createEntry(db, input));
  await controller.current!.change(db => updateEntry(db, id, { ...input, password: 'second' }));
  controller.lock();
  const current = (await storage.readCurrent())!;
  const reply: NativeHelloReply = { status: enabled, component: await hash(), binding: { generation: current.head.generation, sha256: current.blob.sha256 } };
  const hello = new NativeHelloVault(storage, controller, async () => reply);
  const result = await hello.unlock();
  expect(Object.keys(result)).toEqual(['warnings']);
  expect(listEntries(controller.current!.db)[0]!.historyCount).toBe(1);
  expect(reply.component!.every(v => v === 0)).toBe(true);
  await controller.current!.change(db => createEntry(db, { ...input, title: 'After Hello' }));
  controller.lock(); await controller.unlock(password);
  expect(listEntries(controller.current!.db)).toHaveLength(2);
});
test('wrong returned component or stale head never unlocks, even though master password remains valid', async () => {
  const { storage, controller } = await rig(); controller.lock();
  const current = (await storage.readCurrent())!;
  let reply: NativeHelloReply = { status: enabled, component: Array(32).fill(7), binding: { generation: current.head.generation, sha256: current.blob.sha256 } };
  const hello = new NativeHelloVault(storage, controller, async () => reply);
  await expect(hello.unlock()).rejects.toMatchObject({ code: 'AUTH_FAILED' }); expect(controller.current).toBeNull();
  reply = { status: enabled, component: await hash(), binding: { generation: 99, sha256: current.blob.sha256 } };
  await expect(hello.unlock()).rejects.toMatchObject({ code: 'CONFLICT' }); expect(controller.current).toBeNull();
  expect(reply.component!.every(v => v === 0)).toBe(true);
  await controller.unlock(password); expect(controller.current).not.toBeNull();
});
test('cancellation is surfaced without retry or password fallback', async () => {
  const { storage, controller } = await rig(); controller.lock(); let calls = 0;
  const hello = new NativeHelloVault(storage, controller, async () => { calls++; throw { code: 'HELLO_CANCELLED' }; });
  await expect(hello.unlock()).rejects.toMatchObject({ code: 'UNAVAILABLE', detail: 'HELLO_CANCELLED' });
  expect(controller.current).toBeNull(); expect(calls).toBe(1);
});
test('lock while binary KDBX opens invalidates its result and consumes component', async () => {
  const { storage, controller } = await rig(); const current = (await storage.readCurrent())!;
  const component = Uint8Array.from(await hash());
  const pending = controller.unlockWithPasswordHash(component, { generation: current.head.generation, sha256: current.blob.sha256 });
  controller.lock(); await expect(pending).rejects.toMatchObject({ code: 'INVALID_STATE' });
  expect(controller.current).toBeNull(); expect(component.every(v => v === 0)).toBe(true);
});
test('a previous component fails after master-password rotation', async () => {
  const { storage, controller } = await rig();
  await controller.current!.changePassword(password, 'New synthetic password for rotation 2026!'); controller.lock();
  const current = (await storage.readCurrent())!;
  await expect(controller.unlockWithPasswordHash(Uint8Array.from(await hash()), { generation: current.head.generation, sha256: current.blob.sha256 })).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  await controller.unlock('New synthetic password for rotation 2026!'); expect(controller.current).not.toBeNull();
});
