/** Runs in an isolated worker. No active vault/client/storage API is imported. */
import { createVault, createEntry, updateEntry, serializeVerified, openVault, openVaultWithPasswordHash, toRecoveryModel, type EntryInput, type Kdbx } from '@passkey-local/vault-adapter';
import fixture from '../fixtures/hello-recovery.json' with { type: 'json' };
import type { HelloKeyProof, HelloProofStage } from '../../pwa/src/hello-protocol.ts';
export interface RecoveryReply { report: HelloKeyProof; ticket?: string; passwordHash?: number[] }
export type RecoveryBridge = (action: 'prepare' | 'revoke', ticket?: string) => Promise<RecoveryReply>;
export async function createRecoveryFixture() {
  const { db } = createVault({ password: fixture.password, name: 'Public Hello recovery test' });
  const input: EntryInput = { title: 'Synthetic account', username: 'example', password: 'synthetic-before', url: 'https://example.invalid', notes: '', tags: ['synthetic'], customFields: [{ name: 'fixture', value: fixture.id, protected: true }], expiresAt: null };
  const id = createEntry(db, input);
  updateEntry(db, id, { ...input, password: 'synthetic-after' });
  createEntry(db, { ...input, title: 'Second synthetic record' });
  const serialized = await serializeVerified(db);
  return { bytes: serialized.bytes, expected: JSON.stringify(toRecoveryModel(db)) };
}
function equalModel(db: Kdbx, expected: string) {
  if (JSON.stringify(toRecoveryModel(db)) !== expected) throw new Error('INTEGRITY');
}
export async function runRecovery(bridge: RecoveryBridge, current: () => boolean = () => true): Promise<HelloKeyProof> {
  let report: HelloKeyProof = { version: 1, purpose: 'synthetic-kdbx-recovery', eligible: false, enrolled: false, unlocked: false, outcome: 'blocked', checks: [], processScope: 'same-process', remaining: ['fresh-authorization-proof','fresh-process-proof','account-machine-copy-proof'] };
  let ticket: string | undefined;
  let stage: HelloProofStage = 'recovery-kdbx-create';
  let component: Uint8Array | undefined;
  const active = () => { if (!current()) throw new Error('INTERRUPTED'); };
  const passed = () => report.checks.push({ test: stage, status: 'passed' });
  const append = (r: HelloKeyProof) => {
    const previous = report.checks;
    report = { ...r, checks: [...previous, ...r.checks] };
  };
  try {
    active();
    const data = await createRecoveryFixture(); active(); passed();
    stage = 'recovery-worker';
    const prepared = await bridge('prepare');
    ticket = prepared.ticket;
    append(prepared.report);
    // Consume and wipe transport arrays even for refused/late results.
    if (prepared.passwordHash) { component = Uint8Array.from(prepared.passwordHash); prepared.passwordHash.fill(0); }
    active();
    if (report.outcome !== 'recovery-prepared') return report;
    if (!ticket || component?.length !== 32) throw new Error('INVALID_NATIVE_REPLY');
    stage = 'recovery-kdbx-hello-open';
    // No fallback or hardcoded credential may satisfy this positive control.
    let opened = await openVaultWithPasswordHash(data.bytes, component); component = undefined;
    active(); equalModel(opened.db, data.expected); passed();
    stage = 'recovery-kdbx-resave';
    // Exercise fresh salts/IVs with this credential object, preserving logical data.
    const saved = await serializeVerified(opened.db);
    active(); passed();
    // Release the recovered credential object before deleting its protected keys.
    await opened.db.credentials.setPassword(null);
    opened = undefined as unknown as typeof opened;
    stage = 'recovery-worker';
    const revoked = await bridge('revoke', ticket);
    append(revoked.report);
    if (revoked.report.combinedState === 'no-test') ticket = undefined;
    active();
    if (revoked.report.outcome !== 'recovery-revoked') return report;
    stage = 'recovery-kdbx-wrong-password';
    let rejected = false;
    try { await openVault(saved.bytes, fixture.password + '-wrong'); }
    catch (error) { if ((error as { code?: string }).code !== 'AUTH_FAILED') throw error; rejected = true; }
    if (!rejected) throw new Error('WRONG_PASSWORD_ACCEPTED');
    active(); passed();
    stage = 'recovery-kdbx-password-open';
    // Fresh standard credentials, after native deletion. No Hello material is used.
    const recovered = await openVault(saved.bytes, fixture.password);
    active(); passed();
    stage = 'recovery-kdbx-integrity';
    equalModel(recovered.db, data.expected); passed();
    report.outcome = 'vault-recovery-passed';
    report.recovery = { fixture: fixture.id, scope: 'public-synthetic-kdbx', entries: 2, history: 1, accountTest: 'excluded-by-owner' };
    return report;
  } catch {
    report.outcome = current() ? 'blocked' : 'interrupted';
    report.checks.push({ test: stage, status: current() ? 'failed' : 'interrupted', operation: 'recovery-worker-or-integration-failed' });
    return report;
  } finally {
    component?.fill(0);
    if (ticket) {
      const outcome = report.outcome;
      try {
        const cleanup = await bridge('revoke', ticket);
        report.checks.push(...cleanup.report.checks);
        report.combinedState = cleanup.report.combinedState;
        if (cleanup.report.combinedState !== 'no-test') report.outcome = 'blocked';
        else report.outcome = outcome;
      } catch {
        report.combinedState = 'cleanup-required';
        report.outcome = 'blocked';
        report.checks.push({ test: 'recovery-worker', status: 'failed', operation: 'recovery-disposal-failed' });
      }
    }
  }
}
