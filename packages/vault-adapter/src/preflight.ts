/**
 * Bounded structural preflight for KDBX files.
 *
 * Runs before any key derivation or large allocation. It checks sizes, header
 * structure, the allowed cipher/compression/KDF profile and the block layout.
 * Everything it reports is UNAUTHENTICATED: it only limits resource abuse and
 * rejects unsupported profiles early. Authentication is done later by kdbxweb.
 *
 * The Python recovery tool implements the same rules independently in
 * tools/vault-recovery/src/vault_recovery/preflight.py.
 */

import { VaultError } from './errors.ts';
import {
  CIPHER_AES256_UUID,
  KDBX_SIGNATURE_1,
  KDBX_SIGNATURE_2,
  KDF_AESKDF_UUID,
  KDF_ARGON2D_UUID,
  KDF_ARGON2ID_UUID,
  ARGON2_VERSION_13,
  LIMITS,
  READER_ENVELOPE
} from './profile.ts';

export interface PreflightSummary {
  /** Always false: nothing here has been authenticated. */
  readonly authenticated: false;
  readonly fileSize: number;
  readonly versionMajor: number;
  readonly versionMinor: number;
  readonly cipher: 'AES-256-CBC';
  readonly compression: 'none';
  readonly kdf: {
    readonly algorithm: 'Argon2id';
    readonly version: number;
    readonly memoryBytes: number;
    readonly iterations: number;
    readonly parallelism: number;
    readonly saltLength: number;
  };
  readonly headerLength: number;
  readonly blockCount: number;
  readonly payloadBytes: number;
}

const HeaderField = {
  EndOfHeader: 0,
  Comment: 1,
  CipherId: 2,
  CompressionFlags: 3,
  MasterSeed: 4,
  TransformSeed: 5,
  TransformRounds: 6,
  EncryptionIV: 7,
  ProtectedStreamKey: 8,
  StreamStartBytes: 9,
  InnerRandomStreamId: 10,
  KdfParameters: 11,
  PublicCustomData: 12
} as const;

const VdType = {
  End: 0x00,
  UInt32: 0x04,
  UInt64: 0x05,
  Bool: 0x08,
  Int32: 0x0c,
  Int64: 0x0d,
  String: 0x18,
  Bytes: 0x42
} as const;

type VdValue =
  | { type: typeof VdType.UInt32 | typeof VdType.Int32; value: number }
  | { type: typeof VdType.UInt64 | typeof VdType.Int64; value: bigint }
  | { type: typeof VdType.Bool; value: boolean }
  | { type: typeof VdType.String; value: string }
  | { type: typeof VdType.Bytes; value: Uint8Array };

const malformed = (detail: string) => new VaultError('MALFORMED', detail);
const unsupported = (detail: string) => new VaultError('UNSUPPORTED', detail);
const limit = (detail: string) => new VaultError('LIMIT_EXCEEDED', detail);

function hex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** Bounds-checked little-endian reader over a byte range. */
class Reader {
  pos: number;
  private readonly view: DataView;
  private readonly end: number;
  constructor(view: DataView, start: number, end: number) {
    this.view = view;
    this.pos = start;
    this.end = end;
  }
  remaining(): number {
    return this.end - this.pos;
  }
  need(n: number, what: string): void {
    if (n < 0 || n > this.remaining()) throw malformed(`truncated-${what}`);
  }
  u8(what: string): number {
    this.need(1, what);
    return this.view.getUint8(this.pos++);
  }
  u16(what: string): number {
    this.need(2, what);
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u32(what: string): number {
    this.need(4, what);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i32(what: string): number {
    this.need(4, what);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  bytes(n: number, what: string): Uint8Array {
    this.need(n, what);
    const out = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n);
    this.pos += n;
    return out;
  }
}

function parseVariantDictionary(data: Uint8Array): Map<string, VdValue> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const r = new Reader(view, 0, data.byteLength);
  const version = r.u16('vd-version');
  if ((version & 0xff00) !== 0x0100) throw unsupported('vd-version');
  const out = new Map<string, VdValue>();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (;;) {
    const type = r.u8('vd-type');
    if (type === VdType.End) break;
    const keyLen = r.i32('vd-key-length');
    if (keyLen <= 0 || keyLen > r.remaining()) throw malformed('vd-key-length');
    let key: string;
    try {
      key = decoder.decode(r.bytes(keyLen, 'vd-key'));
    } catch {
      throw malformed('vd-key-encoding');
    }
    const valLen = r.i32('vd-value-length');
    if (valLen < 0 || valLen > r.remaining()) throw malformed('vd-value-length');
    const raw = r.bytes(valLen, 'vd-value');
    if (out.has(key)) throw malformed('vd-duplicate-key');
    const vv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    let value: VdValue;
    switch (type) {
      case VdType.UInt32:
        if (valLen !== 4) throw malformed('vd-uint32-length');
        value = { type, value: vv.getUint32(0, true) };
        break;
      case VdType.Int32:
        if (valLen !== 4) throw malformed('vd-int32-length');
        value = { type, value: vv.getInt32(0, true) };
        break;
      case VdType.UInt64:
        if (valLen !== 8) throw malformed('vd-uint64-length');
        value = { type, value: vv.getBigUint64(0, true) };
        break;
      case VdType.Int64:
        if (valLen !== 8) throw malformed('vd-int64-length');
        value = { type, value: vv.getBigInt64(0, true) };
        break;
      case VdType.Bool:
        if (valLen !== 1) throw malformed('vd-bool-length');
        value = { type, value: raw[0] !== 0 };
        break;
      case VdType.String:
        try {
          value = { type, value: decoder.decode(raw) };
        } catch {
          throw malformed('vd-string-encoding');
        }
        break;
      case VdType.Bytes:
        value = { type, value: raw };
        break;
      default:
        throw malformed('vd-unknown-type');
    }
    out.set(key, value);
  }
  if (r.remaining() !== 0) throw malformed('vd-trailing-bytes');
  return out;
}

function checkKdf(params: Map<string, VdValue>): PreflightSummary['kdf'] {
  const uuid = params.get('$UUID');
  if (!uuid || uuid.type !== VdType.Bytes || uuid.value.length !== 16) throw malformed('kdf-uuid');
  const id = hex(uuid.value);
  if (id === KDF_ARGON2D_UUID) throw unsupported('kdf-argon2d');
  if (id === KDF_AESKDF_UUID) throw unsupported('kdf-aes');
  if (id !== KDF_ARGON2ID_UUID) throw unsupported('kdf-unknown');

  const allowed = new Set(['$UUID', 'S', 'P', 'M', 'I', 'V']);
  for (const key of params.keys()) {
    if (key === 'K' || key === 'A') throw unsupported('kdf-secret-or-associated-data');
    if (!allowed.has(key)) throw unsupported('kdf-unknown-parameter');
  }

  const salt = params.get('S');
  const p = params.get('P');
  const m = params.get('M');
  const i = params.get('I');
  const v = params.get('V');
  if (!salt || salt.type !== VdType.Bytes) throw malformed('kdf-salt');
  if (!p || p.type !== VdType.UInt32) throw malformed('kdf-parallelism');
  if (!m || m.type !== VdType.UInt64) throw malformed('kdf-memory');
  if (!i || i.type !== VdType.UInt64) throw malformed('kdf-iterations');
  if (!v || v.type !== VdType.UInt32) throw malformed('kdf-version');

  if (v.value !== ARGON2_VERSION_13) throw unsupported('kdf-argon2-version');
  const E = READER_ENVELOPE;
  if (salt.value.length < E.saltLengthMin || salt.value.length > E.saltLengthMax) {
    throw unsupported('kdf-salt-length');
  }
  // Compare 64-bit values as BigInt before converting to JS numbers.
  if (m.value < BigInt(E.kdfMemoryMinBytes)) throw unsupported('kdf-memory-too-low');
  if (m.value > BigInt(E.kdfMemoryMaxBytes)) throw limit('kdf-memory-too-high');
  if (m.value % 1024n !== 0n) throw unsupported('kdf-memory-not-whole-kib');
  if (i.value < BigInt(E.kdfIterationsMin)) throw unsupported('kdf-iterations-too-low');
  if (i.value > BigInt(E.kdfIterationsMax)) throw limit('kdf-iterations-too-high');
  if (p.value < E.kdfParallelismMin) throw unsupported('kdf-parallelism-too-low');
  if (p.value > E.kdfParallelismMax) throw limit('kdf-parallelism-too-high');

  return {
    algorithm: 'Argon2id',
    version: v.value,
    memoryBytes: Number(m.value),
    iterations: Number(i.value),
    parallelism: p.value,
    saltLength: salt.value.length
  };
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(data); // detach from a possibly shared buffer
  return new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let k = 0; k < a.length; k++) diff |= a[k]! ^ b[k]!;
  return diff === 0;
}

/**
 * Validate the structure of a KDBX file without the password.
 * Throws VaultError (MALFORMED / UNSUPPORTED / LIMIT_EXCEEDED) on rejection.
 */
export async function preflight(input: ArrayBuffer | Uint8Array): Promise<PreflightSummary> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > LIMITS.maxFileBytes) throw limit('file-too-large');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const r = new Reader(view, 0, bytes.byteLength);

  if (bytes.byteLength < 12) throw unsupported('not-kdbx');
  const sig1 = r.u32('signature');
  const sig2 = r.u32('signature');
  if (sig1 !== KDBX_SIGNATURE_1 || sig2 !== KDBX_SIGNATURE_2) throw unsupported('not-kdbx');
  const versionMinor = r.u16('version');
  const versionMajor = r.u16('version');
  if (versionMajor !== READER_ENVELOPE.versionMajor) throw unsupported('kdbx-major-version');
  if (!READER_ENVELOPE.versionMinors.includes(versionMinor)) throw unsupported('kdbx-minor-version');

  const seen = new Set<number>();
  let cipher: Uint8Array | undefined;
  let compression: number | undefined;
  let masterSeed: Uint8Array | undefined;
  let iv: Uint8Array | undefined;
  let kdfParams: Map<string, VdValue> | undefined;

  for (;;) {
    const id = r.u8('header-field-id');
    const size = r.u32('header-field-size');
    if (size > LIMITS.maxOuterHeaderBytes) throw limit('header-field-too-large');
    if (r.pos + size > LIMITS.maxOuterHeaderBytes) throw limit('header-too-large');
    const data = r.bytes(size, 'header-field');
    if (seen.has(id)) throw malformed('header-duplicate-field');
    seen.add(id);
    if (id === HeaderField.EndOfHeader) break;
    switch (id) {
      case HeaderField.CipherId:
        if (size !== 16) throw malformed('header-cipher-length');
        cipher = data;
        break;
      case HeaderField.CompressionFlags:
        if (size !== 4) throw malformed('header-compression-length');
        compression = new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true);
        break;
      case HeaderField.MasterSeed:
        if (size !== 32) throw malformed('header-master-seed-length');
        masterSeed = data;
        break;
      case HeaderField.EncryptionIV:
        iv = data;
        break;
      case HeaderField.KdfParameters:
        kdfParams = parseVariantDictionary(data);
        break;
      case HeaderField.PublicCustomData:
        throw unsupported('public-custom-data');
      case HeaderField.Comment:
      case HeaderField.TransformSeed:
      case HeaderField.TransformRounds:
      case HeaderField.ProtectedStreamKey:
      case HeaderField.StreamStartBytes:
      case HeaderField.InnerRandomStreamId:
        throw malformed('header-kdbx3-field-in-kdbx4');
      default:
        throw malformed('header-unknown-field');
    }
  }
  const headerLength = r.pos;

  if (!cipher || compression === undefined || !masterSeed || !iv || !kdfParams) {
    throw malformed('header-missing-field');
  }
  if (hex(cipher) !== CIPHER_AES256_UUID) throw unsupported('cipher');
  if (iv.length !== 16) throw malformed('header-iv-length');
  if (compression === 1) throw unsupported('compression-gzip');
  if (compression !== 0) throw unsupported('compression-unknown');
  const kdf = checkKdf(kdfParams);

  // Header SHA-256 (unkeyed: detects transfer damage only) and header HMAC slot.
  const storedHash = r.bytes(32, 'header-hash');
  r.need(32, 'header-hmac');
  r.pos += 32;
  const actualHash = await sha256(bytes.subarray(0, headerLength));
  if (!equalBytes(storedHash, actualHash)) throw malformed('header-hash-mismatch');

  // HMAC block stream: [32-byte HMAC][int32 size][data]..., terminated by a size-0 block.
  let blockCount = 0;
  let payloadBytes = 0;
  for (;;) {
    r.need(32, 'block-hmac');
    r.pos += 32;
    const size = r.i32('block-size');
    if (size < 0) throw malformed('block-negative-size');
    if (size > LIMITS.maxFileBytes) throw limit('block-too-large');
    r.need(size, 'block-data');
    r.pos += size;
    blockCount++;
    if (size === 0) break;
    payloadBytes += size;
  }
  if (r.remaining() !== 0) throw malformed('trailing-bytes');
  if (payloadBytes === 0) throw malformed('empty-payload');
  if (payloadBytes % 16 !== 0) throw malformed('payload-not-block-aligned');

  return {
    authenticated: false,
    fileSize: bytes.byteLength,
    versionMajor,
    versionMinor,
    cipher: 'AES-256-CBC',
    compression: 'none',
    kdf,
    headerLength,
    blockCount,
    payloadBytes
  };
}
