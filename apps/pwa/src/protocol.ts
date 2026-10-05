/**
 * Message protocol between the UI thread and the vault worker.
 *
 * The worker owns the decrypted database, the KDF and IndexedDB. The UI
 * receives only what a screen renders. Secrets cross only on an explicit
 * reveal, copy or edit. Messages are never persisted by either side.
 */

import type { CandidateRelation, BackupStatus, BlobInfo, ReceiptKind } from '@passkey-local/vault-core';
import type { EntryInput, EntryView, GroupView, PasswordWarning, SearchHit, SearchOptions, GeneratorOptions, VaultCounts } from '@passkey-local/vault-adapter';

export type LifecycleState = 'empty' | 'locked' | 'head-unreadable' | 'unlocked';

export interface Overview {
  entries: EntryView[];
  groups: GroupView[];
  revision: string | null;
  generation: number;
  unsaved: { code: string } | null;
  readOnly: boolean;
}

/** Entry detail without secret values: password and protected fields are omitted. */
export interface EntryDetail {
  uuid: string;
  title: string;
  username: string;
  url: string;
  notes: string;
  tags: string[];
  hasPassword: boolean;
  customFields: { name: string; value: string | null; protected: boolean }[];
  expiresAt: string | null;
  favorite: boolean;
  inRecycleBin: boolean;
  createdAt: string | null;
  modifiedAt: string | null;
  historyCount: number;
}

export interface HistoryItem {
  index: number;
  modifiedAt: string | null;
  changedFields: string[];
  title: string;
}

export interface FileOut {
  fileName: string;
  bytes: Uint8Array;
  sha256: string;
}

export interface CandidateSummary {
  counts: VaultCounts;
  revision: string | null;
  savedAt: string | null;
  relation: CandidateRelation;
  readOnlyReason: string | null;
}

export interface BackupCheckSummary {
  counts: VaultCounts;
  revision: string | null;
  matchesCurrentHead: boolean;
  matchesStoredGeneration: number | null;
  relation: CandidateRelation;
}

export interface Requests {
  biometricCredential: [void, BiometricCredential | null];
  enableBiometric: [{ password: string; credential: BiometricCredential; prf: Uint8Array }, void];
  unlockBiometric: [{ credentialId: Uint8Array; prf: Uint8Array }, { warnings: PasswordWarning[] }];
  disableBiometric: [void, void];
  state: [void, { state: LifecycleState; persistence: 'persisted' | 'not-persisted' | 'unavailable'; storageUnhealthy: boolean }];
  create: [{ password: string }, { warnings: PasswordWarning[] }];
  unlock: [{ password: string }, { warnings: PasswordWarning[] }];
  overview: [void, Overview];
  entryDetail: [{ uuid: string }, EntryDetail];
  /** Explicit reveal/copy of one field of the current version or a history version. */
  revealField: [{ uuid: string; field: string; historyIndex?: number }, { value: string }];
  entryForEdit: [{ uuid: string }, EntryInput];
  saveEntry: [{ uuid: string | null; input: EntryInput; groupUuid?: string }, { uuid: string; changed: boolean }];
  setFavorite: [{ uuid: string; favorite: boolean }, void];
  recycle: [{ uuid: string }, void];
  restoreFromRecycleBin: [{ uuid: string }, void];
  deletePermanently: [{ uuid: string }, void];
  createGroup: [{ name: string; parentUuid?: string }, { uuid: string }];
  history: [{ uuid: string }, HistoryItem[]];
  historyDetail: [{ uuid: string; index: number }, EntryDetail];
  restoreHistory: [{ uuid: string; index: number }, void];
  search: [{ query: string; options: SearchOptions }, SearchHit[]];
  generatePassword: [GeneratorOptions, { value: string }];
  generatePassphrase: [void, { value: string; bits: number }];
  retrySave: [void, void];
  discardChanges: [void, void];
  unsavedForExport: [void, FileOut];
  backupStatus: [void, BackupStatus];
  prepareExport: [void, FileOut];
  recordExportOutcome: [{ kind: Exclude<ReceiptKind, 'verified' | 'export-prepared'>; sha256: string }, void];
  verifyBackup: [{ bytes: Uint8Array; password: string }, BackupCheckSummary];
  openCandidate: [{ bytes: Uint8Array; password: string }, CandidateSummary];
  adoptCandidate: [{ confirmReplace: boolean }, void];
  discardCandidate: [void, void];
  changePassword: [{ current: string; next: string }, { warnings: PasswordWarning[]; oldPasswordCopiesRemain: number }];
  snapshots: [void, BlobInfo[]];
  restoreSnapshot: [{ blobId: string; password: string }, void];
  rawSnapshot: [{ blobId: string }, FileOut];
  getPreferences: [void, Preferences];
  setPreference: [{ key: keyof Preferences; value: unknown }, void];
}

/** Public WebAuthn metadata only; never includes a PRF result or unwrapped password. */
export interface BiometricCredential {
  credentialId: Uint8Array;
  salt: Uint8Array;
}

export interface Preferences {
  lockIntervalMs: number;
  language: 'auto' | 'en' | 'ru';
  theme: 'auto' | 'light' | 'dark';
  onboardingBackupVerified: boolean;
}

export type Op = keyof Requests;
export type Args<O extends Op> = Requests[O][0];
export type Result<O extends Op> = Requests[O][1];

export interface RequestMessage {
  id: number;
  op: Op;
  args: unknown;
}

export interface SafeError {
  /** VaultError or StorageError code, or INTERNAL. */
  code: string;
  detail?: string;
}

export type ResponseMessage = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: SafeError };
