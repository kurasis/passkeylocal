import { describe, expect, test } from 'vitest';
import {
  bumpRevision,
  changeMasterPassword,
  createEntry,
  createVault,
  kdbx,
  openVault,
  readEntry,
  serializeVerified,
  toRecoveryModel,
  updateEntry,
  type Kdbx
} from '../src/index.ts';
import { PASSWORD, emptyVaultBytes, entryInput, splitHeader } from './helpers.ts';

async function expectCode(p: Promise<unknown>, code: string, detail?: string) {
  await expect(p).rejects.toMatchObject(detail ? { code, detail } : { code });
}

/** Save without the adapter's checks (to build hostile but authenticated fixtures). */
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

describe('create / open', () => {
  test('new vault carries product metadata and keeps all history', async () => {
    const { db, product } = createVault({ password: PASSWORD });
    expect(product.schemaVersion).toBe('1');
    expect(product.revision).toBe('0');
    expect(product.vaultId).toMatch(/^[0-9a-f-]{36}$/);
    expect(product.lineageId).not.toBe(product.vaultId);
    expect(db.meta.historyMaxItems).toBe(-1);
    const opened = await openVault((await serializeVerified(db)).bytes, PASSWORD);
    expect(opened.product).toEqual(product);
    expect(opened.db.meta.recycleBinEnabled).toBe(true);
  });

  test('creation password policy', () => {
    expect(() => createVault({ password: 'short' })).toThrow(expect.objectContaining({ detail: 'password-too-short' }));
    expect(() => createVault({ password: 'a'.repeat(20) + '\n' })).toThrow(expect.objectContaining({ detail: 'password-forbidden-character' }));
    expect(() => createVault({ password: 'a'.repeat(20) + '\uD800' })).toThrow(expect.objectContaining({ detail: 'password-invalid-unicode' }));
    expect(createVault({ password: ' ' + 'a'.repeat(20) + ' ' }).warnings).toContain('leading-or-trailing-space');
  });

  test('bumpRevision increments a large decimal revision exactly', () => {
    const { db } = createVault({ password: PASSWORD });
    db.meta.customData.set('LocalVault.Revision', { value: '9007199254740993' });
    expect(bumpRevision(db)).toBe('9007199254740994');
  });
});

describe('SEC-01 wrong password', () => {
  test('wrong and visually similar passwords fail closed without changing the input', async () => {
    const nfc = 'café-synthetic-passphrase';
    const nfd = 'café-synthetic-passphrase';
    const { db } = createVault({ password: nfc });
    const bytes = (await serializeVerified(db)).bytes;
    const copy = bytes.slice();
    await expectCode(openVault(bytes, nfd), 'AUTH_FAILED');
    await expectCode(openVault(bytes, 'nope'), 'AUTH_FAILED');
    await expectCode(openVault(bytes, nfc + ' '), 'AUTH_FAILED');
    expect(bytes).toEqual(copy);
    await expect(openVault(bytes, nfc)).resolves.toBeTruthy();
  });

  test('leading/trailing spaces are part of the password', async () => {
    const pw = '  spaced synthetic password  ';
    const { db } = createVault({ password: pw });
    const bytes = (await serializeVerified(db)).bytes;
    await expectCode(openVault(bytes, pw.trim()), 'AUTH_FAILED');
    await expect(openVault(bytes, pw)).resolves.toBeTruthy();
  });

  test('existing weak password is accepted for recovery with a warning', async () => {
    const opened = await openVault(await emptyVaultBytes(), PASSWORD);
    expect(opened.warnings).toEqual([]);
    await expectCode(openVault(await emptyVaultBytes(), ''), 'INVALID_INPUT', 'password-empty');
  });
});

describe('SEC-02 tampering is detected', () => {
  test('header HMAC, block HMAC and ciphertext flips fail authentication', async () => {
    const file = await emptyVaultBytes();
    const { fields } = splitHeader(file);
    const headerLen = 12 + fields.reduce((n, f) => n + 5 + f.data.byteLength, 0);
    const positions = {
      headerHmac: headerLen + 32,
      blockHmac: headerLen + 64,
      ciphertextFirst: headerLen + 64 + 36,
      ciphertextLast: file.byteLength - 36 - 1
    };
    for (const pos of Object.values(positions)) {
      const bad = file.slice();
      bad[pos]! ^= 0x80;
      await expectCode(openVault(bad, PASSWORD), 'AUTH_FAILED');
    }
  });
});

describe('SEC-08 fresh randomness', () => {
  test('saving identical content twice gives different ciphertexts that both open', async () => {
    const { db } = createVault({ password: PASSWORD });
    const a = await serializeVerified(db);
    const b = await serializeVerified(db);
    expect(a.sha256).not.toBe(b.sha256);
    const ma = toRecoveryModel((await openVault(a.bytes, PASSWORD)).db);
    const mb = toRecoveryModel((await openVault(b.bytes, PASSWORD)).db);
    expect(ma).toEqual(mb);
  });
});

describe('exact value round trip', () => {
  test('Unicode, whitespace, CR/LF/TAB, XML specials and empty values survive save + reopen', async () => {
    const { db } = createVault({ password: PASSWORD });
    const tricky = {
      title: '  Ünïcödé 🔐 العربية עברית é ',
      username: '<user>&"quote"\'',
      password: ' pa\tss\r\nword ]]> ',
      url: 'https://example.test/?a=1&b=<2>',
      notes: 'line1\r\nline2\rline3\n\ttabbed nbsp',
      customFields: [
        { name: 'Empty', value: '', protected: false },
        { name: 'Secret PIN', value: '\t0042 ', protected: true },
        { name: 'Кириллица', value: 'значение', protected: false }
      ]
    };
    const id = createEntry(db, entryInput(tricky));
    const reopened = await openVault((await serializeVerified(db)).bytes, PASSWORD);
    const e = readEntry(reopened.db, id);
    expect(e).toMatchObject(tricky);
  });
});

describe('SEC-05 / SEC-06 hostile authenticated payloads', () => {
  test('DTD with entity declaration is rejected', async () => {
    const { db } = createVault({ password: PASSWORD });
    const bytes = await rawSave(db, (x) => x.replace(/^(<\?xml[^>]*\?>)?/, '$1<!DOCTYPE KeePassFile [<!ENTITY e "boom">]>'));
    await expectCode(openVault(bytes, PASSWORD), 'UNSUPPORTED', 'xml-dtd-or-declaration');
  });

  test('external entity / XInclude are rejected without resolution', async () => {
    const { db } = createVault({ password: PASSWORD });
    const xi = await rawSave(db, (x) =>
      x.replace('</Meta>', '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/></Meta>')
    );
    await expectCode(openVault(xi, PASSWORD), 'UNSUPPORTED', 'xml-xinclude');
  });

  test('excessive nesting is rejected', async () => {
    const { db } = createVault({ password: PASSWORD });
    const deep = await rawSave(db, (x) => x.replace('</Meta>', '<X>'.repeat(80) + '</X>'.repeat(80) + '</Meta>'));
    await expectCode(openVault(deep, PASSWORD), 'LIMIT_EXCEEDED', 'xml-too-deep');
  });

  test('processing instructions are rejected', async () => {
    const { db } = createVault({ password: PASSWORD });
    const pi = await rawSave(db, (x) => x.replace('</Meta>', '<?evil cmd?></Meta>'));
    await expectCode(openVault(pi, PASSWORD), 'UNSUPPORTED', 'xml-processing-instruction');
  });

  test('attachments are unsupported rather than dropped', async () => {
    const { db } = createVault({ password: PASSWORD });
    const e = db.createEntry(db.getDefaultGroup());
    const bin = await db.createBinary(kdbx().ProtectedValue.fromString('attachment body'));
    e.binaries.set('file.txt', bin);
    await expectCode(serializeVerified(db), 'UNSUPPORTED', 'attachments');
    await expectCode(openVault(await rawSave(db), PASSWORD), 'UNSUPPORTED', 'attachments');
  });

  test('a newer product schema is not silently downgraded', async () => {
    const { db } = createVault({ password: PASSWORD });
    db.meta.customData.set('LocalVault.SchemaVersion', { value: '2' });
    await expectCode(openVault(await rawSave(db), PASSWORD), 'UNSUPPORTED', 'schema-version-newer');
  });

  test('a plain KDBX file without product metadata opens with product = null', async () => {
    const { db } = createVault({ password: PASSWORD });
    for (const k of [...db.meta.customData.keys()]) db.meta.customData.delete(k);
    const opened = await openVault(await rawSave(db), PASSWORD);
    expect(opened.product).toBeNull();
  });
});

describe('SEC-07 limits are refused, never truncated', () => {
  test('over-long title is refused at edit time', () => {
    const { db } = createVault({ password: PASSWORD });
    expect(() => createEntry(db, entryInput({ title: 'x'.repeat(257) }))).toThrow(expect.objectContaining({ code: 'LIMIT_EXCEEDED', detail: 'title-too-long' }));
    expect(() => createEntry(db, entryInput({ title: '😀'.repeat(256) }))).not.toThrow();
  });

  test('over-long field in a foreign file is refused at open', async () => {
    const { db } = createVault({ password: PASSWORD });
    const e = db.createEntry(db.getDefaultGroup());
    e.fields.set('Notes', 'n'.repeat(65_537));
    await expectCode(openVault(await rawSave(db), PASSWORD), 'LIMIT_EXCEEDED', 'notes-too-long');
  });

  test('too many custom fields and tags', () => {
    const { db } = createVault({ password: PASSWORD });
    const many = Array.from({ length: 65 }, (_, i) => ({ name: `f${i}`, value: '', protected: false }));
    expect(() => createEntry(db, entryInput({ customFields: many }))).toThrow(expect.objectContaining({ detail: 'too-many-custom-fields' }));
    const tags = Array.from({ length: 33 }, (_, i) => `t${i}`);
    expect(() => createEntry(db, entryInput({ tags }))).toThrow(expect.objectContaining({ detail: 'too-many-tags' }));
  });
});

describe('password change', () => {
  test('requires the current password and keeps all content including history', async () => {
    const { db } = createVault({ password: PASSWORD });
    const id = createEntry(db, entryInput({ password: 'old-secret' }));
    updateEntry(db, id, entryInput({ password: 'new-secret' }));
    const committed = (await serializeVerified(db)).bytes;
    await expectCode(changeMasterPassword(committed, 'wrong password!!', 'another-synthetic-passphrase'), 'AUTH_FAILED');
    const newPw = 'another-synthetic-passphrase';
    const { serialized } = await changeMasterPassword(committed, PASSWORD, newPw);
    await expectCode(openVault(serialized.bytes, PASSWORD), 'AUTH_FAILED');
    const reopened = await openVault(serialized.bytes, newPw);
    expect(readEntry(reopened.db, id, 0).password).toBe('old-secret');
    expect(readEntry(reopened.db, id).password).toBe('new-secret');
    expect(reopened.product?.revision).toBe('1');
    // The old committed file still opens with the old password.
    await expect(openVault(committed, PASSWORD)).resolves.toBeTruthy();
  });
});

describe('imported KDF profile', () => {
  test('a stronger in-envelope KDF profile is preserved by an ordinary edit', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { preflight } = await import('../src/index.ts');
    const dir = join(import.meta.dirname, '..', '..', '..', 'tests', 'interop', 'fixtures');
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    const item = manifest.fixtures.find((f: { file: string }) => f.file === 'kdf-upper-bound.kdbx');
    const opened = await openVault(new Uint8Array(readFileSync(join(dir, item.file))), item.password);
    const id = createEntry(opened.db, entryInput({ title: 'added after import' }));
    expect(id).toBeTruthy();
    const saved = await serializeVerified(opened.db);
    expect((await preflight(saved.bytes)).kdf).toMatchObject({ memoryBytes: 256 * 1024 * 1024, iterations: 10, parallelism: 4 });
  });
});
