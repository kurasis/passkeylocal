# Acceptance report — experimental integration

Baseline source: `be52275e23a5c8bc0eabbf62198f4ee0c4f75d4d`. Final implementation is identified by the Git commit containing this report and CI artifact `build.json`; do not substitute the baseline SHA for the installer SHA. Local environment: Debian 13 x64, Node 24.19, Python 3.12.14, Rust 1.90.0, Chromium 151.0.7922.173. No physical Windows/TPM/Kensington/iPhone is attached.

## Executed local evidence

- Before changes: typecheck, 158 TypeScript tests and web build passed; Python 76 passed / 12 skipped.
- Native Rust algorithm tests: thirteen passed on Linux, covering write-boundary restart reconciliation, single writer/CAS, external modification, stale tokens, hostile IDs/preferences, symlinks, backup failure/retry/retention, old-password cleanup, and fail-closed Hello. Windows replacement/ACL behavior is not inferred from Linux.
- Actual native fixture driver + shared KDBX worker/controller contract: import full synthetic corpus, preserve groups/entries/custom fields/history, edit password/history, save/restart, reject wrong password, rotate master password, and compare complete independent Python recovery JSON. Passed on Linux. Test-only driver is not an installed app.
- Post-change typecheck, adapter 96 / core 36 / PWA 26 tests, both frontend builds and target isolation passed; production Chromium 6/6 passed, including offline/passkey/themes/CSP. The host timeout uses a monotonic clock separate from all filesystem locks; its exact expiry and refusal to revive an expired session are unit-tested. Windows host code and app-command capabilities cross-compile with Rust/Clippy for x64 GNU (including production custom protocol); this is compilation evidence only. Native Windows tests have passed on a hosted runner; installed-app smoke remains failed. Pending or absent results are not passes.

## Required gates

Every full gate below remains NOT RUN until its complete scenario is observed on the specified target. Linux/static/partial coverage above is useful development evidence but does not satisfy installed Windows, real power-loss, Kensington or iPhone acceptance.

| ID | Scenario | Status / evidence |
| --- | --- | --- |
| WEB-01 | Build/test existing web target before and after integration | PASS: original commands before/after, 158 TypeScript tests, build and typecheck without Rust |
| WEB-02 | Existing deployment, installability, service-worker update and offline use | NOT RUN: complete target-specific scenario outstanding |
| WEB-03 | Shared-code changes on actual iPhone/Safari PWA | NOT RUN: complete target-specific scenario outstanding |
| BUILD-01 | Build both targets consecutively and concurrently in supported configurations | NOT RUN: complete target-specific scenario outstanding |
| DESK-01 | Install and launch as a standard Windows user | NOT RUN: complete target-specific scenario outstanding |
| DESK-02 | Clean offline machine with no preinstalled WebView2 | NOT RUN: complete target-specific scenario outstanding |
| DESK-03 | Disable network after installation | NOT RUN: complete target-specific scenario outstanding |
| DESK-04 | Packaged asset origin and routing | NOT RUN: complete target-specific scenario outstanding |
| DESK-05 | Desktop profile/service worker | NOT RUN: complete target-specific scenario outstanding |
| DATA-01 | Released web export → Windows edit/export → released web reopen | NOT RUN: complete target-specific scenario outstanding |
| DATA-02 | Windows export → independent Python verification and full recovery | NOT RUN: complete target-specific scenario outstanding |
| DATA-03 | Wrong password, truncation, bit flips and unsupported format/features | NOT RUN: complete target-specific scenario outstanding |
| DATA-04 | Unicode passwords/fields and allowed parameter extremes | NOT RUN: complete target-specific scenario outstanding |
| DATA-05 | Change master password, restore older backup | NOT RUN: complete target-specific scenario outstanding |
| SAVE-01 | Successful edit/save/restart | NOT RUN: complete target-specific scenario outstanding |
| SAVE-02 | Kill process before/during/after each write/flush/replace/acknowledge stage | NOT RUN: complete target-specific scenario outstanding |
| SAVE-03 | Disk full, access denied, destination changed, replacement partial failure | NOT RUN: complete target-specific scenario outstanding |
| SAVE-04 | Second launch and external modification during an edit | NOT RUN: complete target-specific scenario outstanding |
| SAVE-05 | Old revision replaced while an immutable backup job is queued | NOT RUN: complete target-specific scenario outstanding |
| PATH-01 | Traversal, ADS/device paths, reparse-point changes and stale picker handles | NOT RUN: complete target-specific scenario outstanding |
| PATH-02 | Managed current/temp/rollback file permissions | NOT RUN: complete target-specific scenario outstanding |
| BACKUP-01 | Successful external backup, then independent open | NOT RUN: complete target-specific scenario outstanding |
| BACKUP-02 | Missing removable drive, read-only folder, full disk or offline cloud placeholder | NOT RUN: complete target-specific scenario outstanding |
| BACKUP-03 | Retention with unrelated files, renamed manual exports and misleading timestamps | NOT RUN: complete target-specific scenario outstanding |
| BACKUP-04 | Restore invalid file, then restore valid file | NOT RUN: complete target-specific scenario outstanding |
| LOCK-01 | Manual lock, timeout, session lock, user switch and suspend/resume | NOT RUN: complete target-specific scenario outstanding |
| LOCK-02 | Lock during native dialog, save, import, restore or worker result | NOT RUN: complete target-specific scenario outstanding |
| UX-01 | Normal close while dirty vs forced shutdown | NOT RUN: complete target-specific scenario outstanding |
| UX-02 | Keyboard, resize, high DPI, accessibility and clipboard | NOT RUN: complete target-specific scenario outstanding |
| SEC-01 | Unauthorized native/plugin commands, stale session and unauthorized window/origin | NOT RUN: complete target-specific scenario outstanding |
| SEC-02 | Stored HTML/script-like fields, navigation attempts and malicious external URLs | NOT RUN: complete target-specific scenario outstanding |
| SEC-03 | Logs, errors, traces, packaged content and CI artifacts inspection | NOT RUN: complete target-specific scenario outstanding |
| UPGRADE-01 | Upgrade and reinstall using the same app identity | NOT RUN: complete target-specific scenario outstanding |
| UPGRADE-02 | Uninstall with external backup folder configured | NOT RUN: complete target-specific scenario outstanding |
| RELEASE-01 | Desktop workflow/tag/artifact alongside normal web release | NOT RUN: complete target-specific scenario outstanding |
| HELLO-00 | All H-01 through H-16 gates in the Kensington document | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-01 | Real Kensington setup and offline enrollment/unlock after OS setup | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-02 | Hardware protection and export attempts | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-03 | Silent/native unwrap, forged success flag, bypassed UI and repeated unlocks | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-04 | Valid fingerprint, nonmatching finger, cancel, PIN fallback and lockout | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-05 | Session mode restart/crash and persistent mode restart/expiry | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-06 | Lock/suspend/user switch/close while prompt is pending; owned-dialog focus changes | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-07 | Envelope corruption, wrong vault, swapped enrollment/key ID and clock rollback | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-08 | Copy files/envelope to another machine or Windows account | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-09 | Multiple normal saves, KDF salt changes and reopen | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-10 | Password change/import/restore plus injected crashes between stages | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-11 | Disable/revoke, replay old envelope, missing key and simulated reset | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-12 | Unplug/replug reader, driver unavailable, RDP/unavailable provider | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-13 | ESS enabled/disabled as permitted on a controlled test machine | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-14 | Remove all Hello metadata, open latest Windows backup in web and Python | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-15 | Release bundle, logs, IPC and crash handling inspection | BLOCKED: physical TPM/provider/Kensington proof unavailable |
| H-16 | Existing PWA CI/deployment and desktop upgrade | BLOCKED: physical TPM/provider/Kensington proof unavailable |

## Outstanding work and release limits

No accepted production Windows release is authorized or claimed. Hello remains unavailable and its provider/envelope/modes need the real-hardware proof and implementation described in HELLO_SECURITY_DESIGN.md. Installer signing, clean-machine offline WebView2, packaged origin/IPC/worker/WASM, native fault/ACL/path races, dialog/close/minimize/session/power, upgrade/uninstall and physical Safari require their actual target environments. A generated unsigned installer alone does not close those gates. No audit claim follows from these tests.

Dependency review: npm audit reports 0 vulnerabilities. cargo-audit 0.22.2 against the current RustSec database reports 0 vulnerability advisories, plus informational warnings for glib 0.18.5 (RUSTSEC-2024-0429) and proc-macro-error 1.0.4 (RUSTSEC-2024-0370); cargo tree for Windows MSVC confirms neither is in the Windows target graph. They are Linux/GTK transitive lock entries; no Linux release is provided. This is dependency review, not an audit of application security.

Packaged smoke now exercises actual Windows WebView2/asset origin/IPC/worker/Argon2/save/lock through CDP on an ephemeral hosted runner, with external application requests blocked. No successful result has been recorded; the source contains no activatable fake Hello provider. The fixture preference shortcut skips native backup-dialog automation and is explicitly recorded by the harness.

## Hosted Windows evidence and current blocker

[Run 37416273642](https://github.com/kurasis/passkeylocal/actions/runs/37416273642) passed 13 native tests, native Clippy, shared-engine/native-file full Python parity, both frontend builds/isolation and the independent recovery corpus. These exercise real Windows replacement APIs and protected ACL readback; they do not establish physical power-loss, standard-user or complete installed-app acceptance.

[Run 37418236570](https://github.com/kurasis/passkeylocal/actions/runs/37418236570) additionally completed the actual per-user NSIS silent installation, then failed compiled/installed executable byte equality before launching the installed app. Tauri patches bundle-type metadata into the packaged binary by default. The build now explicitly disables that patch because this app has no updater; the strict byte-equality assertion is retained. The latest local inactivity regression and release GUI-subsystem changes also require a Windows rerun (14 native tests expected).

GitHub access was restored and the correction was pushed. Run 37420948730 passed 14 Windows native tests and installed/compiled executable equality, but CDP still failed to attach. WebView2 Runtime 150 ignores environment debugger switches on elevated hosts, including GitHub Windows runners; see [Wry issue 1782](https://github.com/tauri-apps/wry/issues/1782) and [Microsoft issue 5645](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5645). The harness now uses temporary HKLM policy scoped to this app's EXE, read back before launch and removed in finally, exclusively on disposable hosted runners. No installer or release-host debug switch is added. Final packaged smoke remains pending the rerun.
