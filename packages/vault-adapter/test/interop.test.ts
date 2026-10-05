/**
 * Cross-implementation checks on the committed corpus.
 *  - G0-03: a file written by PyKeePass opens in the browser adapter with the same logical content
 *    that the independent Python exporter recorded.
 *  - Browser-written fixtures still open and match their recorded models (regression guard).
 *  - Security corpus: each hostile file is rejected with the documented code.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { openVault, serializeVerified, toRecoveryModel } from '../src/index.ts';

const repo = join(import.meta.dirname, '..', '..', '..');
const load = (p: string) => JSON.parse(readFileSync(join(repo, p), 'utf8'));

interface Fixture {
  file: string;
  password: string;
  sha256: string;
  wrong_passwords?: string[];
}

describe('G0-03 PyKeePass-written file opens in the browser adapter', () => {
  const dir = 'tests/interop/fixtures-python';
  const fixtures: Fixture[] = load(`${dir}/manifest.json`).fixtures;
  test.each(fixtures.map((f) => [f.file, f] as const))('%s', async (_name, f) => {
    const bytes = new Uint8Array(readFileSync(join(repo, dir, f.file)));
    const opened = await openVault(bytes, f.password);
    expect(opened.product).toBeNull();
    expect(opened.preflight.kdf.parallelism).toBe(2);
    // PyKeePass writes an empty auto-type association per entry; kdbxweb drops those,
    // so the adapter opens the file read-only instead of silently losing them on save.
    expect(opened.readOnlyReason).toBe('autotype-association-dropped');
    await expect(serializeVerified(opened.db)).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    const expected = load(`${dir}/${f.file.replace('.kdbx', '.expected.json')}`);
    const stripEmptyAssociations = (m: ReturnType<typeof toRecoveryModel>) => {
      for (const e of m.entries) {
        for (const s of [e, ...e.history]) {
          s.auto_type.associations = s.auto_type.associations.filter((a) => a.window !== '' && a.sequence !== '');
        }
      }
      return m;
    };
    // Everything else (passwords, protected flags, history, timestamps, groups) must agree exactly.
    expect(toRecoveryModel(opened.db)).toEqual(stripEmptyAssociations(expected));
  });
});

describe('browser-written corpus re-opens with the recorded model', () => {
  const dir = 'tests/interop/fixtures';
  const fixtures: Fixture[] = load(`${dir}/manifest.json`).fixtures;
  test.each(fixtures.map((f) => [f.file, f] as const))('%s', async (_name, f) => {
    const bytes = new Uint8Array(readFileSync(join(repo, dir, f.file)));
    const opened = await openVault(bytes, f.password);
    expect(opened.readOnlyReason).toBeNull();
    expect(toRecoveryModel(opened.db)).toEqual(load(`${dir}/${f.file.replace('.kdbx', '.expected.json')}`));
    for (const wrong of f.wrong_passwords ?? []) {
      await expect(openVault(bytes, wrong)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    }
  });
});

describe('security corpus is rejected with the documented codes', () => {
  const dir = 'tests/security/fixtures';
  const fixtures: (Fixture & { expect_ts: { code: string; detail?: string } })[] = load(`${dir}/manifest.json`).fixtures;
  test.each(fixtures.map((f) => [f.file, f] as const))('%s', async (_name, f) => {
    const bytes = new Uint8Array(readFileSync(join(repo, dir, f.file)));
    if (f.expect_ts.code === 'OK') {
      await expect(openVault(bytes, f.password)).resolves.toMatchObject({ readOnlyReason: null });
    } else if (f.expect_ts.code === 'READ_ONLY') {
      const opened = await openVault(bytes, f.password);
      expect(opened.readOnlyReason).toBe(f.expect_ts.detail);
      await expect(serializeVerified(opened.db)).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    } else {
      await expect(openVault(bytes, f.password)).rejects.toMatchObject(f.expect_ts);
    }
  });
});
