# Acceptance report — experimental integration

Baseline source: `be52275e23a5c8bc0eabbf62198f4ee0c4f75d4d`. Final implementation is identified by the Git commit containing this report and CI artifact `build.json`; do not substitute the baseline SHA for the installer SHA. Local environment: Debian 13 x64, Node 24.19, Python 3.12.14, Rust 1.90.0, Chromium 151.0.7922.173. No physical Windows/TPM/Kensington/iPhone is attached.

## Owner PRF measurement (2026-10-07)

The [owner report](../../deploy/windows-desktop/hello-target-72a0df6-prf.json)
matches the original PR #18 installer metadata at full source
`72a0df66fe107b6ef15e4c81aa010c261662287b`. Windows 11 Pro 25H2 / build 26200,
API 9 and Kensington VeriMark Desktop pass all ten same-process synthetic
PRF/AES/cleanup stages. The owner separately reports fingerprint confirmation
at creation and each of the three assertions. This completes that diagnostic
measurement only. No H-01 through H-16 gate below is closed: per-key TPM,
complete fresh authorization/process/account/machine/cancellation/lifecycle proof
and real Hello enrollment/unlock remain outstanding. See
[the current security decision](HELLO_SECURITY_DESIGN.md) and
[the release ledger](../RELEASE_EVIDENCE.md). No unchanged PRF retest is required.

## Executed local evidence

- Before changes: typecheck, 158 TypeScript tests and web build passed; Python 76 passed / 12 skipped.
- Native Rust algorithm tests: thirteen passed on Linux, covering write-boundary restart reconciliation, single writer/CAS, external modification, stale tokens, hostile IDs/preferences, symlinks, backup failure/retry/retention, old-password cleanup, and fail-closed Hello. Windows replacement/ACL behavior is not inferred from Linux.
- Actual native fixture driver + shared KDBX worker/controller contract: import full synthetic corpus, preserve groups/entries/custom fields/history, edit password/history, save/restart, reject wrong password, rotate master password, and compare complete independent Python recovery JSON. Passed on Linux. Test-only driver is not an installed app.
- Post-change typecheck, adapter 96 / core 36 / PWA 26 tests, both frontend builds and target isolation passed; production Chromium 6/6 passed, including offline/passkey/themes/CSP. The host timeout uses a monotonic clock separate from all filesystem locks; its exact expiry and refusal to revive an expired session are unit-tested. Windows host code and app-command capabilities cross-compile with Rust/Clippy for x64 GNU (including production custom protocol); this is compilation evidence only. Native Windows tests and installed-app smoke passed on a hosted runner. Pending or absent results are not passes.

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

No accepted production Windows release is authorized or claimed. Hello remains unavailable and its provider/envelope/modes need the real-hardware proof and implementation described in HELLO_SECURITY_DESIGN.md. Installer signing, clean-machine offline WebView2, standard-user installation, complete native fault/ACL/path races, dialog/close/minimize/session/power, upgrade/uninstall and physical Safari require their actual target environments. A generated unsigned installer alone does not close those gates. No audit claim follows from these tests.

Dependency review: npm audit reports 0 vulnerabilities. cargo-audit 0.22.2 against the current RustSec database reports 0 vulnerability advisories, plus informational warnings for glib 0.18.5 (RUSTSEC-2024-0429) and proc-macro-error 1.0.4 (RUSTSEC-2024-0370); cargo tree for Windows MSVC confirms neither is in the Windows target graph. They are Linux/GTK transitive lock entries; no Linux release is provided. This is dependency review, not an audit of application security.

## Final hosted Windows evidence

[Windows run 37424185908](https://github.com/kurasis/passkeylocal/actions/runs/37424185908) and [normal CI 37424185848](https://github.com/kurasis/passkeylocal/actions/runs/37424185848) passed. Code head `edb9405eac3b5b18fbcc3cc944b57d1c3c3d6a03`; tested PR merge source `e88ba87c9ac0c96a0042928b2b0240b6ece4f17a`. Hosted environment: windows-2025 x64, Node 22.23.3, Rust 1.90.0, Python 3.12.10, WebView2 Edg 153.

Executed: 158 TypeScript tests, Windows Clippy/14 native tests (actual replacement/protected ACL readback), full shared-engine/native-file/independent Python parity, both frontend builds/isolation and independent recovery (74 passed, 14 skipped). Normal CI also passed browser scenarios and the Python matrix.

Installed-app smoke passed: per-user NSIS installation, installed/built executable byte equality, generic main window, native autosave/autofill disabled and read back, shared React UI, real IPC/session/worker/Argon2, vault creation/reload/password unlock, entry save, manual lock, direct Hello rejection, saved KDBX reopened in Node, and no foreign application requests/page errors. The fixture shortcut skips native backup-dialog automation. This is hosted evidence, not complete clean offline/standard-user/physical Windows 11 acceptance.

[Unsigned installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37424185908/artifacts/11395251579): 217,415,126 bytes. Downloaded SHA-256 matches the sidecar/build metadata: `70725fd831a40e3c1ac9f89eac90283e51e947c4caa820391207e3b28218640d`. Small metadata and a synthetic locked-window screenshot are retained in the Windows download folder. The large installer has 30-day Actions retention. Lock hashes describe Windows CRLF checkout bytes; equivalent Linux LF bytes differ only in line endings.

Runtime 150+ ignores environment debugger overrides on elevated hosts ([Wry issue](https://github.com/tauri-apps/wry/issues/1782)). The disposable CI runner uses app-specific HKLM debugging policy with readback and cleanup; the installer/release configuration has no debugging switch. Bundle-type executable patching is disabled because there is no updater, allowing strict byte comparison.

The complete gates above remain open unless their entire specified scenario was exercised. Windows Hello is unavailable; physical TPM/Kensington/Safari and the complete lifecycle/fault/upgrade matrix remain open. No production release tag or signing identity was created.
