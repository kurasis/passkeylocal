/**
 * Generates the synthetic interoperability and security corpus with the
 * browser-side adapter (kdbxweb + hash-wasm), exactly as the PWA writes files.
 *
 *   node tests/interop/generate-fixtures.ts
 *
 * Outputs (committed):
 *   tests/interop/fixtures/<name>.kdbx          encrypted file
 *   tests/interop/fixtures/<name>.expected.json  logical model from the TS side
 *   tests/interop/fixtures/manifest.json         passwords (synthetic), hashes, provenance
 *   tests/security/fixtures/*.kdbx + manifest.json  hostile but authenticated payloads
 *
 * All data and passwords are synthetic test values, never real credentials.
 * Ciphertexts differ on every run (fresh salts/IVs); the logical content does not.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bumpRevision,
  changeMasterPassword,
  createEntry,
  createGroup,
  createVault,
  kdbx,
  moveToRecycleBin,
  openVault,
  restoreHistory,
  serializeVerified,
  setFavorite,
  toRecoveryModel,
  updateEntry,
  type EntryInput,
  type Kdbx
} from '../../packages/vault-adapter/src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const fixtureRoot = process.env.INTEROP_FIXTURE_OUTPUT ?? repo;
const interopDir = join(fixtureRoot, 'tests', 'interop', 'fixtures');
const securityDir = join(fixtureRoot, 'tests', 'security', 'fixtures');
mkdirSync(interopDir, { recursive: true });
mkdirSync(securityDir, { recursive: true });

const MAIN_PASSWORD = 'synthetic-Interop-пароль-🔑-2026';
const T = (iso: string) => new Date(iso);

const pkg = (p: string) => JSON.parse(readFileSync(join(repo, p), 'utf8')) as { version: string };
const provenance = {
  generator: 'tests/interop/generate-fixtures.ts',
  node: process.version,
  kdbxweb: pkg('node_modules/kdbxweb/package.json').version,
  'hash-wasm': pkg('node_modules/hash-wasm/package.json').version,
  '@xmldom/xmldom': pkg('node_modules/@xmldom/xmldom/package.json').version,
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
};

function input(o: Partial<EntryInput>): EntryInput {
  return { title: '', username: '', password: '', url: '', notes: '', tags: [], customFields: [], expiresAt: null, ...o };
}

/** Pin every timestamp so expected outputs are stable and cover DST edges. */
function pinTimes(db: Kdbx): void {
  const base = Date.parse('2026-03-29T00:30:00Z'); // EU DST switch at 01:00Z
  let n = 0;
  const pin = (t: { creationTime?: Date; lastModTime?: Date; lastAccessTime?: Date; locationChanged?: Date }) => {
    const at = new Date(base + n++ * 37 * 60 * 1000);
    t.creationTime = new Date(base);
    t.lastModTime = at;
    t.lastAccessTime = at;
    t.locationChanged = at;
  };
  for (const root of db.groups) {
    for (const g of root.allGroups()) pin(g.times);
    for (const e of root.allEntries()) {
      e.history.forEach((h) => pin(h.times));
      pin(e.times);
      for (const item of e.customData?.values() ?? []) item.lastModified = T('2026-10-25T00:59:59Z');
      for (const h of e.history) for (const item of h.customData?.values() ?? []) item.lastModified = T('2026-10-25T01:00:00Z');
    }
  }
  for (const d of db.deletedObjects) d.deletionTime = T('2026-10-25T02:00:00Z');
  for (const item of db.meta.customData.values()) item.lastModified = T('2026-10-04T03:30:00Z');
}

interface ManifestItem {
  file: string;
  password: string;
  sha256: string;
  description: string;
  wrong_passwords?: string[];
}

const manifest: ManifestItem[] = [];

async function emit(name: string, db: Kdbx, password: string, description: string, extra: Partial<ManifestItem> = {}) {
  pinTimes(db);
  const { bytes, sha256 } = await serializeVerified(db);
  // Fresh credentials must match the declared fixture password, independently
  // of the mutable credential object used for serialization.
  await openVault(bytes, password);
  writeFileSync(join(interopDir, `${name}.kdbx`), bytes);
  writeFileSync(join(interopDir, `${name}.expected.json`), JSON.stringify(toRecoveryModel(db), null, 2) + '\n');
  manifest.push({ file: `${name}.kdbx`, password, sha256, description, ...extra });
  return bytes;
}

// 1. Empty vault
{
  const { db } = createVault({ password: MAIN_PASSWORD });
  await emit('empty', db, MAIN_PASSWORD, 'Empty vault with recycle bin and product metadata.');
}

// 2. One entry
{
  const { db } = createVault({ password: MAIN_PASSWORD });
  createEntry(db, input({ title: 'Example', username: 'user@example.test', password: 'one-entry-secret', url: 'https://example.test' }));
  await emit('one-entry', db, MAIN_PASSWORD, 'Single ordinary login entry.');
}

// 3. Full feature coverage
let fullDb: Kdbx;
{
  const { db } = createVault({ password: MAIN_PASSWORD });
  fullDb = db;
  const work = createGroup(db, 'Work');
  const deep = createGroup(db, 'Deep', createGroup(db, 'Nested Ünïcode', work));
  const a = createEntry(
    db,
    input({
      title: 'Mail',
      username: 'alice@example.test',
      password: 'history-v1',
      url: 'https://mail.example.test/',
      notes: 'multi\r\nline\nnotes\twith tab & <xml> "specials" \'quotes\' ]]>',
      tags: ['email', 'Личное', '🔥'],
      customFields: [
        { name: 'Recovery code', value: 'RC-0001-synthetic', protected: true },
        { name: 'Empty field', value: '', protected: false },
        { name: 'Account №', value: '  42  ', protected: false }
      ]
    }),
    work
  );
  updateEntry(db, a, input({ title: 'Mail', username: 'alice@example.test', password: 'history-v2', url: 'https://mail.example.test/', tags: ['email'] }));
  updateEntry(db, a, input({ title: 'Mail', username: 'alice@example.test', password: 'history-v3', url: 'https://mail.example.test/', tags: ['email'], notes: 'third' }));
  restoreHistory(db, a, 1); // current = v2 state, v3 preserved as history
  setFavorite(db, a, true);

  // Duplicate titles and usernames
  createEntry(db, input({ title: 'Mail', username: 'alice@example.test', password: 'duplicate-title', tags: ['dup'] }));
  createEntry(db, input({ title: 'Mail', username: 'bob@example.test', password: 'duplicate-title-2' }), deep);

  // Unicode stress
  createEntry(
    db,
    input({
      title: '  Ünïcode é العربية עברית 😀 ',
      username: 'Ж‍Ж',
      password: '  leading and trailing spaces　 ',
      url: 'http://insecure.example.test/path?q=1&r=<2>',
      notes: '',
      customFields: [{ name: 'RTL ‮override', value: 'value', protected: false }]
    }),
    deep
  );

  // Expiry across DST
  createEntry(db, input({ title: 'Expiring', password: 'exp', expiresAt: T('2026-03-29T00:59:59Z') }));

  // Recycled entry with history
  const r = createEntry(db, input({ title: 'Old account', password: 'recycled-v1' }));
  updateEntry(db, r, input({ title: 'Old account', password: 'recycled-v2' }));
  moveToRecycleBin(db, r, T('2026-10-25T01:30:00Z'));

  db.meta.customData.set('LocalVault.Revision', { value: '18446744073709551616' });
  bumpRevision(db, T('2026-10-04T03:30:00Z'));
  await emit('full', db, MAIN_PASSWORD, 'Nested groups, duplicates, favorites, tags, custom fields, Unicode, 3+ history states with a restore, expiry, recycled entry with history, large revision.');
}

// 4. Password byte policy
{
  const nfc = 'Pässwörd-ñ-synthetic-NFC';
  const nfd = 'Pässwörd-ñ-synthetic-NFC';
  const { db } = createVault({ password: nfc });
  createEntry(db, input({ title: 'nfc', password: 'x' }));
  await emit('password-nfc', db, nfc, 'Password in NFC form; the NFD form of the same text must not unlock it.', { wrong_passwords: [nfd] });

  const spaced = '  leading and trailing spaces  ';
  const s = createVault({ password: spaced });
  await emit('password-spaces', s.db, spaced, 'Password with leading/trailing spaces, preserved exactly.', {
    wrong_passwords: [spaced.trim(), spaced + '\n']
  });

  // Existing weak password (below the creation minimum) must still be recoverable.
  const w = createVault({ password: MAIN_PASSWORD });
  createEntry(w.db, input({ title: 'weak', password: 'w' }));
  // Constructor hashing may still be pending; finish it before replacing it.
  await w.db.credentials.ready;
  await w.db.credentials.setPassword(kdbx().ProtectedValue.fromString('weak'));
  await emit('password-weak-existing', w.db, 'weak', 'Existing file with a weak (4 character) password; recovery must accept it.');
}

// 5. Strongest supported reader KDF profile (byte/KiB mapping at the upper bound)
{
  const { db } = createVault({ password: MAIN_PASSWORD });
  const K = kdbx();
  const VT = K.VarDictionary.ValueType;
  db.header.kdfParameters!.set('M', VT.UInt64, K.Int64.from(256 * 1024 * 1024));
  db.header.kdfParameters!.set('I', VT.UInt64, K.Int64.from(10));
  db.header.kdfParameters!.set('P', VT.UInt32, 4);
  createEntry(db, input({ title: 'kdf-upper', password: 'upper-bound' }));
  await emit('kdf-upper-bound', db, MAIN_PASSWORD, 'Argon2id 256 MiB / 10 iterations / parallelism 4 (upper reader envelope).');
}

// 6. Lifecycle stages: unchanged save, field edit, password rotation
{
  // Stage 1: unchanged re-save of the full vault.
  await emit('stage1-unchanged', fullDb, MAIN_PASSWORD, 'Full vault re-saved without changes (fresh ciphertext, same content).');
  // Stage 2: one field edit on the full vault.
  const mail = toRecoveryModel(fullDb).entries.find((e) => e.favorite)!;
  updateEntry(fullDb, mail.uuid, input({ title: 'Mail', username: 'alice@example.test', password: 'stage2-edited', url: 'https://mail.example.test/', tags: ['email'] }));
  bumpRevision(fullDb, T('2026-10-04T04:00:00Z'));
  const stage2 = await emit('stage2-edited', fullDb, MAIN_PASSWORD, 'Stage 1 plus one password edit (adds a history state).');
  // Stage 3: master password rotation.
  const rotated = 'rotated-synthetic-passphrase-2026';
  const { db: rdb } = await changeMasterPassword(stage2, MAIN_PASSWORD, rotated);
  await emit('stage3-rotated', rdb, rotated, 'Stage 2 after master-password rotation.', { wrong_passwords: [MAIN_PASSWORD] });
}

writeFileSync(join(interopDir, 'manifest.json'), JSON.stringify({ provenance, fixtures: manifest }, null, 2) + '\n');

// ---- Security corpus: authenticated (correct password) but hostile or unsupported payloads ----

async function rawSave(db: Kdbx, mutateXml?: (xml: string) => string): Promise<Uint8Array> {
  const xu = kdbx().XmlUtils as unknown as { serialize: (d: Document, p?: boolean) => string };
  const original = xu.serialize;
  if (mutateXml) xu.serialize = (d, p) => mutateXml(original(d, p));
  try {
    return new Uint8Array(await db.save());
  } finally {
    xu.serialize = original;
  }
}

interface SecurityItem {
  file: string;
  password: string;
  description: string;
  expect_ts: { code: string; detail?: string };
  expect_exit: number;
}
const security: SecurityItem[] = [];
async function emitSecurity(name: string, bytes: Uint8Array, description: string, expect_ts: SecurityItem['expect_ts'], expect_exit: number) {
  writeFileSync(join(securityDir, `${name}.kdbx`), bytes);
  security.push({ file: `${name}.kdbx`, password: MAIN_PASSWORD, description, expect_ts, expect_exit });
}
const base = () => {
  const { db } = createVault({ password: MAIN_PASSWORD });
  createEntry(db, input({ title: 'canary', password: 'canary-secret' }));
  return db;
};

await emitSecurity(
  'xml-dtd-entity',
  await rawSave(base(), (x) => x.replace(/^(<\?xml[^>]*\?>)?/, '$1<!DOCTYPE KeePassFile [<!ENTITY boom "expanded">]>')),
  'Authenticated XML with an internal DTD and entity declaration.',
  { code: 'UNSUPPORTED', detail: 'xml-dtd-or-declaration' },
  4
);
await emitSecurity(
  'xml-external-entity',
  await rawSave(base(), (x) =>
    x.replace(/^(<\?xml[^>]*\?>)?/, '$1<!DOCTYPE KeePassFile [<!ENTITY xxe SYSTEM "http://127.0.0.1:9/xxe">]>').replace('<Generator>', '<Generator>&xxe;')
  ),
  'Authenticated XML with an external entity pointing at a local closed port.',
  { code: 'UNSUPPORTED', detail: 'xml-dtd-or-declaration' },
  4
);
await emitSecurity(
  'xml-xinclude',
  await rawSave(base(), (x) => x.replace('</Meta>', '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/></Meta>')),
  'Authenticated XML with an XInclude element.',
  { code: 'UNSUPPORTED', detail: 'xml-xinclude' },
  4
);
await emitSecurity(
  'xml-too-deep',
  await rawSave(base(), (x) => x.replace('</Meta>', '<X>'.repeat(100) + '</X>'.repeat(100) + '</Meta>')),
  'Authenticated XML nested 100 levels deep (limit 64).',
  { code: 'LIMIT_EXCEEDED', detail: 'xml-too-deep' },
  4
);
await emitSecurity(
  'xml-processing-instruction',
  await rawSave(base(), (x) => x.replace('</Meta>', '<?exec rm -rf /?></Meta>')),
  'Authenticated XML with a processing instruction.',
  { code: 'UNSUPPORTED', detail: 'xml-processing-instruction' },
  4
);
{
  const db = base();
  const e = db.createEntry(db.getDefaultGroup());
  e.binaries.set('attachment.txt', await db.createBinary(kdbx().ProtectedValue.fromString('attachment body')));
  await emitSecurity('attachment', await rawSave(db), 'Entry with a file attachment (unsupported in v1).', { code: 'UNSUPPORTED', detail: 'attachments' }, 4);
}
{
  const db = base();
  db.meta.customData.set('LocalVault.SchemaVersion', { value: '2' });
  await emitSecurity('schema-newer', await rawSave(db), 'Product schema version 2 (newer than supported).', { code: 'UNSUPPORTED', detail: 'schema-version-newer' }, 4);
}
{
  const db = base();
  db.header.compression = kdbx().Consts.CompressionAlgorithm.GZip;
  await emitSecurity('gzip-compressed', await rawSave(db), 'Authenticated but gzip-compressed payload.', { code: 'UNSUPPORTED', detail: 'compression-gzip' }, 4);
}
{
  const db = base();
  db.getDefaultGroup().entries[0]!.fields.set('Notes', 'n'.repeat(65_537));
  await emitSecurity('notes-too-long', await rawSave(db), 'Notes field over 65,536 characters.', { code: 'LIMIT_EXCEEDED', detail: 'notes-too-long' }, 4);
}
{
  const db = base();
  // U+009B is the C1 control sequence introducer (valid in XML 1.0, dangerous on terminals).
  db.getDefaultGroup().entries[0]!.fields.set('Title', '<script>alert(1)</script>\u009b31mRED\u009b0m \u202eevil');
  db.getDefaultGroup().entries[0]!.fields.set('URL', 'javascript:alert(1)');
  await emitSecurity(
    'malicious-strings',
    await rawSave(db),
    'Script tags, C1 CSI control, bidi override and javascript: strings in record fields. Valid file: must open, and render inert.',
    { code: 'OK' },
    0
  );
}

{
  const db = base();
  await emitSecurity(
    'unknown-entry-element',
    await rawSave(db, (x) => x.replace('<String>', '<FutureFeature>opaque</FutureFeature><String>')),
    'Entry with an element neither reader models. Browser: read-only (no lossy re-save). Python: no export.',
    { code: 'READ_ONLY', detail: 'unknown-element-entry' },
    4
  );
}

writeFileSync(join(securityDir, 'manifest.json'), JSON.stringify({ provenance, fixtures: security }, null, 2) + '\n');

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
console.log(`interop fixtures: ${manifest.length}, security fixtures: ${security.length}, manifest sha256 ${sha(join(interopDir, 'manifest.json')).slice(0, 12)}`);
