import { describe, expect, test, vi } from 'vitest';
import { preflight, openVault, WRITER_PROFILE, kdbx, LIMITS } from '../src/index.ts';
import * as argon2 from '../src/argon2.ts';
import { PASSWORD, emptyVaultBytes, joinHeader, splitHeader, u32, u64, withKdfParam, concat } from './helpers.ts';

async function expectCode(p: Promise<unknown>, code: string, detail?: string) {
  await expect(p).rejects.toMatchObject(detail ? { code, detail } : { code });
}

describe('G0-01 writer profile', () => {
  test('a new vault is KDBX 4.1, AES-256, Argon2id 64 MiB / 3 / 1, 32-byte salt, no compression', async () => {
    const s = await preflight(await emptyVaultBytes());
    expect(s).toMatchObject({
      authenticated: false,
      versionMajor: 4,
      versionMinor: 1,
      cipher: 'AES-256-CBC',
      compression: 'none',
      kdf: {
        algorithm: 'Argon2id',
        version: 0x13,
        memoryBytes: WRITER_PROFILE.kdfMemoryBytes,
        iterations: 3,
        parallelism: 1,
        saltLength: 32
      }
    });
  });

  test('no public custom data and no KDBX 3 fields in the outer header', async () => {
    const { fields } = splitHeader(await emptyVaultBytes());
    expect(fields.map((f) => f.id).sort((a, b) => a - b)).toEqual([0, 2, 3, 4, 7, 11]);
  });
});

describe('SEC-03 truncation and trailing data', () => {
  test('every truncation point is rejected as malformed before any KDF', async () => {
    const file = await emptyVaultBytes();
    const { fields } = splitHeader(file);
    const headerLen = 12 + fields.reduce((n, f) => n + 5 + f.data.byteLength, 0);
    const cuts = new Set([12, 13, 20, headerLen - 1, headerLen, headerLen + 16, headerLen + 64, headerLen + 64 + 32, headerLen + 64 + 36, file.byteLength - 36, file.byteLength - 1]);
    for (const cut of cuts) {
      await expectCode(preflight(file.slice(0, cut)), 'MALFORMED');
    }
  });

  test('appended bytes are rejected', async () => {
    const file = await emptyVaultBytes();
    await expectCode(preflight(concat([file, new Uint8Array([0])])), 'MALFORMED', 'trailing-bytes');
  });

  test('non-KDBX input is unsupported, not an unlock failure', async () => {
    await expectCode(preflight(new TextEncoder().encode('hello world, not a vault')), 'UNSUPPORTED', 'not-kdbx');
    await expectCode(openVault(new Uint8Array(100), PASSWORD), 'UNSUPPORTED', 'not-kdbx');
  });

  test('files over 16 MiB are refused before parsing', async () => {
    await expectCode(preflight(new Uint8Array(LIMITS.maxFileBytes + 1)), 'LIMIT_EXCEEDED', 'file-too-large');
  });
});

describe('SEC-02 header checksum', () => {
  test('a flipped header byte fails the header hash (independent of the password)', async () => {
    const file = await emptyVaultBytes();
    const { fields } = splitHeader(file);
    let pos = 12;
    for (const f of fields) {
      if (f.id === 4) break;
      pos += 5 + f.data.byteLength;
    }
    const bad = file.slice();
    bad[pos + 5]! ^= 0x01; // first byte of the master seed
    await expectCode(preflight(bad), 'MALFORMED', 'header-hash-mismatch');
  });
});

describe('SEC-04 / SEC-05 header profile and resource limits (rejected before KDF)', () => {
  const VT = { UInt32: 0x04, UInt64: 0x05, Bytes: 0x42 };

  test.each([
    ['M', VT.UInt64, u64(1n << 40n), 'LIMIT_EXCEEDED', 'kdf-memory-too-high'],
    ['M', VT.UInt64, u64(0xffffffffffffffffn), 'LIMIT_EXCEEDED', 'kdf-memory-too-high'],
    ['M', VT.UInt64, u64(32n * 1024n * 1024n), 'UNSUPPORTED', 'kdf-memory-too-low'],
    ['M', VT.UInt64, u64(64n * 1024n * 1024n + 1n), 'UNSUPPORTED', 'kdf-memory-not-whole-kib'],
    ['I', VT.UInt64, u64(1n << 62n), 'LIMIT_EXCEEDED', 'kdf-iterations-too-high'],
    ['I', VT.UInt64, u64(2n), 'UNSUPPORTED', 'kdf-iterations-too-low'],
    ['P', VT.UInt32, u32(64), 'LIMIT_EXCEEDED', 'kdf-parallelism-too-high'],
    ['V', VT.UInt32, u32(0x10), 'UNSUPPORTED', 'kdf-argon2-version'],
    ['S', VT.Bytes, new Uint8Array(8), 'UNSUPPORTED', 'kdf-salt-length'],
    ['K', VT.Bytes, new Uint8Array(32), 'UNSUPPORTED', 'kdf-secret-or-associated-data'],
    ['M', VT.UInt32, u32(1024), 'MALFORMED', 'kdf-memory']
  ])('KDF %s rejected (%s)', async (key, type, value, code, detail) => {
    const spy = vi.spyOn(argon2, 'argon2Impl');
    const file = withKdfParam(await emptyVaultBytes(), key as string, type as number, value as Uint8Array);
    await expectCode(preflight(file), code as string, detail as string);
    await expectCode(openVault(file, PASSWORD), code as string, detail as string);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('Argon2d and AES-KDF are unsupported', async () => {
    const K = kdbx();
    const b64 = (s: string) => new Uint8Array(K.ByteUtils.base64ToBytes(s));
    await expectCode(preflight(withKdfParam(await emptyVaultBytes(), '$UUID', VT.Bytes, b64(K.Consts.KdfId.Argon2d))), 'UNSUPPORTED', 'kdf-argon2d');
    await expectCode(preflight(withKdfParam(await emptyVaultBytes(), '$UUID', VT.Bytes, b64(K.Consts.KdfId.Aes))), 'UNSUPPORTED', 'kdf-aes');
  });

  test('gzip compression is rejected before decompression', async () => {
    const { prefix, fields, rest } = splitHeader(await emptyVaultBytes());
    fields.find((f) => f.id === 3)!.data = u32(1);
    await expectCode(preflight(joinHeader(prefix, fields, rest)), 'UNSUPPORTED', 'compression-gzip');
  });

  test('ChaCha20 outer cipher is outside the v1 profile', async () => {
    const { prefix, fields, rest } = splitHeader(await emptyVaultBytes());
    const K = kdbx();
    fields.find((f) => f.id === 2)!.data = new Uint8Array(K.ByteUtils.base64ToBytes(K.Consts.CipherId.ChaCha20));
    await expectCode(preflight(joinHeader(prefix, fields, rest)), 'UNSUPPORTED', 'cipher');
  });

  test('duplicate header fields and duplicate dictionary keys are malformed', async () => {
    const { prefix, fields, rest } = splitHeader(await emptyVaultBytes());
    const dup = [...fields.slice(0, -1), fields[1]!, fields[fields.length - 1]!];
    await expectCode(preflight(joinHeader(prefix, dup, rest)), 'MALFORMED', 'header-duplicate-field');

    const kdf = fields.find((f) => f.id === 11)!;
    // Append a second 'P' entry before the terminator.
    const extra = concat([new Uint8Array([0x04, 1, 0, 0, 0]), new TextEncoder().encode('P'), u32(4), u32(1)]);
    kdf.data = concat([kdf.data.slice(0, -1), extra, new Uint8Array([0])]);
    await expectCode(preflight(joinHeader(prefix, fields, rest)), 'MALFORMED', 'vd-duplicate-key');
  });

  test('public custom data is unsupported', async () => {
    const { prefix, fields, rest } = splitHeader(await emptyVaultBytes());
    fields.splice(fields.length - 1, 0, { id: 12, data: new Uint8Array([0x00, 0x01, 0x00]) });
    await expectCode(preflight(joinHeader(prefix, fields, rest)), 'UNSUPPORTED', 'public-custom-data');
  });

  test('oversized declared header field is refused without allocation', async () => {
    const file = (await emptyVaultBytes()).slice(0, 12 + 5);
    new DataView(file.buffer).setUint32(13, 0xfffffff0, true);
    await expectCode(preflight(file), 'LIMIT_EXCEEDED', 'header-field-too-large');
  });

  test('KDBX 3.1 and future 4.2 versions are unsupported', async () => {
    const v3 = (await emptyVaultBytes()).slice();
    new DataView(v3.buffer).setUint16(10, 3, true);
    await expectCode(preflight(v3), 'UNSUPPORTED', 'kdbx-major-version');
    const v42 = (await emptyVaultBytes()).slice();
    new DataView(v42.buffer).setUint16(8, 2, true);
    await expectCode(preflight(v42), 'UNSUPPORTED', 'kdbx-minor-version');
  });
});
