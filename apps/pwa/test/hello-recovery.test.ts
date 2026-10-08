import { expect, test } from 'vitest';
import { runRecovery, type RecoveryBridge, type RecoveryReply } from '../../desktop/src/hello-recovery.ts';
import fixture from '../../desktop/fixtures/hello-recovery.json';
import type { HelloKeyProof } from '../src/hello-protocol.ts';
const base = (): HelloKeyProof => ({version:1,purpose:'synthetic-kdbx-recovery',eligible:false,enrolled:false,unlocked:false,outcome:'recovery-prepared',combinedState:'recovery-ready',checks:[],remaining:['fresh-authorization-proof','fresh-process-proof','account-machine-copy-proof']});
async function prepared(): Promise<RecoveryReply> { return {report:base(),ticket:'synthetic-ticket',passwordHash:[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fixture.password)))]}; }
const revoked = (): RecoveryReply => ({report:{...base(),outcome:'recovery-revoked',combinedState:'no-test'}});
test('actual KDBX opens with unwrapped component and recovers independently after revocation', async () => {
  const reply = await prepared(); const actions: string[]=[];
  const report = await runRecovery(async action => { actions.push(action); return action==='prepare'?reply:revoked(); });
  expect(actions).toEqual(['prepare','revoke']); expect(report.outcome).toBe('vault-recovery-passed');
  expect(report.recovery).toMatchObject({entries:2,history:1,scope:'public-synthetic-kdbx'});
  expect(reply.passwordHash!.every(v=>v===0)).toBe(true);
  const serialized=JSON.stringify(report); expect(serialized).not.toContain(fixture.password); expect(serialized).not.toContain('passwordHash'); expect(serialized).not.toContain('synthetic-ticket');
  expect(report.checks.map(c=>c.test)).toContain('recovery-kdbx-wrong-password');
},60_000);
test('a wrong native component cannot be masked by the known test password; owned keys are cleaned', async () => {
  const reply=await prepared(); reply.passwordHash!.fill(1); const actions:string[]=[];
  const report=await runRecovery(async action=>{actions.push(action);return action==='prepare'?reply:revoked();});
  expect(report.outcome).toBe('blocked'); expect(actions).toEqual(['prepare','revoke']);
  expect(report.checks.find(c=>c.test==='recovery-kdbx-hello-open')?.status).toBe('failed');
  expect(report.checks.some(c=>c.test==='recovery-kdbx-password-open')).toBe(false);
});
test('cancelled native prepare cannot report recovery and starts no fallback', async () => {
  const report=await runRecovery(async action=>{ expect(action).toBe('prepare');return {report:{...base(),outcome:'cancelled',combinedState:'no-test'}};});
  expect(report.outcome).toBe('cancelled'); expect(report.recovery).toBeUndefined();
});
test('stale prepare wipes transport material, cleans its ticket and never opens KDBX', async () => {
  const reply=await prepared(); let current=true;
  const report=await runRecovery(async action=>{ if(action==='prepare'){current=false;return reply;}return revoked();},()=>current);
  expect(report.outcome).toBe('interrupted'); expect(report.combinedState).toBe('no-test');
  expect(reply.passwordHash!.every(v=>v===0)).toBe(true); expect(report.checks.some(c=>c.test==='recovery-kdbx-hello-open')).toBe(false);
});
test('failed key deletion never becomes successful password-recovery acceptance', async () => {
  const reply=await prepared();
  const bridge:RecoveryBridge=async action=>action==='prepare'?reply:{report:{...base(),outcome:'blocked',combinedState:'cleanup-required',checks:[{test:'test-key-delete',status:'failed'}]}};
  const report=await runRecovery(bridge);
  expect(report.outcome).toBe('blocked'); expect(report.combinedState).toBe('cleanup-required');
  expect(report.checks.some(c=>c.test==='recovery-kdbx-password-open')).toBe(false);
});
