/**
 * Import fidelity check.
 *
 * kdbxweb silently ignores XML elements it does not model and normalizes a few
 * things (for example it drops auto-type associations with an empty window or
 * sequence, fields with an empty name, and duplicate field names). Saving such
 * a database would silently lose data. This check compares the authenticated
 * XML with what kdbxweb loaded; any difference makes the opened vault
 * read-only, so the original file stays the authoritative copy and can still
 * be exported byte for byte.
 *
 * The element whitelists match tools/vault-recovery/src/vault_recovery/export.py.
 */

import type kdbxweb from 'kdbxweb';

const META_CHILDREN = new Set([
  'Generator', 'HeaderHash', 'SettingsChanged', 'DatabaseName', 'DatabaseNameChanged',
  'DatabaseDescription', 'DatabaseDescriptionChanged', 'DefaultUserName', 'DefaultUserNameChanged',
  'MaintenanceHistoryDays', 'Color', 'MasterKeyChanged', 'MasterKeyChangeRec', 'MasterKeyChangeForce',
  'MasterKeyChangeForceOnce', 'MemoryProtection', 'CustomIcons', 'RecycleBinEnabled', 'RecycleBinUUID',
  'RecycleBinChanged', 'EntryTemplatesGroup', 'EntryTemplatesGroupChanged', 'HistoryMaxItems',
  'HistoryMaxSize', 'LastSelectedGroup', 'LastTopVisibleGroup', 'Binaries', 'CustomData'
]);
const GROUP_CHILDREN = new Set([
  'UUID', 'Name', 'Notes', 'IconID', 'CustomIconUUID', 'Times', 'IsExpanded', 'DefaultAutoTypeSequence',
  'EnableAutoType', 'EnableSearching', 'LastTopVisibleEntry', 'CustomData', 'PreviousParentGroup', 'Tags',
  'Entry', 'Group'
]);
const ENTRY_CHILDREN = new Set([
  'UUID', 'IconID', 'CustomIconUUID', 'ForegroundColor', 'BackgroundColor', 'OverrideURL', 'Tags', 'Times',
  'String', 'Binary', 'AutoType', 'History', 'CustomData', 'QualityCheck', 'PreviousParentGroup'
]);
const TIMES_CHILDREN = new Set([
  'CreationTime', 'LastModificationTime', 'LastAccessTime', 'ExpiryTime', 'Expires', 'UsageCount', 'LocationChanged'
]);
const AUTOTYPE_CHILDREN = new Set(['Enabled', 'DataTransferObfuscation', 'DefaultSequence', 'Association']);

function elements(node: Element): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const c = node.childNodes[i] as Element;
    if (c.nodeType === 1) out.push(c);
  }
  return out;
}

function child(node: Element, name: string): Element | undefined {
  return elements(node).find((c) => c.tagName === name);
}

class Lossy extends Error {}

function allow(node: Element, allowed: Set<string>, where: string): void {
  for (const c of elements(node)) if (!allowed.has(c.tagName)) throw new Lossy(`unknown-element-${where}`);
}

function checkEntry(el: Element, e: kdbxweb.KdbxEntry): void {
  allow(el, ENTRY_CHILDREN, 'entry');
  const times = child(el, 'Times');
  if (times) allow(times, TIMES_CHILDREN, 'times');
  const strings = elements(el).filter((c) => c.tagName === 'String');
  if (strings.length !== e.fields.size) throw new Lossy('field-dropped');
  const at = child(el, 'AutoType');
  if (at) {
    allow(at, AUTOTYPE_CHILDREN, 'autotype');
    const assoc = elements(at).filter((c) => c.tagName === 'Association').length;
    if (assoc !== e.autoType.items.length) throw new Lossy('autotype-association-dropped');
  }
}

/** Returns null when kdbxweb's model fully represents the XML, otherwise a reason code. */
export function checkImportFidelity(doc: Document, db: kdbxweb.Kdbx): string | null {
  try {
    const root = doc.documentElement;
    allow(root, new Set(['Meta', 'Root']), 'keepassfile');
    const meta = child(root, 'Meta');
    if (meta) allow(meta, META_CHILDREN, 'meta');
    const rootEl = child(root, 'Root');
    if (!rootEl) return 'missing-root';
    allow(rootEl, new Set(['Group', 'DeletedObjects']), 'root');

    const walk = (el: Element, g: kdbxweb.KdbxGroup): void => {
      allow(el, GROUP_CHILDREN, 'group');
      const times = child(el, 'Times');
      if (times) allow(times, TIMES_CHILDREN, 'times');
      const entryEls = elements(el).filter((c) => c.tagName === 'Entry');
      const groupEls = elements(el).filter((c) => c.tagName === 'Group');
      if (entryEls.length !== g.entries.length || groupEls.length !== g.groups.length) throw new Lossy('item-dropped');
      entryEls.forEach((entryEl, i) => {
        const e = g.entries[i]!;
        checkEntry(entryEl, e);
        const hist = child(entryEl, 'History');
        const histEls = hist ? elements(hist) : [];
        if (histEls.length !== e.history.length) throw new Lossy('history-dropped');
        histEls.forEach((h, j) => checkEntry(h, e.history[j]!));
      });
      groupEls.forEach((sub, i) => walk(sub, g.groups[i]!));
    };
    const groupEls = elements(rootEl).filter((c) => c.tagName === 'Group');
    if (groupEls.length !== db.groups.length) return 'item-dropped';
    groupEls.forEach((el, i) => walk(el, db.groups[i]!));
    return null;
  } catch (e) {
    if (e instanceof Lossy) return e.message;
    throw e;
  }
}
