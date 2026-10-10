/** Test-only client. No vault or biometric proof is claimed by this fixture. */
import type { Preferences } from '../../../pwa/src/protocol.ts';
export class VaultRequestError extends Error { code = 'SYNTHETIC'; detail = undefined; }
let searchFailure = false;
(window as any).searchTest = { fail() { searchFailure = true; } };
let phase = 'unlocked';
let hello = { state: 'off', mode: 'session', expiresAt: 123456789 };
const helloCalls: string[] = [];
let cancelHello = false;
(window as any).helloVaultTest = { calls: helloCalls, cancel() { cancelHello = true; } };

const prefs: Preferences = { language: 'ru', theme: 'color', lockIntervalMs: 86400000, onboardingBackupVerified: true };
export class VaultClient {
  epoch = 0;
  async call(operation: string, args?: { key?: keyof Preferences; value?: never }) {
    switch (operation) {
      case 'helloVaultStatus': return { ...hello };
      case 'enableHelloVault': helloCalls.push('enable'); hello = { ...hello, state: 'enabled', mode: (args as any).mode }; return { ...hello };
      case 'disableHelloVault': helloCalls.push('disable'); hello.state = 'off'; return { ...hello };
      case 'unlockHelloVault': helloCalls.push('unlock'); if (cancelHello) { cancelHello = false; throw { code: 'UNAVAILABLE', detail: 'HELLO_CANCELLED' }; } phase = 'unlocked'; return { warnings: [] };
      case 'state': return { state: phase, persistence: 'persisted', storageUnhealthy: false };
      case 'getPreferences': return { ...prefs };
      case 'setPreference': if (args?.key) prefs[args.key] = args.value!; return;
      case 'overview': return { entries: [], groups: [], revision: '0', generation: 0, unsaved: null, readOnly: false };
      case 'backupStatus': return null;
      case 'biometricCredential': return null;
      case 'unlock': phase = 'unlocked'; return { warnings: [] };
      case 'search': if (searchFailure) throw new Error('Synthetic search failure'); return [];
      default: throw new Error(`Unexpected synthetic operation: ${operation}`);
    }
  }
  lock() { this.epoch++; phase = 'locked'; }
}
