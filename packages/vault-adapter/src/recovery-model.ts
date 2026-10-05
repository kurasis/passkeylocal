/**
 * Portable logical model of a vault: the `localvault-recovery-json/1` document
 * minus the export-specific fields (`exported_at`, `source.sha256`).
 *
 * Used for:
 *  - verifying that a freshly serialized candidate re-opens to the same content;
 *  - interoperability tests: the Python tool's `export-json` output for the same
 *    file must equal this model (tests/interop).
 *
 * The Python implementation of the same mapping lives in
 * tools/vault-recovery/src/vault_recovery/export.py. Keep both in sync with
 * tools/vault-recovery/src/vault_recovery/schema/localvault-recovery-json-1.schema.json.
 */

import type kdbxweb from 'kdbxweb';
import { kdbx } from './kdbx.ts';
import { ENTRY_KEYS, META_KEYS } from './profile.ts';

type Kdbx = kdbxweb.Kdbx;
type KdbxEntry = kdbxweb.KdbxEntry;
type KdbxGroup = kdbxweb.KdbxGroup;
type KdbxUuid = kdbxweb.KdbxUuid;
type KdbxTimes = kdbxweb.KdbxTimes;
type CustomData = Map<string, { value: string | undefined; lastModified?: Date | undefined }> | undefined;

export interface RecoveryCustomDataItem {
  key: string;
  value: string;
  last_modified: string | null;
}

export interface RecoveryTimes {
  creation: string | null;
  last_modification: string | null;
  last_access: string | null;
  expiry: string | null;
  expires: boolean;
  usage_count: string;
  location_changed: string | null;
}

export interface RecoveryField {
  name: string;
  value: string;
  protected: boolean;
}

export interface RecoveryAutoType {
  enabled: boolean;
  obfuscation: number;
  default_sequence: string | null;
  associations: { window: string; sequence: string }[];
}

export interface RecoveryEntryState {
  icon_id: number;
  custom_icon_uuid: string | null;
  foreground_color: string | null;
  background_color: string | null;
  override_url: string | null;
  quality_check: boolean | null;
  previous_parent_group: string | null;
  fields: RecoveryField[];
  tags: string[];
  times: RecoveryTimes;
  custom_data: RecoveryCustomDataItem[];
  favorite: boolean;
  deleted_at: string | null;
  auto_type: RecoveryAutoType;
}

export interface RecoveryHistoryItem extends RecoveryEntryState {
  history_index: number;
}

export interface RecoveryEntry extends RecoveryEntryState {
  uuid: string;
  group_uuid: string;
  group_path: string[];
  in_recycle_bin: boolean;
  history: RecoveryHistoryItem[];
}

export interface RecoveryGroup {
  uuid: string;
  parent_uuid: string | null;
  name: string;
  notes: string | null;
  icon_id: number;
  custom_icon_uuid: string | null;
  times: RecoveryTimes;
  is_expanded: boolean;
  default_auto_type_sequence: string | null;
  enable_auto_type: boolean | null;
  enable_searching: boolean | null;
  last_top_visible_entry: string | null;
  previous_parent_group: string | null;
  tags: string[];
  custom_data: RecoveryCustomDataItem[];
  in_recycle_bin: boolean;
}

export interface RecoveryMetadata {
  name: string | null;
  description: string | null;
  default_username: string | null;
  recycle_bin_enabled: boolean;
  recycle_bin_uuid: string | null;
  history_max_items: number | null;
  history_max_size: number | null;
  custom_data: RecoveryCustomDataItem[];
}

export interface RecoveryModel {
  format: 'localvault-recovery-json/1';
  source: {
    kdbx_version: string;
    vault_id: string | null;
    lineage_id: string | null;
    revision: string | null;
  };
  metadata: RecoveryMetadata;
  groups: RecoveryGroup[];
  entries: RecoveryEntry[];
  deleted_objects: { uuid: string; deletion_time: string | null }[];
}

/** Canonical lowercase 8-4-4-4-12 UUID text, or null for missing/all-zero UUIDs. */
export function uuidText(u: KdbxUuid | undefined | null): string | null {
  if (!u || u.empty) return null;
  const bytes = kdbx().ByteUtils.base64ToBytes(u.id);
  let h = '';
  for (const b of bytes) h += b.toString(16).padStart(2, '0');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** UTC RFC 3339 with second precision (KDBX 4 stores whole seconds). */
export function timeText(d: Date | undefined | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function emptyToNull(s: string | undefined | null): string | null {
  return s === undefined || s === null || s === '' ? null : s;
}

function customDataList(cd: CustomData): RecoveryCustomDataItem[] {
  if (!cd) return [];
  const out: RecoveryCustomDataItem[] = [];
  for (const [key, item] of cd) {
    out.push({ key, value: item.value ?? '', last_modified: timeText(item.lastModified) });
  }
  return out;
}

function timesOf(t: KdbxTimes): RecoveryTimes {
  return {
    creation: timeText(t.creationTime),
    last_modification: timeText(t.lastModTime),
    last_access: timeText(t.lastAccessTime),
    expiry: timeText(t.expiryTime),
    expires: t.expires === true,
    usage_count: String(t.usageCount ?? 0),
    location_changed: timeText(t.locationChanged)
  };
}

function fieldValue(v: unknown): { value: string; protected: boolean } {
  const K = kdbx();
  if (v instanceof K.ProtectedValue) return { value: v.getText(), protected: true };
  return { value: typeof v === 'string' ? v : '', protected: false };
}

function entryState(e: KdbxEntry): RecoveryEntryState {
  const cd = e.customData as CustomData;
  const fav = cd?.get(ENTRY_KEYS.favorite)?.value;
  const deletedAt = cd?.get(ENTRY_KEYS.deletedAt)?.value;
  return {
    icon_id: e.icon ?? 0,
    custom_icon_uuid: uuidText(e.customIcon),
    foreground_color: emptyToNull(e.fgColor),
    background_color: emptyToNull(e.bgColor),
    override_url: emptyToNull(e.overrideUrl),
    quality_check: typeof e.qualityCheck === 'boolean' ? e.qualityCheck : null,
    previous_parent_group: uuidText(e.previousParentGroup),
    fields: [...e.fields].map(([name, v]) => ({ name, ...fieldValue(v) })),
    tags: [...e.tags],
    times: timesOf(e.times),
    custom_data: customDataList(cd),
    favorite: fav === 'true',
    deleted_at: emptyToNull(deletedAt),
    auto_type: {
      enabled: e.autoType.enabled !== false,
      obfuscation: e.autoType.obfuscation ?? 0,
      default_sequence: emptyToNull(e.autoType.defaultSequence),
      associations: e.autoType.items.map((it) => ({ window: it.window ?? '', sequence: it.keystrokeSequence ?? '' }))
    }
  };
}

function nullableBool(v: boolean | null | undefined): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

/** Build the logical model. Traversal: groups pre-order; per group its entries, then subgroups. */
export function toRecoveryModel(db: Kdbx): RecoveryModel {
  const meta = db.meta;
  const recycleBinId = meta.recycleBinUuid && !meta.recycleBinUuid.empty ? meta.recycleBinUuid.id : null;
  const groups: RecoveryGroup[] = [];
  const entries: RecoveryEntry[] = [];

  const walk = (g: KdbxGroup, parent: KdbxGroup | null, path: string[], inBin: boolean): void => {
    const here = [...path, g.name ?? ''];
    const binHere = inBin || (recycleBinId !== null && g.uuid.id === recycleBinId);
    groups.push({
      uuid: uuidText(g.uuid)!,
      parent_uuid: parent ? uuidText(parent.uuid) : null,
      name: g.name ?? '',
      notes: emptyToNull(g.notes),
      icon_id: g.icon ?? 0,
      custom_icon_uuid: uuidText(g.customIcon),
      times: timesOf(g.times),
      is_expanded: g.expanded !== false,
      default_auto_type_sequence: emptyToNull(g.defaultAutoTypeSeq),
      enable_auto_type: nullableBool(g.enableAutoType),
      enable_searching: nullableBool(g.enableSearching),
      last_top_visible_entry: uuidText(g.lastTopVisibleEntry),
      previous_parent_group: uuidText(g.previousParentGroup),
      tags: [...(g.tags ?? [])],
      custom_data: customDataList(g.customData as CustomData),
      in_recycle_bin: binHere
    });
    for (const e of g.entries) {
      entries.push({
        uuid: uuidText(e.uuid)!,
        group_uuid: uuidText(g.uuid)!,
        group_path: here,
        in_recycle_bin: binHere,
        ...entryState(e),
        history: e.history.map((h, i) => ({ history_index: i, ...entryState(h) }))
      });
    }
    for (const sub of g.groups) walk(sub, g, here, binHere);
  };
  for (const root of db.groups) walk(root, null, [], false);

  const mcd = meta.customData as CustomData;
  const metaValue = (k: string) => mcd?.get(k)?.value ?? null;

  return {
    format: 'localvault-recovery-json/1',
    source: {
      kdbx_version: `${db.header.versionMajor}.${db.header.versionMinor}`,
      vault_id: metaValue(META_KEYS.vaultId),
      lineage_id: metaValue(META_KEYS.lineageId),
      revision: metaValue(META_KEYS.revision)
    },
    metadata: {
      name: emptyToNull(meta.name),
      description: emptyToNull(meta.desc),
      default_username: emptyToNull(meta.defaultUser),
      recycle_bin_enabled: meta.recycleBinEnabled === true,
      recycle_bin_uuid: uuidText(meta.recycleBinUuid),
      history_max_items: typeof meta.historyMaxItems === 'number' ? meta.historyMaxItems : null,
      history_max_size: typeof meta.historyMaxSize === 'number' ? meta.historyMaxSize : null,
      custom_data: customDataList(mcd)
    },
    groups,
    entries,
    deleted_objects: db.deletedObjects.map((d) => ({
      uuid: uuidText(d.uuid)!,
      deletion_time: timeText(d.deletionTime)
    }))
  };
}
