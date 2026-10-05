import { createHash } from 'node:crypto';
import { createVault, serializeVerified, type EntryInput } from '../src/index.ts';

/** Synthetic test password (never a real credential). */
export const PASSWORD = 'synthetic-test-password-Ж-🔑';

export function entryInput(overrides: Partial<EntryInput> = {}): EntryInput {
  return {
    title: 'Example service',
    username: 'user@example.test',
    password: 'S3cr3t-synthetic',
    url: 'https://example.test/login',
    notes: '',
    tags: [],
    customFields: [],
    expiresAt: null,
    ...overrides
  };
}

let cachedEmpty: Uint8Array | undefined;
/** A valid serialized empty vault (cached; KDF work is expensive). */
export async function emptyVaultBytes(): Promise<Uint8Array> {
  if (!cachedEmpty) {
    const { db } = createVault({ password: PASSWORD });
    cachedEmpty = (await serializeVerified(db)).bytes;
  }
  return new Uint8Array(cachedEmpty);
}

export interface HeaderField {
  id: number;
  data: Uint8Array;
}

/** Split a KDBX 4 file into its outer header fields and the remainder after the header. */
export function splitHeader(file: Uint8Array): { prefix: Uint8Array; fields: HeaderField[]; rest: Uint8Array } {
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let pos = 12;
  const fields: HeaderField[] = [];
  for (;;) {
    const id = dv.getUint8(pos);
    const size = dv.getUint32(pos + 1, true);
    fields.push({ id, data: file.slice(pos + 5, pos + 5 + size) });
    pos += 5 + size;
    if (id === 0) break;
  }
  return { prefix: file.slice(0, 12), fields, rest: file.slice(pos + 32) /* skip stored SHA-256 */ };
}

/** Rebuild a file from (possibly modified) header fields, recomputing the unkeyed header SHA-256. */
export function joinHeader(prefix: Uint8Array, fields: HeaderField[], rest: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [prefix];
  for (const f of fields) {
    const h = new Uint8Array(5);
    new DataView(h.buffer).setUint8(0, f.id);
    new DataView(h.buffer).setUint32(1, f.data.byteLength, true);
    parts.push(h, f.data);
  }
  const header = concat(parts);
  const hash = createHash('sha256').update(header).digest();
  return concat([header, new Uint8Array(hash), rest]);
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

export interface VdItem {
  type: number;
  key: string;
  value: Uint8Array;
}

export function parseVd(data: Uint8Array): VdItem[] {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 2;
  const items: VdItem[] = [];
  for (;;) {
    const type = dv.getUint8(pos++);
    if (type === 0) break;
    const kl = dv.getInt32(pos, true);
    pos += 4;
    const key = new TextDecoder().decode(data.slice(pos, pos + kl));
    pos += kl;
    const vl = dv.getInt32(pos, true);
    pos += 4;
    items.push({ type, key, value: data.slice(pos, pos + vl) });
    pos += vl;
  }
  return items;
}

export function buildVd(items: VdItem[]): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x00, 0x01])];
  for (const it of items) {
    const k = new TextEncoder().encode(it.key);
    const h = new Uint8Array(9);
    const dv = new DataView(h.buffer);
    dv.setUint8(0, it.type);
    dv.setInt32(1, k.byteLength, true);
    parts.push(h.subarray(0, 5), k);
    const l = new Uint8Array(4);
    new DataView(l.buffer).setInt32(0, it.value.byteLength, true);
    parts.push(l, it.value);
  }
  parts.push(new Uint8Array([0]));
  return concat(parts);
}

export function u64(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

export function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

/** Return a copy of a vault with a KDF parameter replaced (header hash recomputed, HMAC left stale). */
export function withKdfParam(file: Uint8Array, key: string, type: number, value: Uint8Array): Uint8Array {
  const { prefix, fields, rest } = splitHeader(file);
  const kdf = fields.find((f) => f.id === 11)!;
  const items = parseVd(kdf.data).filter((i) => i.key !== key);
  items.push({ type, key, value });
  kdf.data = buildVd(items);
  return joinHeader(prefix, fields, rest);
}
