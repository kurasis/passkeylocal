/** Real shared KDBX engine -> real native file service -> independent Python.
 * Synthetic corpus only. This harness is not packaged-app/Windows evidence.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { NativeVaultStorage, VaultController } from '@passkey-local/vault-core';
import { findEntry, listEntries, openVault, readEntry, toRecoveryModel, updateEntry } from '@passkey-local/vault-adapter';

const root = resolve(import.meta.dirname, '../../..');
const temp = await mkdtemp(join(tmpdir(), 'passkey-native-interop-'));
const executable = join(root, 'apps/desktop/src-tauri/target/debug/examples/storage_fixture_driver' + (process.platform === 'win32' ? '.exe' : ''));
let child: ReturnType<typeof spawn>;
let stopped = false;
function start() {
  stopped = false;
  child = spawn(executable, [join(temp, 'managed')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const replies = createInterface({ input: child.stdout! });
  const pending: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
  let failure: Error | null = null;
  replies.on('line', (line) => {
    const reply = JSON.parse(line); const request = pending.shift();
    if (!request) return;
    if (reply.ok) request.resolve(reply.result); else request.reject(reply.error);
  });
  child.on('exit', () => { failure = new Error('Native fixture process exited'); for (const p of pending.splice(0)) p.reject(failure); });
  return new NativeVaultStorage((operation, args = {}) => new Promise((resolve, reject) => {
    if (failure) { reject(failure); return; }
    pending.push({ resolve, reject }); child.stdin!.write(JSON.stringify({ operation, args }) + '\n');
  }));
}
async function stop() { if (stopped) return; stopped = true; child.stdin!.end(); await once(child, 'exit'); }
try {
  const manifest = JSON.parse(await readFile(join(root, 'tests/interop/fixtures/manifest.json'), 'utf8'));
  const fixture = manifest.fixtures.find((f: { file: string }) => f.file === 'full.kdbx');
  const password = fixture.password;
  const bytes = new Uint8Array(await readFile(join(root, 'tests/interop/fixtures/full.kdbx')));
  const original = toRecoveryModel((await openVault(bytes, password)).db);
  let storage = start(); let controller = new VaultController(storage);
  await controller.adoptCandidate(await controller.openCandidate(bytes, password), { confirmReplace: false });
  assert.deepEqual(toRecoveryModel(controller.current!.db).entries, original.entries);
  assert.deepEqual(toRecoveryModel(controller.current!.db).groups, original.groups);
  const session = controller.current!;
  const target = listEntries(session.db).find((e) => !e.inRecycleBin)!;
  const input = readEntry(session.db, target.uuid);
  const oldHistory = findEntry(session.db, target.uuid).history.length;
  await session.change((db) => updateEntry(db, target.uuid, { ...input, password: 'synthetic-desktop-edited-🔑' }));
  assert.equal(findEntry(session.db, target.uuid).history.length, oldHistory + 1);
  const exported = await session.prepareExport();
  const expected = toRecoveryModel((await openVault(exported.bytes, password)).db);
  controller.lock(); await stop();
  storage = start(); controller = new VaultController(storage);
  await assert.rejects(controller.unlock('synthetic-wrong-password'));
  await controller.unlock(password);
  assert.deepEqual(toRecoveryModel(controller.current!.db), expected);
  const rotatedPassword = 'synthetic-Windows-rotated-2026';
  await controller.current!.changePassword(password, rotatedPassword);
  const rotated = await controller.current!.prepareExport();
  await assert.rejects(openVault(rotated.bytes, password));
  assert.deepEqual(toRecoveryModel((await openVault(rotated.bytes, rotatedPassword)).db).entries, expected.entries);
  const file = join(temp, 'desktop-export.kdbx'); const output = join(temp, 'recovered.json');
  await writeFile(file, rotated.bytes, { mode: 0o600 });
  const python = process.env.RECOVERY_PYTHON ?? join(root, 'tools/vault-recovery/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const result = spawnSync(python, ['-m', 'vault_recovery', 'export-json', file, '--password-stdin', '--output', output, '--allow-plaintext', '--yes'], {
    input: Buffer.from(rotatedPassword), encoding: 'utf8', env: { ...process.env, PYTHONPATH: join(root, 'tools/vault-recovery/src') }
  });
  assert.equal(result.status, 0, 'Independent Python recovery must succeed');
  const recovered = JSON.parse(await readFile(output, 'utf8'));
  delete recovered.exported_at; delete recovered.source.sha256;
  assert.deepEqual(recovered, toRecoveryModel((await openVault(rotated.bytes, rotatedPassword)).db));
  await stop();
  console.log('PASS: native save/restart/edit/history/password rotation and full independent Python parity (synthetic corpus).');
} finally {
  if (!stopped && child!) await stop();
  await rm(temp, { recursive: true, force: true });
}
