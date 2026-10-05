/**
 * Errors raised by the durability core.
 *
 * Like the adapter's VaultError, messages are fixed safe strings: they never
 * contain record data, passwords, keys or ciphertext.
 */

export type StorageErrorCode =
  /** IndexedDB is missing or the database could not be opened. */
  | 'UNAVAILABLE'
  /** The head changed since the editor opened it; nothing was written. */
  | 'CONFLICT'
  /** The browser refused the write for lack of space; nothing was written. */
  | 'QUOTA'
  /** The transaction failed or aborted; the previous head is unchanged. */
  | 'WRITE_FAILED'
  /** The transaction completed but reading the blob back did not match. Storage is unhealthy. */
  | 'READBACK_FAILED'
  /** A stored blob does not match its recorded hash or is missing. */
  | 'CORRUPT'
  /** A referenced record does not exist. */
  | 'NOT_FOUND'
  /** The operation is not allowed in the current state (locked, read-only, stale session). */
  | 'INVALID_STATE';

const MESSAGES: Record<StorageErrorCode, string> = {
  UNAVAILABLE: 'Local storage is not available in this browser.',
  CONFLICT: 'The vault was changed in another tab or window. Nothing was overwritten.',
  QUOTA: 'There is not enough storage space. The previous version is unchanged.',
  WRITE_FAILED: 'Saving failed. The previous version is unchanged.',
  READBACK_FAILED: 'The saved data could not be read back. Export an encrypted backup now.',
  CORRUPT: 'Stored vault data is damaged.',
  NOT_FOUND: 'The requested stored item does not exist.',
  INVALID_STATE: 'This action is not possible right now.'
};

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly detail: string | undefined;

  constructor(code: StorageErrorCode, detail?: string) {
    super(MESSAGES[code]);
    this.name = 'StorageError';
    this.code = code;
    this.detail = detail;
  }
}

export function isStorageError(e: unknown, code?: StorageErrorCode): e is StorageError {
  return e instanceof StorageError && (code === undefined || e.code === code);
}
