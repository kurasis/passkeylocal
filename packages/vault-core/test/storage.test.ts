import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  ROLLBACK_MAX_COUNT,
  StorageError,
  openStorage,
  requestPersistence,
  sha256Hex,
  type FaultPoint
} from '../src/index.ts';

function bytesOf(n: number, fill = n % 251): Uint8Array {
  return new Uint8Array(n).fill(fill);
}

async function blob(n: number, fill?: number) {
  const bytes = bytesOf(n, fill);
  return { bytes, sha256: await sha256Hex(bytes) };
}

async function fresh(faults?: (p: FaultPoint) => void) {
  const indexedDB = new IDBFactory();
  const storage = await openStorage({ indexedDB, faults });
  return { indexedDB, storage };
}

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(StorageError);
  expect((err as StorageError).code).toBe(code);
}

describe('VaultStorage', () => {
  it('DATA-07: a fresh or cleared installation has no head', async () => {
    const { storage } = await fresh();
    expect(await storage.readHead()).toBeNull();
    expect(await storage.readCurrent()).toBeNull();
    expect(await storage.listBlobs()).toEqual([]);
  });

  it('commits immutable blobs with a generation compare-and-swap', async () => {
    const { storage } = await fresh();
    const a = await blob(100, 1);
    const h1 = await storage.commit({ ...a, expectedGeneration: null });
    expect(h1.generation).toBe(1);
    expect(h1.unbackedSince).not.toBeNull();
    const b = await blob(120, 2);
    const h2 = await storage.commit({ ...b, expectedGeneration: 1 });
    expect(h2.generation).toBe(2);
    const cur = await storage.readCurrent();
    expect(cur!.blob.sha256).toBe(b.sha256);
    const list = await storage.listBlobs();
    expect(list.map((x) => [x.generation, x.isHead])).toEqual([
      [2, true],
      [1, false]
    ]);
    // Metadata holds no plaintext: only ids, sizes, hashes, generations, times.
    expect(Object.keys(list[0]!).sort()).toEqual(['committedAt', 'generation', 'id', 'isHead', 'passwordEpoch', 'sha256', 'size']);
  });

  it('DATA-03: two writers from the same generation, exactly one wins', async () => {
    const indexedDB = new IDBFactory();
    const tab1 = await openStorage({ indexedDB });
    const tab2 = await openStorage({ indexedDB });
    await tab1.commit({ ...(await blob(10, 1)), expectedGeneration: null });
    const [r1, r2] = await Promise.allSettled([
      tab1.commit({ ...(await blob(11, 2)), expectedGeneration: 1 }),
      tab2.commit({ ...(await blob(12, 3)), expectedGeneration: 1 })
    ]);
    const outcomes = [r1.status, r2.status].sort();
    expect(outcomes).toEqual(['fulfilled', 'rejected']);
    const rejected = (r1.status === 'rejected' ? r1 : r2) as PromiseRejectedResult;
    expect((rejected.reason as StorageError).code).toBe('CONFLICT');
    const head = await tab1.readHead();
    expect(head!.generation).toBe(2);
    expect(await tab1.listBlobs()).toHaveLength(2); // loser inserted nothing
  });

  it('the first head cannot be created twice', async () => {
    const { storage } = await fresh();
    await storage.commit({ ...(await blob(10)), expectedGeneration: null });
    await expectCode(storage.commit({ ...(await blob(10)), expectedGeneration: null }), 'CONFLICT');
  });

  for (const point of ['before-blob-put', 'after-blob-put', 'after-head-put'] as const) {
    it(`DATA-01: interruption at ${point} leaves the old head fully valid`, async () => {
      let armed = false;
      const indexedDB = new IDBFactory();
      const storage = await openStorage({
        indexedDB,
        faults: (p) => {
          if (armed && p === point) throw new Error('simulated termination');
        }
      });
      const old = await blob(64, 7);
      await storage.commit({ ...old, expectedGeneration: null });
      armed = true;
      await expectCode(storage.commit({ ...(await blob(65, 8)), expectedGeneration: 1 }), 'WRITE_FAILED');
      storage.close();
      // "Reopen the app": a new connection sees the old, complete head and no partial blob.
      const reopened = await openStorage({ indexedDB });
      const cur = await reopened.readCurrent();
      expect(cur!.head.generation).toBe(1);
      expect(cur!.blob.sha256).toBe(old.sha256);
      expect(await reopened.listBlobs()).toHaveLength(1);
    });
  }

  it('DATA-02: QuotaExceededError keeps the old vault and reports QUOTA', async () => {
    let quota = false;
    const { storage } = await fresh((p) => {
      if (quota && p === 'before-blob-put') throw new DOMException('full', 'QuotaExceededError');
    });
    const old = await blob(32, 1);
    await storage.commit({ ...old, expectedGeneration: null });
    quota = true;
    await expectCode(storage.commit({ ...(await blob(33, 2)), expectedGeneration: 1 }), 'QUOTA');
    expect((await storage.readCurrent())!.blob.sha256).toBe(old.sha256);
    quota = false;
    expect((await storage.commit({ ...(await blob(33, 2)), expectedGeneration: 1 })).generation).toBe(2);
  });

  it('a failed read-back after a completed transaction marks storage unhealthy', async () => {
    let fail = false;
    const { storage } = await fresh((p) => {
      if (fail && p === 'readback') throw new Error('readback');
    });
    await storage.commit({ ...(await blob(8, 1)), expectedGeneration: null });
    fail = true;
    await expectCode(storage.commit({ ...(await blob(9, 2)), expectedGeneration: 1 }), 'READBACK_FAILED');
    expect(storage.unhealthy).toBe(true);
    // The transaction did commit: the new head is authoritative.
    expect((await storage.readHead())!.generation).toBe(2);
  });

  it('keeps the head plus at most five rollback blobs', async () => {
    const { storage } = await fresh();
    let gen: number | null = null;
    for (let i = 0; i < 9; i++) gen = (await storage.commit({ ...(await blob(50 + i, i)), expectedGeneration: gen })).generation;
    const list = await storage.listBlobs();
    expect(list).toHaveLength(1 + ROLLBACK_MAX_COUNT);
    expect(list[0]!.isHead).toBe(true);
    expect(list.map((b) => b.generation)).toEqual([9, 8, 7, 6, 5, 4]);
  });

  it('enforces the 80 MiB rollback-only budget without touching the head', async () => {
    const { storage } = await fresh();
    const MiB = 1024 * 1024;
    let gen: number | null = null;
    for (let i = 0; i < 5; i++) gen = (await storage.commit({ ...(await blob(25 * MiB, i)), expectedGeneration: gen })).generation;
    const list = await storage.listBlobs();
    // head (25 MiB) + 3 rollback (75 MiB <= 80 MiB)
    expect(list.map((b) => b.generation)).toEqual([5, 4, 3, 2]);
  });

  it('a pruning failure never fails or undoes a commit', async () => {
    let failPrune = false;
    const { storage } = await fresh((p) => {
      if (failPrune && p === 'prune') throw new Error('prune');
    });
    let gen: number | null = null;
    for (let i = 0; i < 6; i++) gen = (await storage.commit({ ...(await blob(10 + i, i)), expectedGeneration: gen })).generation;
    failPrune = true;
    const head = await storage.commit({ ...(await blob(99, 9)), expectedGeneration: gen });
    expect(head.generation).toBe(7);
    expect(await storage.listBlobs()).toHaveLength(7); // extra encrypted copy kept, nothing lost
  });

  it('detects a damaged head blob', async () => {
    const { indexedDB, storage } = await fresh();
    await storage.commit({ ...(await blob(40, 1)), expectedGeneration: null });
    const head = (await storage.readHead())!;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('passkey-local');
      req.onsuccess = () => {
        const tx = req.result.transaction(['vault_blobs'], 'readwrite');
        const store = tx.objectStore('vault_blobs');
        const g = store.get(head.blobId);
        g.onsuccess = () => {
          const rec = g.result;
          const b = new Uint8Array(rec.bytes);
          b[3]! ^= 0xff;
          store.put({ ...rec, bytes: b.buffer });
        };
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    await expectCode(storage.readCurrent(), 'CORRUPT');
    expect(await storage.readBlobUnchecked(head.blobId)).toHaveLength(40);
  });

  it('BAK-03/05/06: verified receipts update backup state without a new generation', async () => {
    const { storage } = await fresh();
    const a = await blob(10, 1);
    await storage.commit({ ...a, expectedGeneration: null });
    const b = await blob(11, 2);
    await storage.commit({ ...b, expectedGeneration: 1 });

    // Verifying an older stored blob does not mark the head as backed up.
    await storage.addReceipt('verified', a.sha256);
    let head = (await storage.readHead())!;
    expect(head.generation).toBe(2);
    expect(head.verifiedGeneration).toBe(1);
    expect(head.unbackedSince).not.toBeNull();

    // Verifying the exact head bytes clears the unbacked state; generation unchanged.
    await storage.addReceipt('verified', b.sha256);
    head = (await storage.readHead())!;
    expect(head.generation).toBe(2);
    expect(head.verifiedGeneration).toBe(2);
    expect(head.unbackedSince).toBeNull();

    // A later change makes it unbacked again.
    head = await storage.commit({ ...(await blob(12, 3)), expectedGeneration: 2 });
    expect(head.verifiedGeneration).toBe(2);
    expect(head.unbackedSince).not.toBeNull();

    // A file matching nothing stored is recorded with no generation.
    const r = await storage.addReceipt('verified', 'f'.repeat(64));
    expect(r.generation).toBeNull();
    expect((await storage.listReceipts()).length).toBe(3);
  });

  it('password epochs: cleanup deletes only older-epoch rollback blobs', async () => {
    const { storage } = await fresh();
    await storage.commit({ ...(await blob(10, 1)), expectedGeneration: null });
    await storage.commit({ ...(await blob(11, 2)), expectedGeneration: 1 });
    await storage.commit({ ...(await blob(12, 3)), expectedGeneration: 2, passwordEpoch: 1 });
    expect(await storage.countOlderPasswordEpochs()).toBe(2);
    expect(await storage.deleteOlderPasswordEpochs()).toBe(2);
    const list = await storage.listBlobs();
    expect(list).toHaveLength(1);
    expect(list[0]!.isHead).toBe(true);
  });

  it('preferences round-trip', async () => {
    const { storage } = await fresh();
    expect(await storage.getPreference('theme')).toBeUndefined();
    await storage.setPreference('theme', 'dark');
    expect(await storage.getPreference('theme')).toBe('dark');
  });

  it('DATA-06: persistence denial or absence is a status, not an error', async () => {
    expect(await requestPersistence(undefined)).toBe('unavailable');
    const denied = { persisted: async () => false, persist: async () => false } as unknown as StorageManager;
    expect(await requestPersistence(denied)).toBe('not-persisted');
    const granted = { persisted: async () => false, persist: async () => true } as unknown as StorageManager;
    expect(await requestPersistence(granted)).toBe('persisted');
    const throwing = { persisted: async () => { throw new Error('x'); }, persist: async () => true } as unknown as StorageManager;
    expect(await requestPersistence(throwing)).toBe('unavailable');
  });

  it('no code path deletes the database or clears a store', () => {
    const dir = join(import.meta.dirname, '..', 'src');
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/deleteDatabase|\.clear\(/);
    }
  });
});
