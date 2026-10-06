# Windows Extension Specification

## 1. Objective and boundaries

The user already has a working password-vault PWA. Add a Windows application efficiently, preserving the existing product and keeping both targets in one GitHub repository. The selected stack is **Tauri 2 + the existing web frontend + Rust for Windows platform operations**. On Windows, Tauri uses WebView2.

Expected existing technologies, to verify rather than assume: React, TypeScript, a static frontend build such as Vite, a browser/WASM KDBX engine, encrypted IndexedDB storage, search, history, backup import/export and an independent Python recovery utility. Do not substitute these assumptions for reading the repository.

### In scope

- A Windows 11 x64 desktop target with a per-user installer.
- Reuse of the existing design/components, records, groups, search, history, localization and validation.
- Native encrypted file persistence, save-conflict detection, local rollback copies, external backup folders, import/export and recovery.
- Offline operation using packaged code and dependencies.
- Desktop keyboard/layout adaptation, lock/session handling and safe application lifecycle.
- Separate web and Windows builds, tests and release artifacts in the same repository.
- Compatibility tests against existing web versions and the Python tool.
- Opt-in Windows Hello quick unlock using Kensington VeriMark Desktop and TPM-backed protection, as specified in [WINDOWS_HELLO_KENSINGTON.md](WINDOWS_HELLO_KENSINGTON.md).

### Outside this increment

Automatic cross-device synchronization/merge, cloud accounts, a new server, native iOS packaging, macOS/Linux releases, global hotkeys, a browser extension, YubiKey/FIDO2 unlocking, fingerprint-only enforcement, background Windows services, autostart, file associations and a rewrite of the cryptographic engine in Rust. These may be later separately reviewed tasks.

Do not add Electron, a Node.js runtime, a Python sidecar, or a local HTTP server just to host the frontend. The recovery tool stays an independent emergency utility, not a required runtime component of the desktop app.

## 2. Required repository discovery

Before editing, follow applicable AGENTS.md/contribution instructions and record the current commit and worktree state. Preserve unrelated user changes. Do not reset, overwrite, force-push or delete an existing web implementation.

Create `docs/windows/BASELINE.md`, or the repository's equivalent, recording:

| Area | Facts to discover |
| --- | --- |
| Frontend | Framework, package manager, lockfile, scripts, output directory, router, base path and PWA plugin. |
| Vault engine | Actual library versions, KDBX/profile/schema, password encoding, limits and compatibility fixtures. |
| Persistence | Where IndexedDB calls occur, save transaction semantics, local snapshots and platform coupling. |
| Backup/recovery | Export file format, verification behavior, Python code/tests and offline setup. |
| UI/lifecycle | Existing lock policy, clipboard rules, unsaved changes, desktop responsiveness and localization. |
| Windows Hello | Existing native host/provider code, engine unlock-material interface, TPM evidence, sensor SKU/driver, Windows build and ESS compatibility. |
| Deployment | Existing GitHub Actions, Pages/other hosting settings, paths, secrets names without values, release tags and artifacts. |
| Tests | Working baseline commands, failures already present, supported browsers and physical-iPhone evidence. |

Run the current web build and relevant tests **before** refactoring. Create representative synthetic vault fixtures through the existing app and retain expected semantic output. Do not ask the user to provide real passwords or a real vault for testing.

If the repository differs from earlier design documents, document the difference. Do not silently change its file format, password policy, KDF, UI framework or package manager to match an older plan. A security-critical defect or necessary incompatible migration must be raised with a concrete proposal before changing compatibility. Continue safe additive work where possible.

## 3. One repository, one frontend source

Choose the smallest integration that fits the actual layout.

**If the project is a single frontend at the repository root:** keep it there, add `src-tauri/`, and extract only genuinely platform-dependent modules. Do not introduce a workspace manager or move the whole app just to make a monorepo diagram look tidy.

**If the repository is already a workspace:** follow its conventions. Add a thin desktop host such as `apps/desktop`, referencing the same shared frontend/domain packages. Avoid a copied `apps/windows/src` UI that will diverge from the web app.

The following is a directory-responsibility table, not a mandatory migration plan:

| Responsibility | Typical location |
| --- | --- |
| Existing screens/components/styles | Current frontend source, unchanged where possible |
| Shared vault/domain interfaces | Existing core package, or a small extracted module |
| Browser implementation | Existing web modules behind a platform adapter |
| Desktop adapter/bootstrap | A new isolated frontend module/build entry |
| Rust host, native I/O, capabilities | `src-tauri/` in the chosen desktop project |
| Python recovery utility | Its current repository directory |
| Cross-target fixtures/tests | Shared test corpus, not duplicate copies |
| Windows documentation | `docs/windows/` |
| Desktop CI | New or extended workflows under `.github/workflows/` |

Preserve the existing lockfile and package manager. Add Cargo.lock for the desktop application. Do not upgrade unrelated major dependencies during the port. Pin the selected compatible Tauri 2/Rust/plugin versions and inspect security advisories.

## 4. Platform boundary and reusable logic

Move environment-specific operations behind typed interfaces. Adapt existing abstractions if present rather than adding a parallel framework.

| Shared responsibility | Browser adapter | Desktop adapter |
| --- | --- | --- |
| Load/save encrypted vault bytes | Existing IndexedDB transaction model | Narrow native file service |
| Import candidate file | Browser file picker | Native picker returning validated bytes/opaque handle |
| Export encrypted bytes | Download/share workflow | Native save dialog and verified write |
| Backup destination | User-directed external export | Explicitly selected managed backup folder |
| Lifecycle lock signals | Visibility/page/session events | Existing events plus native session/power events |
| Copy a selected value | Existing browser clipboard behavior | Restricted clipboard operation if needed |
| Updates | Existing PWA update mechanism | Manual installed-app update initially |
| Quick unlock | Existing web behavior, no new biometric requirement | Native Windows Hello protected-secret adapter |

Suggested conceptual contract: `loadVault`, `commitVault(expectedToken, ciphertext)`, `pickImport`, `exportBackup`, `getBackupStatus`, and `subscribeLifecycle`. Do not make arbitrary readFile/writeFile/exec APIs the application's public platform interface.

Keep encryption/format work in the existing tested TypeScript/WASM engine for this increment. Rust owns file operations, locks, safe path authorization, backup scheduling, native events and the Windows Hello protected-secret adapter. Windows Hello enrollment/unlock adds a narrowly scoped flow of credential-equivalent secret material between the shared engine and native protection layer; minimize its lifetime and audit this new boundary. Do not introduce a generic secret-read IPC command. A candidate must be authenticated/parsed by the shared engine before a normal commit.

This choice maximizes reuse but leaves decrypted data and necessary key material in the WebView/worker while unlocked. State that tradeoff explicitly. Native storage alone does not make the cryptographic engine native or hardware-isolated. A later move to a maintained Rust KDBX library requires separate parity, security and recovery tests; do not write custom cryptography now.

UI components should not import Tauri directly. Select adapters through a build-specific entry or alias. Dynamic feature checks are convenience, not authorization; Rust enforces permissions independently. The production web bundle must not execute desktop bootstrap, call IPC or require Tauri initialization.

## 5. Two builds without breaking the PWA

Keep the existing web scripts and deployment output contract. Add clearly named commands, adapting syntax to the existing package manager:

```text
web:dev / web:build / web:test     # aliases only if useful; old scripts still work
desktop:dev                      # Tauri dev with a desktop-mode frontend
desktop:frontend                 # builds bundled assets for Tauri only
desktop:build                    # Windows release installer
desktop:test                     # desktop-specific tests
test:interop                     # shared file compatibility suite
```

Use separate output directories (for example the existing web `dist/` and a new `dist-desktop/`). A desktop build must not replace a web deployment's files. Running both development targets concurrently must not collide on ports, output cleanup or test profiles.

Tauri's frontend build hook calls the frontend-only command, never the enclosing `desktop:build` command recursively. Keep target selection explicit and reproducible in local development and CI.

The desktop production bundle includes local HTML, JS, styles, WASM, icons, translations and any wordlists. Configure `frontendDist` to these built assets; no production `devUrl` or live website URL. The desktop process needs no website availability to unlock a vault.

Do not register a service worker in the desktop target. Do not delete or globally disable the web service worker to achieve this. PWA manifest/update code belongs to the web build only. Desktop updates replace installed application assets, not a worker cache. If a development WebView profile previously registered a service worker, use isolated development/test profiles and scoped cleanup; never clear user vault data as a shortcut.

Check router base paths, asset URLs, workers, Web Crypto secure-context behavior and WASM loading under the actual packaged Tauri origin. Do not assume that a page working at HTTPS in Safari automatically works unchanged under the desktop asset protocol. Do not add a localhost server as the default workaround.

## 6. Vault format and existing-data compatibility

The desktop target must use the existing encrypted export format and all supported entry/history metadata. Do not introduce a desktop-only vault wrapper, DPAPI-only recovery dependency, a different salt/KDF policy, or a plaintext SQLite copy.

The earlier planned profile was KDBX 4.1, AES-256-CBC with KDBX HMAC authentication, Argon2id, no compression, password-only unlocking and a 16 MiB file limit. **These are baseline expectations to inspect, not commands to overwrite the ready app's actual profile.** Preserve stronger supported imported parameters and the exact Unicode password policy. Keep memory-cost unit conversions and malformed-input limits shared.

No silent truncation, history pruning, field loss or database recreation on authentication failure. Unknown unsupported schema/features must produce a clear unsupported result with the original encrypted file retained. Preserve entry/group UUIDs, custom data, tags, timestamps, recycle-bin contents and old passwords.

Before release prove both directions:

- Existing released web build exports → Windows imports/edits/exports → that web build reopens.
- Windows export → independent Python verify/full recovery export.
- Current web build and Windows build at the same commit preserve identical logical content.

If a new shared feature cannot be read by the currently deployed web release, coordinate a compatible staged release or defer the feature. A common repository does not mean users update both clients at the same time.

## 7. Windows native storage and safe saves

Use an application-managed directory under the current user's local application data, resolved using platform APIs. Choose and document a stable app identifier and data path before the first Windows release. Never store the active vault in the installation directory, repository, temp directory, Downloads, or a browser profile. Use appropriate Windows ACLs; Unix-style chmod is not sufficient ACL configuration on Windows.

V1 uses one managed active vault per installation unless the ready app already supports more. Import creates a managed copy; it does not start editing the user's selected source file in place. Explicit exports are copies. This keeps file ownership and concurrency manageable.

The authoritative local state is an encrypted vault file. Minimal settings may contain backup-folder authorization, opaque IDs, timestamps, byte lengths and hashes, but not credentials, vault titles, record summaries, search indexes or plaintext history. A sidecar metadata file must not be needed to decrypt a backup or decide that damaged vault bytes are valid.

### Commit protocol

1. Serialize and authenticate/re-open the candidate with the shared vault engine. Capture the ciphertext hash of the revision currently being edited as an optimistic concurrency token.
2. Rust acquires the process/store write lock, validates the caller/session token, payload size and authorized managed destination, and rechecks the current file's hash. A mismatch is a conflict, not permission to overwrite.
3. Exclusively create a restrictive temporary file in the same directory/volume. Write all ciphertext, flush through the selected Windows filesystem APIs, and read back/compare bytes or hash.
4. Preserve a known-good encrypted previous copy and use a Windows-appropriate replacement operation. Handle first creation separately with a no-overwrite operation. Do not implement replacement as delete-current-then-rename-temp.
5. Verify the resulting current file and return its new opaque token only after the operation completes. Clear the dirty state only on that successful acknowledgement.
6. Prune old rollback copies only after successful commit verification. Never remove the sole recoverable file to make room for a failing write.

Use a reviewed implementation based on suitable platform/library APIs. `ReplaceFileW` has documented partial-failure cases; code must reconcile current/temp/backup files rather than assume any error leaves all names unchanged. Its `REPLACEFILE_WRITE_THROUGH` flag is unsupported; do not rely on it for durability. Flush the candidate explicitly and document the filesystem/hardware limits of power-loss guarantees. [S6, S7]

A hash match demonstrates that stored/copied bytes equal a previously validated candidate; it is not an independent KDBX authentication check. Rust must not call a structural header check “successful decryption.” Keep these statuses separate.

On a crash or ambiguous outcome, restart must find a valid current or recoverable prior ciphertext and present a recovery choice, not automatically initialize an empty vault. A successful native commit that finishes just before a UI crash remains authoritative. Keep error states actionable and preserve candidate ciphertext when safe.

Default rollback retention: current file plus five previous valid encrypted files. Adapt only if the existing product has a documented user setting. Retention is application-owned, never a recursive delete over a user folder. After a password change, old-password rollback files require explicit cleanup policy consistent with the existing app; report cleanup failures and never call logical deletion secure erasure.

### Concurrency and hostile paths

Use a single-instance host where practical, plus an actual write lock/CAS guard; a single-instance plugin alone does not solve all file races. A second launch focuses the existing window without bypassing its lock. If another tool modifies the managed file, detect the hash conflict and stop normal writes. Do not auto-merge.

The native side owns canonical managed paths. For user-picked files/folders, issue scoped opaque handles after native authorization; renderer strings do not authorize arbitrary destinations. Validate handles, expected revisions, lengths and states on every command. Defend against traversal, drive/UNC confusion, Windows alternate data streams, reserved/device paths and reparse-point/symlink escapes, including time-of-check/time-of-use issues. Use handle-based checks where necessary; string prefix checks alone are insufficient.

Treat imported and backup files as hostile inputs. Enforce resource limits before expensive KDF/parser work and retain the ready app's authentication/XXE defenses. Do not grant broad recursive filesystem permissions merely because the app has a file picker.

## 8. Backups on Windows

Retain the existing manual export/restore/verify UX. Add a user-selected external backup folder, authorized by a native folder dialog. Create a dedicated product-managed subdirectory using a non-sensitive opaque vault identifier. Never start writing to an arbitrary path sent from the WebView.

After each successful local commit, queue a copy of that exact immutable encrypted revision to the configured folder while the application is running. Generate collision-resistant filenames with timestamp plus an opaque revision/hash fragment. Write exclusively, flush, read back and verify equality with the validated source. Do not overwrite an earlier backup in place.

Default managed external retention: last 30 successfully byte-verified backups, adjustable by the user. Prune only files the application explicitly tracks as its own, only after the new backup is verified, and never a user-renamed/manual export or an unrelated `.kdbx`. Protect at least the newest good copy even if timestamps are misleading. No automatic deletion of old-key backups without a clear retention/password-change policy.

Distinguish:

| Status | Meaning |
| --- | --- |
| Saved on this computer | Managed current vault commit succeeded. |
| Backup pending/failed | Current revision is not yet confirmed at the selected destination. |
| Backup bytes verified | A file was written/read back and matches the validated source bytes. |
| Recovery verified | A selected backup was independently opened/authenticated, ideally also with Python. |

If the drive is missing, permission is revoked, storage is full or a cloud placeholder is unavailable, keep the local save and report the backup failure separately. Retry while running or at the next startup/foreground opportunity. Do not report a local save as failed merely because a secondary backup failed. Conversely, do not display “Backed up” when only the local save succeeded.

Pending backup work may hold references to encrypted revisions, never passwords. If retention or limited space means intermediate revisions are no longer available, report that only the latest pending state can be copied; do not invent a complete backup history. The task queue must be bounded.

There is no background service in v1: backups are not guaranteed while the app is closed or the computer is asleep. An OS-synced folder being written locally does not prove its cloud upload finished. A copy on the same physical disk is not protection from disk failure. Recommend a verified copy on another device/removable medium.

A selected external file is authenticated and previewed before replacement. Back up the current vault or obtain explicit acknowledgement before replacing it; commit the restored candidate safely. Never modify the selected source backup. Password changes leave old exported files protected by their old password. Preserve the existing recovery-tool workflow.

## 9. Desktop UX and lock lifecycle

Preserve the current visual identity and feature set. Add an adaptive list/detail layout, mouse interactions, keyboard navigation, proper window resizing, high-DPI support and accessibility. Do not redesign the mobile PWA during the port.

Suggested local shortcuts: Ctrl+F search, Ctrl+N new entry, Ctrl+S save, Ctrl+L lock, Escape dismiss/redact. Ensure they do not conflict with focused editor controls and never create global shortcuts in v1. Keep titles/taskbar previews generic while locked; never expose record values in notifications or crash dialogs.

Bridge Windows session lock, user switching and suspend/resume events into the existing lock controller. Immediately invalidate unlock state on session lock/suspend; on resume/focus re-entry recheck the lock deadline before rendering secrets. Also lock on hide/minimize according to the existing policy, and preserve inactivity/manual lock. Do not rely only on a WebView timer that can be throttled.

An already-authorized native ciphertext commit may complete after the UI locks. Its acknowledgement must not restore an old unlocked session or display secrets. Cancel or invalidate stale plaintext/UI work using session epochs; reject new sensitive requests from an expired session. Explicitly test a lock arriving during save/import/restore.

Native dialogs may change focus/visibility. Do not weaken the existing security policy merely to prevent a password prompt after a dialog. Prepare only encrypted export data before opening a picker; after return, re-unlock if the session was invalidated. If the UI currently locks on every visibility transition, retain that behavior until an explicitly reviewed desktop-specific policy is approved.

Discard or safely handle uncommitted drafts exactly as documented; do not promise to save them during forced termination. On a normal close while editing, offer Save/Discard/Cancel; wait for a chosen save to complete. On forced shutdown, preserve the last committed revision rather than depending on an asynchronous final save. Close exits the process in v1; do not leave an unexpectedly unlocked tray process.

Use the existing clipboard protections. If a native clipboard command is added, scope it narrowly and require an explicit action. Do not read clipboard contents automatically, promise that copied secrets never sync through Windows features, or claim guaranteed clipboard erasure. Best-effort timed clearing must not destroy unrelated clipboard content copied later.

## 10. Desktop security and trust boundary

The desktop host increases access to the operating system; packaging alone is not a sandbox guarantee. Do not run elevated. Keep the WebView2 sandbox enabled and the runtime serviced. Do not load third-party pages/scripts, analytics, remote fonts or favicon services inside the privileged window.

Set production CSP for the actual Tauri asset/IPC mechanism and tested WASM bundle. Start from the web app's strict policy and add only the minimum needed desktop origins/directives. Do not copy an HTTPS-only policy blindly if it breaks IPC, or resolve that failure using wildcards/unsafe-eval. Apply worker policy too. No arbitrary navigation, popups, shell execution or generic network proxy. Deliberate HTTPS links open in the system browser after scheme/credential validation, never in a privileged embedded webview.

Explicitly select the capabilities used by the main window and platform. Do not use wildcard window labels or remote URL grants. Tauri's custom commands registered through invoke_handler are not automatically restricted just by limiting plugin permissions: configure app-command permissions/AppManifest and test unauthorized callers. Each native command still needs validation of state, handles, lengths and paths. [S1]

Disable developer tooling in release builds where appropriate, but do not treat that as a security boundary. Do not log IPC payloads, keys, decoded XML, search terms, titles or credentials. Distinguish user-facing errors from sanitized diagnostics. The backup folder path itself is personal metadata and must not be uploaded in telemetry.

The shared JS/WASM engine can access secrets while unlocked, and hostile renderer code can abuse the permissions legitimately granted to it. Capability restriction reduces OS exposure; it cannot make compromised application code safe or guarantee protection from malware running as the user. Shipping local assets removes dependence on live website code changes for that installed build, but trust in the build/release pipeline remains.

Do not replace portable KDBX protection with Windows-account-bound encryption. The optional local Windows Hello envelope is in scope under [WINDOWS_HELLO_KENSINGTON.md](WINDOWS_HELLO_KENSINGTON.md); it must never be required for backup recovery or added to portable exports. The master-password path stays independent of the sensor, TPM and Windows account.

## 11. Migration from the web app

Installed Tauri WebView storage is not the existing Safari/Edge PWA origin. Never assume the desktop app can read or migrate browser IndexedDB automatically, and never scrape browser profile files.

Supported first-use transfer:

1. In the existing PWA, export and verify an encrypted backup.
2. In Windows, choose Import through the native dialog and unlock the candidate.
3. Show its authenticated summary; save a managed copy only after confirmation.
4. Edit synthetic data first, export from Windows, and verify that the PWA and Python can read it.

Keep the original web data and export intact. Explain that the two installations are separate copies. Concurrent editing creates divergent vaults; this increment has no automatic synchronization or merge. Do not point both clients at a cloud folder and call that conflict-safe sync.

## 12. Implementation sequence and completion

1. Discover and record the baseline; run existing tests; create synthetic compatibility fixtures.
2. Introduce the smallest adapter seam with the browser implementation retaining identical behavior.
3. Add a Tauri development host and separately bundled frontend; verify offline packaged startup before adding native writes.
4. Implement native managed storage, narrow commands, crash/conflict handling and backup folder behavior.
5. Prove the Windows Hello/TPM protection mechanism, integrate Kensington quick unlock and desktop lock/UI behavior, and run independent Python parity tests.
6. Add separate Windows CI/installer artifacts without changing web deployment triggers or paths.
7. Run the full acceptance matrix and deliver the installer, source changes and verification report.

Do not mark the work complete after creating a window around the website. Do not make users install Rust, Node.js or Python to run the final Windows app. Build tools belong on development/CI machines; WebView2 is the runtime prerequisite handled by the installer strategy.
