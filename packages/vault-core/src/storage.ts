/**
 * IndexedDB persistence of complete encrypted KDBX blobs
 * (PRODUCT_AND_ARCHITECTURE.md section 5).
 *
 * Invariants:
 *  - Only ciphertext and minimal operational metadata are stored: opaque IDs,
 *    byte lengths, SHA-256 hashes, generations, timestamps, backup receipts.
 *    No titles, counts, names or record data.
 *  - Blobs are immutable. A commit inserts a new blob and switches the head in
 *    ONE short readwrite transaction guarded by a generation compare-and-swap.
 *    No non-IndexedDB awaits happen inside a transaction (all cryptography is
 *    finished before `commit` is called).
 *  - "Saved" is reported only after the transaction's `complete` event and a
 *    successful hash read-back.
 *  - Rollback pruning runs in a separate transaction after a completed commit
 *    and never touches the current head.
 *  - Nothing in this module deletes the database or clears a store.
 */

import { StorageError } from './errors.ts';

export const DB_NAME = 'passkey-local';
export const DB_VERSION = 1;
export const HEAD_SLOT = 'active';
export const BLOB_FORMAT = 'kdbx4';

/** Rollback retention (section 5): head plus up to five previous blobs, 80 MiB rollback-only budget. */
export const ROLLBACK_MAX_COUNT = 5;
export const ROLLBACK_MAX_BYTES = 80 * 1024 * 1024;

export interface HeadRecord {
  slot: typeof HEAD_SLOT;
  blobId: string;
  /** Local generation; increments by one on every committed head change. */
  generation: number;
  format: typeof BLOB_FORMAT;
  /** Increments on every master-password change; blobs from older epochs need an older password. */
  passwordEpoch: number;
  committedAt: string;
  /** Generation whose exact bytes were last verified as an external backup, or null. */
  verifiedGeneration: number | null;
  /** First commit time after the last verified backup, or null when nothing is unbacked. */
  unbackedSince: string | null;
}

export interface BlobRecord {
  id: string;
  bytes: ArrayBuffer;
  sha256: string;
  size: number;
  /** Generation at which this blob was first committed. */
  generation: number;
  passwordEpoch: number;
  committedAt: string;
}

export type BlobInfo = Omit<BlobRecord, 'bytes'> & { isHead: boolean };

export type ReceiptKind = 'export-prepared' | 'export-offered' | 'export-cancelled' | 'export-failed' | 'user-reported' | 'verified';

export interface ReceiptRecord {
  id: string;
  kind: ReceiptKind;
  /** SHA-256 of the exported or verified file bytes. */
  sha256: string;
  /** Local generation of the matching stored blob, or null when the file matches none. */
  generation: number | null;
  at: string;
}

export interface CommitRequest {
  bytes: Uint8Array;
  sha256: string;
  /** Generation the editor started from; null when creating the first head. */
  expectedGeneration: number | null;
  /** Defaults to the current head's epoch (or 0 for the first head). */
  passwordEpoch?: number;
  /** Explicitly confirmed/authenticated file adoption; native damaged-head recovery only. */
  confirmedReplacement?: boolean;
  now?: Date;
}

/** Test hook: called at commit boundaries; throwing aborts the transaction at that point. */
export type FaultPoint = 'before-blob-put' | 'after-blob-put' | 'after-head-put' | 'before-readback' | 'readback' | 'prune';
export type FaultHook = (point: FaultPoint) => void;

const STORES = { heads: 'vault_heads', blobs: 'vault_blobs', receipts: 'backup_receipts', prefs: 'preferences' } as const;

function randomId(): string {
  return crypto.randomUUID();
}

async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? new Uint8Array(bytes) : bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function mapDomError(err: unknown, fallback: 'WRITE_FAILED' | 'UNAVAILABLE' = 'WRITE_FAILED'): StorageError {
  if (err instanceof StorageError) return err;
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'QuotaExceededError') return new StorageError('QUOTA');
  return new StorageError(fallback, typeof name === 'string' ? name : undefined);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Run `body` inside one transaction. `body` must only issue IndexedDB requests
 * (synchronously or from request callbacks) and may throw to abort. Resolves
 * with the body's result only after the transaction's `complete` event.
 */
function runTransaction<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction, fail: (e: unknown) => void, done: (value: T) => void) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (e) {
      reject(mapDomError(e));
      return;
    }
    let result: { value: T } | undefined;
    let failure: unknown;
    const fail = (e: unknown) => {
      if (failure === undefined) failure = e ?? new StorageError('WRITE_FAILED');
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
    };
    tx.oncomplete = () => {
      if (failure !== undefined) reject(mapDomError(failure));
      else if (result) resolve(result.value);
      else reject(new StorageError('WRITE_FAILED', 'no-result'));
    };
    tx.onabort = () => reject(mapDomError(failure ?? tx.error));
    tx.onerror = (ev) => {
      // Let the abort handler report; keep the request error as the cause.
      if (failure === undefined) failure = (ev.target as IDBRequest | null)?.error ?? tx.error;
    };
    try {
      body(tx, fail, (value) => {
        result = { value };
      });
    } catch (e) {
      fail(e);
    }
  });
}

export interface OpenStorageOptions {
  /** IndexedDB factory; defaults to `globalThis.indexedDB`. */
  indexedDB?: IDBFactory;
  name?: string;
  faults?: FaultHook;
}

export async function openStorage(opts: OpenStorageOptions = {}): Promise<VaultStorage> {
  const factory = opts.indexedDB ?? globalThis.indexedDB;
  if (!factory) throw new StorageError('UNAVAILABLE', 'no-indexeddb');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(opts.name ?? DB_NAME, DB_VERSION);
    } catch (e) {
      reject(mapDomError(e, 'UNAVAILABLE'));
      return;
    }
    req.onupgradeneeded = (ev) => {
      const up = req.result;
      // Additive schema only: never delete stores or data during an upgrade.
      if (ev.oldVersion < 1) {
        up.createObjectStore(STORES.heads, { keyPath: 'slot' });
        up.createObjectStore(STORES.blobs, { keyPath: 'id' });
        up.createObjectStore(STORES.receipts, { keyPath: 'id' });
        up.createObjectStore(STORES.prefs, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(mapDomError(req.error, 'UNAVAILABLE'));
    req.onblocked = () => reject(new StorageError('UNAVAILABLE', 'upgrade-blocked'));
  });
  return new VaultStorage(db, opts.faults);
}

export class VaultStorage {
  private readonly db: IDBDatabase;
  private readonly faults: FaultHook;
  /** Set when a committed write could not be read back; the UI must show storage as unhealthy. */
  unhealthy = false;

  constructor(db: IDBDatabase, faults?: FaultHook) {
    this.db = db;
    this.faults = faults ?? (() => {});
    // Another tab upgrading the schema: close so it is not blocked; this instance becomes unusable.
    db.onversionchange = () => db.close();
  }

  close(): void {
    this.db.close();
  }

  async readHead(): Promise<HeadRecord | null> {
    const tx = this.db.transaction([STORES.heads], 'readonly');
    const head = await request(tx.objectStore(STORES.heads).get(HEAD_SLOT));
    return (head as HeadRecord | undefined) ?? null;
  }

  /** Read a blob and check it against its recorded hash. */
  async readBlob(id: string): Promise<BlobRecord> {
    const tx = this.db.transaction([STORES.blobs], 'readonly');
    const blob = (await request(tx.objectStore(STORES.blobs).get(id))) as BlobRecord | undefined;
    if (!blob) throw new StorageError('NOT_FOUND', 'blob');
    if (!(blob.bytes instanceof ArrayBuffer) || blob.bytes.byteLength !== blob.size) throw new StorageError('CORRUPT', 'blob-size');
    if ((await sha256Hex(blob.bytes)) !== blob.sha256) throw new StorageError('CORRUPT', 'blob-hash');
    return blob;
  }

  /** Raw stored bytes without the hash check, for exporting possibly damaged data. */
  async readBlobUnchecked(id: string): Promise<Uint8Array> {
    const tx = this.db.transaction([STORES.blobs], 'readonly');
    const blob = (await request(tx.objectStore(STORES.blobs).get(id))) as { bytes?: unknown } | undefined;
    if (!blob || !(blob.bytes instanceof ArrayBuffer)) throw new StorageError('NOT_FOUND', 'blob');
    return new Uint8Array(blob.bytes);
  }

  /** Head plus its blob. Throws CORRUPT when the head's blob is missing or damaged. */
  async readCurrent(): Promise<{ head: HeadRecord; blob: BlobRecord } | null> {
    const head = await this.readHead();
    if (!head) return null;
    try {
      return { head, blob: await this.readBlob(head.blobId) };
    } catch (e) {
      if (e instanceof StorageError && e.code === 'NOT_FOUND') throw new StorageError('CORRUPT', 'head-blob-missing');
      throw e;
    }
  }

  async listBlobs(): Promise<BlobInfo[]> {
    const tx = this.db.transaction([STORES.heads, STORES.blobs], 'readonly');
    const head = (await request(tx.objectStore(STORES.heads).get(HEAD_SLOT))) as HeadRecord | undefined;
    const all = (await request(tx.objectStore(STORES.blobs).getAll())) as BlobRecord[];
    return all
      .map(({ bytes: _bytes, ...info }) => ({ ...info, isHead: info.id === head?.blobId }))
      .sort((a, b) => b.generation - a.generation);
  }

  /**
   * Atomically insert a new immutable blob and switch the head to it, if and
   * only if the head is still at `expectedGeneration`. Then read the blob back
   * and compare its hash. Rollback pruning follows in its own transaction.
   */
  async commit(req: CommitRequest): Promise<HeadRecord> {
    const bytes = req.bytes.slice().buffer as ArrayBuffer; // own copy; caller buffers may be reused
    if (bytes.byteLength !== req.bytes.byteLength) throw new StorageError('WRITE_FAILED', 'copy');
    const now = (req.now ?? new Date()).toISOString();
    const blobId = randomId();
    const faults = this.faults;

    const head = await runTransaction<HeadRecord>(this.db, [STORES.heads, STORES.blobs], 'readwrite', (tx, fail, done) => {
      const heads = tx.objectStore(STORES.heads);
      const blobs = tx.objectStore(STORES.blobs);
      const getHead = heads.get(HEAD_SLOT);
      getHead.onsuccess = () => {
        try {
          const current = (getHead.result as HeadRecord | undefined) ?? null;
          const currentGen = current ? current.generation : null;
          if (currentGen !== req.expectedGeneration) throw new StorageError('CONFLICT', 'generation');
          const generation = (currentGen ?? 0) + 1;
          const passwordEpoch = req.passwordEpoch ?? current?.passwordEpoch ?? 0;
          const blob: BlobRecord = { id: blobId, bytes, sha256: req.sha256, size: bytes.byteLength, generation, passwordEpoch, committedAt: now };
          const next: HeadRecord = {
            slot: HEAD_SLOT,
            blobId,
            generation,
            format: BLOB_FORMAT,
            passwordEpoch,
            committedAt: now,
            verifiedGeneration: current?.verifiedGeneration ?? null,
            unbackedSince: current?.unbackedSince ?? now
          };
          faults('before-blob-put');
          blobs.add(blob).onsuccess = () => {
            try {
              faults('after-blob-put');
              heads.put(next).onsuccess = () => {
                try {
                  faults('after-head-put');
                  done(next);
                } catch (e) {
                  fail(e);
                }
              };
            } catch (e) {
              fail(e);
            }
          };
        } catch (e) {
          fail(e);
        }
      };
    });

    // The transaction completed: the new head is authoritative from here on.
    try {
      faults('before-readback');
      const back = await this.readBlob(blobId);
      faults('readback');
      if (back.sha256 !== req.sha256) throw new StorageError('CORRUPT', 'readback-hash');
    } catch {
      this.unhealthy = true;
      throw new StorageError('READBACK_FAILED');
    }
    await this.pruneRollback().catch(() => {
      /* Pruning is housekeeping; a failure leaves extra encrypted copies, never less data. */
    });
    return head;
  }

  /**
   * Point the head at an existing stored blob (explicit recovery from a local
   * snapshot). The caller must have authenticated the snapshot first.
   */
  async restoreBlob(blobId: string, expectedGeneration: number | null, now: Date = new Date()): Promise<HeadRecord> {
    const at = now.toISOString();
    return runTransaction<HeadRecord>(this.db, [STORES.heads, STORES.blobs], 'readwrite', (tx, fail, done) => {
      const heads = tx.objectStore(STORES.heads);
      const getHead = heads.get(HEAD_SLOT);
      const getBlob = tx.objectStore(STORES.blobs).get(blobId);
      getBlob.onsuccess = () => {
        try {
          const blob = getBlob.result as BlobRecord | undefined;
          if (!blob) throw new StorageError('NOT_FOUND', 'blob');
          const current = (getHead.result as HeadRecord | undefined) ?? null;
          if ((current ? current.generation : null) !== expectedGeneration) throw new StorageError('CONFLICT', 'generation');
          const next: HeadRecord = {
            slot: HEAD_SLOT,
            blobId,
            generation: (current?.generation ?? 0) + 1,
            format: BLOB_FORMAT,
            passwordEpoch: blob.passwordEpoch,
            committedAt: at,
            verifiedGeneration: current?.verifiedGeneration ?? null,
            unbackedSince: current?.unbackedSince ?? at
          };
          heads.put(next).onsuccess = () => done(next);
        } catch (e) {
          fail(e);
        }
      };
    });
  }

  /** Delete the oldest rollback blobs beyond the count/byte budget. Never deletes the head blob. */
  async pruneRollback(): Promise<number> {
    const faults = this.faults;
    return runTransaction<number>(this.db, [STORES.heads, STORES.blobs], 'readwrite', (tx, fail, done) => {
      const heads = tx.objectStore(STORES.heads);
      const blobs = tx.objectStore(STORES.blobs);
      const getHead = heads.get(HEAD_SLOT);
      const getAll = blobs.getAll();
      getAll.onsuccess = () => {
        try {
          faults('prune');
          const head = getHead.result as HeadRecord | undefined;
          if (!head) return done(0);
          const rollback = (getAll.result as BlobRecord[])
            .filter((b) => b.id !== head.blobId)
            .sort((a, b) => b.generation - a.generation);
          let keptBytes = 0;
          let kept = 0;
          let removed = 0;
          for (const b of rollback) {
            if (kept < ROLLBACK_MAX_COUNT && keptBytes + b.size <= ROLLBACK_MAX_BYTES) {
              kept++;
              keptBytes += b.size;
            } else {
              blobs.delete(b.id);
              removed++;
            }
          }
          done(removed);
        } catch (e) {
          fail(e);
        }
      };
    });
  }

  /**
   * After a committed password change: delete rollback blobs protected by an
   * older password (BACKUP_AND_PYTHON_RECOVERY.md section 5, step 6). This is
   * a separate transaction; it is not secure erasure.
   */
  async deleteOlderPasswordEpochs(): Promise<number> {
    return runTransaction<number>(this.db, [STORES.heads, STORES.blobs], 'readwrite', (tx, fail, done) => {
      const getHead = tx.objectStore(STORES.heads).get(HEAD_SLOT);
      const blobs = tx.objectStore(STORES.blobs);
      const getAll = blobs.getAll();
      getAll.onsuccess = () => {
        try {
          this.faults('prune');
          const head = getHead.result as HeadRecord | undefined;
          if (!head) return done(0);
          let removed = 0;
          for (const b of getAll.result as BlobRecord[]) {
            if (b.id !== head.blobId && b.passwordEpoch < head.passwordEpoch) {
              blobs.delete(b.id);
              removed++;
            }
          }
          done(removed);
        } catch (e) {
          fail(e);
        }
      };
    });
  }

  async countOlderPasswordEpochs(): Promise<number> {
    const head = await this.readHead();
    if (!head) return 0;
    return (await this.listBlobs()).filter((b) => !b.isHead && b.passwordEpoch < head.passwordEpoch).length;
  }

  /**
   * Record a backup receipt. A `verified` receipt whose hash matches a stored
   * blob updates the head's verified generation without changing the vault
   * generation or revision (BAK-05).
   */
  async addReceipt(kind: ReceiptKind, sha256: string, now: Date = new Date()): Promise<ReceiptRecord> {
    const at = now.toISOString();
    return runTransaction<ReceiptRecord>(this.db, [STORES.heads, STORES.blobs, STORES.receipts], 'readwrite', (tx, fail, done) => {
      const heads = tx.objectStore(STORES.heads);
      const getHead = heads.get(HEAD_SLOT);
      const getAll = tx.objectStore(STORES.blobs).getAll();
      getAll.onsuccess = () => {
        try {
          const head = (getHead.result as HeadRecord | undefined) ?? null;
          const match = (getAll.result as BlobRecord[]).find((b) => b.sha256 === sha256);
          const generation = match ? match.generation : null;
          const receipt: ReceiptRecord = { id: randomId(), kind, sha256, generation, at };
          tx.objectStore(STORES.receipts).add(receipt);
          if (kind === 'verified' && head && match) {
            const isHead = match.id === head.blobId;
            const verifiedGeneration = Math.max(head.verifiedGeneration ?? 0, isHead ? head.generation : match.generation);
            heads.put({ ...head, verifiedGeneration, unbackedSince: isHead ? null : head.unbackedSince });
          }
          done(receipt);
        } catch (e) {
          fail(e);
        }
      };
    });
  }

  async listReceipts(): Promise<ReceiptRecord[]> {
    const tx = this.db.transaction([STORES.receipts], 'readonly');
    const all = (await request(tx.objectStore(STORES.receipts).getAll())) as ReceiptRecord[];
    return all.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }

  async getPreference<T>(key: string): Promise<T | undefined> {
    const tx = this.db.transaction([STORES.prefs], 'readonly');
    const rec = (await request(tx.objectStore(STORES.prefs).get(key))) as { key: string; value: T } | undefined;
    return rec?.value;
  }

  /** Optional head-generation check atomically rejects preferences derived from a stale vault. */
  async setPreference(key: string, value: unknown, expectedGeneration?: number): Promise<void> {
    const stores = expectedGeneration === undefined ? [STORES.prefs] : [STORES.prefs, STORES.heads];
    await runTransaction<void>(this.db, stores, 'readwrite', (tx, fail, done) => {
      const put = () => { tx.objectStore(STORES.prefs).put({ key, value }).onsuccess = () => done(undefined); };
      if (expectedGeneration === undefined) return put();
      const head = tx.objectStore(STORES.heads).get(HEAD_SLOT);
      head.onsuccess = () => {
        if ((head.result as HeadRecord | undefined)?.generation !== expectedGeneration) {
          fail(new StorageError('CONFLICT', 'generation'));
        } else put();
      };
    });
  }
}

/** The existing ciphertext contract, without IndexedDB implementation details. */
export type VaultStore = Pick<VaultStorage, keyof VaultStorage>;

export type PersistenceStatus = 'persisted' | 'not-persisted' | 'unavailable';

/** Ask the browser to make storage persistent (DATA-06). Denial is a status, not an error. */
export async function requestPersistence(manager: StorageManager | undefined = globalThis.navigator?.storage): Promise<PersistenceStatus> {
  if (!manager || typeof manager.persist !== 'function') return 'unavailable';
  try {
    if (typeof manager.persisted === 'function' && (await manager.persisted())) return 'persisted';
    return (await manager.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unavailable';
  }
}

export { sha256Hex };
