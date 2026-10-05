/** Unicode helpers shared by validation code. */

import { VaultError } from './errors.ts';

/** True when the string contains an unpaired UTF-16 surrogate. */
export function hasLoneSurrogate(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (c >= 0xdc00 && c <= 0xdfff) return true;
  }
  return false;
}

/** Number of Unicode scalar values. Throws INVALID_INPUT on lone surrogates. */
export function scalarLength(s: string): number {
  if (hasLoneSurrogate(s)) throw new VaultError('INVALID_INPUT', 'invalid-unicode');
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) i++;
    n++;
  }
  return n;
}

export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).byteLength;
}
