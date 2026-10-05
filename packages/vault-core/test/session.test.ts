import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { VaultError, createEntry, listEntries, readEntry, updateEntry } from '@passkey-local/vault-adapter';
import { StorageError, VaultController, openStorage, type FaultPoint } from '../src/index.ts';

const PW = 'correct horse battery staple 2026';
const PW2 = 'another synthetic passphrase 42';

function entry(title: string) {
  return { title, username: 'synthetic.user@example.test', password: `pw-${title}`, url: 'https://example.test/', notes: '', tags: [] as string[], customFields: [], expiresAt: null };
}

interface Rig {
  indexedDB: IDBFactory;
  faults: Set<FaultPoint>;
  quota: { on: boolean };
  clock: { t: number };
  controller: VaultController;
}

async function rig(indexedDB = new IDBFactory()): Promise<Rig> {
  const faults = new Set<FaultPoint>();
  const quota = { on: false };
  const clock = { t: Date.parse('2026-10-04T10:00:00Z') };
  const storage = await openStorage({
    indexedDB,
    faults: (p) => {
      if (quota.on && p === 'before-blob-put') throw new DOMException('full', 'QuotaExceededError');
      if (faults.has(p)) throw new Error(`fault ${p}`);
    }
  });
  return { indexedDB, faults, quota, clock, controller: new VaultController(storage, { now: () => new Date(clock.t) }) };
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error('expected rejection');
    },
    (e: unknown) => e
  );
}

describe('VaultController lifecycle', () => {
  it('DATA-07: empty installation, create once, lock, unlock', async () => {
    const r = await rig();
    expect((await r.controller.state()).kind).toBe('empty');
    const { session } = await r.controller.create(PW);
    expect(session.head.generation).toBe(1);
    expect(session.product!.revision).toBe('0');
    r.controller.lock();
    expect(() => session.db).toThrow(StorageError);
    expect((await r.controller.state()).kind).toBe('locked');
    // Never initialize over an existing vault.
    expect(await rejection(r.controller.create(PW))).toMatchObject({ code: 'INVALID_STATE' });
    const err = await rejection(r.controller.unlock('wrong password for this vault'));
    expect(err).toBeInstanceOf(VaultError);
    expect((err as VaultError).code).toBe('AUTH_FAILED');
    const { session: s2 } = await r.controller.unlock(PW);
    expect(s2.head.generation).toBe(1);
  });

  it('saves each change as one revision and one generation; no-op saves nothing', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    const id = await session.change((db) => createEntry(db, entry('Alpha')));
    expect(session.head.generation).toBe(2);
    expect(session.product!.revision).toBe('1');
    const changed = await session.change((db) => updateEntry(db, id, entry('Alpha')));
    expect(changed).toBe(false);
    expect(session.head.generation).toBe(2);
    await session.change((db) => updateEntry(db, id, { ...entry('Alpha'), password: 'rotated' }));
    expect(session.product!.revision).toBe('2');
    r.controller.lock();
    const { session: again } = await r.controller.unlock(PW);
    expect(readEntry(again.db, id).password).toBe('rotated');
    expect(readEntry(again.db, id, 0).password).toBe('pw-Alpha'); // history retained once
    expect(again.db.getDefaultGroup().entries[0]!.history).toHaveLength(1);
  });

  it('a change that cannot be serialized is refused and the committed state reloaded', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    // Attachments are outside the v1 profile; the limit check refuses the candidate.
    const err = await rejection(
      session.change((db) => {
        const e = db.createEntry(db.getDefaultGroup());
        e.binaries.set('x.bin', new Uint8Array([1, 2, 3]).buffer);
        return 'changed';
      })
    );
    expect(err).toBeInstanceOf(VaultError);
    expect(session.hasUnsavedChanges).toBe(false);
    expect(listEntries(session.db)).toHaveLength(0);
    expect(session.head.generation).toBe(1);
    await session.change((db) => createEntry(db, entry('After')));
    expect(session.head.generation).toBe(2);
  });

  it('lock during a save discards the uncommitted change and ignores the late result', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    const saving = session.change((db) => createEntry(db, entry('Late')));
    r.controller.lock(); // app hidden while the KDF runs
    expect(await rejection(saving)).toMatchObject({ code: 'INVALID_STATE' });
    expect((await r.controller.storage.readHead())!.generation).toBe(1);
    const { session: s2 } = await r.controller.unlock(PW);
    expect(listEntries(s2.db)).toHaveLength(0);
  });

  it('a late unlock result after lock is ignored', async () => {
    const r = await rig();
    await r.controller.create(PW);
    r.controller.lock();
    const unlocking = r.controller.unlock(PW);
    r.controller.lock();
    expect(await rejection(unlocking)).toMatchObject({ code: 'INVALID_STATE' });
    expect(r.controller.current).toBeNull();
  });
});

describe('VaultController durability', () => {
  it('DATA-03: two tabs edit the same generation; the second reports a conflict', async () => {
    const indexedDB = new IDBFactory();
    const a = await rig(indexedDB);
    await a.controller.create(PW);
    a.controller.lock();
    const b = await rig(indexedDB);
    const { session: sa } = await a.controller.unlock(PW);
    const { session: sb } = await b.controller.unlock(PW);
    await sa.change((db) => createEntry(db, entry('From A')));
    const err = await rejection(sb.change((db) => createEntry(db, entry('From B'))));
    expect(err).toMatchObject({ code: 'CONFLICT' });
    expect(sb.hasUnsavedChanges).toBe(true);
    expect(sb.unsaved!.error).toMatchObject({ code: 'CONFLICT' });
    // The losing candidate is a verified encrypted file the user can export.
    const file = sb.candidateForExport();
    expect(file.fileName).toMatch(/^vault-unsaved-\d{8}T\d{6}Z\.kdbx$/);
    expect(await rejection(sb.retrySave())).toMatchObject({ code: 'CONFLICT' });
    await sb.discardChanges();
    expect(listEntries(sb.db).map((e) => e.title)).toEqual(['From A']);
    expect(sb.head.generation).toBe(2);
  });

  it('DATA-02: quota error keeps the old head; Retry commits the kept candidate', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    r.quota.on = true;
    const err = await rejection(session.change((db) => createEntry(db, entry('Q'))));
    expect(err).toMatchObject({ code: 'QUOTA' });
    expect((await r.controller.storage.readHead())!.generation).toBe(1);
    expect(session.candidateForExport().bytes.byteLength).toBeGreaterThan(0);
    r.quota.on = false;
    await session.retrySave();
    expect(session.head.generation).toBe(2);
    expect(session.hasUnsavedChanges).toBe(false);
    expect(session.product!.revision).toBe('1'); // retry did not bump again
  });

  it('DATA-01 (session level): a failed commit boundary leaves the old vault openable', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    await session.change((db) => createEntry(db, entry('Kept')));
    r.faults.add('after-head-put');
    await rejection(session.change((db) => createEntry(db, entry('Lost'))));
    r.faults.clear();
    r.controller.lock();
    const { session: s2 } = await r.controller.unlock(PW);
    expect(listEntries(s2.db).map((e) => e.title)).toEqual(['Kept']);
  });

  it('DATA-05: damaged head needs an explicit, authenticated snapshot choice', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    await session.change((db) => createEntry(db, entry('One')));
    await session.change((db) => createEntry(db, entry('Two')));
    const damaged = session.head.blobId;
    r.controller.lock();
    await corruptBlob(r.indexedDB, damaged);

    const state = await r.controller.state();
    expect(state.kind).toBe('head-unreadable');
    expect(await rejection(r.controller.unlock(PW))).toMatchObject({ code: 'CORRUPT' });

    const snaps = await r.controller.listSnapshots();
    expect(snaps.map((s) => s.generation)).toEqual([3, 2, 1]);
    const older = snaps.find((s) => s.generation === 2)!;
    const info = await r.controller.inspectSnapshot(older.id, PW);
    expect(info.product!.revision).toBe('1');
    expect(await rejection(r.controller.restoreSnapshot(older.id, 'not the password at all'))).toBeInstanceOf(VaultError);
    expect((await r.controller.storage.readHead())!.blobId).toBe(damaged); // nothing changed

    const { session: restored } = await r.controller.restoreSnapshot(older.id, PW);
    expect(restored.head.generation).toBe(4);
    expect(listEntries(restored.db).map((e) => e.title)).toEqual(['One']);
    // The damaged blob is kept and exportable byte for byte.
    const raw = await r.controller.rawBlobForExport(damaged);
    expect(raw.fileName).toMatch(/^vault-damaged-.*-g3\.kdbx$/);
  });

  it('DATA-09: interrupted password change keeps the old password; success switches', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    await session.change((db) => createEntry(db, entry('Keep')));
    expect(await rejection(session.changePassword('wrong current password', PW2))).toBeInstanceOf(VaultError);

    r.faults.add('after-blob-put');
    await rejection(session.changePassword(PW, PW2));
    r.faults.clear();
    r.controller.lock();
    expect(await rejection(r.controller.unlock(PW2))).toBeInstanceOf(VaultError);
    const { session: s2 } = await r.controller.unlock(PW);

    const res = await s2.changePassword(PW, PW2);
    expect(res.oldPasswordCopiesRemain).toBe(0);
    expect(s2.head.passwordEpoch).toBe(1);
    expect((await r.controller.listSnapshots()).every((b) => b.passwordEpoch === 1)).toBe(true);
    r.controller.lock();
    expect(await rejection(r.controller.unlock(PW))).toBeInstanceOf(VaultError);
    const { session: s3 } = await r.controller.unlock(PW2);
    expect(listEntries(s3.db).map((e) => e.title)).toEqual(['Keep']);
    expect(readEntry(s3.db, listEntries(s3.db)[0]!.uuid).password).toBe('pw-Keep');
  });

  it('DATA-10: failed old-password cleanup warns and keeps the new vault usable', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    await session.change((db) => createEntry(db, entry('A')));
    r.faults.add('prune');
    const res = await session.changePassword(PW, PW2);
    r.faults.clear();
    expect(res.oldPasswordCopiesRemain).toBeGreaterThan(0);
    await session.change((db) => createEntry(db, entry('B')));
    expect(listEntries(session.db)).toHaveLength(2);
  });
});

describe('VaultController backups and restore', () => {
  it('BAK-03/04/05/06: export, verify exact and older files, track changes since backup', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    await session.change((db) => createEntry(db, entry('One')));
    const older = await session.prepareExport();
    await session.change((db) => createEntry(db, entry('Two')));
    const file = await session.prepareExport();
    expect(file.fileName).toBe('vault-backup-20261004T100000Z-r2.kdbx');
    await r.controller.recordExportOutcome('export-offered', file.sha256);

    let status = await r.controller.backupStatus();
    expect(status.changesSinceVerified).toBe(3);
    expect(status.latestExport!.kind).toBe('export-offered');
    expect(status.latestVerified).toBeNull();

    // BAK-04: an older valid file is labelled older and does not protect the head.
    const checkOld = await r.controller.verifyBackup(older.bytes, PW);
    expect(checkOld.matchesCurrentHead).toBe(false);
    expect(checkOld.relation).toBe('older-revision');
    status = await r.controller.backupStatus();
    expect(status.changesSinceVerified).toBe(1);

    // BAK-03/05: the exact file verifies, without creating a revision.
    const check = await r.controller.verifyBackup(file.bytes, PW);
    expect(check.matchesCurrentHead).toBe(true);
    expect(check.relation).toBe('same-revision');
    expect(check.counts.entries).toBe(2);
    status = await r.controller.backupStatus();
    expect(status.changesSinceVerified).toBe(0);
    expect(status.escalate).toBe(false);
    expect(session.head.generation).toBe((await r.controller.storage.readHead())!.generation);

    // BAK-06: new changes after the verified export.
    await session.change((db) => createEntry(db, entry('Three')));
    status = await r.controller.backupStatus();
    expect(status.changesSinceVerified).toBe(1);
    expect(status.escalate).toBe(false);
    r.clock.t += 24 * 60 * 60 * 1000;
    expect((await r.controller.backupStatus()).escalate).toBe(true);
  });

  it('BAK-01/02: cancelled or merely offered exports never count as verified', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    const file = await session.prepareExport();
    await r.controller.recordExportOutcome('export-cancelled', file.sha256);
    await r.controller.recordExportOutcome('user-reported', file.sha256);
    const status = await r.controller.backupStatus();
    expect(status.latestVerified).toBeNull();
    expect(status.changesSinceVerified).toBe(1);
  });

  it('DATA-11: restoring an older backup is identified and needs confirmation', async () => {
    const r = await rig();
    const { session } = await r.controller.create(PW);
    await session.change((db) => createEntry(db, entry('One')));
    const old = await session.prepareExport();
    await session.change((db) => createEntry(db, entry('Two')));
    const lineage = session.product!.lineageId;

    const candidate = await r.controller.openCandidate(old.bytes, PW);
    expect(candidate.relation).toBe('older-revision');
    expect(candidate.counts.entries).toBe(1);
    expect(await rejection(r.controller.adoptCandidate(candidate, { confirmReplace: false }))).toMatchObject({ code: 'INVALID_STATE' });

    const again = await r.controller.openCandidate(old.bytes, PW);
    const { session: adopted } = await r.controller.adoptCandidate(again, { confirmReplace: true });
    expect(adopted.product!.lineageId).not.toBe(lineage);
    expect(adopted.product!.revision).toBe('2');
    expect(listEntries(adopted.db).map((e) => e.title)).toEqual(['One']);
    expect(adopted.head.passwordEpoch).toBe(1);
    // The replaced head stays as rollback material.
    expect((await r.controller.listSnapshots()).length).toBeGreaterThanOrEqual(2);
  });
});

async function corruptBlob(indexedDB: IDBFactory, blobId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('passkey-local');
    req.onsuccess = () => {
      const tx = req.result.transaction(['vault_blobs'], 'readwrite');
      const store = tx.objectStore('vault_blobs');
      const g = store.get(blobId);
      g.onsuccess = () => {
        const b = new Uint8Array(g.result.bytes);
        b[b.length - 5]! ^= 0x55;
        store.put({ ...g.result, bytes: b.buffer });
      };
      tx.oncomplete = () => {
        req.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}
