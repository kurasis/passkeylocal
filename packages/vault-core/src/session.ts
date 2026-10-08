/**
 * Vault controller: the save transaction, lock lifecycle, conflicts, snapshot
 * recovery, password rotation, backups and restore, on top of the adapter
 * (format) and VaultStore (ciphertext persistence).
 *
 * Plaintext lives only in the in-memory `Kdbx` object of an unlocked session.
 * `lock()` drops it and invalidates the session token; every asynchronous
 * operation re-checks the token after each await and discards late results.
 */

import {
  VaultError,
  assignProductMetadata,
  bumpRevision,
  changeMasterPassword,
  createVault,
  openVault,
  openVaultWithPasswordHash,
  readProductMetadata,
  reopenWithCredentialsOf,
  serializeVerified,
  type Kdbx,
  type OpenedVault,
  type PasswordWarning,
  type ProductMetadata,
  type SerializedVault,
  type VaultCounts
} from '@passkey-local/vault-adapter';
import { StorageError, isStorageError } from './errors.ts';
import { sha256Hex, type BlobInfo, type HeadRecord, type ReceiptKind, type ReceiptRecord, type VaultStore } from './storage.ts';

export type VaultState =
  /** No head: fresh installation or site data cleared (DATA-07). */
  | { kind: 'empty' }
  | { kind: 'locked'; head: HeadRecord }
  /** The head blob is missing or damaged; recovery needs an explicit choice (DATA-05). */
  | { kind: 'head-unreadable'; head: HeadRecord; reason: string };

/** A failed save keeps its verified candidate so it can be retried or exported. */
export interface UnsavedCandidate {
  bytes: Uint8Array;
  sha256: string;
  expectedGeneration: number;
  error: StorageError | VaultError;
}

export interface ExportFile {
  fileName: string;
  bytes: Uint8Array;
  sha256: string;
  generation: number;
  revision: string | null;
}

export type CandidateRelation =
  | 'same-revision'
  | 'older-revision'
  | 'newer-revision'
  | 'different-lineage'
  | 'different-vault'
  | 'no-product-metadata'
  | 'unknown';

export interface BackupCheck {
  sha256: string;
  counts: VaultCounts;
  product: ProductMetadata | null;
  /** The file's bytes equal a blob stored on this device. */
  matchesStoredGeneration: number | null;
  matchesCurrentHead: boolean;
  /** Compared with the unlocked vault's metadata; `unknown` while locked. */
  relation: CandidateRelation;
}

export interface BackupStatus {
  savedLocally: boolean;
  generation: number | null;
  latestExport: ReceiptRecord | null;
  latestVerified: ReceiptRecord | null;
  verifiedGeneration: number | null;
  /** Commits since the last verified backup of exactly that revision. */
  changesSinceVerified: number;
  unbackedSince: string | null;
  /** Show the visible banner: 10 commits or 24 hours of unbacked changes. */
  escalate: boolean;
}

export const BACKUP_ESCALATE_COMMITS = 10;
export const BACKUP_ESCALATE_MS = 24 * 60 * 60 * 1000;

function locked(): StorageError {
  return new StorageError('INVALID_STATE', 'locked');
}

function backupFileName(product: ProductMetadata | null, committedAt: string): string {
  const stamp = committedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const rev = product ? `-r${product.revision}` : '';
  return `vault-backup-${stamp}${rev}.kdbx`;
}

function relationOf(candidate: ProductMetadata | null, current: ProductMetadata | null): CandidateRelation {
  if (!candidate) return 'no-product-metadata';
  if (!current) return 'unknown';
  if (candidate.vaultId !== current.vaultId) return 'different-vault';
  if (candidate.lineageId !== current.lineageId) return 'different-lineage';
  const a = BigInt(candidate.revision);
  const b = BigInt(current.revision);
  return a === b ? 'same-revision' : a < b ? 'older-revision' : 'newer-revision';
}

export interface ControllerOptions {
  now?: () => Date;
}

export class VaultController {
  readonly storage: VaultStore;
  private readonly now: () => Date;
  private token = 0;
  private session: UnlockedSession | null = null;

  constructor(storage: VaultStore, opts: ControllerOptions = {}) {
    this.storage = storage;
    this.now = opts.now ?? (() => new Date());
  }

  /** Current lifecycle state, read from storage. Never decrypts anything. */
  async state(): Promise<VaultState> {
    const head = await this.storage.readHead();
    if (!head) return { kind: 'empty' };
    try {
      await this.storage.readBlob(head.blobId);
    } catch (e) {
      if (isStorageError(e, 'CORRUPT') || isStorageError(e, 'NOT_FOUND')) {
        return { kind: 'head-unreadable', head, reason: e.detail ?? e.code };
      }
      throw e;
    }
    return { kind: 'locked', head };
  }

  get current(): UnlockedSession | null {
    return this.session;
  }

  /** Immediate redaction: drop plaintext and invalidate every in-flight operation. */
  lock(): void {
    this.token++;
    this.session?.invalidate();
    this.session = null;
  }

  /** @internal */
  isLive(token: number): boolean {
    return token === this.token;
  }

  /** @internal */
  checkLive(token: number): void {
    if (token !== this.token) throw locked();
  }

  /** @internal */
  nowDate(): Date {
    return this.now();
  }

  /** Create the first vault. Refuses when any head already exists (never overwrite). */
  async create(password: string, name?: string): Promise<{ session: UnlockedSession; warnings: PasswordWarning[] }> {
    this.lock();
    const token = this.token;
    if (await this.storage.readHead()) throw new StorageError('INVALID_STATE', 'vault-exists');
    const { db, warnings } = createVault({ password, name, now: this.now() });
    const serialized = await serializeVerified(db);
    this.checkLive(token);
    const head = await this.storage.commit({ bytes: serialized.bytes, sha256: serialized.sha256, expectedGeneration: null, now: this.now() });
    this.checkLive(token);
    this.session = new UnlockedSession(this, token, db, head, serialized.sha256);
    return { session: this.session, warnings };
  }

  async unlock(password: string): Promise<{ session: UnlockedSession; warnings: PasswordWarning[] }> {
    this.lock();
    const token = this.token;
    const current = await this.storage.readCurrent();
    if (!current) throw new StorageError('INVALID_STATE', 'empty');
    const opened = await openVault(current.blob.bytes, password);
    this.checkLive(token);
    this.session = new UnlockedSession(this, token, opened.db, current.head, current.blob.sha256, opened.readOnlyReason);
    return { session: this.session, warnings: opened.warnings };
  }

  /** Native Hello supplies only a binary component to this crypto worker. */
  async unlockWithPasswordHash(component: Uint8Array, expected: { generation: number; sha256: string }): Promise<{ session: UnlockedSession; warnings: PasswordWarning[] }> {
    this.lock();
    const token = this.token;
    try {
      const current = await this.storage.readCurrent();
      this.checkLive(token);
      if (!current || current.head.generation !== expected.generation || current.blob.sha256 !== expected.sha256) throw new StorageError('CONFLICT');
      const opened = await openVaultWithPasswordHash(current.blob.bytes, component);
      this.checkLive(token);
      const latest = await this.storage.readHead();
      this.checkLive(token);
      if (latest?.generation !== current.head.generation || latest.blobId !== current.head.blobId) throw new StorageError('CONFLICT');
      this.session = new UnlockedSession(this, token, opened.db, current.head, current.blob.sha256, opened.readOnlyReason);
      return { session: this.session, warnings: opened.warnings };
    } finally { component.fill(0); }
  }

  // ---- local snapshots (DATA-05) -----------------------------------------

  async listSnapshots(): Promise<BlobInfo[]> {
    return this.storage.listBlobs();
  }

  /** Authenticate a stored snapshot without changing anything. */
  async inspectSnapshot(blobId: string, password: string): Promise<{ product: ProductMetadata | null; counts: VaultCounts; committedAt: string; generation: number }> {
    const blob = await this.storage.readBlob(blobId);
    const opened = await openVault(blob.bytes, password);
    return { product: opened.product, counts: opened.counts, committedAt: blob.committedAt, generation: blob.generation };
  }

  /**
   * Make an authenticated older snapshot the head again. Explicit only; the
   * damaged head blob stays stored (exportable) as rollback material.
   */
  async restoreSnapshot(blobId: string, password: string): Promise<{ session: UnlockedSession }> {
    this.lock();
    const token = this.token;
    const head = await this.storage.readHead();
    const blob = await this.storage.readBlob(blobId);
    const opened = await openVault(blob.bytes, password);
    this.checkLive(token);
    const next = await this.storage.restoreBlob(blobId, head ? head.generation : null, this.now());
    this.checkLive(token);
    this.session = new UnlockedSession(this, token, opened.db, next, blob.sha256, opened.readOnlyReason);
    return { session: this.session };
  }

  /**
   * Byte-for-byte copy of a stored blob, even when it cannot be opened, for
   * export as potentially damaged data. No authentication is performed.
   */
  async rawBlobForExport(blobId: string): Promise<ExportFile> {
    const list = await this.storage.listBlobs();
    const info = list.find((b) => b.id === blobId);
    if (!info) throw new StorageError('NOT_FOUND', 'blob');
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array((await this.storage.readBlob(blobId)).bytes);
    } catch (e) {
      if (!isStorageError(e, 'CORRUPT')) throw e;
      bytes = await this.storage.readBlobUnchecked(blobId);
    }
    return {
      fileName: `vault-damaged-${info.committedAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-g${info.generation}.kdbx`,
      bytes,
      sha256: await sha256Hex(bytes),
      generation: info.generation,
      revision: null
    };
  }

  // ---- backups ------------------------------------------------------------

  async recordExportOutcome(kind: Exclude<ReceiptKind, 'verified' | 'export-prepared'>, sha256: string): Promise<ReceiptRecord> {
    return this.storage.addReceipt(kind, sha256, this.now());
  }

  /**
   * Verify a saved external backup: authenticate and parse it without touching
   * the active vault, compare its bytes with stored blobs, record a receipt.
   * Never changes the vault revision (BAK-05).
   */
  async verifyBackup(bytes: Uint8Array, password: string): Promise<BackupCheck> {
    const opened = await openVault(bytes, password);
    const sha256 = await sha256Hex(bytes);
    const blobs = await this.storage.listBlobs();
    const match = blobs.find((b) => b.sha256 === sha256) ?? null;
    await this.storage.addReceipt('verified', sha256, this.now());
    const current = this.session && !this.session.invalidated ? this.session.product : null;
    return {
      sha256,
      counts: opened.counts,
      product: opened.product,
      matchesStoredGeneration: match ? match.generation : null,
      matchesCurrentHead: !!match?.isHead,
      relation: relationOf(opened.product, current)
    };
  }

  async backupStatus(): Promise<BackupStatus> {
    const head = await this.storage.readHead();
    const receipts = await this.storage.listReceipts();
    const exportKinds: ReceiptKind[] = ['export-offered', 'export-cancelled', 'export-failed', 'user-reported'];
    const latestExport = receipts.find((r) => exportKinds.includes(r.kind)) ?? null;
    const latestVerified = receipts.find((r) => r.kind === 'verified' && r.generation !== null) ?? null;
    if (!head) {
      return { savedLocally: false, generation: null, latestExport, latestVerified, verifiedGeneration: null, changesSinceVerified: 0, unbackedSince: null, escalate: false };
    }
    const verifiedGeneration = head.verifiedGeneration;
    const changesSinceVerified = head.generation - (verifiedGeneration ?? 0);
    const since = head.unbackedSince ? Date.parse(head.unbackedSince) : NaN;
    const escalate =
      changesSinceVerified >= BACKUP_ESCALATE_COMMITS ||
      (Number.isFinite(since) && this.now().getTime() - since >= BACKUP_ESCALATE_MS);
    return {
      savedLocally: true,
      generation: head.generation,
      latestExport,
      latestVerified,
      verifiedGeneration,
      changesSinceVerified,
      unbackedSince: head.unbackedSince,
      escalate
    };
  }

  // ---- restore / adopt a file (section 4) ----------------------------------

  /** Open a selected file as a candidate for inspection. Local data is untouched. */
  async openCandidate(bytes: Uint8Array, password: string): Promise<RestoreCandidate> {
    const opened = await openVault(bytes, password);
    const current = this.session && !this.session.invalidated ? this.session.product : null;
    return new RestoreCandidate(opened, relationOf(opened.product, current));
  }

  /**
   * Adopt a candidate as the active editing branch: fresh lineage, revision
   * bumped once, committed through the same atomic head switch. The previous
   * head stays as rollback data. Replacing an existing vault requires
   * `confirmReplace` (the UI asks after offering an export).
   */
  async adoptCandidate(candidate: RestoreCandidate, opts: { confirmReplace: boolean }): Promise<{ session: UnlockedSession }> {
    if (candidate.readOnlyReason) throw new VaultError('UNSUPPORTED', `read-only-${candidate.readOnlyReason}`);
    this.lock();
    const token = this.token;
    const head = await this.storage.readHead();
    if (head && !opts.confirmReplace) throw new StorageError('INVALID_STATE', 'replace-not-confirmed');
    const db = candidate.take();
    assignProductMetadata(db, { keepVaultId: true });
    bumpRevision(db, this.now());
    const serialized = await serializeVerified(db);
    this.checkLive(token);
    const next = await this.storage.commit({
      bytes: serialized.bytes,
      sha256: serialized.sha256,
      expectedGeneration: head ? head.generation : null,
      // A restored file may use another password: older blobs belong to an older epoch.
      passwordEpoch: head ? head.passwordEpoch + 1 : 0,
      confirmedReplacement: !!head && opts.confirmReplace,
      now: this.now()
    });
    this.checkLive(token);
    this.session = new UnlockedSession(this, token, db, next, serialized.sha256);
    return { session: this.session };
  }
}

export class RestoreCandidate {
  readonly counts: VaultCounts;
  readonly product: ProductMetadata | null;
  readonly relation: CandidateRelation;
  readonly readOnlyReason: string | null;
  private db: Kdbx | null;

  constructor(opened: OpenedVault, relation: CandidateRelation) {
    this.db = opened.db;
    this.counts = opened.counts;
    this.product = opened.product;
    this.relation = relation;
    this.readOnlyReason = opened.readOnlyReason;
  }

  /** @internal */
  take(): Kdbx {
    if (!this.db) throw new StorageError('INVALID_STATE', 'candidate-used');
    const db = this.db;
    this.db = null;
    return db;
  }

  discard(): void {
    this.db = null;
  }
}

export class UnlockedSession {
  private readonly controller: VaultController;
  private readonly token: number;
  private kdbxDb: Kdbx | null;
  private headRecord: HeadRecord;
  private committedSha: string;
  private pending: UnsavedCandidate | null = null;
  private dirty = false;
  private saving = false;
  readonly readOnlyReason: string | null;
  invalidated = false;

  constructor(controller: VaultController, token: number, db: Kdbx, head: HeadRecord, sha256: string, readOnlyReason: string | null = null) {
    this.controller = controller;
    this.token = token;
    this.kdbxDb = db;
    this.headRecord = head;
    this.committedSha = sha256;
    this.readOnlyReason = readOnlyReason;
  }

  /** @internal */
  invalidate(): void {
    this.invalidated = true;
    this.kdbxDb = null;
    this.pending = null;
  }

  private live(): Kdbx {
    if (this.invalidated || !this.kdbxDb || !this.controller.isLive(this.token)) throw locked();
    return this.kdbxDb;
  }

  /** The decrypted database. Throws once the session is locked. */
  get db(): Kdbx {
    return this.live();
  }

  get product(): ProductMetadata | null {
    return readProductMetadata(this.live());
  }

  get head(): HeadRecord {
    return this.headRecord;
  }

  /** True when in-memory content differs from the committed head (a save failed or is pending). */
  get hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  get unsaved(): UnsavedCandidate | null {
    return this.pending;
  }

  /**
   * Apply a content change and save it with the full transaction:
   * validate (inside `change`; adapter mutators validate before mutating) →
   * bump revision once → serialize and verify (outside any IndexedDB
   * transaction) → CAS commit → read-back. Resolves only when the vault is
   * saved on this device. A change returning exactly `false` (for example a
   * no-op `updateEntry`) saves nothing and creates no revision. On failure the
   * verified candidate is kept for Retry / encrypted export.
   */
  async change<T>(change: (db: Kdbx) => T): Promise<T> {
    const db = this.live();
    if (this.readOnlyReason) throw new VaultError('UNSUPPORTED', `read-only-${this.readOnlyReason}`);
    if (this.saving) throw new StorageError('INVALID_STATE', 'save-in-progress');
    if (this.dirty) throw new StorageError('INVALID_STATE', 'unsaved-changes');
    const result = change(db);
    if (result === false) return result;
    this.dirty = true;
    this.saving = true;
    try {
      let serialized: SerializedVault;
      try {
        bumpRevision(db, this.controller.nowDate());
        serialized = await serializeVerified(db);
      } catch (e) {
        // No verified candidate (for example a limit was hit): return to the committed state.
        this.saving = false;
        await this.discardChanges().catch(() => {});
        throw e;
      }
      // Locked while serializing (app hidden): discard; never commit after lock.
      this.live();
      await this.commitCandidate(serialized.bytes, serialized.sha256);
      return result;
    } finally {
      this.saving = false;
    }
  }

  private async commitCandidate(bytes: Uint8Array, sha256: string, passwordEpoch?: number): Promise<void> {
    const expectedGeneration = this.headRecord.generation;
    try {
      const head = await this.controller.storage.commit({ bytes, sha256, expectedGeneration, passwordEpoch, now: this.controller.nowDate() });
      // Committed: authoritative even if the session was locked meanwhile.
      if (!this.invalidated) {
        this.headRecord = head;
        this.committedSha = sha256;
        this.dirty = false;
        this.pending = null;
      }
    } catch (e) {
      const error = e instanceof StorageError || e instanceof VaultError ? e : new StorageError('WRITE_FAILED');
      if (error instanceof StorageError && error.code === 'READBACK_FAILED') {
        // The transaction completed; the head did move. Keep the bytes for export anyway.
        const head = await this.controller.storage.readHead().catch(() => null);
        if (head && head.generation === expectedGeneration + 1 && !this.invalidated) {
          this.headRecord = head;
          this.committedSha = sha256;
        }
      }
      if (!this.invalidated) this.pending = { bytes, sha256, expectedGeneration, error };
      throw error;
    }
  }

  /** Retry committing the kept candidate (same generation check; no new revision). */
  async retrySave(): Promise<void> {
    this.live();
    const p = this.pending;
    if (!p) throw new StorageError('INVALID_STATE', 'nothing-to-retry');
    if (p.error instanceof StorageError && p.error.code === 'CONFLICT') throw p.error;
    if (this.saving) throw new StorageError('INVALID_STATE', 'save-in-progress');
    this.saving = true;
    try {
      await this.commitCandidate(p.bytes, p.sha256);
    } finally {
      this.saving = false;
    }
  }

  /** Throw away in-memory changes and reload the committed head with the same credentials. */
  async discardChanges(): Promise<void> {
    const db = this.live();
    const current = await this.controller.storage.readCurrent();
    if (!current) throw new StorageError('INVALID_STATE', 'empty');
    const opened = await reopenWithCredentialsOf(current.blob.bytes, db);
    this.live();
    this.kdbxDb = opened.db;
    this.headRecord = current.head;
    this.committedSha = current.blob.sha256;
    this.dirty = false;
    this.pending = null;
  }

  /**
   * Prepare an encrypted backup of the committed head: read it from storage
   * (hash-checked), authenticate it again, and build a generic file name.
   * Records an `export-prepared` receipt. Plaintext is not involved.
   */
  async prepareExport(): Promise<ExportFile> {
    const db = this.live();
    const blob = await this.controller.storage.readBlob(this.headRecord.blobId);
    const opened = await reopenWithCredentialsOf(blob.bytes, db);
    this.live();
    await this.controller.storage.addReceipt('export-prepared', blob.sha256, this.controller.nowDate());
    return {
      fileName: backupFileName(opened.product, blob.committedAt),
      bytes: new Uint8Array(blob.bytes),
      sha256: blob.sha256,
      generation: blob.generation,
      revision: opened.product?.revision ?? null
    };
  }

  /** Encrypted export of an uncommitted, already verified candidate after a failed save. */
  candidateForExport(): ExportFile {
    this.live();
    const p = this.pending;
    if (!p) throw new StorageError('INVALID_STATE', 'no-candidate');
    const stamp = this.controller.nowDate().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return { fileName: `vault-unsaved-${stamp}.kdbx`, bytes: p.bytes, sha256: p.sha256, generation: p.expectedGeneration, revision: null };
  }

  /**
   * Master-password rotation (section 5): verify the current password against
   * the committed ciphertext, build and independently verify a candidate under
   * the new password, commit atomically with a new password epoch, then delete
   * old-password rollback copies in a separate transaction.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ warnings: PasswordWarning[]; oldPasswordCopiesRemain: number }> {
    this.live();
    if (this.dirty || this.saving) throw new StorageError('INVALID_STATE', 'unsaved-changes');
    const blob = await this.controller.storage.readBlob(this.headRecord.blobId);
    const { db, serialized, warnings } = await changeMasterPassword(new Uint8Array(blob.bytes), currentPassword, newPassword);
    this.live();
    this.saving = true;
    try {
      await this.commitCandidate(serialized.bytes, serialized.sha256, this.headRecord.passwordEpoch + 1);
    } finally {
      this.saving = false;
    }
    if (!this.invalidated) this.kdbxDb = db;
    let oldPasswordCopiesRemain = 0;
    try {
      await this.controller.storage.deleteOlderPasswordEpochs();
    } catch {
      /* reported below */
    }
    try {
      oldPasswordCopiesRemain = await this.controller.storage.countOlderPasswordEpochs();
    } catch {
      oldPasswordCopiesRemain = -1;
    }
    return { warnings, oldPasswordCopiesRemain };
  }
}
