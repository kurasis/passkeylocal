/**
 * Product v1 limits (PRODUCT_AND_ARCHITECTURE.md §7). Applied to current
 * entries and to every history state. Violations are refused, never truncated.
 */

import type kdbxweb from 'kdbxweb';
import { VaultError } from './errors.ts';
import { kdbx } from './kdbx.ts';
import { LIMITS, STANDARD_FIELDS } from './profile.ts';
import { scalarLength } from './text.ts';

const STANDARD = new Set<string>(STANDARD_FIELDS);
const TAG_FORBIDDEN = /[;,:]/;
/** Characters that cannot be stored in KDBX XML text (TAB, LF, CR are allowed). */
// eslint-disable-next-line no-control-regex
export const FORBIDDEN_TEXT_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/;

const over = (detail: string) => new VaultError('LIMIT_EXCEEDED', detail);

function fieldText(v: unknown): string {
  const K = kdbx();
  return v instanceof K.ProtectedValue ? v.getText() : typeof v === 'string' ? v : '';
}

/** Validate a single tag value (also used by the editing API). */
export function checkTag(tag: string): void {
  if (tag.length === 0) throw new VaultError('INVALID_INPUT', 'tag-empty');
  if (TAG_FORBIDDEN.test(tag) || tag.trim() !== tag) throw new VaultError('INVALID_INPUT', 'tag-forbidden-character');
  if (scalarLength(tag) > LIMITS.maxShortText) throw over('tag-too-long');
}

export function checkEntryState(e: kdbxweb.KdbxEntry): void {
  let custom = 0;
  for (const [name, value] of e.fields) {
    const text = fieldText(value);
    if (FORBIDDEN_TEXT_CHARS.test(name) || FORBIDDEN_TEXT_CHARS.test(text)) {
      throw new VaultError('UNSUPPORTED', 'field-control-character');
    }
    if (!STANDARD.has(name)) {
      custom++;
      if (scalarLength(name) > LIMITS.maxShortText) throw over('custom-field-name-too-long');
      if (scalarLength(text) > LIMITS.maxMediumText) throw over('custom-field-value-too-long');
    } else if (name === 'Title') {
      if (scalarLength(text) > LIMITS.maxShortText) throw over('title-too-long');
    } else if (name === 'Notes') {
      if (scalarLength(text) > LIMITS.maxNotes) throw over('notes-too-long');
    } else if (scalarLength(text) > LIMITS.maxMediumText) {
      throw over(`${name.toLowerCase()}-too-long`);
    }
  }
  if (custom > LIMITS.maxCustomFields) throw over('too-many-custom-fields');
  if (e.tags.length > LIMITS.maxTags) throw over('too-many-tags');
  for (const t of e.tags) checkTag(t);
  if (e.binaries.size > 0) throw new VaultError('UNSUPPORTED', 'attachments');
}

export interface VaultCounts {
  entries: number;
  historyVersions: number;
  groups: number;
  maxDepth: number;
}

/** Walk the whole vault, enforce every product limit and return the counts. */
export function checkVaultLimits(db: kdbxweb.Kdbx): VaultCounts {
  const counts: VaultCounts = { entries: 0, historyVersions: 0, groups: 0, maxDepth: 0 };
  const walk = (g: kdbxweb.KdbxGroup, depth: number): void => {
    counts.groups++;
    if (counts.groups > LIMITS.maxGroups) throw over('too-many-groups');
    if (depth > LIMITS.maxGroupDepth) throw over('groups-too-deep');
    counts.maxDepth = Math.max(counts.maxDepth, depth);
    if (scalarLength(g.name ?? '') > LIMITS.maxShortText) throw over('group-name-too-long');
    if (scalarLength(g.notes ?? '') > LIMITS.maxNotes) throw over('group-notes-too-long');
    for (const e of g.entries) {
      counts.entries++;
      if (counts.entries > LIMITS.maxEntries) throw over('too-many-entries');
      checkEntryState(e);
      counts.historyVersions += e.history.length;
      if (counts.historyVersions > LIMITS.maxHistoryVersions) throw over('too-many-history-versions');
      for (const h of e.history) checkEntryState(h);
    }
    for (const sub of g.groups) walk(sub, depth + 1);
  };
  for (const root of db.groups) walk(root, 1);
  if (db.binaries.getAll().length > 0) throw new VaultError('UNSUPPORTED', 'attachments');
  if (db.meta.customIcons.size > 0) throw new VaultError('UNSUPPORTED', 'custom-icons');
  return counts;
}
