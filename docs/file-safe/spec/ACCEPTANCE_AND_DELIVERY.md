# Acceptance, Implementation Order and Delivery

## 1. Sequence

1. Inspect the existing repository, record baseline builds/tests and identify reusable Windows Hello, file-dialog, backup and lock code. Do not modify the password-vault format or web deployment contract.
2. Prove native preview isolation with a hostile test worker **before integrating a complex document parser**. Prove the file-safe Hello purpose/key separation on the actual Windows provider.
3. Freeze the catalog schema, portable byte format and fixture corpus. Implement Rust/Python cross-reading with synthetic content before building a large UI.
4. Implement the native encrypted store, crash-safe commits, import/export, independent lock state, bounded memory and recovery paths.
5. Add the existing-style UI, folders/search/history/trash and disabled/unsupported preview states.
6. Integrate the sandboxed PDF/image/text worker and resource restrictions, then negative security tests.
7. Add consistent encrypted backups, restore and offline Python recovery; test password/root rotation and retention.
8. Package the worker and pinned parsers with the normal Windows installer, run full acceptance and deliver a reviewable change plus an honest test report.

Do not claim completion with a working mock UI, an unisolated viewer or an installer that has never run on Windows. Do not import the owner's important files until the integrity/recovery gates pass. Use synthetic canaries for validation.

## 2. Required evidence format

For each gate record PASS, FAIL, NOT RUN or BLOCKED; commit, OS/build, architecture, dependency/driver versions, fixture and relevant log/result. Sanitize logs. Separate verified behavior from design intentions and known limitations. A successful unit test is not evidence of OS sandbox enforcement or physical fingerprint operation.

| ID | Test scenario | Required result |
| --- | --- | --- |
| I-01 | Existing web and desktop baseline before/after | Original build/test/deploy contracts remain; known pre-existing failures distinguished. |
| I-02 | Open existing password databases and run original Python recovery | No format/schema/credential changes or lost password history. |
| I-03 | Unlock/lock password vault and file safe independently | No automatic cross-unlock, shared root key or shared Hello envelope; Lock All affects both. |
| I-04 | Packaged offline startup and standard-user operation | Bundled assets/parsers work; no server, runtime downloads or developer tool installation needed. |
| C-01 | Rust/Python format vectors, including empty/exact-boundary/multi-frame data | Matching decoded bytes and metadata; final-frame variants accepted as specified. |
| C-02 | Nonce/key/ID generation and production build inspection | CSPRNG use; fresh per-version object keys; no deterministic test randomness in release. |
| C-03 | Wrong password, header mutation, excessive KDF, short/long fields | Bounded failure before dangerous allocation; no partial trusted output or empty-safe recreation. |
| C-04 | Catalog duplicate keys, overflow, cycles, unknown required schema, mismatched IDs | Reject without truncation, object access or unsafe path construction. |
| C-05 | Tampered/reordered/duplicated/missing frames, wrong key, truncated final, trailing data | Authentication/structure checks fail; no preview or successful final export. |
| C-06 | Substitute an object/catalog from another safe or version | Context binding and catalog checks reject the substitution. |
| C-07 | Password/root rotation plus older backups | Current catalog requires the new password; new versions inaccessible through the old root; historic copies remain honestly tied to old credentials. |
| C-08 | Copy entire old valid safe over current files | Application does not claim guaranteed freshness; rollback limitations documented. |
| S-01 | Interrupt every object/catalog/key-header/HEAD write and replacement stage | Either old or new complete committed state is recoverable; no acknowledged missing dependencies. |
| S-02 | Disk full, access denied, partial replace failure, unexpected source changes | Clear per-item outcome; prior committed state preserved; no source deletion or silent overwrite. |
| S-03 | Second process/external change and stale revision | Lock/CAS conflict blocks overwrite; UI does not silently merge. |
| S-04 | Folder import with symlinks, junctions, hardlink/path races and alternate streams | Only authorized regular byte streams imported; skipped/unsupported inputs reported. |
| S-05 | Files of 0 bytes, 1 byte, chunk boundaries and at least 5 GiB | Exact round trip; no 32-bit truncation; native streaming buffers remain bounded independently of file length. |
| S-06 | 10,000 synthetic entries and large history catalog | Responsive virtualized UI; search runs locally while unlocked; limits fail cleanly, never discard records. |
| S-07 | Retention/GC while a preview or backup pins an old snapshot, and after root rotation with unavailable old catalogs/ledger | Required objects/key epochs retained; uncertain reachability prevents destructive GC; only proven unreachable owned objects reclaimed. |
| V-01 | Probe actual worker token, capabilities, handle list and Job Object | Intended AppContainer/LPAC and limits established before parsing; no broad grants/inherited secrets. |
| V-02 | Worker attempts DNS/Internet/intranet/loopback/UDP and broker URL access | OS-enforced denial; no network broker bypass. |
| V-03 | Worker reads password vault, unrelated object, Documents, parent memory or credentials | Access denied; selected document and minimal runtime resources are the only sensitive grants. |
| V-04 | Worker writes profile/TEMP/user paths, executes children or persists plaintext | Denied; any unavoidable non-document infrastructure writes are documented; no claimed diskless sandbox without proof. |
| V-05 | Hostile PDF/image/text, PDF actions/JS/XFA, SVG/HTML/polyglots | Supported content handled inertly or refused; no privileged parsing or action execution. |
| V-06 | Oversized dimensions, huge page count, malformed IPC stride/length/ID, timeout/OOM | Bounded failure; worker terminated; host remains responsive; stored source preserved. |
| V-07 | Lock/suspend/user switch/close while decrypting or rendering | Immediate redaction, canceled stale responses, killed job and revoked handles; no document reappears. |
| V-08 | Parent crash and worker crash | No orphan viewer with selected plaintext; no document-bearing app crash upload or plaintext temp fallback. |
| V-09 | Supported PDF/image/text UX, DPI/keyboard/accessibility | Useful read-only controls; text escaped; PDF raster-only accessibility limits stated. |
| H-01 | Physical Kensington + TPM + current Windows provider | Per-safe enrollment and authorized unwrap work; exact SKU/driver/ESS configuration recorded. |
| H-02 | Silent unwrap, forged verification flag, wrong safe/epoch and cached authorization | Native checks deny unauthorized key recovery; one module's authorization cannot unlock the other. |
| H-03 | Cancel, PIN fallback, lockout, reader removal, unavailable TPM/ESS conflict | Honest states and password fallback; no OS security downgrade or false fingerprint-only claim. |
| H-04 | Password change/restore/revocation, stale envelope replay, process restart | Enrollments correctly expire/invalidate; key deletion errors visible; session/persistent policies enforced. |
| B-01 | Edit/rotate password while a backup copies | Package uses one pinned snapshot with matching header/catalog and all referenced immutable objects. |
| B-02 | Missing/full/read-only drive, interrupted copy, coalesced queue | Local save survives; incomplete backup not reported successful; pending state accurate and bounded. |
| B-03 | Retention next to unrelated directories and manual backups | Only tracked managed packages pruned after successful new verification; at least one good copy retained. |
| B-04 | Restore with corrupt/missing object, then a complete valid backup | Partial/corrupt result distinguished; existing safe untouched until verified replacement confirmation. |
| R-01 | Independent Python offline recovery without app/Hello/TPM state | All live bytes, names and selected history/trash recover using the applicable password. |
| R-02 | Python traversal, device names, Unicode/case collisions, output reparse race | Output remains inside authorized root, no overwrite or data loss; original names mapped safely. |
| R-03 | Partial extraction, disk full, cancellation and corrupted last frame | No unverified file published as complete; nonzero status and plaintext-remnant report. |
| R-04 | Recovery on Windows x64 and one declared non-Windows environment | Pinned offline dependency instructions reproduce; no hidden OS key/service dependency. |
| P-01 | Inspect app data, WebView profile, logs, clipboard, recent files, temp and backups | No deliberate plaintext cache/index/thumbnail or exposed keys; expected source/export copies identified separately. |
| P-02 | Export/import messaging and lock behavior during operations | User understands original/export copies remain; lock cannot be held off indefinitely by bulk work. |
| D-01 | Upgrade/reinstall/uninstall and web/desktop CI coexistence | Safe data preserved by default, stable app paths, no overwritten web output or unapproved release. |

## 3. Performance verification

Measure on a declared Windows machine with CPU, RAM, storage and TPM details. Record import encryption time, full verification time, backup copy time, peak working set and cancellation latency separately. Do not call skipped readback verification a speed optimization.

File transfer crypto buffers must be bounded to at most 64 MiB per active transfer, excluding OS cache, the bounded decrypted catalog and viewer allocations. Default one active import/export transfer; independent ciphertext backup work must use bounded I/O concurrency. Do not load a 5 GiB source into memory or serialize it through JS/base64 IPC. Record actual process working set so hidden copies are visible.

Target cancellation/redaction within one second under ordinary responsive storage. Document OS I/O stalls that cannot be canceled immediately; redaction and revocation must not wait for those stalls. Measure search and UI response with 10,000 entries. If limits need tuning, document the changed budgets and repeat the relevant adversarial/resource tests.

## 4. CI and packaging

Keep existing web commands and deployment. Shared UI changes run existing web checks; native-only components build on the Windows job. Maintain separate frontend output directories and existing release channels. Pin GitHub actions and dependencies appropriately, use minimum token permissions and never expose release secrets to untrusted PR code.

Add Rust native store/protocol tests, Python cross-implementation tests and parser/broker negative tests. Mocks cover state logic but do not replace physical Windows/AppContainer/TPM tests. Use a controlled test machine/account for hardware gates; do not run untrusted jobs on the owner's personal computer or clear its TPM for testing.

Bundle the fixed worker and parser libraries in the existing installer. Resolve their paths from the installation, not writable current directories or PATH. Validate provenance/integrity and prevent user-document DLL search paths. Include licenses/notices and a parser update policy. No runtime plugin download, externally supplied executable parser or generic sidecar-launch IPC.

Production artifacts must not expose a fake Hello provider, sandbox bypass, test key, debug shell or deterministic random source. A failure to create the sandbox disables preview, not the security control. Release publication remains subject to the existing owner's authorization; preparation of a draft/reviewable artifact is sufficient until then.

## 5. Handoff deliverables

- Additive implementation in the same repository and a concise integration/change report.
- Frozen format specification, exact catalog JSON schema and bidirectional Rust/Python fixtures.
- Threat model and native permissions/IPC/sandbox design, including rejected approaches and remaining limits.
- File-safe UX and operating guide: import sources, plaintext export, preview limits, password rotation, history/trash, backup consistency and recovery.
- Independent Python module, dependency locks and verified offline setup for the supported recovery environments.
- Windows installer/checksum/signing status and dependency/worker provenance.
- Completed acceptance matrix with actual evidence, including Kensington/TPM and sandbox denial tests.
- Evidence that old password-vault data, existing Python commands, web builds and deployments remain compatible.

No source or hardware was supplied for this specification's preparation. The implementing agent must establish these facts in the real repository. This is not an audited application design or a guarantee against malware; passing this matrix is an implementation gate, not a security certification.
