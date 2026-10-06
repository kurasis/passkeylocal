# Backups and Independent Python Recovery

## 1. Backup unit

A backup is a consistent, self-contained encrypted snapshot: one selected HEAD locator, its exact key-epoch header, its encrypted catalog, and **every content object referenced by that catalog**, including retained versions and recycle-bin items. Files alone or a copied active directory during writes are not sufficient.

V1 exports a directory package with the same relative `HEAD.json`, `keys/`, `catalogs/` and `objects/` structure as the portable format. The backup directory name uses an opaque vault ID, UTC timestamp and random suffix, never a safe/document title. Do not add ZIP parsing to the app solely for convenience; the ZIP used to deliver this specification is unrelated to the runtime backup format. Users can copy the completed backup folder to another device.

Copy encrypted bytes only. Exclude Hello envelopes, machine settings, local GC/reachability ledgers, plaintext caches, Windows credential containers, source paths, temp files and staging. The metadata/key header and immutable catalog must match the snapshot captured at the start, even if subsequent edits or password changes occur.

## 2. Consistency and verification

Under a short store lock, pin the authenticated current snapshot and all referenced files. Create an immutable in-memory backup plan, then release the write lock so normal work may continue. A ciphertext-only backup worker receives exact opaque paths/handles, lengths and ciphertext digests, not decrypted catalog or usable keys. Pins remain until completion/cancel; retention must not reclaim any dependency meanwhile.

Use a native-authorized destination and a product-owned subdirectory. Write into a new random staging folder, using restrictive permissions where the destination filesystem supports them. Copy each dependency exclusively, flush, read back and compare its ciphertext digest/length. Publish the completed snapshot directory only after every required file verifies. Keep incomplete packages clearly marked and never count them as restorable backups. Removable/non-NTFS destinations may have different ACL/durability guarantees; document and test them without pretending the active-store guarantees apply unchanged.

A completion marker and file hashes are bookkeeping, not cryptographic authenticity. Recovery always authenticates the key header, catalog and content. Local save, backup copy verification and independent full recovery verification are separate statuses.

Default automatic policy: while the app is running, schedule a backup after a successful catalog commit, debounce bursts for 30 seconds and coalesce to the newest pending snapshot. Display which committed snapshot is protected, plus Pending/Failed states. Do not promise every edit has its own backup. Reuse verified unchanged ciphertext within a single backup package only if the package remains self-contained; no fragile dependency on files in another backup. Do not introduce cross-package hardlink tricks in v1.

Default retention: last ten completed external snapshots. This is independent of per-file version history. Delete only product-owned, explicitly tracked snapshot directories after a new one verifies, never arbitrary neighboring files or the only good backup. Manual exports are not auto-pruned. Full snapshots may consume substantial storage; estimate required bytes and report capacity/retention clearly.

A disconnected/full/read-only destination does not undo a successful local commit. Keep a bounded queue, report failure, and retry at next running/foreground opportunity. Coalescing must release superseded pins safely. Backups do not run while the app is closed or the computer sleeps. A locally written cloud folder does not establish completed cloud upload; a same-disk copy is not protection against disk failure.

## 3. Restore

Treat backup input as hostile. Authenticate the password header/catalog, validate all names and object references, and fully verify all referenced content before claiming a complete restore. A readable catalog with missing/corrupt objects is partial recovery, not success.

Restore into a separate staging safe, preserving the current safe and source backup. Show authenticated summary only after unlock and validation. After explicit replacement confirmation and a verified copy of the current state, atomically select the new restored store through the existing native state mechanism. Never edit the selected source backup in place or merge divergent safes automatically.

Invalidate local Hello enrollment on restore/replacement. A restored snapshot uses the password applicable when it was created. If a previous password/root epoch is required, explain it without searching for secrets in OS state. Corrupt current data must not cause an empty safe to replace a recoverable copy.

## 4. Python recovery utility

Extend the existing recovery directory/tool with a **file-safe-specific subcommand or module**, preserving existing password/KDBX commands and fixtures. The new format is not KDBX; PyKeePass alone does not decode it.

The utility must independently implement the documented format using PyNaCl/libsodium bindings and a maintained HKDF-SHA-256 implementation such as `cryptography`. It must not call the installed desktop executable, reuse a private Tauri service, depend on Windows Hello/TPM, or require the Rust application to be built or running. Do not implement a custom cipher. Pin tested stable Python/dependency versions and verify the exact low-level functions available. [S4]

Required conceptual CLI:

```text
file-safe-recover inspect BACKUP_DIR
file-safe-recover verify BACKUP_DIR
file-safe-recover list BACKUP_DIR
file-safe-recover extract BACKUP_DIR --output NEW_DIRECTORY
file-safe-recover extract BACKUP_DIR --file-id ID --version-id ID --output NEW_DIRECTORY
```

Adapt command names to existing CLI conventions. `inspect` prints only bounded untrusted structural information and does not call it verified. `verify` prompts for the password, authenticates everything and reports counts/status without printing private names by default. `list` explicitly reveals authenticated metadata. `extract` recovers current live files by default; explicit `--include-history` and `--include-trash` recover retained versions/deleted items into separate safe subdirectories with stable opaque suffixes.

Passwords are entered via a non-echoing prompt, never command-line arguments, environment variables or logs. If test automation needs noninteractive entry, use a narrowly documented protected input channel with synthetic passwords; do not ship fixture credentials as a universal fallback.

Provide a tested offline installation procedure and a hash-locked dependency wheel bundle or documented reproducible bundle-generation command for each declared Python/OS/architecture combination. Python on Windows x64 is mandatory; validate at least one non-Windows recovery environment to demonstrate lack of an OS key dependency. No runtime package download. Distinguish downloading dependencies beforehand from offline recovery itself.

## 5. Safe plaintext extraction

The user selects a new output directory and explicitly acknowledges plaintext output. Refuse an existing nonempty destination by default. The utility never overwrites an existing file silently, executes a recovered file, opens links or launches a viewer.

Authenticate catalog paths as metadata, but still treat them as unsafe for the destination OS. Reconstruct under the selected root using validated relative components. Reject/escape absolute paths, `..`, separators inside names, Windows device names, alternate data streams, NUL/control characters and platform-specific reserved forms. Resolve Unicode/case collisions deterministically with opaque ID suffixes; do not lose either file. Do not follow output symlinks/junctions/reparse points. Use handle-relative/no-follow semantics where available and an explicit race-resistant extraction strategy, not only `Path.resolve()` followed by an unchecked open.

Preserve original display names and mapping in an explicitly plaintext recovery report inside the chosen output directory, so sanitization is reversible. Never put this report in general logs. Use restricted permissions where supported. Restore file bytes, not original ACLs, alternate streams, executable permissions, hardlinks or arbitrary filesystem attributes.

Decrypt into exclusive temporary output files under the selected destination. Publish each final output only after final-tag, length and digest verification. If a later file fails, report Partial recovery with the verified files identified; return a nonzero status. Do not hide partial plaintext remnants after cancellation/crash; track them and provide cleanup instructions without guaranteeing secure deletion.

Bound KDF parameters, catalog sizes, frame sizes, file counts, recursion, total output bytes and allocations before processing untrusted values. Preflight expected total plaintext size/free space, allow a user-selected extraction quota and fail safely if space disappears. A malicious manifest must not trigger unlimited work or write outside the target.

## 6. Interoperability evidence

Commit synthetic fixed test vectors for Rust and Python: empty file, sub-chunk, exact-chunk, multi-chunk, Unicode names/passwords, version history, trash, password rotation and malformed/tampered inputs. Expected semantic results and byte hashes must be independent of implementation output. Deterministic test randomness is allowed only in test code, never production.

Rust writes → Python verifies/extracts and byte-compares against originals is mandatory. A Python test fixture writer should also produce valid format fixtures that Rust opens; it is not required as a user-facing recovery command. Test a multi-gigabyte file with bounded memory and a backup after root/password rotation. Delete all app/Hello metadata in the recovery test environment and recover solely from the portable backup and password.
