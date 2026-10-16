/** Disposable AES-GCM cache; its random key exists only inside encrypted KDBX metadata. */
import { StorageError, type UnlockedSession, type VaultStore } from '@passkey-local/vault-core';
import { safeRaster } from '../favicon/image.ts';
export const FAVICON_KEY = 'LocalVault.FaviconCacheKey';
const SLOT = 'faviconCache';
const AAD = new TextEncoder().encode('PassKey Local favicon cache v1');
const MAX_TEXT = 65_536;
type Row = { domain: string; png: string | null; at: number; missPolicy?: number; imagePolicy?: number };
type Envelope = { version: 1; id: string; iv: string; ciphertext: string };
export const encode64 = (b: Uint8Array): string => {
  let text = '';
  for (let i = 0; i < b.length; i += 4096) text += String.fromCharCode(...b.subarray(i, i + 4096));
  return btoa(text);
};
export const decode64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export class FaviconCache {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly storage: VaultStore;
  constructor(storage: VaultStore) { this.storage = storage; }

  private async material(s: UnlockedSession) {
    const value = s.db.meta.customData.get(FAVICON_KEY)?.value;
    if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new StorageError('INVALID_STATE');
    const raw = decode64(value);
    try {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
      const id = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
      const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      if (s.invalidated) throw new StorageError('INVALID_STATE');
      return { id, key };
    } finally { raw.fill(0); }
  }

  private async read(s: UnlockedSession, id: string, key: CryptoKey): Promise<Row[]> {
    const e = await this.storage.getPreference<Envelope>(SLOT);
    if (!e || e.version !== 1 || e.id !== id || typeof e.iv !== 'string' || e.iv.length !== 16 ||
      typeof e.ciphertext !== 'string' || e.ciphertext.length > 87_408) return [];
    let plaintext: Uint8Array | undefined;
    try {
      plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(e.iv), additionalData: AAD }, key, decode64(e.ciphertext)));
      if (plaintext.length > MAX_TEXT) return [];
      const rows: unknown = JSON.parse(new TextDecoder().decode(plaintext));
      if (!Array.isArray(rows) || rows.length > 64) return [];
      return rows.filter((r): r is Row => typeof r?.domain === 'string' && r.domain.length <= 253 &&
        (r.png === null || typeof r.png === 'string' && r.png.length <= 21_848) && Number.isFinite(r.at));
    } catch { return []; }
    finally { plaintext?.fill(0); }
  }

  async get(s: UnlockedSession, domain: string) {
    const { id, key } = await this.material(s);
    const row = (await this.read(s, id, key)).find((r) => r.domain === domain);
    if (s.invalidated) throw new StorageError('INVALID_STATE');
    let png: Uint8Array | null = null;
    try { png = row?.png ? decode64(row.png) : null; } catch { /* Disposable cache. */ }
    const valid = png && safeRaster(png);
    return { png: valid ? png : null,
      refresh: !row || !row.png && row.missPolicy !== 4 || !!row.png && (!valid || row.imagePolicy !== 1) || Date.now() - row.at > (row.png ? 30 : 1) * 86_400_000 };
  }

  put(s: UnlockedSession, domain: string, png: Uint8Array | null): Promise<void> {
    const operation = this.queue.catch(() => {}).then(async () => {
      const { id, key } = await this.material(s);
      const rows = (await this.read(s, id, key)).filter((r) => r.domain !== domain);
      rows.push({ domain, png: png ? encode64(png) : null, at: Date.now(), ...png ? { imagePolicy: 1 } : { missPolicy: 4 } });
      while (rows.length > 64 || JSON.stringify(rows).length > MAX_TEXT) rows.shift();
      const plaintext = new TextEncoder().encode(JSON.stringify(rows));
      try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, plaintext));
        if (s.invalidated) throw new StorageError('INVALID_STATE');
        // Consent can be withdrawn while a request is in flight.
        if (await this.storage.getPreference('faviconsEnabled') !== true || s.invalidated) return;
        await this.storage.setPreference(SLOT, { version: 1, id, iv: encode64(iv), ciphertext: encode64(ciphertext) }, s.head.generation);
      } finally { plaintext.fill(0); }
    });
    this.queue = operation;
    return operation;
  }

  async clear(): Promise<void> {
    await this.queue.catch(() => {});
    await this.storage.setPreference(SLOT, null);
  }
}
