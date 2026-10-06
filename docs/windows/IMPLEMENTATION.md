# Build, migration and native storage

This is an experimental Windows integration, not an accepted production release. See [ACCEPTANCE.md](ACCEPTANCE.md) and [HELLO_SECURITY_DESIGN.md](HELLO_SECURITY_DESIGN.md). The web frontend, KDBX engine and Python utility are shared in this repository.

## Development

Windows 11 x64: install Node 22+, the pinned Rust 1.90.0 toolchain (rustup), Visual Studio Build Tools with Desktop development with C++ / Windows SDK, and Evergreen WebView2. These tools are development prerequisites, not application runtime dependencies.

From repository root:

```sh
npm ci
npm run typecheck
npm test
npm run build -w @passkey-local/pwa
npm run desktop:frontend
node apps/desktop/scripts/check-bundles.mjs
npm run desktop:dev
npm run desktop:build
```

Tauri uses a separate development port 1420 and `apps/desktop/dist-desktop`; web `dist`, SW, manifest, deployment headers and the existing dev port remain separate. `desktop:build` invokes only the frontend hook, not itself. Release assets are bundled locally under the Tauri asset origin; the dev URL is not a production website dependency. No server, Node, Python sidecar, telemetry, remote fonts or updater is packaged.

```sh
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
cargo clippy --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo build --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --example storage_fixture_driver
node apps/desktop/test/interop.ts
```

The last test needs the existing recovery venv, or `RECOVERY_PYTHON` set to a Python executable with the locked recovery dependencies installed. It uses synthetic data in a temporary directory and compares full Python output, including historical passwords. The example is a developer harness and is never installed. Linux tests exercise the native store algorithm but do not establish Windows API/ACL/UI acceptance.

## Data and safe saves

Managed `current.kdbx` is portable encrypted data. `blob-<UUID>.kdbx` files preserve immutable candidates/rollbacks. `state.json` contains only operational metadata/settings; `commit.json` is a flushed replacement journal. Neither is needed to decrypt a copied KDBX. The shared engine authenticates and reopens candidates; Rust checks lengths/hashes and stores bytes, without claiming decryption.

The host holds an exclusive store lock for the process. Every worker has a revocable native token. A commit verifies expected generation and current ciphertext hash, creates and flushes exclusive restrictive files on the same volume, records a flushed journal, then calls `ReplaceFileW` (or no-overwrite `MoveFileExW` for first creation). There is no delete-current fallback or unsupported `REPLACEFILE_WRITE_THROUGH` flag. Current readback determines success even after a partial replacement error. Restart reconciles current against both journal revisions; unmatched state remains damaged and presents authenticated snapshot recovery, rather than creating empty data. Extra crash-candidate/replacement files may remain for manual recovery; never delete them automatically to free space.

The managed directory has a protected current-user + SYSTEM inheritable DACL. New files receive explicit ACLs; directory/file handles request READ_CONTROL + WRITE_DAC and the exact protected DACL is read back and verified; Windows directory handles pin ancestor names without share-delete, and reparse points are rejected. Picker destinations are owned/validated natively. IPC accepts opaque blob UUIDs, never filesystem paths. Windows UNC/device/ADS destinations are rejected for this increment. Filesystem and hardware caching still limit power-loss guarantees; controlled Windows fault tests remain required.

Default rollback retention is current plus five prior files, within the existing 80 MiB budget. Old-password local rollback cleanup follows the existing controller and reports remaining copies. Logical deletion is not secure erasure. Exported/external copies keep their original passwords.

A folder picker authorizes a dedicated `PassKeyLocal-<opaque UUID>` subdirectory. Each pending job references exact immutable ciphertext, with only the latest pending revision retained in the queue. Copies have unique names, exclusive writes, flush and byte readback. Default retention is 30 tracked copies, adjustable in settings from 1 to 100; only tracked names may be pruned after a verified new copy, not unrelated, renamed or user-modified files. Windows retention deletes the verified file by handle. Folder volume/file identity is rechecked before copy; replacement at the same pathname requires fresh authorization. A copy already in flight holds immutable ciphertext and may finish after a newer save or password change; it cannot verify that newer revision. External writes run outside the store lock and cannot delay local acknowledgement or native token revocation. Local save, external byte verification, independent recovery and cloud upload are distinct. No service runs while closed/asleep. Use another physical device and independently verify recovery.

## Migration and recovery

1. Export a verified encrypted backup in the PWA and keep the original.
2. In Windows, choose Import/restore using the native picker, enter its master password, inspect the authenticated summary, and confirm adoption.
3. Initially edit synthetic data. Export to a **new** filename; native exports refuse overwrite.
4. Reopen that copy in the PWA and verify/full-export with the independent Python tool as documented in `tools/vault-recovery/README.md`.

Copies can diverge; there is no synchronization or merge. Vault data lives outside the installation folder at `%LOCALAPPDATA%\com.passkeylocal.vault`. The standard NSIS uninstaller includes an unchecked **Delete application data** checkbox: leave it unchecked to keep the managed vault. Selecting it explicitly removes the managed app-data directory. External backups outside that directory remain in their separately chosen folder. Upgrade/reinstall/uninstall behavior still requires the acceptance tests on the installed target. If metadata/startup fails, preserve the directory and use the master password with Python on `current.kdbx` or a rollback copy; do not reinstall into an empty data directory or overwrite an original source file.

Windows session changes and power events invalidate native tokens before sending the UI lock event. The worker is destroyed and views unmounted. Native monotonic inactivity runs independently of WebView timers and the filesystem mutex; commands that need the store run off the Windows event thread. Normal close lets an editor cancel and save its draft, or discard; Save/Discard/Cancel is offered directly on normal close; Save calls the existing editor save and waits for its verified native acknowledgement. A failed save cancels close. Forced termination preserves acknowledged ciphertext; no final asynchronous save is promised. Local Ctrl+F/N/S/L shortcuts stay inside the application. The native dialogs receive the main HWND. The Windows workflow also tests the packaged WebView2 asset origin, actual IPC/worker/Argon2, synthetic creation/edit/native save and lock through Playwright CDP. The debugging switch belongs only to that CI process, not app configuration. Native dialogs, forced shutdown, high DPI and physical events remain separate gates.

## Distribution

`.github/workflows/windows.yml` builds an unsigned per-user Windows x64 NSIS installer and uploads it with SHA-256 and source/lock/toolchain metadata to GitHub Actions for 30 days. These are test artifacts, not a published release or security approval. There is no new production release/deployment workflow. If a later desktop release is authorized, use a draft `desktop-v0.1.0` with `make_latest: false`; do not override the web latest-release channel.

The installer is configured with Tauri's Evergreen **offlineInstaller** option, bundling the official x64 runtime installer. A clean offline Windows machine without WebView2 must still be tested before calling offline installation verified. The runtime has Microsoft's distribution terms and installation UI; see [Microsoft WebView2 distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution). Offline computers need explicit runtime servicing: obtain the current official x64 standalone installer on a connected machine, verify Microsoft signing, transfer it, and update according to local policy. Evergreen does not guarantee offline patching.

No Authenticode certificate was supplied. Artifacts are explicitly unsigned: a colocated checksum confirms bytes but does not independently authenticate the publisher. Do not disable Windows security or invent a signing identity. Manual updates close the app and run the versioned installer with the same identity/data path.
