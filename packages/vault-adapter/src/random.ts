/**
 * Cryptographically secure randomness and the password generator.
 * Never falls back to Math.random: if the platform RNG is missing or fails,
 * the operation stops with RNG_UNAVAILABLE.
 */

import { VaultError } from './errors.ts';

export function secureRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  try {
    if (typeof globalThis.crypto?.getRandomValues !== 'function') throw new Error('missing');
    // getRandomValues is limited to 65536 bytes per call.
    for (let off = 0; off < n; off += 65536) {
      globalThis.crypto.getRandomValues(out.subarray(off, Math.min(n, off + 65536)));
    }
  } catch {
    throw new VaultError('RNG_UNAVAILABLE');
  }
  return out;
}

/** Uniform integer in [0, maxExclusive) by rejection sampling (no modulo bias). */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 32) {
    throw new VaultError('INVALID_INPUT', 'random-range');
  }
  const limit = 2 ** 32 - (2 ** 32 % maxExclusive);
  for (;;) {
    const b = secureRandomBytes(4);
    const v = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
    if (v < limit) return v % maxExclusive;
  }
}

/** Random version-4 UUID text using the secure RNG. */
export function randomUuid(): string {
  const b = secureRandomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const CHARSETS = Object.freeze({
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!#$%&()*+,-./:;<=>?@[]^_{|}~'
});

export interface GeneratorOptions {
  length?: number;
  lower?: boolean;
  upper?: boolean;
  digits?: boolean;
  symbols?: boolean;
}

export const DEFAULT_PASSWORD_LENGTH = 24;

/**
 * Random password. Each character is drawn uniformly from the union of the
 * enabled sets; candidates missing an enabled class are rejected and redrawn,
 * which keeps the result uniform over all qualifying strings.
 */
export function generatePassword(opts: GeneratorOptions = {}): string {
  const length = opts.length ?? DEFAULT_PASSWORD_LENGTH;
  const sets = (['lower', 'upper', 'digits', 'symbols'] as const)
    .filter((k) => opts[k] ?? true)
    .map((k) => CHARSETS[k]);
  if (sets.length === 0) throw new VaultError('INVALID_INPUT', 'generator-no-charset');
  if (!Number.isInteger(length) || length < sets.length || length > 4096) {
    throw new VaultError('INVALID_INPUT', 'generator-length');
  }
  const alphabet = sets.join('');
  for (;;) {
    let s = '';
    for (let i = 0; i < length; i++) s += alphabet[randomInt(alphabet.length)];
    if (sets.every((set) => [...s].some((ch) => set.includes(ch)))) return s;
  }
}

/** 32 unambiguous lowercase letters and digits: 5 bits per character. */
export const PASSPHRASE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/**
 * Suggested master password: `groups` groups of `groupLength` characters joined
 * by '-'. Default 6 x 5 = 30 characters = 150 bits of entropy, 35 characters
 * total, within the 16..1024 creation policy.
 */
export function generatePassphrase(groups = 6, groupLength = 5): string {
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    let p = '';
    for (let i = 0; i < groupLength; i++) p += PASSPHRASE_ALPHABET[randomInt(PASSPHRASE_ALPHABET.length)];
    parts.push(p);
  }
  return parts.join('-');
}

export function passphraseEntropyBits(groups = 6, groupLength = 5): number {
  return groups * groupLength * Math.log2(PASSPHRASE_ALPHABET.length);
}
