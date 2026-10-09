# File-safe acceptance ledger

Baseline `670e41fda3935258dde8dc4f095e666370ad7bfb`; branch `feat/encrypted-file-safe`. Final source/workflow/artifact provenance is recorded below. Synthetic fixtures only. **Full feature release BLOCKED**: complete multi-format preview and remaining physical acceptance are incomplete. The current [Hello increment](WINDOWS_HELLO.md) enables an experimental, independent PRF/TPM root envelope, with new file-safe hardware acceptance pending. Current storage/recovery remains unsigned and experimental. The original matrix below records its earlier baseline; the update supersedes only its unavailable-Hello implementation notes.

## File-safe Hello implementation update (2026-10-09)

Independent native PRF/TPM opt-in is implemented. Root material stays in Rust;
full safe/store/key-epoch identity and separate RP/key/domain/journal prevent
cross-module enrollment. Real catalog authentication is required before token
publication. Password rotation/restore durably invalidate; explicit removal
retries both owned objects. Portable v1 format, encrypted backups and independent
password recovery are unchanged. Existing password-vault envelopes preserve their
exact AAD and namespaces without migration.

Local results: 145 routine native tests (ten new cases: seven safe lifecycle
and three purpose/compatibility cases), 174 TypeScript tests and 49 desktop/browser
scenarios, including three new file-safe Hello cases. Type checks, Linux Clippy
and Windows GNU Clippy passed. Native safe tests authenticate the actual catalog,
export exact synthetic file bytes, validate password-only backup and reject stale
roots/sessions. Doubles do not constitute physical Hello/TPM authorization. Final
Windows/MSVC/installed artifact evidence is recorded at publication.

H-01/H-03 physical file-safe reader, modality, ESS and negative-case acceptance
remain NOT RUN. H-02/H-04 now have native purpose/key/session checks and automated
coverage; their complete physical acceptance is NOT RUN. The prior password-vault
owner “works” result is not a file-safe pass. No completed standalone experiment
or excluded same-PC second-account procedure is requested. Preview gates remain
blocked separately; this increment does not complete the full feature matrix.

Local environment: Linux x64, AMD EPYC 9V74 virtual CPU, reported 34,906,040 KiB RAM, overlay filesystem; Node 24, CPython 3.12, Rust 1.90, libsodium 1.0.22 via libsodium-rs 0.2.5/libsodium-sys-stable 1.24.0. Hosted resources are not a physical Windows performance measurement.

Evidence: native `file_safe::tests` / `file_safe::manager::tests`, fifteen Python `test_file_safe.py` scenarios, `tests/file-safe/interop.py` fresh bidirectional read/extract, fixed independent producer corpora plus external expected byte digests, four isolated metadata UI scenarios. The API double is only in `apps/desktop/test/ui`, never in production. 31 native tests pass / one resource test is separately opt-in. Original 161 TS tests, both frontend builds/typecheck/isolation and all eight production PWA e2e scenarios pass. Python full suite: 91 passed / 12 skipped (Windows ACL and absent KeePassXC); missing KeePassXC is not reported as a pass.

| Gate | Status | Actual evidence / remaining requirement |
| --- | --- | --- |
| I-01 | PASS | Original TS suites, both production frontends, typecheck, target isolation and eight PWA e2e scenarios. |
| I-02 | PASS | Original Python KDBX fixture/security/CLI corpus and password storage tests remain compatible; no format change. KeePassXC checks skipped locally. |
| I-03 | PASS | Native independent-token tests and the earlier hosted installed Windows module independence/Lock All smoke pass. Final installer evidence is recorded below. |
| I-04 | NOT RUN | Hosted per-user installer smoke passes; clean offline standard-user Windows 11 remains untested. No parser is bundled because preview is blocked. |
| C-01 | PASS | Fixed/fresh Rust and Python producers; empty/one-byte/exact-boundary/multi-frame fixtures and exact Unicode/spaced passwords. External expected digests match extracted bytes. |
| C-02 | PASS | Production randomness calls libsodium CSPRNG. Fresh per-object/root/nonce IDs; synthetic writer is outside release entrypoints. |
| C-03 | PASS | Native/Python wrong-password, bounds, malformed header, exact UTF-8 and excessive KDF rejection tests. |
| C-04 | PASS | Strict duplicate/unknown-key handling, counter >2^53, bool-counter refusal, folder cycles/invalid keys and ID checks. Wider count/depth maxima are implemented; not all maxima were allocated in tests. |
| C-05 | PASS | Native mutation/reorder/duplicate/missing/wrong-key/trailing/final tests; Python failed extraction publishes no unverified file. |
| C-06 | PASS | Vault/object/header context substitution tests, epoch mismatch and per-frame AD. |
| C-07 | PASS | Password/root rotation rejects old password for new catalog; old pinned copy survives rotation/lock and opens with old password. No retroactive revocation claim. |
| C-08 | PASS | Offline full-directory rollback limitation documented explicitly; no freshness guarantee advertised. |
| S-01 | NOT RUN | Logical fault injection passes at initial key/catalog/HEAD/ACTIVE, encrypted part/object publication/catalog/recovery ledger/HEAD. Exhaustive OS disk/power/partial-write failures not executed. |
| S-02 | NOT RUN | Cancel/no-overwrite/source preservation and free-space preflight tested; actual Windows disk-full/access-denied/partial-replace/source-race matrix pending. |
| S-03 | PASS | Native single-writer lock, stale snapshot and exact locator/catalog/HEAD CAS checks; existing external-change tests retained. |
| S-04 | NOT RUN | No-follow/pinning and regular-file/hardlink rejection implemented; Linux path tests pass. Full Windows folder/junction/alternate-stream race corpus pending. |
| S-05 | PASS | Optimized Linux exact 5 GiB encryption 12.263 s + verification 10.259 s = 22.522 s primitive, 22.718 s process, peak RSS 10,304 KiB. Final Windows measurements are recorded below. Debug attempt was stopped after 610.545 s and is not counted as passed. |
| S-06 | PASS | Real Linux native 10,000-file restore: 5.332 s; search: 0.184 s. Metadata UI passes paging/12 rendered rows/keyboard scroll/search <2 s. Final Windows timings are recorded below. |
| S-07 | PASS | Ciphertext handles pin old copy through root rotation/lock; conservative GC retains uncertain older objects/epochs. No destructive local GC enabled. |
| V-01 | BLOCKED | No proved AppContainer/LPAC worker token/handle/job setup. No parser integrated. |
| V-02 | BLOCKED | Actual worker network-denial probe unavailable. |
| V-03 | BLOCKED | Actual worker filesystem/parent-memory denial probe unavailable. |
| V-04 | BLOCKED | Actual worker profile/TEMP/disk/child denial proof unavailable. |
| V-05 | BLOCKED | Parser integration intentionally depends on isolation proof. No privileged parser/fallback. |
| V-06 | BLOCKED | No parser/broker to run IPC/dimension/OOM tests against. |
| V-07 | BLOCKED | UI/native stale-lock tests pass; no isolated viewer job lifecycle proof. |
| V-08 | BLOCKED | No production viewer job to verify parent/worker crash behavior. |
| V-09 | BLOCKED | Preview controls/accessibility not implemented while isolation is unproved. |
| H-01 | BLOCKED | Actual Kensington SKU/revision, driver, TPM key provider and Windows 11/ESS machine unavailable. |
| H-02 | BLOCKED | No non-exportable per-unwrap hardware provider; unavailable state exposes no enrollment/unwrap API. |
| H-03 | BLOCKED | Physical cancel/PIN/removal/lockout/ESS matrix unavailable; master password remains the supported path. |
| H-04 | BLOCKED | No hardware envelopes exist; enablement/replay/revocation evidence depends on provider proof. |
| B-01 | PASS | Immutable old plan copies complete matching key/catalog/objects through rotation/lock. Plans contain no keys/decrypted catalog. |
| B-02 | NOT RUN | Coalesced one-newest-plan/one-copier design, failure status and incomplete-directory publication checks implemented; missing/full/read-only drive matrix pending. |
| B-03 | PASS | Managed retention test preserves manual and unrelated files; a changed tracked package blocks pruning. New complete copy precedes retention. |
| B-04 | PASS | Corrupt candidate HEAD and missing-object restore leave existing ACTIVE/content intact; complete verified restore changes a local generation and queues the completed ciphertext snapshot before returning locked. Candidate validation and restore are bound to the exact observed HEAD bytes. |
| R-01 | PASS | Independent Python verification/full history+trash extraction from fixed and freshly native-written packages; no app/Hello/TPM dependency. |
| R-02 | NOT RUN | Linux private exclusive output, traversal/device/Unicode-safe names/hardlinks/no-overwrite tested; Windows reparse-race matrix pending. |
| R-03 | NOT RUN | Last-frame corruption/partial report and no unverified publication pass; actual disk-full/cancellation remnant matrix pending. |
| R-04 | PASS | Linux hash-locked no-index wheel installation verifies file-safe and KDBX fixtures; hosted Windows offline-kit installation independently verifies both formats. |
| P-01 | NOT RUN | Source inspection finds no index/WAL/thumbnail/document IPC; installed profile/temp/log/clipboard/recent-file privacy scan pending. |
| P-02 | PASS | Explicit import/source and plaintext export disclosures, export acknowledgment, native lock under a held store mutex and late UI metadata refusal. Stalled OS I/O can delay buffer disposal, never token revocation/redaction. |
| D-01 | NOT RUN | Web/desktop outputs isolated and user data paths stable; actual upgrade/reinstall/uninstall preservation remains untested. |

No physical iPhone/Safari result is implied by these tests. Passing this matrix would still not be a security audit.

## Final hosted evidence — 2026-10-06

Code head `ad3a8de8bbd6e86161390f5d29690ceeb5271654`; tested PR merge source `2ebf75fbfd49291bd3cb678aada7e1167fcd3c34`. [Normal CI 37463813032](https://github.com/kurasis/passkeylocal/actions/runs/37463813032) and [Windows CI 37463813205](https://github.com/kurasis/passkeylocal/actions/runs/37463813205) passed. Earlier Windows run 37455672245 passed code/resource tests but two packaging attempts failed fetching the official WebView2 offline installer with `Peer disconnected`. The second attempt was canceled during cache saving to obtain logs promptly. The final build uses the Windows HTTPS client with bounded retries to prefetch the official installer, validates its trusted Microsoft Authenticode signature and seeds Tauri’s cache; the installed app smoke passes. No TLS/signature bypass was used. Windows run 37460830936 packaged successfully but its installed smoke caught immediate re-unlock after Lock All using a stale native generation. The form now disables password admission until a fresh status is observed; the held-status regression first failed on the old UI and all four metadata UI scenarios now pass.

Windows: Clippy and 32 native tests passed (one resource test is separately executed); 161 TypeScript tests; full existing native/KDBX parity; fresh independent file-safe round trips including the real 10,000-file catalog; both isolated production frontends; Python 88 passed / 15 skipped. Normal CI also passed all five Python environments, fresh KeePassXC/KDBX compatibility, the offline Windows recovery kit, eight PWA and four bounded-metadata UI scenarios. Missing platform/hardware tests are not counted as passes.

The installed application passed real native/UI file-safe creation, virtual folder creation, module independence, Lock All and subsequent explicit file-safe password unlock. This also exercises the exact generation-bound password IPC admission. [Downloaded installer](https://github.com/kurasis/passkeylocal/actions/runs/37463813205/artifacts/11415511148) SHA-256 `a5d8e4f709cb0b8e7e59614fbf7e77b0ee0b2b5c118e1aa29c526a7f1afe199d`, 217,789,444 bytes, matches the sidecar/build metadata. [Small verified metadata](../../deploy/windows-desktop/) is retained in Git.

Optimized native Windows 5 GiB resource gate: encryption 29.301 s; verification 38.421 s; total 67.726 s; process 68.404 s; sampled peak working set 8,368,128 bytes. CPU/RAM/disk/runner image and OS are recorded in [the resource JSON](../../deploy/windows-desktop/file-safe-resource-2ebf75f.json). This is a native streaming-primitive measurement on a hosted virtual machine, not an end-to-end import/export or physical-machine performance claim. Linux final measurement: encryption 12.263 s + verification 10.259 s, process 22.718 s, peak RSS 10,304 KiB.

Preview/physical Hello, clean offline standard-user Windows 11, exhaustive fault/path-race/lifecycle and installed privacy gates remain open as identified above. **Full feature release remains BLOCKED.**

Final hosted 10,000-file restore: 181.867 s; native search: 0.225 s (one matched row). The full restore verifies all referenced encrypted objects; this is not a catalog-only unlock measurement. All four metadata UI scenarios pass, including held-status admission after lock.

## File-safe Hello hosted publication — 2026-10-09

PR #34 code `93821b69e978f9f75a7862cccb397b6eecc73dfb`, tested source `5369fadd0dc35c03cb568125cae7c444ec9e8472`, merge `58084c47377d17e634a0d1839baf7cff24a96d46` passed all eleven checks. Windows 177 routine native tests, Linux 145, TypeScript 174, UI 49 and production PWA eight passed. Ten new native cases and three UI cases cover the independent root lifecycle and old-vault/purpose boundaries. Actual installed command/form smoke rejected stale/malformed/wrong-password requests without creating keys. [Installer and original evidence](../../deploy/windows-desktop/) and [publication ledger](../RELEASE_EVIDENCE.md) contain checksums and source correlation. Independent recovery/format, MSVC ABI and offline kit passed. This is hosted software evidence; physical file-safe Hello acceptance remains NOT RUN. H-01/H-03 and full physical H-02/H-04, other-account isolation and preview requirements are not marked passed.

## Explorer and separate settings hosted publication — 2026-10-09

PR #35 code `6572c6f939cb5d27c9a0e39aa9222122505dbb5d`, tested source `db201b1edae9dbee69bcd38e54ffc1ba97d8833d`, merge `e63a2859b9f6757603f63a73a5e1e7b474a8826c` passed all eleven checks. Windows 177 routine native tests, Linux 145, TypeScript 174, UI 55 and production PWA eight passed. Six new UI cases cover nested/history/parent/breadcrumb navigation, current-parent creation, settings/secrets, stale lock replies, 205-folder paging, themes/responsive Russian controls and exact sizes/sort requests. Actual installed smoke creates real native nested folders and navigates their parent/history/breadcrumb path, with separate settings and Hello controls. [Installer/original screenshot](../../deploy/windows-desktop/) and [publication ledger](../RELEASE_EVIDENCE.md) contain source/checksum evidence. Native format/protection/recovery source bytes are unchanged. This is software/hosted evidence; it does not change physical Hello, other-account, preview or standard-user gates to passed.

## Context menus and isolated TXT hosted publication — 2026-10-09

PR #36 code `ba32360d75c00ccddd450224e39837be7045cf68`, tested source `69eee39f6908ef26dc80b635d865f6a1624323d6`, merge `5afdfa27839e49a4ba3c9cf7418b45f0251f97ac` passed all eleven checks. Windows 180 routine native tests, Linux 148, TypeScript 174, UI 61 and production PWA eight passed. Six new UI cases cover file/folder context actions, keyboard menus, consent, header/sidebar placement, themes/responsive Russian controls, inert 100,000-line paged text and cancellation. Three native tests cover folder actions, selected TXT authentication and preview tickets. Two worker unit tests and two actual Windows integration tests prove the bounded TXT path; installed smoke matches its exact release worker digest and verifies native selected-version preview/lock/context rename. Standard-user/exhaustive service-broker/WER/crash and full PDF/image acceptance remain NOT RUN. Actual installed smoke creates real native nested folders and navigates their parent/history/breadcrumb path, with separate settings and Hello controls. [Installer/original screenshot](../../deploy/windows-desktop/) and [publication ledger](../RELEASE_EVIDENCE.md) contain source/checksum evidence. Native encrypted format and Hello/recovery semantics remain compatible. This is software/hosted evidence; it does not change physical Hello, other-account, full multi-format preview or standard-user gates to passed.
