# Product and Existing-App Integration

## 1. Scope

Target the existing Windows 11 x64 application first, using the current Tauri 2 frontend and a Rust file-safe service. Keep the same repository, package manager, workspace conventions and release process. The web/PWA remains a password manager in this increment; do not add a large-file web implementation or silently change its storage quota requirements.

Implement:

- One independently locked file safe per Windows profile in v1, unless the existing app already has a suitable multi-vault model.
- Create/unlock/lock, import ordinary files and folders, organize virtual folders, rename, tag, favorite and add short notes.
- Search names, tags and notes while unlocked. No full-text document indexing, OCR or cloud search in v1.
- Read-only PDF, JPEG/PNG and plain-text preview with the restrictions in the viewer document.
- Store other formats as opaque bytes; export only by explicit action. No automatic archive unpacking.
- Replace a file with a new immutable version, version restore, recycle bin and explicit permanent removal.
- Verified local commits, separate encrypted backups and independent Python recovery.
- Kensington/Windows Hello quick unlock after explicit per-safe enrollment.

Exclude mounted/virtual drives, filesystem drivers, shell preview handlers, Explorer integration, Office editing, executable launching, synchronization/merge, sharing, network APIs, AI document processing and a new cloud account system. No background Windows service, autostart or global shortcuts are needed.

## 2. Discover before changing

Follow AGENTS.md and existing contribution instructions. Preserve unrelated worktree changes. Record baseline commit, build commands, web deploy paths, storage adapters, lock controller, Windows Hello provider, Python utility, installed versions and known failures in `docs/file-safe/BASELINE.md` or the repository equivalent.

Run the current web/desktop tests and build. Identify existing safe-write, native-dialog, capability and backup utilities before writing another implementation. Reuse audited generic mechanics, but give the new vault its own data and permissions. If an existing encrypted file-safe implementation is discovered, evaluate its format and migration implications before replacing it with this proposed v1 design.

No real files, personal documents, real master passwords, fingerprints or production vaults may be used as fixtures or uploaded to CI. Use synthetic files with recognizable canary strings for privacy tests.

## 3. UI

Add a File Safe navigation item using the current design system. The locked screen reveals only a generic label and actions to unlock, recover or locate an encrypted backup. No filenames, notes, thumbnails, search results, recent-document titles or document counts should remain visible after locking.

The unlocked screen uses a folder/sidebar plus a virtualized file list/grid and an optional details/preview pane. Provide sort/filter, multi-select, import progress, cancel, tags, favorites, file version history, recycle bin, backup status and keyboard navigation. Show relative logical paths rather than leaking absolute source paths. Store source paths only for the active import operation, not as permanent metadata by default.

Import is **copy into safe**. Explain that the original stays in its original location. Do not delete it automatically or promise secure deletion from SSDs, cloud history or backups. Verify a successfully imported version before acknowledging it. Show per-item outcomes for partial multi-file imports. An explicit Replace action is required to add a version to an existing logical file; same names must not silently overwrite.

Export creates an unencrypted copy at the selected destination. Name the action clearly and disclose that this copy remains outside the safe. No Open in external app, print, document-link navigation or drag-out plaintext export in v1. Clipboard copying of document content is off by default; if supported later, require an explicit action and the existing clipboard policy.

Version history defaults to current plus ten previous content versions per file. Recycle-bin items are retained until explicit emptying in v1. Show retained storage usage before pruning. Metadata edits create a new catalog snapshot, not a duplicate content object. Restoring a prior content version is a new catalog operation; it never overwrites historical ciphertext in place. Old backups may retain deleted files.

## 4. Native boundary

Rust owns the file-safe root/object keys, key derivation, crypto, encrypted catalog, object I/O and backup transactions. Unlike the existing password engine, there is no reason to put file-safe root keys or complete document bytes into the main WebView.

The frontend receives only bounded display metadata while unlocked, operation statuses and validated preview output. Use narrow typed commands such as status, create/unlock, list/search, authorize_import, import_selected, request_preview, export_selected, replace_version, restore_version, backup and lock. Names are illustrative. Resolve paths from native dialog-authorized handles and opaque IDs; never authorize arbitrary renderer paths or accept a generic native decrypt command.

Windows capabilities must explicitly restrict custom app commands as well as plugins. No remote origin or wildcard window permissions. A viewer cannot invoke these commands. Verify native session generation, operation state, limits and object membership on every request. A UI boolean is not an authorization boundary. Preserve normal master-password entry through the trusted app UI; clear its transient copies and never persist or log it.

Keep separate file-safe and password-vault data directories, crypto contexts, Hello envelope/key identifiers and backup manifests. Native code may share utilities, never root keys. Do not derive the file-safe root from the password KDBX key or store its only recovery credential inside that database. The user can choose the same passphrase, but cryptographic salts and random keys must remain independent.

## 5. Lock lifecycle and operations

Default file-safe inactivity lock: five minutes, or a stricter existing policy. Allow a shorter interval. Lock on explicit action, Windows session lock/user switch, suspend, and minimization if that matches existing policy. Global Lock All locks both modules. Unlocking either module does not unlock the other.

On lock: redact the UI immediately, increment the native session epoch, cancel queued previews, terminate the viewer job, revoke transferred handles, clear metadata/search results and dispose usable key/plaintext buffers. Clear native buffers where feasible; do not claim perfect erasure from OS-managed memory or GPU resources.

Lock cancels ongoing plaintext import/decryption/export work at bounded checkpoints. An already fully prepared ciphertext-only commit may finish safely; its callback must not unlock or repopulate UI. Import parts not yet committed remain encrypted staging and are cleaned up later. A canceled explicit plaintext export may leave a partial file after a crash; track and clean it best-effort, with an honest status. Never delay session locking for a long-running file operation.

The auto-backup copier may finish a previously pinned ciphertext snapshot after lock; it receives no live keys or catalog plaintext. On shutdown, preserve the last committed snapshot instead of relying on an asynchronous final save.

## 6. Kensington and Windows Hello

Use the existing native Windows Hello integration if it passes the required protection tests. The selected product is Kensington VeriMark Desktop Fingerprint Key; record the actual SKU/revision and driver, not just a family name. Enroll fingerprints in Windows Settings, not in this app. Do not capture templates, implement matching or require a vendor SDK.

Enrollment is independent for the file safe and requires a successful file-safe master-password unlock. Protect the random root key in a purpose-bound local envelope associated with vault ID, key epoch, Windows user/device and enrollment ID. Do not reuse the password vault's envelope or imply that a prior password-vault Hello prompt authorizes this safe.

The native secret-unwrapping operation itself must require Windows Hello authorization and verified non-exportable TPM-backed key protection. A successful UserConsentVerifier response followed by reading a generally accessible secret is insufficient. A TPM-present flag alone is not evidence that the specific key is hardware protected. Require the existing provider proof or produce one before enabling the feature. Never silently fall back to software-only key storage.

Keep two opt-in modes: session-only quick unlock, with the protected envelope retained only until process exit; and Remember on this computer, with a persistent protected envelope and a maximum default 24 hours since master-password verification. Expiry is local application policy, not rollback-proof hardware time. Require fresh authorization per unlock and a password when state is uncertain.

Windows Hello can accept PIN or other configured methods. Do not promise fingerprint-only access, a particular enrolled finger or possession of one specific USB reader. Unplugging Kensington is not a cryptographic revocation mechanism. A missing/blocked reader must leave master-password access available.

Associate owned authentication dialogs with the real host window. Keep the safe redacted while the prompt runs; ordinary focus transfer to that dialog must not invalidate its own request. Session lock, suspend, timeout and explicit cancellation must invalidate stale results. Recheck the epoch after every asynchronous authorization.

Do not automatically disable Enhanced Sign-in Security, VBS or related protections to make an external reader work. Windows Hello certification alone does not establish ESS compatibility. Test the actual reader/driver/Windows combination and report incompatibility without changing OS policy.

Invalidate enrollment on password/root-key change, safe replacement/restore, known key reset, account change or revocation. Deleting only a UI setting is not cryptographic revocation: remove app-owned envelopes/protection keys, report failures and test stale-envelope replay. Never delete system fingerprint enrollment or unrelated keys.

The file safe and its backups remain recoverable by master password without the reader, Windows account, TPM or application. Windows Hello is an alternative unlock path, not mandatory second-factor protection for portable encrypted backups.
