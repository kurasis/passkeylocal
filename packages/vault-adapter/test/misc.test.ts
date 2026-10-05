import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  assertSafeXml,
  checkExistingPassword,
  checkNewMasterPassword,
  createVault,
  generatePassphrase,
  generatePassword,
  passphraseEntropyBits,
  randomInt,
  CHARSETS
} from '../src/index.ts';
import { argon2Impl } from '../src/argon2.ts';

afterEach(() => vi.restoreAllMocks());

describe('password generator', () => {
  test('default length 24 with all classes', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(24);
      for (const set of Object.values(CHARSETS)) expect([...p].some((c) => set.includes(c))).toBe(true);
    }
    expect(generatePassword({ length: 8, symbols: false, upper: false })).toMatch(/^[a-z0-9]{8}$/);
  });

  test('randomInt is within range and roughly uniform', () => {
    const counts = new Array(7).fill(0);
    for (let i = 0; i < 7000; i++) counts[randomInt(7)]++;
    for (const c of counts) expect(c).toBeGreaterThan(800);
  });

  test('passphrase format and entropy', () => {
    expect(generatePassphrase()).toMatch(/^([a-km-np-z2-9]{5}-){5}[a-km-np-z2-9]{5}$/);
    expect(passphraseEntropyBits()).toBe(150);
    expect(() => checkNewMasterPassword(generatePassphrase())).not.toThrow();
  });

  test('SEC-12 RNG failure stops generation and creation (no Math.random fallback)', () => {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('rng down');
    });
    const mathRandom = vi.spyOn(Math, 'random');
    expect(() => generatePassword()).toThrow(expect.objectContaining({ code: 'RNG_UNAVAILABLE' }));
    expect(() => createVault({ password: 'synthetic-test-password' })).toThrow(expect.objectContaining({ code: 'RNG_UNAVAILABLE' }));
    expect(mathRandom).not.toHaveBeenCalled();
  });
});

describe('password policy', () => {
  test('scalar counting, not UTF-16 units', () => {
    expect(() => checkNewMasterPassword('😀'.repeat(16))).not.toThrow();
    expect(() => checkNewMasterPassword('😀'.repeat(15))).toThrow(expect.objectContaining({ detail: 'password-too-short' }));
    expect(() => checkNewMasterPassword('a'.repeat(1025))).toThrow(expect.objectContaining({ detail: 'password-too-long' }));
    expect(checkExistingPassword('weak').warnings).toEqual(['below-creation-minimum']);
    expect(() => checkExistingPassword('ж'.repeat(2049))).toThrow(expect.objectContaining({ detail: 'password-too-long' }));
  });
});

describe('XML guard', () => {
  const ok = '<?xml version="1.0" encoding="utf-8" standalone="yes"?><KeePassFile><Meta/><Root a=">"><G/></Root></KeePassFile>';
  test('accepts ordinary documents and comments/CDATA', () => {
    expect(() => assertSafeXml(ok)).not.toThrow();
    expect(() => assertSafeXml('<a><!-- c --><![CDATA[<x>]]></a>')).not.toThrow();
  });
  test.each([
    ['<!DOCTYPE a><a/>', 'xml-dtd-or-declaration'],
    ['<a><!ENTITY x "y"></a>', 'xml-dtd-or-declaration'],
    ['<a><?php x?></a>', 'xml-processing-instruction'],
    ['<?xml-stylesheet href="x"?><a/>', 'xml-processing-instruction'],
    ['<a xmlns:xi="http://www.w3.org/2001/XInclude"/>', 'xml-xinclude'],
    ['<a>\u0001</a>', 'xml-forbidden-character'],
    ['<a>\uD800</a>', 'xml-invalid-unicode'],
    ['<a><b></a>', 'xml-unbalanced'],
    ['<a/><b/>', 'xml-multiple-roots'],
    ['<a', 'xml-unterminated-tag'],
    ['text only', 'xml-no-root']
  ])('rejects %s', (xml, detail) => {
    expect(() => assertSafeXml(xml)).toThrow(expect.objectContaining({ detail }));
  });
  test('depth and element-count limits', () => {
    expect(() => assertSafeXml('<a>'.repeat(65) + '</a>'.repeat(65))).toThrow(expect.objectContaining({ detail: 'xml-too-deep' }));
    expect(() => assertSafeXml('<a>'.repeat(64) + '</a>'.repeat(64))).not.toThrow();
    expect(() => assertSafeXml('<r>' + '<e/>'.repeat(10) + '</r>', { maxDepth: 64, maxElements: 5 })).toThrow(
      expect.objectContaining({ detail: 'xml-too-many-elements' })
    );
  });
});

describe('Argon2 adapter boundary', () => {
  test('receives KiB from kdbxweb and refuses non-Argon2id or out-of-envelope requests', async () => {
    const pw = new Uint8Array(32).buffer;
    const salt = new Uint8Array(32).buffer;
    await expect(argon2Impl(pw, salt, 65536, 3, 32, 1, 0, 0x13)).rejects.toMatchObject({ detail: 'kdf-not-argon2id' });
    await expect(argon2Impl(pw, salt, 65536, 3, 32, 1, 2, 0x10)).rejects.toMatchObject({ detail: 'kdf-argon2-version' });
    // A bytes-instead-of-KiB mistake (64 MiB passed as 67108864 "KiB") is refused.
    await expect(argon2Impl(pw, salt, 67108864, 3, 32, 1, 2, 0x13)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    const out = new Uint8Array(await argon2Impl(pw, salt, 65536, 3, 32, 1, 2, 0x13));
    expect(out).toHaveLength(32);
  });

  test('kdbxweb passes 65536 KiB for the 64 MiB header value', async () => {
    const mod = await import('../src/argon2.ts');
    const calls: number[] = [];
    const K = (await import('../src/kdbx.ts')).kdbx();
    K.CryptoEngine.setArgon2Impl(async (...args: Parameters<typeof mod.argon2Impl>) => {
      calls.push(args[2]);
      return mod.argon2Impl(...args);
    });
    try {
      const { db } = createVault({ password: 'synthetic-test-password' });
      await db.save();
      expect(calls).toEqual([65536]);
    } finally {
      K.CryptoEngine.setArgon2Impl(mod.argon2Impl);
    }
  });
});
