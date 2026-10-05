/**
 * Request handlers of the vault worker. Kept free of `self`/postMessage so the
 * same logic is unit-testable in Node with fake IndexedDB.
 */

import {
  ENTRY_KEYS,
  VaultError,
  changedFieldNames,
  createEntry,
  createGroup,
  deletePermanently,
  findEntry,
  generatePassphrase,
  generatePassword,
  isVaultError,
  kdbx,
  listEntries,
  listGroups,
  moveEntry,
  moveToRecycleBin,
  passphraseEntropyBits,
  readEntry,
  restoreFromRecycleBin,
  restoreHistory,
  searchEntries,
  setFavorite,
  timeText,
  updateEntry
} from '@passkey-local/vault-adapter';
import {
  DEFAULT_LOCK_INTERVAL_MS,
  StorageError,
  VaultController,
  isLockInterval,
  requestPersistence,
  type RestoreCandidate,
  type UnlockedSession,
  type VaultStorage
} from '@passkey-local/vault-core';
import type { Args, EntryDetail, Op, Preferences, Result, SafeError } from '../protocol.ts';
import { BiometricVault } from './biometric.ts';

type KdbxEntry = ReturnType<typeof findEntry>;

const DEFAULT_PREFERENCES: Preferences = {
  lockIntervalMs: DEFAULT_LOCK_INTERVAL_MS,
  language: 'auto',
  theme: 'color',
  onboardingBackupVerified: false
};

function text(v: unknown): string {
  const K = kdbx();
  return v instanceof K.ProtectedValue ? v.getText() : typeof v === 'string' ? v : '';
}

function isProtected(v: unknown): boolean {
  return v instanceof kdbx().ProtectedValue;
}

const STANDARD = new Set(['Title', 'UserName', 'Password', 'URL', 'Notes']);

function detailOf(uuid: string, e: KdbxEntry, current: KdbxEntry, inRecycleBin: boolean): EntryDetail {
  return {
    uuid,
    title: text(e.fields.get('Title')),
    username: text(e.fields.get('UserName')),
    url: text(e.fields.get('URL')),
    notes: text(e.fields.get('Notes')),
    tags: [...e.tags],
    hasPassword: text(e.fields.get('Password')).length > 0,
    customFields: [...e.fields]
      .filter(([k]) => !STANDARD.has(k))
      .map(([name, v]) => ({ name, value: isProtected(v) ? null : text(v), protected: isProtected(v) })),
    expiresAt: e.times.expires ? timeText(e.times.expiryTime) : null,
    favorite: current.customData?.get(ENTRY_KEYS.favorite)?.value === 'true',
    inRecycleBin,
    createdAt: timeText(e.times.creationTime),
    modifiedAt: timeText(e.times.lastModTime),
    historyCount: current.history.length
  };
}

export function toSafeError(e: unknown): SafeError {
  if (isVaultError(e) || e instanceof StorageError) return { code: e.code, detail: e.detail };
  return { code: 'INTERNAL' };
}

export class VaultWorkerHandlers {
  private readonly controller: VaultController;
  private readonly storage: VaultStorage;
  private candidate: RestoreCandidate | null = null;
  private readonly biometric: BiometricVault;

  constructor(storage: VaultStorage, controller = new VaultController(storage)) {
    this.storage = storage;
    this.controller = controller;
    this.biometric = new BiometricVault(storage, controller);
  }

  private session(): UnlockedSession {
    const s = this.controller.current;
    if (!s || s.invalidated) throw new StorageError('INVALID_STATE', 'locked');
    return s;
  }

  private inRecycleBin(uuid: string): boolean {
    return listEntries(this.session().db).find((v) => v.uuid === uuid)?.inRecycleBin ?? false;
  }

  async handle<O extends Op>(op: O, args: Args<O>): Promise<Result<O>> {
    const fn = (this.ops as Record<string, (a: unknown) => unknown>)[op];
    if (!fn) throw new VaultError('INVALID_INPUT', 'op');
    return (await fn.call(this, args)) as Result<O>;
  }

  private readonly ops: { [O in Op]: (args: Args<O>) => Promise<Result<O>> | Result<O> } = {
    biometricCredential: () => this.biometric.credential(),
    enableBiometric: ({ password, credential, prf }) => this.biometric.enable(password, credential, prf),
    unlockBiometric: ({ credentialId, prf }) => this.biometric.unlock(credentialId, prf),
    disableBiometric: () => this.biometric.disable(),
    state: async () => {
      const st = this.controller.current ? { kind: 'unlocked' as const } : await this.controller.state();
      return {
        state: st.kind,
        persistence: await requestPersistence(),
        storageUnhealthy: this.storage.unhealthy
      };
    },
    create: async ({ password }) => ({ warnings: (await this.controller.create(password)).warnings }),
    unlock: async ({ password }) => ({ warnings: (await this.controller.unlock(password)).warnings }),
    overview: () => {
      const s = this.session();
      return {
        entries: listEntries(s.db),
        groups: listGroups(s.db),
        revision: s.product?.revision ?? null,
        generation: s.head.generation,
        unsaved: s.unsaved ? { code: s.unsaved.error.code } : null,
        readOnly: s.readOnlyReason !== null
      };
    },
    entryDetail: ({ uuid }) => {
      const e = findEntry(this.session().db, uuid);
      return detailOf(uuid, e, e, this.inRecycleBin(uuid));
    },
    historyDetail: ({ uuid, index }) => {
      const cur = findEntry(this.session().db, uuid);
      const h = cur.history[index];
      if (!h) throw new VaultError('INVALID_INPUT', 'history-index');
      return detailOf(uuid, h, cur, this.inRecycleBin(uuid));
    },
    revealField: ({ uuid, field, historyIndex }) => {
      const cur = findEntry(this.session().db, uuid);
      const e = historyIndex === undefined ? cur : cur.history[historyIndex];
      if (!e) throw new VaultError('INVALID_INPUT', 'history-index');
      if (!e.fields.has(field)) throw new VaultError('INVALID_INPUT', 'field');
      return { value: text(e.fields.get(field)) };
    },
    entryForEdit: ({ uuid }) => readEntry(this.session().db, uuid),
    saveEntry: async ({ uuid, input, groupUuid }) => {
      const s = this.session();
      if (uuid === null) {
        const id = await s.change((db) => createEntry(db, input, groupUuid));
        return { uuid: id, changed: true };
      }
      // One commit for the edit and the group move; false means nothing changed.
      const changed = await s.change((db) => {
        const edited = updateEntry(db, uuid, input);
        const moved = groupUuid ? moveEntry(db, uuid, groupUuid) : false;
        return edited || moved ? true : false;
      });
      return { uuid, changed: changed !== false };
    },
    setFavorite: async ({ uuid, favorite }) => {
      await this.session().change((db) => setFavorite(db, uuid, favorite));
    },
    recycle: async ({ uuid }) => {
      await this.session().change((db) => moveToRecycleBin(db, uuid));
    },
    restoreFromRecycleBin: async ({ uuid }) => {
      await this.session().change((db) => restoreFromRecycleBin(db, uuid));
    },
    deletePermanently: async ({ uuid }) => {
      await this.session().change((db) => deletePermanently(db, uuid));
    },
    createGroup: async ({ name, parentUuid }) => ({ uuid: await this.session().change((db) => createGroup(db, name, parentUuid)) }),
    history: ({ uuid }) => {
      const cur = findEntry(this.session().db, uuid);
      const items = cur.history.map((h, index) => {
        const next = cur.history[index + 1] ?? cur;
        return { index, modifiedAt: timeText(h.times.lastModTime), changedFields: changedFieldNames(h, next), title: text(h.fields.get('Title')) };
      });
      return items.reverse();
    },
    restoreHistory: async ({ uuid, index }) => {
      await this.session().change((db) => restoreHistory(db, uuid, index));
    },
    search: ({ query, options }) => searchEntries(this.session().db, query, options),
    generatePassword: (opts) => ({ value: generatePassword(opts) }),
    generatePassphrase: () => ({ value: generatePassphrase(), bits: passphraseEntropyBits() }),
    retrySave: () => this.session().retrySave(),
    discardChanges: () => this.session().discardChanges(),
    unsavedForExport: () => {
      const f = this.session().candidateForExport();
      return { fileName: f.fileName, bytes: f.bytes, sha256: f.sha256 };
    },
    backupStatus: () => this.controller.backupStatus(),
    prepareExport: async () => {
      const f = await this.session().prepareExport();
      return { fileName: f.fileName, bytes: f.bytes, sha256: f.sha256 };
    },
    recordExportOutcome: async ({ kind, sha256 }) => {
      await this.controller.recordExportOutcome(kind, sha256);
    },
    verifyBackup: async ({ bytes, password }) => {
      const c = await this.controller.verifyBackup(bytes, password);
      return {
        counts: c.counts,
        revision: c.product?.revision ?? null,
        matchesCurrentHead: c.matchesCurrentHead,
        matchesStoredGeneration: c.matchesStoredGeneration,
        relation: c.relation
      };
    },
    openCandidate: async ({ bytes, password }) => {
      this.candidate?.discard();
      const c = await this.controller.openCandidate(bytes, password);
      this.candidate = c;
      return { counts: c.counts, revision: c.product?.revision ?? null, savedAt: c.product?.savedAt ?? null, relation: c.relation, readOnlyReason: c.readOnlyReason };
    },
    adoptCandidate: async ({ confirmReplace }) => {
      const c = this.candidate;
      if (!c) throw new StorageError('INVALID_STATE', 'no-candidate');
      await this.biometric.disable();
      this.candidate = null;
      await this.controller.adoptCandidate(c, { confirmReplace });
    },
    discardCandidate: () => {
      this.candidate?.discard();
      this.candidate = null;
    },
    changePassword: async ({ current, next }) => {
      const s = this.session();
      await this.biometric.disable();
      return s.changePassword(current, next);
    },
    snapshots: () => this.controller.listSnapshots(),
    restoreSnapshot: async ({ blobId, password }) => {
      await this.biometric.disable();
      await this.controller.restoreSnapshot(blobId, password);
    },
    rawSnapshot: async ({ blobId }) => {
      const f = await this.controller.rawBlobForExport(blobId);
      return { fileName: f.fileName, bytes: f.bytes, sha256: f.sha256 };
    },
    getPreferences: async () => {
      const out: Preferences = { ...DEFAULT_PREFERENCES };
      const lock = await this.storage.getPreference<number>('lockIntervalMs');
      if (isLockInterval(lock)) out.lockIntervalMs = lock;
      const lang = await this.storage.getPreference<string>('language');
      if (lang === 'en' || lang === 'ru' || lang === 'auto') out.language = lang;
      const theme = await this.storage.getPreference<string>('theme');
      if (theme === 'light' || theme === 'dark' || theme === 'color' || theme === 'auto') out.theme = theme;
      out.onboardingBackupVerified = (await this.storage.getPreference<boolean>('onboardingBackupVerified')) === true;
      return out;
    },
    setPreference: async ({ key, value }) => {
      const valid =
        (key === 'lockIntervalMs' && isLockInterval(value)) ||
        (key === 'language' && (value === 'auto' || value === 'en' || value === 'ru')) ||
        (key === 'theme' && (value === 'auto' || value === 'color' || value === 'light' || value === 'dark')) ||
        (key === 'onboardingBackupVerified' && typeof value === 'boolean');
      if (!valid) throw new VaultError('INVALID_INPUT', 'preference');
      await this.storage.setPreference(key, value);
    }
  };
}
