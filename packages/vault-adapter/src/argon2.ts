/**
 * Argon2id adapter for kdbxweb, backed by the bundled hash-wasm implementation.
 *
 * Unit boundary: the KDBX header stores Argon2 memory in BYTES. kdbxweb 2.1.1
 * divides that by 1024 before calling this function, so `memoryKiB` is already
 * in KiB, which is exactly what hash-wasm's `memorySize` expects. No further
 * conversion happens here. tests/argon2.test.ts pins this with RFC 9106-style
 * vectors and a full KDBX fixture cross-checked by the Python tool.
 */

import { argon2id } from 'hash-wasm';
import { VaultError } from './errors.ts';
import { ARGON2_VERSION_13, READER_ENVELOPE } from './profile.ts';

/** kdbxweb's numeric Argon2 type for Argon2id. */
const KDBXWEB_ARGON2ID = 2;

export async function argon2Impl(
  password: ArrayBuffer,
  salt: ArrayBuffer,
  memoryKiB: number,
  iterations: number,
  length: number,
  parallelism: number,
  type: number,
  version: number
): Promise<ArrayBuffer> {
  if (type !== KDBXWEB_ARGON2ID) throw new VaultError('UNSUPPORTED', 'kdf-not-argon2id');
  if (version !== ARGON2_VERSION_13) throw new VaultError('UNSUPPORTED', 'kdf-argon2-version');
  // Defence in depth: the preflight already enforced the envelope on the header bytes.
  const E = READER_ENVELOPE;
  if (
    !Number.isSafeInteger(memoryKiB) ||
    memoryKiB < E.kdfMemoryMinBytes / 1024 ||
    memoryKiB > E.kdfMemoryMaxBytes / 1024 ||
    iterations < E.kdfIterationsMin ||
    iterations > E.kdfIterationsMax ||
    parallelism < E.kdfParallelismMin ||
    parallelism > E.kdfParallelismMax ||
    length !== 32
  ) {
    throw new VaultError('LIMIT_EXCEEDED', 'kdf-parameters-outside-envelope');
  }
  const out = await argon2id({
    password: new Uint8Array(password),
    salt: new Uint8Array(salt),
    memorySize: memoryKiB,
    iterations,
    parallelism,
    hashLength: length,
    outputType: 'binary'
  });
  if (!(out instanceof Uint8Array) || out.length !== length) {
    throw new VaultError('INTERNAL', 'kdf-output');
  }
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}
