/**
 * In-memory literal search over an unlocked vault. No persistent index, no
 * query history, no regular expressions. Normalization (NFKC + lowercase)
 * applies only to transient copies; stored values are never rewritten.
 */

import type kdbxweb from 'kdbxweb';
import { kdbx } from './kdbx.ts';
import { STANDARD_FIELDS } from './profile.ts';
import { uuidText } from './recovery-model.ts';
import type { Kdbx } from './vault.ts';

export interface SearchOptions {
  /** Also match Password and protected custom fields (per-session switch). */
  includeSecrets?: boolean;
  /** Also match older versions; such hits are labelled with their history index. */
  includeHistory?: boolean;
  /** Also match entries in the recycle bin. */
  includeRecycleBin?: boolean;
}

export interface SearchHit {
  uuid: string;
  /** undefined = current version; otherwise the matching history index. */
  historyIndex: number | undefined;
  /** Field names that matched. Secret field names are reported, values are not. */
  fields: string[];
  secretMatch: boolean;
}

const STANDARD = new Set<string>(STANDARD_FIELDS);

export function normalizeForSearch(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

function matchState(e: kdbxweb.KdbxEntry, needle: string, opts: SearchOptions): { fields: string[]; secret: boolean } {
  const K = kdbx();
  const fields: string[] = [];
  let secret = false;
  for (const [name, value] of e.fields) {
    const isProtected = value instanceof K.ProtectedValue;
    const isSecret = name === 'Password' || (isProtected && !STANDARD.has(name));
    if (isSecret && !opts.includeSecrets) continue;
    const text = isProtected ? value.getText() : (value as string);
    if (normalizeForSearch(text).includes(needle)) {
      fields.push(name);
      if (isSecret) secret = true;
    }
  }
  if (e.tags.some((t) => normalizeForSearch(t).includes(needle))) fields.push('Tags');
  return { fields, secret };
}

export function searchEntries(db: Kdbx, query: string, opts: SearchOptions = {}): SearchHit[] {
  const needle = normalizeForSearch(query);
  if (needle.length === 0) return [];
  const binId = db.meta.recycleBinUuid && !db.meta.recycleBinUuid.empty ? db.meta.recycleBinUuid.id : null;
  const hits: SearchHit[] = [];
  const walk = (g: kdbxweb.KdbxGroup, inBin: boolean): void => {
    const bin = inBin || (binId !== null && g.uuid.id === binId);
    if (!bin || opts.includeRecycleBin) {
      for (const e of g.entries) {
        const uuid = uuidText(e.uuid)!;
        const cur = matchState(e, needle, opts);
        if (cur.fields.length) hits.push({ uuid, historyIndex: undefined, fields: cur.fields, secretMatch: cur.secret });
        if (opts.includeHistory) {
          e.history.forEach((h, i) => {
            const m = matchState(h, needle, opts);
            if (m.fields.length) hits.push({ uuid, historyIndex: i, fields: m.fields, secretMatch: m.secret });
          });
        }
      }
    }
    for (const sub of g.groups) walk(sub, bin);
  };
  for (const root of db.groups) walk(root, false);
  return hits;
}
