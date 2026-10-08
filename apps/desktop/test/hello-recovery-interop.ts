/** Independent password recovery of actual hash-opened/re-saved public KDBX. */
import assert from 'node:assert/strict';
import { createHash, } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openVaultWithPasswordHash, serializeVerified } from '@passkey-local/vault-adapter';
import { createRecoveryFixture } from '../src/hello-recovery.ts';
import fixture from '../fixtures/hello-recovery.json' with { type: 'json' };
const root = resolve(import.meta.dirname, '../../..');
const folder = await mkdtemp(join(tmpdir(), 'hello-kdbx-recovery-'));
try {
  const test = await createRecoveryFixture();
  const db = (await openVaultWithPasswordHash(test.bytes, new Uint8Array(createHash('sha256').update(fixture.password).digest()))).db;
  const saved = await serializeVerified(db);
  await db.credentials.setPassword(null);
  const file = join(folder, 'synthetic.kdbx'); const output = join(folder, 'recovery.json');
  await writeFile(file, saved.bytes, {mode:0o600});
  const python = process.env.RECOVERY_PYTHON ?? join(root, 'tools/vault-recovery/.venv', process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const args = ['-m','vault_recovery','export-json',file,'--password-stdin','--output',output,'--allow-plaintext','--yes'];
  const options = {encoding:'utf8' as const,env:{...process.env,PYTHONPATH:join(root,'tools/vault-recovery/src')}};
  const wrong = spawnSync(python,args,{...options,input:fixture.password+'-wrong'});
  assert.notEqual(wrong.status,0); assert.equal(wrong.error,undefined);
  const recovered = spawnSync(python,args,{...options,input:fixture.password});
  assert.equal(recovered.status,0,'Independent recovery must succeed');
  const result=JSON.parse(await readFile(output,'utf8')); delete result.exported_at; delete result.source.sha256;
  assert.deepEqual(result,JSON.parse(test.expected));
  console.log('PASS: public Hello KDBX credential-component re-save, Python wrong-password rejection and full records/history recovery (no hardware claim).');
} finally { await rm(folder,{recursive:true,force:true}); }
