/**
 * Master-password policy (SECURITY_AND_FORMAT.md §2 "Password handling").
 *
 * The password is never trimmed, case-folded, normalized or pre-hashed. It is
 * handed to kdbxweb's standard credential path as-is (UTF-8).
 */

import { VaultError } from './errors.ts';
import { LIMITS } from './profile.ts';
import { hasLoneSurrogate, scalarLength, utf8Length } from './text.ts';

export type PasswordWarning = 'leading-or-trailing-space' | 'below-creation-minimum';

export interface PasswordCheck {
  warnings: PasswordWarning[];
}

/** Policy for a NEW vault or a password change. Throws INVALID_INPUT with a detail code. */
export function checkNewMasterPassword(password: string): PasswordCheck {
  if (hasLoneSurrogate(password)) throw new VaultError('INVALID_INPUT', 'password-invalid-unicode');
  if (/[\u0000\r\n]/.test(password)) throw new VaultError('INVALID_INPUT', 'password-forbidden-character');
  const len = scalarLength(password);
  if (len < LIMITS.masterPasswordMin) throw new VaultError('INVALID_INPUT', 'password-too-short');
  if (len > LIMITS.masterPasswordMax) throw new VaultError('INVALID_INPUT', 'password-too-long');
  const warnings: PasswordWarning[] = [];
  if (/^\s|\s$/u.test(password)) warnings.push('leading-or-trailing-space');
  return { warnings };
}

/**
 * Policy for unlocking an EXISTING file: any nonempty, valid-Unicode password
 * up to the recovery byte limit. Weak passwords are allowed (with a warning) so
 * that recovery is never blocked by the creation policy.
 */
export function checkExistingPassword(password: string): PasswordCheck {
  if (password.length === 0) throw new VaultError('INVALID_INPUT', 'password-empty');
  if (hasLoneSurrogate(password)) throw new VaultError('INVALID_INPUT', 'password-invalid-unicode');
  if (utf8Length(password) > LIMITS.recoveryPasswordMaxBytes) {
    throw new VaultError('INVALID_INPUT', 'password-too-long');
  }
  const warnings: PasswordWarning[] = [];
  if (scalarLength(password) < LIMITS.masterPasswordMin) warnings.push('below-creation-minimum');
  return { warnings };
}
