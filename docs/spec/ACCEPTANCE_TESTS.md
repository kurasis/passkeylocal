# Acceptance Tests and Release Evidence

## 1. Test policy

All data in tests is synthetic. The specification is not a test report. The implementing agent must report each gate as **passed / failed / not run / blocked**, identify exact versions/devices, and attach reproducible commands or manual steps. Do not turn “should work” into “verified.”

Security/durability/recovery failures block use with real credentials. A visual demo may be delivered earlier only if explicitly labelled experimental. Passing automated tests alone is not a security audit.

Independent interoperability is mandatory. A writer reading back its own output can reproduce its own bug; it does not replace Python and independent-reader checks.

## 2. Gate 0 — prove the design before building the UI

| ID | Test | Required result |
| --- | --- | --- |
| G0-01 | Pinned browser library writes the required profile. | Header/cipher/KDF/compression values match the specification. |
| G0-02 | Browser-generated file opened by PyKeePass. | Every supported current and historical value matches expected data. |
| G0-03 | Independently produced compatible fixture opened in the browser. | Password byte policy, Argon2 mapping, protected values and timestamps agree. |
| G0-04 | App-generated file opened with a maintained KeePass reader on desktop. | Groups, passwords, Unicode and entry history readable; record the app/version used. |
| G0-05 | Production bundle under proposed CSP on an actual iPhone. | WASM/KDF, parsing, worker integration and encrypted save work without broad unsafe-eval. |
| G0-06 | Native file share/download and re-import on actual iPhone. | Saved `.kdbx` file can be selected, authenticated and independently recovered. |
| G0-07 | Dependencies reviewed and pinned. | No unresolved relevant critical/high advisory; transitive parsers/crypto and notices recorded. |

If any gate fails, fix the integration or revise the documented library selection. Do not create a proprietary format to get around a failing library, weaken the KDF, or proceed with a polished UI over an unproven backup path.

## 3. Interoperability corpus

Commit public synthetic fixtures, their correct test passwords, expected semantic JSON, hashes, generation tool versions and provenance. Keep production RNG separate from any deterministic test helper. Compare logical content, not byte-for-byte ciphertext after reserialization.

Required cases:

- Empty vault; one entry; nested groups; duplicate titles and usernames; favorites/tags/custom fields.
- Cyrillic, emoji, combining marks, right-to-left text, leading/trailing spaces, multiline notes, empty values and XML-special characters.
- Two visually similar master passwords with different Unicode normalization forms; they must not be silently made equivalent.
- Existing weak but nonempty password accepted for recovery; creation policy enforced separately.
- Password bytes containing leading/trailing spaces; `--password-stdin` exact-byte treatment.
- At least three history states, a historical password different from current, a restored version and a recycled entry with history.
- Product metadata, UUID stability, nontrivial expiry state, timestamps before/after daylight-saving transitions, and large decimal revision strings.
- KDF default and upper supported reader bounds, including the byte/KiB adapter conversion.
- A stronger supported imported KDF profile remains unchanged during ordinary edits; unusual existing password bytes are recovered exactly or rejected clearly without normalization/truncation.
- Unchanged save, field edit, password rotation, export/re-import, and Python extraction of each stage.

Fixtures must cover full field content, counts and ordering where defined. A database opening without an exception is not proof that history/custom metadata survived.

## 4. Cryptographic and parser tests

| ID | Case | Expected result |
| --- | --- | --- |
| SEC-01 | Wrong password, including visually similar Unicode. | Authentication fails, original bytes unchanged, no plaintext or empty-vault overwrite. |
| SEC-02 | Flip a bit in header, header hash/HMAC, block authentication and ciphertext. | Every applicable integrity/authentication check fails closed. |
| SEC-03 | Truncate at header/body/block/tag boundaries; append unexpected bytes. | Reject malformed file, never export a partial success. |
| SEC-04 | Header KDF values request huge memory/iterations, overflow integers or duplicate keys. | Reject before KDF/large allocation in browser and Python. |
| SEC-05 | Gzip, unknown cipher/KDF, newer schema, attachment or custom binary icon. | Clear unsupported-profile result; original file preserved; no silent content loss. |
| SEC-06 | Authenticated fixture with DTD/entity/XXE/XInclude content, deep XML or excessive node count. | Reject without filesystem/network access or resource exhaustion. |
| SEC-07 | Long fields/too many entries/history/groups/file over 16 MiB. | Defined limit error; no truncation or implicit pruning. |
| SEC-08 | Multiple saves of identical logical data. | Distinct ciphertext with standard fresh randomness; all files open independently. |
| SEC-09 | All secrets duplicated as conspicuous test markers. | Markers absent from IndexedDB metadata, local/session storage, Cache Storage, URLs, logs and build artifacts. |
| SEC-10 | Malicious strings in titles, notes, URLs, tags, filenames and terminal values. | Rendered inert; no HTML/script/terminal escape execution or path traversal. |
| SEC-11 | CSP/network inspection of production bundle. | No forbidden script/eval, remote assets, telemetry or application transmission of vault content. |
| SEC-12 | RNG unavailable or deliberately fails in a test environment. | Stop creation/generation/save that needs randomness; no fallback to Math.random. |

A worker timeout does not prove that input memory allocation is bounded. Inspect and test the preflight path before allocation. Library defaults are not evidence that DTDs, entity expansion, compression or HMAC bypasses are disabled.

Do not use live attack infrastructure. A local test server that records attempted network access is sufficient for XML/network-leakage cases.

## 5. Persistence and lifecycle tests

Inject failures at meaningful boundaries: encryption, re-open verification, blob insertion, head comparison, transaction abort, quota error, transaction completion and post-commit read-back.

| ID | Case | Expected result |
| --- | --- | --- |
| DATA-01 | App/process terminated during each save boundary. | Reopen finds old or new fully valid head; never half a vault. |
| DATA-02 | IndexedDB throws QuotaExceededError. | Old vault intact; explicit error and encrypted-export route where feasible. |
| DATA-03 | Two tabs edit the same starting generation. | Exactly one commit wins; the other reports conflict rather than overwriting. |
| DATA-04 | IndexedDB transaction auto-closes during async work. | Design avoids long crypto work inside transaction; no false “Saved.” |
| DATA-05 | Current head corrupt, older valid snapshots exist. | Recovery offered with revision warning, no silent rollback or empty reset. |
| DATA-06 | Storage persistence request denied/unavailable. | Vault can operate with clear storage-risk status and external-backup workflow. |
| DATA-07 | Site storage cleared, then app reopened. | Honest empty-installation/restore screen; external file restores full data. |
| DATA-08 | History retention, restore and recycle bin operations. | Correct previous state retained once; backup includes all retained versions. |
| DATA-09 | Password change interrupted at each step. | Usable old or new committed database; no mixed state; appropriate password works. |
| DATA-10 | Rotation cleanup fails. | Warn old-password local snapshot remains; current new-password vault still usable. |
| DATA-11 | Old valid backup restored after newer edits. | Older/branched state clearly identified where information exists. |
| DATA-12 | Failed schema migration or service-worker update. | Prior ciphertext preserved; no IndexedDB wipe and no mixed app assets. |

Lifecycle tests: manual lock, inactivity, app switch, Home button/gesture, screen lock, incoming call, share sheet, file picker, back/forward cache, OS process eviction, and a worker response arriving after lock. Each return starts redacted/locked. The last committed revision survives; unsaved editing drafts are not advertised as durable.

Run reveal/copy/search immediately before each lock condition. Verify that late state updates cannot repopulate the screen. Check best-effort app-switcher redaction without claiming OS screenshot prevention.

## 6. Backups and recovery tests

| ID | Case | Expected result |
| --- | --- | --- |
| BAK-01 | Cancel share sheet or download. | No “verified” or guaranteed-saved status. |
| BAK-02 | Share promise resolves but user selects a different destination/cancels later. | Status remains an offer or user report until file re-open verification. |
| BAK-03 | Select the exact exported file for verification. | Hash and authenticated semantic revision match; active database unchanged. |
| BAK-04 | Select a different valid older file. | Valid but older/different status; latest revision not marked backed up. |
| BAK-05 | Verify file itself increments no vault revision. | Backup status does not immediately become stale solely due to verification. |
| BAK-06 | New changes after verified export. | Changes-since-backup status returns correctly. |
| BAK-07 | Backup after password rotation. | New file needs new password; retained old external file still needs old password. |
| BAK-08 | Rehost app on a different origin. | No assumption of shared storage; explicit file import succeeds. |
| BAK-09 | Phone-loss and origin-loss drills. | Recovery works from file/password/offline kit only. |
| BAK-10 | No backup and deleted browser data. | Clear unrecoverable-state explanation, no fabricated recovery promise. |

On physical iPhone test at least: Save to Files on-device, transfer to a separate computer, re-select using Files, offline fresh launch, and restore into a clean installation. Test an OS cloud-backed destination only if available; label an untested destination as such. Do not rely on desktop file-picker behavior to infer iOS behavior.

## 7. Python-specific tests

- Safe no-echo prompt; non-interactive prompt failure; exact stdin password bytes; no password argument or environment fallback.
- `inspect` does not run Argon2 and labels metadata unauthenticated.
- `verify` fully authenticates all blocks and reports only safe summaries.
- `list`/`show` obey reveal/history options; escape ANSI/control characters.
- `export-json` includes current entries, all history, recycle-bin descendants, groups, tags, timestamps and protected flags; compare with expected semantic fixture.
- JSON round-trip recovers exact original Unicode and secret values; no HTML or CSV conversion involved.
- Unsupported content prevents a misleading “complete export” before final output creation.
- Existing output path, symlink/reparse target, source-as-output, unwritable directory, disk full and interruption all fail safely; original encrypted file unchanged.
- Restrictive output permissions checked on the tested OS, with Windows ACL behavior verified separately from POSIX mode bits.
- Successful output written completely through a restricted temporary file; no accidental overwrite of a raced target.
- Runtime execution succeeds with networking denied and installed dependencies; offline setup succeeds from the matching wheelhouse on a clean Windows test environment.
- No plaintext in default errors, debug logs, crash messages or temp files outside the explicitly requested restricted output path.
- Exit codes match the contract; dependency failures have useful instructions without automatically downloading anything.

## 8. UI and accessibility acceptance

Use realistic synthetic records and verify small iPhone widths, keyboard open/closed, safe areas, portrait/landscape, large text, VoiceOver labels, sufficient contrast and touch targets of at least 44 by 44 CSS pixels where practical. Secret reveal/copy controls need clear accessible names and must not accidentally announce hidden values.

Search is responsive, secret matches remain masked, and an empty result is distinct from a locked or failed database. Buttons show saving/error states. A confirmation names the operation without unnecessarily exposing credentials. English/Russian labels must not overflow. Offline, storage-risk, unsaved-edit and unverified-backup states are visually understandable.

Performance measurements use the actual production build, fixed synthetic corpus, explicit device/OS, and cold/warm runs. Record KDF and total unlock/save separately. Search timing cannot hide repeated decryption or network requests.

## 9. Required release report

Deliver a report with:

1. Source commit, build ID, package versions, dependency lock hashes and SBOM.
2. Supported file profile and schema versions, with fixture hashes and expected semantic outputs.
3. Browser/device/OS test matrix, including actual iPhone identifiers and date.
4. Results of all gates and failed/not-run cases, with reasons.
5. Evidence of browser export → offline Python recovery → independent KeePass opening.
6. Evidence that no plaintext markers persist and vault actions do not transmit data.
7. Deployment headers/update behavior and a host/origin-loss recovery drill.
8. Offline recovery-kit installation instructions and tested Python/OS combinations.
9. Remaining limitations and any security review performed; clearly distinguish an internal review from an independent audit.

The final handoff must include the functioning PWA, the standalone Python tool, setup/build/deployment instructions, synthetic tests, offline recovery materials and this report. A screen recording alone is insufficient.
