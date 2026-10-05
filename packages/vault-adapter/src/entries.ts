/**
 * Entry and group operations over a kdbxweb database, mapped to standard KDBX
 * structures (PRODUCT_AND_ARCHITECTURE.md §2 "History and deletion", §4).
 *
 * Rules:
 *  - A full previous state goes to the standard History collection before an
 *    actual content change; no-op saves, opening, copying and searching create
 *    no history.
 *  - Restoring a history state preserves the former current state as another
 *    history item. Histories are never nested.
 *  - Moving to the recycle bin keeps history; permanent deletion removes the
 *    logical record (not secure erasure of older ciphertexts).
 *  - History is never pruned implicitly.
 */

import type kdbxweb from 'kdbxweb';
import { VaultError } from './errors.ts';
import { kdbx } from './kdbx.ts';
import { FORBIDDEN_TEXT_CHARS, checkEntryState, checkTag } from './limits.ts';
import { ENTRY_KEYS, STANDARD_FIELDS } from './profile.ts';
import { timeText, uuidText } from './recovery-model.ts';
import { scalarLength } from './text.ts';
import type { Kdbx } from './vault.ts';

type KdbxEntry = kdbxweb.KdbxEntry;
type KdbxGroup = kdbxweb.KdbxGroup;

export interface CustomFieldInput {
  name: string;
  value: string;
  protected: boolean;
}

/** Complete editable state of an entry, as submitted by an explicit Save. */
export interface EntryInput {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  customFields: CustomFieldInput[];
  /** null = does not expire. */
  expiresAt: Date | null;
}

export interface EntryView {
  uuid: string;
  groupUuid: string;
  title: string;
  username: string;
  url: string;
  tags: string[];
  favorite: boolean;
  inRecycleBin: boolean;
  expiresAt: string | null;
  modifiedAt: string | null;
  historyCount: number;
}

const STANDARD = new Set<string>(STANDARD_FIELDS);

function uuidFromText(text: string): kdbxweb.KdbxUuid {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text)) {
    throw new VaultError('INVALID_INPUT', 'uuid');
  }
  const K = kdbx();
  const hex = text.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return new K.KdbxUuid(bytes.buffer);
}

function fieldText(v: unknown): string {
  const K = kdbx();
  return v instanceof K.ProtectedValue ? v.getText() : typeof v === 'string' ? v : '';
}

function recycleBin(db: Kdbx): KdbxGroup | undefined {
  const id = db.meta.recycleBinUuid;
  return id && !id.empty ? db.getGroup(id) : undefined;
}

function isInGroup(item: { parentGroup: KdbxGroup | undefined }, group: KdbxGroup | undefined): boolean {
  if (!group) return false;
  for (let g = item.parentGroup; g; g = g.parentGroup) if (g === group) return true;
  return false;
}

export function findEntry(db: Kdbx, uuid: string): KdbxEntry {
  const id = uuidFromText(uuid).id;
  for (const root of db.groups) {
    for (const e of root.allEntries()) if (e.uuid.id === id) return e;
  }
  throw new VaultError('INVALID_INPUT', 'entry-not-found');
}

export function findGroup(db: Kdbx, uuid: string): KdbxGroup {
  const g = db.getGroup(uuidFromText(uuid));
  if (!g) throw new VaultError('INVALID_INPUT', 'group-not-found');
  return g;
}

function validateText(s: string): void {
  scalarLength(s);
  if (FORBIDDEN_TEXT_CHARS.test(s)) throw new VaultError('INVALID_INPUT', 'forbidden-control-character');
}

function validateInput(input: EntryInput): void {
  for (const s of [input.title, input.username, input.password, input.url, input.notes]) validateText(s);
  const names = new Set<string>();
  for (const f of input.customFields) {
    if (f.name.length === 0) throw new VaultError('INVALID_INPUT', 'custom-field-name-empty');
    if (STANDARD.has(f.name)) throw new VaultError('INVALID_INPUT', 'custom-field-name-reserved');
    if (names.has(f.name)) throw new VaultError('INVALID_INPUT', 'custom-field-name-duplicate');
    names.add(f.name);
    validateText(f.name);
    validateText(f.value);
  }
  for (const t of input.tags) checkTag(t);
  if (new Set(input.tags).size !== input.tags.length) throw new VaultError('INVALID_INPUT', 'tag-duplicate');
  if (input.expiresAt && Number.isNaN(input.expiresAt.getTime())) throw new VaultError('INVALID_INPUT', 'expiry');
}

/** Field map for an input. Password and protected custom fields become ProtectedValue. */
function fieldsFor(db: Kdbx, input: EntryInput): Map<string, string | kdbxweb.ProtectedValue> {
  const K = kdbx();
  const mp = db.meta.memoryProtection;
  const val = (v: string, prot: boolean | undefined) => (prot ? K.ProtectedValue.fromString(v) : v);
  const m = new Map<string, string | kdbxweb.ProtectedValue>();
  m.set('Title', val(input.title, mp.title));
  m.set('UserName', val(input.username, mp.userName));
  m.set('Password', K.ProtectedValue.fromString(input.password));
  m.set('URL', val(input.url, mp.url));
  m.set('Notes', val(input.notes, mp.notes));
  for (const f of input.customFields) m.set(f.name, val(f.value, f.protected));
  return m;
}

/** Comparable representation of the user-editable state of an entry. */
function editableKey(e: KdbxEntry): string {
  const K = kdbx();
  return JSON.stringify({
    fields: [...e.fields].map(([k, v]) => [k, fieldText(v), v instanceof K.ProtectedValue]),
    tags: e.tags,
    expires: e.times.expires === true,
    expiry: e.times.expires ? timeText(e.times.expiryTime) : null
  });
}

/**
 * Push a full copy of the entry's current state into its History.
 * kdbxweb's pushHistory() does not copy CustomData, QualityCheck or
 * PreviousParentGroup; they are copied here so history states are complete.
 */
function pushFullHistory(e: KdbxEntry): void {
  e.pushHistory();
  const h = e.history[e.history.length - 1]!;
  if (e.customData) {
    h.customData = new Map([...e.customData].map(([k, v]) => [k, { ...v }]));
  }
  h.qualityCheck = e.qualityCheck;
  h.previousParentGroup = e.previousParentGroup;
}

function applyInput(db: Kdbx, e: KdbxEntry, input: EntryInput): void {
  e.fields = fieldsFor(db, input);
  e.tags = [...input.tags];
  e.times.expires = input.expiresAt !== null;
  if (input.expiresAt) e.times.expiryTime = input.expiresAt;
}

/** Create a new entry in a group (default group when omitted). Returns its UUID. */
export function createEntry(db: Kdbx, input: EntryInput, groupUuid?: string): string {
  validateInput(input);
  const group = groupUuid ? findGroup(db, groupUuid) : db.getDefaultGroup();
  if (isInGroup({ parentGroup: group }, recycleBin(db)) || group === recycleBin(db)) {
    throw new VaultError('INVALID_INPUT', 'target-in-recycle-bin');
  }
  const e = db.createEntry(group);
  applyInput(db, e, input);
  checkEntryState(e);
  return uuidText(e.uuid)!;
}

/**
 * Apply an explicit Save. Returns false (and changes nothing) when the
 * submitted state equals the current state.
 */
export function updateEntry(db: Kdbx, uuid: string, input: EntryInput): boolean {
  validateInput(input);
  const e = findEntry(db, uuid);
  const probe = new (kdbx().KdbxEntry)();
  probe.times = e.times.clone();
  applyInput(db, probe, input);
  checkEntryState(probe);
  const before = editableKey(e);
  if (before === editableKey(probe)) return false;
  pushFullHistory(e);
  applyInput(db, e, input);
  e.times.update();
  return true;
}

/** Make history state `index` current; the former current state becomes a new history item. */
export function restoreHistory(db: Kdbx, uuid: string, index: number): void {
  const e = findEntry(db, uuid);
  const h = e.history[index];
  if (!h) throw new VaultError('INVALID_INPUT', 'history-index');
  const K = kdbx();
  pushFullHistory(e);
  e.fields = new Map([...h.fields].map(([k, v]) => [k, v instanceof K.ProtectedValue ? v.clone() : v]));
  e.tags = [...h.tags];
  e.icon = h.icon;
  e.fgColor = h.fgColor;
  e.bgColor = h.bgColor;
  e.overrideUrl = h.overrideUrl;
  e.autoType = JSON.parse(JSON.stringify(h.autoType));
  e.times.expires = h.times.expires;
  e.times.expiryTime = h.times.expiryTime;
  // Product flags that describe location/favorite status stay as they are now.
  const keep = new Set<string>([ENTRY_KEYS.favorite, ENTRY_KEYS.deletedAt]);
  const restored = new Map<string, kdbxweb.KdbxCustomDataItem>();
  for (const [k, v] of h.customData ?? []) if (!keep.has(k)) restored.set(k, { ...v });
  for (const [k, v] of e.customData ?? []) if (keep.has(k)) restored.set(k, v);
  e.customData = restored.size ? restored : undefined;
  checkEntryState(e);
  e.times.update();
}

function setEntryFlag(e: KdbxEntry, key: string, value: string | undefined): void {
  if (value === undefined) {
    e.customData?.delete(key);
    if (e.customData && e.customData.size === 0) e.customData = undefined;
    return;
  }
  if (!e.customData) e.customData = new Map();
  e.customData.set(key, { value, lastModified: new Date() });
}

/** Favorite is product metadata, not record content: no history item. */
export function setFavorite(db: Kdbx, uuid: string, favorite: boolean): void {
  const e = findEntry(db, uuid);
  setEntryFlag(e, ENTRY_KEYS.favorite, favorite ? 'true' : undefined);
}

export function moveToRecycleBin(db: Kdbx, uuid: string, now: Date = new Date()): void {
  const e = findEntry(db, uuid);
  const bin = recycleBin(db);
  if (bin && isInGroup(e, bin)) return;
  e.previousParentGroup = e.parentGroup?.uuid;
  db.remove(e);
  e.times.locationChanged = now;
  setEntryFlag(e, ENTRY_KEYS.deletedAt, timeText(now)!);
}

export function restoreFromRecycleBin(db: Kdbx, uuid: string, now: Date = new Date()): void {
  const e = findEntry(db, uuid);
  const bin = recycleBin(db);
  if (!bin || !isInGroup(e, bin)) throw new VaultError('INVALID_INPUT', 'not-in-recycle-bin');
  let target = e.previousParentGroup ? db.getGroup(e.previousParentGroup) : undefined;
  if (!target || target === bin || isInGroup({ parentGroup: target }, bin)) target = db.getDefaultGroup();
  db.move(e, target);
  e.times.locationChanged = now;
  e.previousParentGroup = undefined;
  setEntryFlag(e, ENTRY_KEYS.deletedAt, undefined);
}

/**
 * Move an entry to another group. Returns false when it is already there.
 * Moving into or out of the recycle bin goes through the dedicated functions.
 */
export function moveEntry(db: Kdbx, uuid: string, groupUuid: string, now: Date = new Date()): boolean {
  const e = findEntry(db, uuid);
  const target = findGroup(db, groupUuid);
  const bin = recycleBin(db);
  if (bin && isInGroup(e, bin)) throw new VaultError('INVALID_INPUT', 'entry-in-recycle-bin');
  if (target === bin || isInGroup({ parentGroup: target }, bin)) throw new VaultError('INVALID_INPUT', 'target-in-recycle-bin');
  if (e.parentGroup === target) return false;
  db.move(e, target);
  e.times.locationChanged = now;
  return true;
}

/** Permanently delete an entry that is already in the recycle bin. */
export function deletePermanently(db: Kdbx, uuid: string): void {
  const e = findEntry(db, uuid);
  if (!isInGroup(e, recycleBin(db))) throw new VaultError('INVALID_INPUT', 'not-in-recycle-bin');
  db.move(e, null);
}

export function createGroup(db: Kdbx, name: string, parentUuid?: string): string {
  if (name.length === 0) throw new VaultError('INVALID_INPUT', 'group-name-empty');
  if (scalarLength(name) > 256) throw new VaultError('LIMIT_EXCEEDED', 'group-name-too-long');
  const parent = parentUuid ? findGroup(db, parentUuid) : db.getDefaultGroup();
  const g = db.createGroup(parent, name);
  return uuidText(g.uuid)!;
}

export function renameGroup(db: Kdbx, uuid: string, name: string): void {
  if (name.length === 0) throw new VaultError('INVALID_INPUT', 'group-name-empty');
  if (scalarLength(name) > 256) throw new VaultError('LIMIT_EXCEEDED', 'group-name-too-long');
  const g = findGroup(db, uuid);
  g.name = name;
  g.times.update();
}

/** Names of fields whose values differ between two states (for the History screen). */
export function changedFieldNames(a: KdbxEntry, b: KdbxEntry): string[] {
  const names = new Set([...a.fields.keys(), ...b.fields.keys()]);
  const out: string[] = [];
  for (const n of names) {
    const av = a.fields.get(n);
    const bv = b.fields.get(n);
    if (av === undefined || bv === undefined || fieldText(av) !== fieldText(bv)) out.push(n);
  }
  if (a.tags.join('\u0000') !== b.tags.join('\u0000')) out.push('Tags');
  if ((a.times.expires === true) !== (b.times.expires === true) || timeText(a.times.expiryTime) !== timeText(b.times.expiryTime)) {
    out.push('Expiry');
  }
  return out;
}

/** List view data: titles/usernames only, never secrets. */
export function listEntries(db: Kdbx): EntryView[] {
  const bin = recycleBin(db);
  const out: EntryView[] = [];
  for (const root of db.groups) {
    for (const e of root.allEntries()) {
      out.push({
        uuid: uuidText(e.uuid)!,
        groupUuid: uuidText(e.parentGroup?.uuid)!,
        title: fieldText(e.fields.get('Title')),
        username: fieldText(e.fields.get('UserName')),
        url: fieldText(e.fields.get('URL')),
        tags: [...e.tags],
        favorite: e.customData?.get(ENTRY_KEYS.favorite)?.value === 'true',
        inRecycleBin: isInGroup(e, bin),
        expiresAt: e.times.expires ? timeText(e.times.expiryTime) : null,
        modifiedAt: timeText(e.times.lastModTime),
        historyCount: e.history.length
      });
    }
  }
  return out;
}

export interface GroupView {
  uuid: string;
  name: string;
  parentUuid: string | null;
  depth: number;
  isRecycleBin: boolean;
  inRecycleBin: boolean;
}

/** Group tree in depth-first order (names only). */
export function listGroups(db: Kdbx): GroupView[] {
  const bin = recycleBin(db);
  const out: GroupView[] = [];
  const walk = (g: KdbxGroup, depth: number, parentUuid: string | null, inBin: boolean): void => {
    const isBin = g === bin;
    out.push({ uuid: uuidText(g.uuid)!, name: g.name ?? '', parentUuid, depth, isRecycleBin: isBin, inRecycleBin: inBin });
    for (const c of g.groups) walk(c, depth + 1, uuidText(g.uuid)!, inBin || isBin);
  };
  for (const root of db.groups) walk(root, 0, null, false);
  return out;
}

/** Read the editable state of an entry (secrets included; call only on explicit reveal/edit). */
export function readEntry(db: Kdbx, uuid: string, historyIndex?: number): EntryInput {
  const e0 = findEntry(db, uuid);
  const e = historyIndex === undefined ? e0 : e0.history[historyIndex];
  if (!e) throw new VaultError('INVALID_INPUT', 'history-index');
  const K = kdbx();
  return {
    title: fieldText(e.fields.get('Title')),
    username: fieldText(e.fields.get('UserName')),
    password: fieldText(e.fields.get('Password')),
    url: fieldText(e.fields.get('URL')),
    notes: fieldText(e.fields.get('Notes')),
    tags: [...e.tags],
    customFields: [...e.fields]
      .filter(([k]) => !STANDARD.has(k))
      .map(([name, v]) => ({ name, value: fieldText(v), protected: v instanceof K.ProtectedValue })),
    expiresAt: e.times.expires && e.times.expiryTime ? new Date(e.times.expiryTime) : null
  };
}
