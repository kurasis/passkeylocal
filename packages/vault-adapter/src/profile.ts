/**
 * Fixed writer profile, supported reader envelope and product limits.
 * Values come from docs/spec/SECURITY_AND_FORMAT.md and PRODUCT_AND_ARCHITECTURE.md §7.
 * Changing any of them is a format change that needs interoperability fixtures.
 */

export const KIB = 1024;
export const MIB = 1024 * 1024;

/** KDBX outer header identifiers (canonical byte values from the KDBX specification). */
export const KDBX_SIGNATURE_1 = 0x9aa2d903;
export const KDBX_SIGNATURE_2 = 0xb54bfb67;
export const CIPHER_AES256_UUID = '31c1f2e6bf714350be5805216afc5aff';
export const KDF_ARGON2ID_UUID = '9e298b1956db4773b23dfc3ec6f0a1e6';
export const KDF_ARGON2D_UUID = 'ef636ddf8c29444b91f7a9a403e30a0c';
export const KDF_AESKDF_UUID = 'c9d9f39a628a4460bf740d08c18a4fea';
export const ARGON2_VERSION_13 = 0x13;

/** Mandatory v1 writer profile. */
export const WRITER_PROFILE = Object.freeze({
  versionMajor: 4,
  versionMinor: 1,
  cipherUuid: CIPHER_AES256_UUID,
  kdfUuid: KDF_ARGON2ID_UUID,
  argon2Version: ARGON2_VERSION_13,
  /** Bytes, as stored in the KDBX header. */
  kdfMemoryBytes: 64 * MIB,
  kdfIterations: 3,
  kdfParallelism: 1,
  saltLength: 32,
  /** 0 = no compression. */
  compression: 0
});

/** Envelope of KDF parameters accepted when reading. Writers always use WRITER_PROFILE. */
export const READER_ENVELOPE = Object.freeze({
  versionMajor: 4,
  versionMinors: [0, 1] as readonly number[],
  kdfMemoryMinBytes: 64 * MIB,
  kdfMemoryMaxBytes: 256 * MIB,
  kdfIterationsMin: 3,
  kdfIterationsMax: 10,
  kdfParallelismMin: 1,
  kdfParallelismMax: 4,
  saltLengthMin: 16,
  saltLengthMax: 64
});

/** Product v1 limits. Enforced on create, edit, import and save; never by truncation. */
export const LIMITS = Object.freeze({
  maxFileBytes: 16 * MIB,
  maxOuterHeaderBytes: 64 * KIB,
  maxEntries: 5_000,
  maxHistoryVersions: 20_000,
  maxGroups: 500,
  maxGroupDepth: 16,
  maxXmlDepth: 64,
  /** Safety ceiling for XML elements; the 16 MiB size cap bounds this anyway. */
  maxXmlElements: 2_000_000,
  maxShortText: 256, // title, custom field name, tag, group name
  maxMediumText: 4_096, // username, URL, password, custom field value
  maxNotes: 65_536,
  maxCustomFields: 64,
  maxTags: 32,
  masterPasswordMin: 16,
  masterPasswordMax: 1_024,
  /** Recovery path accepts existing passwords up to this many UTF-8 bytes. */
  recoveryPasswordMaxBytes: 4_096
});

/** Encrypted Meta/CustomData keys owned by this product. */
export const META_KEYS = Object.freeze({
  schemaVersion: 'LocalVault.SchemaVersion',
  vaultId: 'LocalVault.VaultId',
  revision: 'LocalVault.Revision',
  savedAt: 'LocalVault.SavedAt',
  lineageId: 'LocalVault.LineageId'
});

/** Encrypted entry CustomData keys owned by this product. */
export const ENTRY_KEYS = Object.freeze({
  favorite: 'LocalVault.Favorite',
  deletedAt: 'LocalVault.DeletedAt'
});

export const SCHEMA_VERSION = '1';

/** Standard KDBX string field names. */
export const STANDARD_FIELDS = Object.freeze(['Title', 'UserName', 'Password', 'URL', 'Notes'] as const);
export type StandardField = (typeof STANDARD_FIELDS)[number];
