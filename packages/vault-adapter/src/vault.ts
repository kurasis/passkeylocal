/**
 * Vault lifecycle: create, open (preflight + authenticate), and serialize a
 * verified candidate. All cryptography is done by kdbxweb/hash-wasm.
 */

import type kdbxweb from 'kdbxweb';
import { VaultError, isVaultError } from './errors.ts';
import { kdbx } from './kdbx.ts';
import { checkImportFidelity } from './fidelity.ts';
import { checkVaultLimits, type VaultCounts } from './limits.ts';
import { checkExistingPassword, checkNewMasterPassword, type PasswordWarning } from './password.ts';
import { preflight, type PreflightSummary } from './preflight.ts';
import { LIMITS, META_KEYS, READER_ENVELOPE, SCHEMA_VERSION, WRITER_PROFILE } from './profile.ts';
import { secureRandomBytes, randomUuid } from './random.ts';
import { toRecoveryModel } from './recovery-model.ts';
import { timeText } from './recovery-model.ts';

export type Kdbx = kdbxweb.Kdbx;

export interface ProductMetadata {
  schemaVersion: string;
  vaultId: string;
  lineageId: string;
  revision: string;
  savedAt: string | null;
}

export interface OpenedVault {
  db: Kdbx;
  preflight: PreflightSummary;
  counts: VaultCounts;
  /** Null for an ordinary KDBX file without this product's metadata. */
  product: ProductMetadata | null;
  warnings: PasswordWarning[];
  /**
   * Non-null when the file holds content the adapter cannot write back losslessly.
   * The vault can be viewed and its original bytes exported, but never re-saved.
   */
  readOnlyReason: string | null;
}

/** Databases opened from files that cannot be written back without loss. */
const readOnly = new WeakMap<Kdbx, string>();

export function readOnlyReason(db: Kdbx): string | null {
  return readOnly.get(db) ?? null;
}

export interface SerializedVault {
  bytes: Uint8Array;
  sha256: string;
  counts: VaultCounts;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function credentialsFor(password: string): kdbxweb.KdbxCredentials {
  const K = kdbx();
  return new K.Credentials(K.ProtectedValue.fromString(password));
}

function setMeta(db: Kdbx, key: string, value: string): void {
  db.meta.customData.set(key, { value, lastModified: new Date() });
}

function getMeta(db: Kdbx, key: string): string | undefined {
  return db.meta.customData.get(key)?.value;
}

/** Translate kdbxweb errors into the adapter's error model without leaking content. */
function mapLibraryError(e: unknown): VaultError {
  if (isVaultError(e)) return e;
  const K = kdbx();
  if (e instanceof K.KdbxError) {
    switch (e.code) {
      case K.Consts.ErrorCodes.InvalidKey:
        return new VaultError('AUTH_FAILED', 'header-hmac');
      case K.Consts.ErrorCodes.FileCorrupt:
        // Block HMAC failures and damaged authenticated data cannot be told apart from a wrong key.
        return /^bad xml/.test(e.message)
          ? new VaultError('MALFORMED', 'xml')
          : new VaultError('AUTH_FAILED', 'authenticated-data');
      case K.Consts.ErrorCodes.BadSignature:
      case K.Consts.ErrorCodes.InvalidVersion:
      case K.Consts.ErrorCodes.Unsupported:
      case K.Consts.ErrorCodes.NotImplemented:
        return new VaultError('UNSUPPORTED', 'library');
      default:
        return new VaultError('INTERNAL', 'library');
    }
  }
  return new VaultError('INTERNAL', 'unexpected');
}

/** Read the product metadata, or null when the file has none. Rejects future schemas. */
export function readProductMetadata(db: Kdbx): ProductMetadata | null {
  const schema = getMeta(db, META_KEYS.schemaVersion);
  if (schema === undefined) return null;
  if (!/^\d+$/.test(schema)) throw new VaultError('UNSUPPORTED', 'schema-version-invalid');
  if (schema !== SCHEMA_VERSION) throw new VaultError('UNSUPPORTED', 'schema-version-newer');
  const vaultId = getMeta(db, META_KEYS.vaultId);
  const lineageId = getMeta(db, META_KEYS.lineageId);
  const revision = getMeta(db, META_KEYS.revision);
  if (!vaultId || !lineageId || revision === undefined || !/^\d+$/.test(revision)) {
    throw new VaultError('UNSUPPORTED', 'product-metadata-incomplete');
  }
  return { schemaVersion: schema, vaultId, lineageId, revision, savedAt: getMeta(db, META_KEYS.savedAt) ?? null };
}

/** Assign fresh product metadata (new vault, or a deliberately adopted file). */
export function assignProductMetadata(db: Kdbx, opts: { keepVaultId?: boolean } = {}): ProductMetadata {
  const vaultId = opts.keepVaultId ? (getMeta(db, META_KEYS.vaultId) ?? randomUuid()) : randomUuid();
  const lineageId = randomUuid();
  const revision = getMeta(db, META_KEYS.revision) ?? '0';
  setMeta(db, META_KEYS.schemaVersion, SCHEMA_VERSION);
  setMeta(db, META_KEYS.vaultId, vaultId);
  setMeta(db, META_KEYS.lineageId, lineageId);
  setMeta(db, META_KEYS.revision, revision);
  return { schemaVersion: SCHEMA_VERSION, vaultId, lineageId, revision, savedAt: getMeta(db, META_KEYS.savedAt) ?? null };
}

/**
 * Increment LocalVault.Revision and set LocalVault.SavedAt. Call exactly once per
 * committed content/settings change, before serializing the candidate.
 */
export function bumpRevision(db: Kdbx, now: Date = new Date()): string {
  const current = getMeta(db, META_KEYS.revision) ?? '0';
  if (!/^\d+$/.test(current)) throw new VaultError('UNSUPPORTED', 'revision-invalid');
  const next = (BigInt(current) + 1n).toString();
  setMeta(db, META_KEYS.revision, next);
  setMeta(db, META_KEYS.savedAt, timeText(now)!);
  return next;
}

/** Apply the fixed writer profile to a database object (new vaults only). */
function applyWriterProfile(db: Kdbx): void {
  const K = kdbx();
  const VT = K.VarDictionary.ValueType;
  db.setVersion(4);
  db.header.versionMinor = WRITER_PROFILE.versionMinor;
  db.header.dataCipherUuid = new K.KdbxUuid(K.Consts.CipherId.Aes);
  db.header.compression = K.Consts.CompressionAlgorithm.None;
  db.setKdf(K.Consts.KdfId.Argon2id);
  const kp = db.header.kdfParameters!;
  kp.set('M', VT.UInt64, K.Int64.from(WRITER_PROFILE.kdfMemoryBytes));
  kp.set('I', VT.UInt64, K.Int64.from(WRITER_PROFILE.kdfIterations));
  kp.set('P', VT.UInt32, WRITER_PROFILE.kdfParallelism);
  kp.set('V', VT.UInt32, WRITER_PROFILE.argon2Version);
}

/**
 * Check that a database object will be written with an allowed profile.
 * Imported files keep their (stronger, in-envelope) KDF settings.
 */
function assertWritableProfile(db: Kdbx): void {
  const K = kdbx();
  const h = db.header;
  if (h.versionMajor !== 4) throw new VaultError('UNSUPPORTED', 'write-version');
  if (h.dataCipherUuid?.toString() !== K.Consts.CipherId.Aes) throw new VaultError('UNSUPPORTED', 'write-cipher');
  if (h.compression !== K.Consts.CompressionAlgorithm.None) throw new VaultError('UNSUPPORTED', 'write-compression');
  if (h.crsAlgorithm !== K.Consts.CrsAlgorithm.ChaCha20) throw new VaultError('UNSUPPORTED', 'write-inner-stream');
  const kp = h.kdfParameters;
  const uuid = kp?.get('$UUID');
  if (!(uuid instanceof ArrayBuffer) || K.ByteUtils.bytesToBase64(uuid) !== K.Consts.KdfId.Argon2id) {
    throw new VaultError('UNSUPPORTED', 'write-kdf');
  }
  const m = kp!.get('M');
  const it = kp!.get('I');
  const p = kp!.get('P');
  const v = kp!.get('V');
  const E = READER_ENVELOPE;
  const mem = m instanceof K.Int64 ? m.value : NaN;
  const iter = it instanceof K.Int64 ? it.value : NaN;
  if (
    v !== WRITER_PROFILE.argon2Version ||
    !(mem >= E.kdfMemoryMinBytes && mem <= E.kdfMemoryMaxBytes && mem % 1024 === 0) ||
    !(iter >= E.kdfIterationsMin && iter <= E.kdfIterationsMax) ||
    typeof p !== 'number' ||
    !(p >= E.kdfParallelismMin && p <= E.kdfParallelismMax)
  ) {
    throw new VaultError('UNSUPPORTED', 'write-kdf-parameters');
  }
}

export interface CreateVaultOptions {
  password: string;
  /** Database name stored in the encrypted payload. Keep it generic. */
  name?: string;
  now?: Date;
}

/** Create a new, empty vault using the mandatory v1 writer profile. */
export function createVault(opts: CreateVaultOptions): { db: Kdbx; product: ProductMetadata; warnings: PasswordWarning[] } {
  const { warnings } = checkNewMasterPassword(opts.password);
  secureRandomBytes(32); // fail early (RNG_UNAVAILABLE) before touching the library
  const K = kdbx();
  const db = K.Kdbx.create(credentialsFor(opts.password), opts.name ?? 'Vault');
  applyWriterProfile(db);
  // Keep all history by default; other KeePass clients prune to HistoryMaxItems on save.
  db.meta.historyMaxItems = -1;
  db.meta.historyMaxSize = -1;
  db.meta.memoryProtection = { title: false, userName: false, password: true, url: false, notes: false };
  db.createRecycleBin();
  const product = assignProductMetadata(db);
  setMeta(db, META_KEYS.savedAt, timeText(opts.now ?? new Date())!);
  product.savedAt = getMeta(db, META_KEYS.savedAt) ?? null;
  return { db, product, warnings };
}

/**
 * Open an existing KDBX file: bounded preflight, then authenticated decryption
 * by kdbxweb, then profile, schema and product-limit checks. Nothing is
 * returned unless every check passed.
 */
export async function openVault(bytes: Uint8Array | ArrayBuffer, password: string): Promise<OpenedVault> {
  const { warnings } = checkExistingPassword(password);
  return openWithCredentials(bytes, credentialsFor(password), warnings);
}

/**
 * Consume a password-only SHA-256 credential component, not a final KDF key.
 * kdbxweb's public passwordHash field is before composite hashing and Argon2;
 * using setPassword here would hash twice. No key-file/challenge credential is
 * accepted. The caller transfers ownership; input bytes are cleared on all paths.
 */
export async function openVaultWithPasswordHash(bytes: Uint8Array | ArrayBuffer, hash: Uint8Array): Promise<OpenedVault> {
  try {
    if (!(hash instanceof Uint8Array) || hash.byteLength !== 32) throw new VaultError('INVALID_INPUT', 'credential-length');
    const K = kdbx();
    const credentials = new K.Credentials(null);
    await credentials.ready;
    credentials.passwordHash = K.ProtectedValue.fromBinary(hash.slice().buffer);
    return await openWithCredentials(bytes, credentials, []);
  } finally {
    if (hash instanceof Uint8Array) hash.fill(0);
  }
}

/**
 * Re-open bytes with the credentials of an already unlocked database (for
 * example to discard unsaved changes or authenticate a stored snapshot) without
 * keeping the master password as a string. Same checks as `openVault`.
 */
export async function reopenWithCredentialsOf(bytes: Uint8Array | ArrayBuffer, unlocked: Kdbx): Promise<OpenedVault> {
  return openWithCredentials(bytes, unlocked.credentials, []);
}

async function openWithCredentials(
  bytes: Uint8Array | ArrayBuffer,
  credentials: kdbxweb.Credentials,
  warnings: PasswordWarning[]
): Promise<OpenedVault> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const summary = await preflight(input);
  const K = kdbx();
  let db: Kdbx;
  try {
    db = await K.Kdbx.load(toArrayBuffer(input), credentials, { preserveXml: true });
  } catch (e) {
    throw mapLibraryError(e);
  }
  const xml = db.xml;
  db.xml = undefined;
  if (db.header.crsAlgorithm !== K.Consts.CrsAlgorithm.ChaCha20) throw new VaultError('UNSUPPORTED', 'inner-stream');
  const counts = checkVaultLimits(db);
  const product = readProductMetadata(db);
  const lossy = xml ? checkImportFidelity(xml, db) : 'xml-unavailable';
  if (lossy) readOnly.set(db, lossy);
  return { db, preflight: summary, counts, product, warnings, readOnlyReason: lossy };
}

/**
 * Serialize a candidate and prove it before anyone may commit it:
 * limits → kdbxweb save (fresh salts/IV/seeds) → size cap → preflight →
 * independent re-open with the same credentials → logical comparison.
 */
export async function serializeVerified(db: Kdbx): Promise<SerializedVault> {
  const lossy = readOnly.get(db);
  if (lossy) throw new VaultError('UNSUPPORTED', `read-only-${lossy}`);
  assertWritableProfile(db);
  const counts = checkVaultLimits(db);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await db.save());
  } catch (e) {
    throw mapLibraryError(e);
  }
  if (bytes.byteLength > LIMITS.maxFileBytes) throw new VaultError('LIMIT_EXCEEDED', 'file-too-large');
  try {
    await preflight(bytes);
    const K = kdbx();
    const reopened = await K.Kdbx.load(toArrayBuffer(bytes), db.credentials);
    const expected = JSON.stringify(toRecoveryModel(db));
    const actual = JSON.stringify(toRecoveryModel(reopened));
    if (expected !== actual) throw new VaultError('VERIFY_FAILED', 'logical-mismatch');
  } catch (e) {
    if (isVaultError(e) && e.code === 'VERIFY_FAILED') throw e;
    throw new VaultError('VERIFY_FAILED', isVaultError(e) ? e.detail : 'reopen');
  }
  return { bytes, sha256: await sha256Hex(bytes), counts };
}

/**
 * Change the master password. Requires the current password to be re-entered
 * and verified against the committed ciphertext, even while unlocked.
 * Returns a verified candidate; the caller commits it atomically.
 */
export async function changeMasterPassword(
  committed: Uint8Array,
  currentPassword: string,
  newPassword: string
): Promise<{ db: Kdbx; serialized: SerializedVault; warnings: PasswordWarning[] }> {
  const { db } = await openVault(committed, currentPassword);
  const { warnings } = checkNewMasterPassword(newPassword);
  const before = JSON.stringify(toRecoveryModel(db).entries);
  await db.credentials.setPassword(kdbx().ProtectedValue.fromString(newPassword));
  bumpRevision(db);
  const serialized = await serializeVerified(db);
  // Independent check with a fresh credential object for the NEW password.
  const reopened = await openVault(serialized.bytes, newPassword);
  if (JSON.stringify(toRecoveryModel(reopened.db).entries) !== before) {
    throw new VaultError('VERIFY_FAILED', 'password-change-content');
  }
  return { db, serialized, warnings };
}

export { sha256Hex };
