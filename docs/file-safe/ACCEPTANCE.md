# File-safe acceptance ledger

Baseline `670e41fda3935258dde8dc4f095e666370ad7bfb`; branch `feat/encrypted-file-safe`. Source commit and Windows workflow/artifact provenance will be appended after those runs. Synthetic fixtures only. **Full feature release BLOCKED**: no isolated viewer or proved hardware Hello provider. Those capabilities are unavailable in production code, with no fallback. Current storage/recovery is an unsigned experimental increment.

Local environment: Linux x64, AMD EPYC 9V74 virtual CPU, reported 34,906,040 KiB RAM, overlay filesystem; Node 24, CPython 3.12, Rust 1.90, libsodium 1.0.22 via libsodium-rs 0.2.5/libsodium-sys-stable 1.24.0. Hosted resources are not a physical Windows performance measurement.

Evidence: native `file_safe::tests` / `file_safe::manager::tests`, fifteen Python `test_file_safe.py` scenarios, `tests/file-safe/interop.py` fresh bidirectional read/extract, fixed independent producer corpora plus external expected byte digests, two isolated metadata UI scenarios. The API double is only in `apps/desktop/test/ui`, never in production. 31 native tests pass / one resource test is separately opt-in. Original 161 TS tests, both frontend builds/typecheck/isolation and all eight production PWA e2e scenarios pass. Python full suite: 91 passed / 12 skipped (Windows ACL and absent KeePassXC); missing KeePassXC is not reported as a pass.

| Gate | Status | Actual evidence / remaining requirement |
| --- | --- | --- |
| I-01 | PASS | Original TS suites, both production frontends, typecheck, target isolation and eight PWA e2e scenarios. |
| I-02 | PASS | Original Python KDBX fixture/security/CLI corpus and password storage tests remain compatible; no format change. KeePassXC checks skipped locally. |
| I-03 | NOT RUN | Native independent-token test passes; installed Windows module independence/Lock All smoke is pending. |
| I-04 | NOT RUN | Hosted installer smoke pending; clean offline standard-user Windows 11 remains untested. No parser is bundled because preview is blocked. |
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
| S-05 | PASS | Optimized Linux exact 5 GiB encrypt/decrypt verification: 20.422 s primitive run, 20.629 s process, peak RSS 8,448 KiB. Windows measurement pending. Debug attempt was stopped after 610.545 s and is not counted as passed. |
| S-06 | PASS | Real Linux native 10,000-file restore: 5.332 s; search: 0.184 s. Metadata UI passes paging/12 rendered rows/keyboard scroll/search <2 s. Windows timing remains pending. |
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
| B-04 | PASS | Corrupt candidate HEAD and missing-object restore leave existing ACTIVE/content intact; complete verified restore changes a local generation. |
| R-01 | PASS | Independent Python verification/full history+trash extraction from fixed and freshly native-written packages; no app/Hello/TPM dependency. |
| R-02 | NOT RUN | Linux private exclusive output, traversal/device/Unicode-safe names/hardlinks/no-overwrite tested; Windows reparse-race matrix pending. |
| R-03 | NOT RUN | Last-frame corruption/partial report and no unverified publication pass; actual disk-full/cancellation remnant matrix pending. |
| R-04 | NOT RUN | Linux hash-locked no-index wheel installation verifies both file-safe and existing KDBX fixtures. Windows offline wheel verification pending. |
| P-01 | NOT RUN | Source inspection finds no index/WAL/thumbnail/document IPC; installed profile/temp/log/clipboard/recent-file privacy scan pending. |
| P-02 | PASS | Explicit import/source and plaintext export disclosures, export acknowledgment, native lock under a held store mutex and late UI metadata refusal. Stalled OS I/O can delay buffer disposal, never token revocation/redaction. |
| D-01 | NOT RUN | Web/desktop outputs isolated and user data paths stable; actual upgrade/reinstall/uninstall preservation remains untested. |

No physical iPhone/Safari result is implied by these tests. Passing this matrix would still not be a security audit.
