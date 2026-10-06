# Encryption, Portable Format and Safe Storage

## 1. Design and threat model

Use maintained cryptographic implementations, not custom primitives: libsodium XChaCha20-Poly1305 AEAD, libsodium secretstream for file content, explicitly selected Argon2id for password derivation, and HKDF-SHA-256 for purpose-separated subkeys. Use a maintained compatible Rust binding; the independent Python implementation uses PyNaCl and a maintained HKDF implementation. Pin actual stable versions after repository inspection. Do not assume a generic ChaCha20-Poly1305 API accepts XChaCha20's 24-byte nonce. [S1, S2, S3, S4]

This is a new application container format built from standard primitives, not an externally audited format. Its serialization, binding, transactions and recovery must be reviewed and tested. The concrete format below is the v1 baseline; do not independently improvise Rust and Python layouts. Freeze a matching machine-readable schema and fixtures before importing real data. If the actual repository already supports a suitable reviewed format, propose compatibility-preserving reuse first.

Protect content and logical metadata from an attacker who obtains the locked encrypted files/backups without a valid credential. Detect content/catalog corruption and substitution. Constrain untrusted document parsers separately. Do not claim to prevent deletion/denial of service, full-state rollback, traffic/size analysis, screenshots or a compromised OS/application from reading secrets during unlock.

Opaque disk names hide logical filenames. Physical object counts, ciphertext sizes, directory activity and OS timestamps remain observable. No padding or size-hiding guarantee in v1. Hashes of plaintext and search indexes are encrypted metadata, not public filenames.

## 2. Keys and credentials

Create a random 32-byte root key using the OS/libsodium CSPRNG, independent from all password-manager keys. Each content version receives a fresh random 32-byte object key and random 16-byte object ID. No deduplication or deterministic encryption in v1.

Derive the password wrapping key with libsodium `crypto_pwhash`, selecting `crypto_pwhash_ALG_ARGON2ID13` explicitly, output length 32, random salt length 16, default opslimit 3 and memlimit 67,108,864 **bytes** (64 MiB). Do not use a moving ALG_DEFAULT value as the file-format definition. Password encoding is UTF-8 without normalization, trimming, case folding or implicit NUL termination. Preserve all password bytes and impose a documented maximum of 1,024 UTF-8 bytes. The new-safe UI should encourage a strong generated or long unique passphrase and confirm it before creation.

V1 accepts opslimit 3–10 and memlimit 64–256 MiB, integer multiples of 1 MiB. Validate these bounds and all lengths before KDF allocation. Creation may choose a stronger supported profile based on measurement, never a weaker hidden downgrade. Record parameters in each portable key header. A future larger profile needs a documented compatibility update, not unbounded attacker-controlled allocation.

Derive a catalog key of 32 bytes using HKDF-SHA-256 with IKM=root key, salt=raw 16-byte vault ID, and info=ASCII `file-safe/catalog/v1`. HKDF uses the standard extract-and-expand construction. Never use the catalog key as an object or password-wrapping key.

Every password change rotates the root key and 16-byte key-epoch ID, writes a new password header and re-encrypts the complete current catalog, including keys for retained versions. Existing immutable file objects need not be rewritten: prior backups already expose those same historical contents to their old credential. Future imported/replaced versions always receive new random keys; the previous root must not decrypt new catalog generations. Invalidate Hello enrollment and password-derived caches. Retained older backup/rollback generations keep their original passwords; rotation cannot revoke copies an attacker already obtained.

V1 has password recovery only, plus optional local Hello convenience unlock. Do not add a hidden rescue password, password hint, universal recovery key or dependency on a server. If the password and all usable enrollment material are lost, there is no promised recovery. A separate printable recovery-key slot may be a later explicitly designed extension.

## 3. Disk organization

Resolve a stable per-user local application data directory through Windows APIs. Keep active storage on a supported local filesystem; v1 acceptance targets NTFS. Do not use a cloud-synced folder, network share or the installation directory as the active store. External backup destinations are separate.

Logical layout:

```text
file-safe/<vault-id>/
  HEAD.json
  keys/<epoch-id>.key
  catalogs/<snapshot-id>.cat
  objects/<object-id>.obj
  staging/<random-id>.part
```

IDs in paths are 32 lowercase hexadecimal characters representing random 16-byte values. Object/catalog/key files are immutable after creation. HEAD is a small untrusted locator, not proof of authenticity: strict JSON with only `format_version: 1`, `vault_id`, `key_epoch_id`, and `snapshot_id`, maximum 1,024 bytes. All IDs must match authenticated file headers and catalog contents. A tampered pointer may select an older valid snapshot; this is not global anti-rollback protection.

Windows ACLs restrict active files, staging, rollbacks and envelopes appropriately for the user. Use native-authorized handles and safe relative names, not string-prefix path checks. Reject reparse-point traversal and unexpected alternate streams, device paths, hardlink/path races or substituted destinations where relevant. Do not grant the preview process directory access.

## 4. Binary and metadata format v1

All integers in binary headers are unsigned little-endian. Concatenation below means exact raw bytes without implicit separators. All magic values are the eight ASCII bytes shown. AEAD is libsodium XChaCha20-Poly1305-IETF, with a 32-byte key, fresh random 24-byte nonce and 16-byte authentication tag. Ciphertext includes the tag.

### Password header: exactly 140 bytes

| Field in order | Size |
| --- | --- |
| Magic `FVKEY001` | 8 bytes |
| Vault ID | 16 bytes |
| Key-epoch ID | 16 bytes |
| Argon2id opslimit | uint32, 4 bytes |
| Argon2id memlimit in bytes | uint64, 8 bytes |
| Argon2id salt | 16 bytes |
| AEAD nonce | 24 bytes |
| Encrypted root key plus authentication tag | 48 bytes |

AEAD key is the password-derived wrapping key. Plaintext is exactly the 32-byte root key. Associated data is the first 92 bytes of the header, including the nonce. Reject incorrect length, trailing bytes, unsupported magic or out-of-range parameters before unlock. Authentication failure never creates an empty safe.

### Encrypted catalog

Header: magic `FVCAT001` (8), vault ID (16), key-epoch ID (16), snapshot ID (16), nonce (24), ciphertext length uint64 (8), followed by exactly that many ciphertext bytes. Associated data is the complete 88-byte header. Encrypt under the derived catalog key.

Plaintext is strict UTF-8 JSON: reject duplicate keys, malformed UTF-8, invalid integer ranges, excessive nesting and unknown required schema versions. Integers representing sizes/counters are exact; do not round through JavaScript floating point. Maximum plaintext catalog size is 64 MiB, checked both before encryption and before allocation on read. Ciphertext length must therefore be 16 through 67,108,880 bytes. No compression in v1.

The frozen catalog schema must contain:

- Schema version, vault ID, key-epoch ID, snapshot ID, uint64 commit sequence and prior snapshot ID or null.
- Virtual folders with opaque IDs, parent IDs and names; root parent is null, no cycles.
- Logical file IDs, folder ID, name, tags, notes, favorite flag, created/modified UTC timestamps, deleted/recycle-bin state and current-version ID.
- Each retained version's ID, object ID, 32-byte key encoded as standard padded Base64, uint64 plaintext byte length, lowercase SHA-256 hex digest, timestamp and bounded media hint.
- Policy values needed to interpret retention/history; no absolute machine paths or Hello material.

Specify exact field names, timestamp syntax, optional fields and limits in a checked-in JSON schema before both implementations are written. Require graph integrity, unique IDs, bounded names/notes/tags, one current version per live file and known object references. V1 limits: 50,000 logical files, 100,000 retained versions and depth 64, additionally bounded by the 64 MiB catalog limit. Reject a limit breach without truncation. Search data is built in memory from this catalog and cleared on lock. Do not add a plaintext SQLite database, journal or WAL.

### Content object

Header: magic `FVOBJ001` (8), vault ID (16), object ID (16), secretstream header (24), total 64 bytes. Use libsodium `crypto_secretstream_xchacha20poly1305` with the version's random object key.

Frames are a uint32 ciphertext length followed by exactly that ciphertext. Maximum plaintext chunk is 1,048,576 bytes (1 MiB); secretstream overhead is 17 bytes. Before allocation accept only lengths 17 through 1,048,593. Associated data for each frame is the full 64-byte object header, followed by the zero-based uint64 frame index and the uint32 encoded ciphertext length. This binds identity, framing and position to authentication.

All nonfinal frames have exactly 1 MiB plaintext and TAG_MESSAGE. Exactly one last frame has TAG_FINAL, with 0 through 1 MiB plaintext. An empty file has one empty final frame. A writer may finish an exact multiple of the chunk size with an empty final frame; both readers must support it. No other tag values, missing final frame, data after final, trailing bytes, duplicated/reordered frame or length overflow are accepted. Require final plaintext length and SHA-256 to match the authenticated catalog before reporting full verification.

Maximum file size in v1 is 1 TiB (1,099,511,627,776 bytes), subject to free-space and quota checks. Use 64-bit counters end-to-end. The storage/import/export path must stream with bounded memory; this limit does not mean a 1 TiB file can be previewed. Preview has much smaller limits.

Catalog/header corruption may prevent recovery of names and object keys. Opaque object files alone are not sufficient to recover a safe. Backups must include the matching key header and authenticated catalog, not just the objects directory.

## 5. Commit and import protocol

1. Acquire the safe's write lock and verify the expected current HEAD/revision. A second instance or external change must cause conflict, not overwrite. Single-instance UI is not a substitute for native locking.
2. Authorize source handles via native dialog/drop handling. Import only regular file bytes. For folder import, do not follow reparse points, symlinks or junctions by default; report skipped files. Read stable handles and detect size/identity/time changes; retry or report a changing source. Do not claim a snapshot of a concurrently edited source.
3. Create random encrypted staging objects with restrictive ACLs; stream, hash, flush and verify them by rereading/authenticating. No source plaintext temp file. For large files show separate encryption and verification progress; retain a bounded number of concurrent I/O jobs, default one.
4. Move verified objects into immutable final names using no-overwrite operations on the same volume. Write/flush/reread the new encrypted catalog and, when needed, key header. Check that all its referenced objects exist and are pinned.
5. Commit by safely replacing HEAD only after dependencies are durable under the documented Windows filesystem strategy. Preserve a prior valid locator. Handle first creation and partial replacement failures explicitly; never delete-current-then-rename. Do not assume flushing alone guarantees survival against all hardware/power faults.
6. Only then report Saved. If UI crashes after commit, the committed revision remains authoritative. Queue a pinned ciphertext snapshot for backup separately. Garbage collection runs only after commit verification and cannot delete pinned or retained generations.

Use immutable generation-specific key headers so a password change and catalog change can be selected together with one HEAD commit. Keep current plus five prior committed catalog locators for local recovery by default. Password changes can leave those prior locators decryptable under earlier passwords; explain retention rather than claiming retrospective revocation. Never delete the sole known recoverable generation to make room for a failed write.

Restart scans bounded known recovery/staging locations and offers valid current/prior snapshots. Do not choose the newest filename blindly or initialize an empty safe after authentication failure. Catalog sequence/hash chains can detect some local inconsistencies but cannot prove freshness against replacement of the entire directory with an older valid backup.

Object garbage collection is reachability-based over current catalog, retained local catalogs, recycle-bin/history content and in-flight backup/preview references. Track key epochs needed by retained catalogs. A failed backup cannot let pruning delete its pinned source. No recursive delete over user-selected directories. Never equate logical deletion, TRIM or removing an encrypted key file with guaranteed physical erasure.

Prior catalogs can become unreadable with the current password after root rotation. Preserve their known object sets in a bounded local reachability ledger encrypted under the current root, or conservatively retain all potentially referenced objects until the old generations are explicitly retired. Never interpret inability to decrypt an older catalog as an empty reference set. The ledger is local maintenance metadata, excluded from portable backups and unnecessary for decryption/recovery; losing or distrusting it disables destructive GC until reachability is re-established. Publish/update it safely with the relevant catalog commit, or conservatively retain on ambiguous state. Do not keep an old plaintext root key merely to enable cleanup.
