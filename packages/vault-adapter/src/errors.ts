/**
 * Error model for the vault adapter.
 *
 * Messages are fixed, safe strings. They never contain record content, XML,
 * passwords or library object dumps, so they can be shown to the user or logged.
 */

export type VaultErrorCode =
  /** Password is wrong or authenticated data is damaged; the two cannot be told apart. */
  | 'AUTH_FAILED'
  /** The file is valid KDBX but uses a profile, feature or schema this version does not support. */
  | 'UNSUPPORTED'
  /** A product resource limit would be exceeded (size, counts, field lengths, KDF cost). */
  | 'LIMIT_EXCEEDED'
  /** Structurally malformed or truncated data, detected independently of the password. */
  | 'MALFORMED'
  /** Input rejected by validation (password policy, invalid Unicode, bad argument). */
  | 'INVALID_INPUT'
  /** No cryptographically secure random source is available. */
  | 'RNG_UNAVAILABLE'
  /** A serialized candidate failed independent re-open verification. */
  | 'VERIFY_FAILED'
  /** Unexpected internal failure. */
  | 'INTERNAL';

const DEFAULT_MESSAGES: Record<VaultErrorCode, string> = {
  AUTH_FAILED: 'Unable to unlock: password is incorrect or the file is damaged.',
  UNSUPPORTED: 'This file uses a format or feature that is not supported.',
  LIMIT_EXCEEDED: 'A vault limit would be exceeded.',
  MALFORMED: 'The file is malformed or truncated.',
  INVALID_INPUT: 'The input is not valid.',
  RNG_UNAVAILABLE: 'A secure random number generator is not available.',
  VERIFY_FAILED: 'The encrypted file could not be verified after writing.',
  INTERNAL: 'An internal error occurred.'
};

export class VaultError extends Error {
  readonly code: VaultErrorCode;
  /** Short machine-readable detail, e.g. `kdf-memory-out-of-range`. Never contains user data. */
  readonly detail: string | undefined;

  constructor(code: VaultErrorCode, detail?: string, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'VaultError';
    this.code = code;
    this.detail = detail;
  }
}

export function isVaultError(e: unknown): e is VaultError {
  return e instanceof VaultError;
}
