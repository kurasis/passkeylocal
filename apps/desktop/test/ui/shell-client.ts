/** Test-only client. No vault or biometric proof is claimed by this fixture. */
import type { Preferences } from '../../../pwa/src/protocol.ts';
export class VaultRequestError extends Error { code = 'SYNTHETIC'; detail = undefined; }
let phase = 'unlocked';
const prefs: Preferences = { language: 'ru', theme: 'color', lockIntervalMs: 86400000, onboardingBackupVerified: true };
export class VaultClient {
  epoch = 0;
  async call(operation: string, args?: { key?: keyof Preferences; value?: never }) {
    switch (operation) {
      case 'state': return { state: phase, persistence: 'persisted', storageUnhealthy: false };
      case 'getPreferences': return { ...prefs };
      case 'setPreference': if (args?.key) prefs[args.key] = args.value!; return;
      case 'overview': return { entries: [], groups: [], revision: '0', generation: 0, unsaved: null, readOnly: false };
      case 'backupStatus': return null;
      case 'biometricCredential': return null;
      case 'unlock': phase = 'unlocked'; return { warnings: [] };
      case 'search': return [];
      default: throw new Error(`Unexpected synthetic operation: ${operation}`);
    }
  }
  lock() { this.epoch++; phase = 'locked'; }
}
