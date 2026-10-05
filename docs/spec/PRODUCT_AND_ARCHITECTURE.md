# Product and Architecture

## 1. Goal and scope

Create a private password vault for one person. The main device is an iPhone with the application installed on the Home Screen. A desktop browser is a useful secondary interface. Each installation has its own local vault; there is no automatic device synchronization in v1.

The user must be able to create, find, view, copy, edit, and recover login credentials, inspect previous values, and export a self-contained encrypted backup. The Python recovery program must recover all supported fields and historical versions from that backup even when the website, browser storage, and development repository are unavailable.

### Required v1 features

- One active vault per browser installation; create or import/restore one.
- Master-password unlock; manual lock; automatic lock.
- Login records with title, username/email, password, URL, notes, tags, favorite status, optional expiry, and custom text/secret fields.
- Groups/folders, including a recycle bin.
- Search, filtering, sorting, duplicate titles, and Unicode data.
- Encrypted history and restore-to-current without destroying the prior current value.
- Cryptographically random password generator.
- Offline operation after a successful first installation and cache-readiness check.
- Atomic local saves, bounded encrypted rollback snapshots, external encrypted backups, backup re-import verification, and disaster recovery.
- Independent Python CLI: inspect, verify, list, show, and complete JSON export.
- Russian and English UI text; initial language from the device with a manual setting. All code documentation and development deliverables in English.

### Explicitly outside v1

Cloud accounts, backend authentication, remote vault storage, automatic multi-device sync/merge, collaboration, sharing individual credentials, TOTP generation, passkey storage, Face ID/passkey-based unlocking, PIN-only unlocking, browser extensions, native iOS Password AutoFill provider, file attachments, key files, hardware challenge-response, and password-reset services.

Do not expose incomplete versions of these features. In particular, WebAuthn authentication alone must never be presented as encryption or as a replacement for the master password.

## 2. Product experience

Use a calm, modern mobile layout: system font, clear spacing, restrained color, light/dark themes, large touch targets, readable contrast, safe-area support, and reduced-motion support. Use locally bundled icons or generated initials. Never fetch service logos or favicons using stored URLs.

Primary navigation: **Vault / Favorites / Backups / Settings**. Search stays easy to reach. History is an entry-level screen, not a developer console. A desktop layout may use a list/detail split view.

### Screens and behavior

| Screen | Required behavior |
| --- | --- |
| Welcome | Explain local storage, master-password responsibility, and external backup; offer Create and Restore. |
| Create vault | Confirm master password twice; explain that lost password plus no usable alternative means no recovery. Offer a suggested long passphrase, locally generated. |
| Initial backup | Export and re-open an empty or demonstration vault before normal onboarding completes; never ask for real passwords as test data. |
| Unlock | Masked password input, optional temporary reveal, no stored password hint; distinguish unsupported file from unlock/authentication failure. |
| Vault list | Titles and usernames only after unlock; masked passwords; groups, tags, favorites and sort. |
| Entry detail | Explicit reveal/copy buttons; URL shown as text with optional deliberate navigation; history access. |
| Edit | Explicit Save/Cancel; do not persist plaintext drafts; warn that backgrounding discards uncommitted edits. |
| History | Timestamp, changed field names, masked secret values, reveal and restore; distinguish history from a forensic audit trail. |
| Recycle bin | Restore or permanently delete; show that old backups may still contain deleted data. |
| Backups | Local-save status, external-file status, last verified revision, changes since verified backup, export and restore drill. |
| Settings | Lock interval, language/theme, encrypted history policy, storage status, password change, app version/update, recovery instructions. |

Never render a stored password or username on the locked screen. Keep document titles generic. A route may use an opaque ID, never a title, username, query, password, or note. Disable spellcheck/autocorrect/autocapitalization on secret fields. Treat browser autofill hints as hints, not a guarantee that the OS will never remember input.

### Search

Default search covers current titles, usernames, URLs, tags, notes, and non-secret custom fields. Optional per-session switches may include secret fields and history. Search runs only while unlocked; no query history, analytics, URL query parameters, persistent index, or OS search integration.

Use literal text matching, not user-supplied regular expressions. Unicode/case normalization is allowed on a transient search copy; never rewrite stored values. A history hit must clearly identify that it came from an older version. Show count/snippets only after unlock and mask secret snippets.

### History and deletion

Before an actual content change, retain a full previous entry state. Do not create a history entry for opening, copying, searching, a no-op save, or merely exporting a backup. A restore makes the chosen historical fields current and preserves the former current state as another version. Do not recursively nest histories inside history items.

Keep all history by default within the documented overall limits. If the user chooses a retention limit, show the number of versions that will be removed and obtain explicit confirmation before pruning. Never invoke library history-cleanup defaults silently. Moving to the recycle bin retains entry history. Permanent deletion removes the current logical records on the next successful commit, but is not secure erasure of browser storage, local snapshots, exported backups, or OS copies.

History is an editable local revision feature. It cannot prove who changed a password or resist an attacker replacing the entire database with an older valid file.

## 3. Stack and dependency boundaries

| Component | Decision |
| --- | --- |
| UI | React + TypeScript + Vite; CSS or a small locally bundled component layer. |
| Vault format adapter | `kdbxweb`; use supported APIs and document any narrowly scoped adapter patch. |
| Argon2id | Bundled `hash-wasm` candidate; an alternate established implementation is allowed only after identical interoperability tests. |
| Persistence | IndexedDB, preferably through a small typed wrapper. Store complete encrypted KDBX blobs. |
| Expensive work | Dedicated Web Worker for KDF and, where the integration allows it, vault parsing/serialization/search. |
| Offline shell | Small, explicitly reviewed service worker with a build-specific asset manifest. |
| Recovery | Python 3.12+ target, PyKeePass, pinned transitive dependencies, standard-library argparse/getpass/json where possible. |
| Tests | TypeScript unit tests, browser E2E tests, Python pytest, and actual iPhone acceptance tests. |

Before implementation, select exact maintained versions, examine security advisories, pin versions and integrity hashes, and commit lockfiles. The names above are candidates with relevant documented capabilities, not assertions of a completed audit. Do not use unpinned CDN code or a runtime dependency on a third-party service.

The first technical spike must prove the chosen library combination works under the production CSP and in Safari. DOM/XML parsing APIs are not automatically available in Web Workers: provide a compatible, reviewed bundled parser where required, or document a tested design with only KDF in a worker. Do not invent a DOM shim casually. A worker is a responsiveness and lifetime boundary, not protection against same-origin malicious JavaScript.

Use a separate deployable origin for the vault. Do not share it with a blog, CMS, uploads, arbitrary user content, or unrelated apps. Paths under one origin are not independent security boundaries.

## 4. Encrypted data model

Map ordinary fields to standard KDBX fields, not to a proprietary JSON string containing the entire database.

| Product concept | KDBX representation |
| --- | --- |
| Stable entry identity | Entry UUID, retained across edits/restores. |
| Folder identity and hierarchy | Group UUID and parent group. |
| Title / login / password / URL / notes | Standard Title / UserName / Password / URL / Notes fields. |
| Tags | Standard entry tags. |
| Custom fields | Standard string fields with a protected/unprotected flag. |
| Created/modified/expiry times | Standard entry timestamps and expiry flags. |
| Prior entry states | Standard entry History collection. |
| Recycle bin | Standard recycle-bin group and metadata. |
| Favorite and product-only data | Namespaced CustomData in the encrypted payload. |

All of the above, including fields marked unprotected for the inner field mechanism, remain inside the encrypted outer payload. The inner protected flag is not permission to write the value to plaintext storage or logs.

Define the following encrypted Meta/CustomData keys:

- `LocalVault.SchemaVersion`: decimal string `1`.
- `LocalVault.VaultId`: a random UUID; independent of the installation ID.
- `LocalVault.Revision`: non-negative decimal integer incremented on each content/settings commit.
- `LocalVault.SavedAt`: UTC RFC 3339 timestamp.
- `LocalVault.LineageId`: random UUID identifying the current editing branch.

Encrypted entry CustomData may contain `LocalVault.Favorite` (`true`/`false`) and `LocalVault.DeletedAt` (UTC RFC 3339 or absent). Define all new keys before adding them, preserve unknown supported custom data, and never place product secrets in the public outer header.

Use KDBX's normal UUID and time encodings through the library. JSON recovery output converts them to the explicit portable representation in the recovery document. Preserve empty strings and distinguish them from missing custom fields. Reject invalid Unicode scalar sequences rather than replacing characters silently. Master passwords have a separate exact-byte policy in the security document.

## 5. Local persistence and concurrency

IndexedDB contains only encrypted vault blobs and minimal operational metadata: opaque IDs, byte lengths, blob hashes, local generation, commit timestamps, and backup status. Theme/language may be plaintext preferences. Vault titles, entry counts, folder names, and record data must not appear in a plaintext metadata cache. Time/size/generation metadata leakage is an acknowledged tradeoff.

Suggested stores:

- `vault_heads`: opaque installation slot, active blob reference, local generation, format marker.
- `vault_blobs`: immutable ciphertext blobs keyed by opaque ID; current plus rollback versions.
- `backup_receipts`: external export attempt/verification metadata, blob hash, timestamp, and local generation.
- `preferences`: non-secret UI settings and schema version.

Keep only one logical writer at a time. Web Locks may be used when supported, but correctness must not depend on them. The authoritative commit uses an IndexedDB readwrite transaction with a generation compare-and-swap. If the current head is no longer the generation the editor opened, abort and offer reload/export of the candidate; never silently overwrite another tab.

Use an available cross-tab channel to propagate lock and head-change notifications without record content or keys. A received message may invalidate a session; it must never authorize unlock or substitute for the transaction check. Hidden tabs are already required to be locked.

### Save transaction

1. On Save, validate fields and limits; form a candidate in memory and update history/revision exactly once.
2. Serialize to a fresh encrypted KDBX blob, using the standard library's fresh randomness. Verify that the output can be fully re-opened and authenticated before considering it a candidate for commit.
3. Outside any IndexedDB transaction, complete the expensive cryptography. Do not hold a transaction open while awaiting KDF work.
4. In a short readwrite transaction, compare the expected generation, insert the new immutable blob, preserve the prior head as rollback data, and change the head atomically.
5. Report **Saved on this device** only after transaction completion. A successful put request alone is insufficient.
6. Read back and compare the committed blob hash. If read-back fails, mark storage unhealthy, preserve candidates, and offer encrypted export; do not falsely mark a backup as complete.

If any step fails, the old committed head remains usable. A failed save must leave an explicit unsaved/error state, with Retry and encrypted export of a validated candidate when available. Never delete old data to make a failing write appear successful.

An interrupted transaction may leave either the old or new valid revision, but never a partially written current vault. A transaction that actually committed just before suspension is authoritative on reopening. UI messages must not claim an unsaved draft survived unless it did.

Default rollback retention: current head plus up to five previous committed blobs, with a total rollback-only budget of 80 MiB. Prune oldest rollback copies only after a new commit has completed; never prune the current head. A local snapshot is still vulnerable to whole-origin deletion. The user may export any accessible snapshot. Password-change handling is specified separately.

## 6. Offline shell, startup and updates

An HTTPS origin hosts immutable, versioned static assets. Cache HTML/app shell, JavaScript, styles, icons, WASM and all dependencies needed for a cold offline unlock. Confirm offline readiness before showing “Ready offline.” No font, wordlist, dependency, or cryptographic asset may be downloaded on demand during unlock.

Use IndexedDB for vault bytes, never Cache Storage. Cache Storage contains only application assets. Service workers never receive decrypted records, passwords, or keys.

The page starts locked after reload, restoration from back/forward cache, or app process restart. Handle schema/version mismatch without changing the original database. On migration, preserve an exportable old ciphertext, create and validate a new candidate, then switch atomically. Do not mutate the sole copy in place.

An available app update is shown while locked and applied after explicit user action. Do not use unconditional skipWaiting/reload during editing. Keep old required assets until the new complete shell is usable; clean up only known app-asset caches. No update routine may clear IndexedDB to “fix” errors.

Browser-managed service-worker update fetches can still occur. The update UI and asset hashes do not make a hostile hosting origin trustworthy. The security document explains this residual risk.

## 7. Limits and performance targets

Initial target: iOS/iPadOS 17 or later with required capabilities, with an actual certified device/OS matrix recorded before release; current desktop Safari, Chromium and Firefox as secondary targets. Do not claim support for an untested iOS version merely because a desktop WebKit test passed.

Product v1 limits (apply consistently in UI, import, Python and tests):

- 5,000 live/recycled entries combined; 20,000 historical versions total; 500 groups.
- Group nesting depth 16; XML nesting safety ceiling 64.
- Title/custom-field name/tag: 256 Unicode scalar values; username/URL/password/custom-field value: 4,096; notes: 65,536.
- Up to 64 custom fields and 32 tags per entry; limits also apply to history.
- Master password: 16–1,024 Unicode scalar values for newly created vaults, excluding NUL/CR/LF; nonempty existing compatible passwords may be used to recover data subject to the bounded recovery-input rule.
- Serialized KDBX input/output: maximum 16 MiB. No attachments or compression in the v1 interchange profile.

At these limits refuse the new operation clearly; do not truncate, silently prune history, or degrade cryptography. Test memory usage, because parsed XML and JS objects can consume far more memory than the file size.

On a documented physical baseline iPhone, target ordinary search response under 150 ms for 1,000 entries, and responsive progress/cancel UI during unlock/save. Measure KDF, serialization and save/re-open verification separately. Prefer a 0.5–3 second unlock target; do not lower the required KDF just to meet this aspirational timing. Record actual large-vault timings, and state the tested scale honestly.

## 8. Implementation sequence

1. **Interoperability and safety spike:** standard-format fixtures, browser export to Python verification, resource-limit preflight, strict CSP/WASM test, and real-iPhone external export/re-import.
2. **Durability core:** atomic encrypted writes, concurrent-tab conflicts, lock lifecycle, failed-write recovery, offline cold start.
3. **Recovery deliverable:** Python CLI, complete JSON export schema, offline installation kit and user disaster-recovery guide.
4. **Product UI:** credentials, search, history, groups, recycle bin and generator over the already-tested storage layer.
5. **Release hardening:** dependency review, synthetic leakage tests, malformed-input corpus, physical-device evidence and deployment instructions.

Do not use real user credentials in development. Do not report the PWA as ready for real secrets until all critical gates have passed and remaining limitations are disclosed.
