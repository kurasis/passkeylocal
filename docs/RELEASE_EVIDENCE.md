# Release evidence and gate status

This is the gate ledger required by `docs/spec/ACCEPTANCE_TESTS.md`. Every gate
is **passed**, **partial**, **failed**, **not run** or **blocked**, with the
evidence or the reason. "Passed" means an automated test or a recorded manual
run exists and passed; nothing is marked passed because it "should work".

**Overall: not ready for real credentials.** No physical iPhone test has been
run. Passing automated tests is not a security audit; no
independent review has been performed.

Last updated: 2026-10-06 (experimental file-safe validation; prior deployed-site results below are historical).

## Experimental native file safe (2026-10-06)

The uploaded file-safe README and six linked documents were read before implementation. The native encrypted format/store, independently locked module, typed main-window-only IPC, bounded metadata UI and separate Python recovery are additive. KDBX/PWA storage and credential formats are unchanged. Full feature acceptance remains **BLOCKED** by the preview sandbox and physical Hello/TPM/Kensington requirements; both unavailable capabilities fail closed. See [file-safe acceptance](file-safe/ACCEPTANCE.md), [format](file-safe/FORMAT.md), [operating guide](file-safe/OPERATING_GUIDE.md) and [recovery](file-safe/RECOVERY.md).

Current Linux x64 evidence: 161 original TypeScript tests; typecheck; both frontend production builds and output-isolation check; 26 native tests passed (subsequent added regression tests pending the final rerun), plus the separately executed optimized 5 GiB gate (20.422 s, peak RSS 8,448 KiB); 91 Python tests passed and 12 skipped (Windows ACL and absent KeePassXC). New fixed Rust/Python fixtures cover empty, one byte, exact chunk and multi-frame content with exact spaced Unicode passwords, trash/history and an integer above JS precision. Both fresh producer directions verify independently. Fifteen new Python tests cover extraction/no-overwrite, KDF limits, invalid catalogs, corruption/partial reporting and unsafe paths. Native tests add lock/token separation, history/trash/root rotation, candidate binding, managed retention beside unrelated/manual files and failure injection at ciphertext/locator publication boundaries.

All eight original PWA e2e scenarios and two isolated file-safe metadata UI scenarios also pass (10,000-entry paging/virtualization/keyboard/search and stale-lock redaction). Windows installed-app, offline-wheel and Windows resource runs are still pending. The real 10,000-file native catalog search passed locally in 0.184 s after a 5.332 s complete restore; Linux no-index wheel installation and full Rust-fixture verification also passed for this change. No unit result is used as physical-device or sandbox evidence. This section will be updated with completed runs and artifact provenance before delivery.

## Three themes and responsive layout (2026-10-05)

Colorful, Light and Dark palettes are implemented, with Colorful as the
default for installations without a saved preference. The System option and
existing saved themes remain supported. The header picker works while empty
or locked; Settings offers the same choices while unlocked. The layout uses
desktop sidebar navigation, mobile bottom navigation, a prominent search
field, local SVG icons and colored entry initials.

Passed: `npm run typecheck`, production build, 26 PWA unit tests and all 6
Chromium e2e tests. The appearance e2e checks explicit choices under a dark
OS preference, persistence across reload/lock/unlock, System changes,
keyboard selection and Escape focus return, Russian labels, no horizontal
overflow at 320/390/1440 pixels, secondary-button text contrast of at least
4.5:1 in all three palettes, and no CSP/console/network violations. Existing
backup, offline and virtual-passkey scenarios also pass.

Desktop and mobile-viewport screenshots were visually reviewed with synthetic
entries; see [design references and previews](DESIGN.md). No Safari,
physical-iPhone or deployed-site checks were run for this change.

## Optional Face ID / passkey unlock (2026-10-05)

The owner requested platform-passkey unlock. The implementation uses WebAuthn
PRF to encrypt the exact master password in an AES-GCM local wrapper; it does
not change the portable KDBX format or independent password-based recovery.
The OS chooses Face ID, Touch ID or screen-lock code. This is an explicit
addition to the original v1 scope, not a claim of exclusively biometric or
device-bound protection.

Validated on Linux with Node.js 24.19.0 and Chromium 151.0.7922.173:

| Check | Status | Evidence |
| --- | --- | --- |
| TypeScript and production build | passed | `npm run typecheck`; `npm run build -w @passkey-local/pwa`. |
| Unit suites | passed | 96 adapter, 36 core and 26 PWA tests. `npm test`, followed by the expanded PWA suite with `npm test -w @passkey-local/pwa`. |
| Wrapper authentication and lifecycle | passed | `apps/pwa/test/biometric.test.ts`: password reauthentication, ciphertext-only persistence, worker restart, edits, wrong PRF/credential, tampered AAD/ciphertext, lock during encryption, atomic head-generation conflict, disable, password rotation, snapshot restore and vault replacement. |
| WebAuthn context and cancellation | passed | `apps/pwa/test/webauthn.test.ts`: rejects wrong origin, challenge, type, RP hash, credential, missing UP/UV; wipes rejected PRF buffers; cancellation and late-result refusal. |
| Browser workflow | passed (virtual authenticator) | `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run e2e -w @passkey-local/pwa`: 5 tests, including real WebAuthn PRF enrollment/get with a CTAP2 virtual platform authenticator, pending-get cancellation by reload, offline unlock, disable/password fallback, lock during enrollment and PRF-unavailable fallback. Existing vault/CSP/header tests also pass. Local RP is `localhost` because WebAuthn rejects raw IP domains. |
| Physical Face ID, Safari and OS passkey providers | not run | Requires an iPhone and a browser/provider supporting WebAuthn PRF. Virtual verification does not prove Face ID or Safari behavior. |

No deployed-site check was run for this change. Existing deployment and
physical-device gates remain open.

## Environment of the recorded runs

| Item | Value |
| --- | --- |
| TypeScript runtime | Node.js 22.22.0 (Linux x64); same adapter code the PWA will bundle |
| Browser-side libraries | kdbxweb 2.1.1, hash-wasm 4.12.0, @xmldom/xmldom 0.9.12 |
| Python | CPython 3.12.3 (Linux x64); CI adds 3.12/3.13 on Windows and Linux, 3.12 on macOS |
| Python libraries | pykeepass 4.2.0, argon2-cffi 25.1.0, pycryptodomex 3.23.0, lxml 6.1.3 |
| Independent reader | KeePassXC 2.7.6 (`keepassxc-cli`) |
| Physical devices | none yet |

Commands: `npm test` (adapter), `cd tools/vault-recovery && python -m pytest`
(CLI + interop + security), CI workflow `.github/workflows/ci.yml`.

## Gate 0: prove the design before building the UI

| ID | Status | Evidence / reason |
| --- | --- | --- |
| G0-01 Writer profile | **passed** | `packages/vault-adapter/test/preflight.test.ts` "G0-01": KDBX 4.1, AES-256, Argon2id v1.3 64 MiB/3/1, 32-byte salt, no compression, no public custom data. Independently confirmed by `vault_recovery inspect`. |
| G0-02 Browser file opened by PyKeePass | **passed** (Node runtime) | `tests/interop/test_browser_to_python.py`: 10 fixtures exported by the CLI equal the adapter's model field by field (all fields, protection flags, 3+ history states, recycle bin, custom data, timestamps, Unicode, CR/LF/TAB). CI also regenerates the corpus and re-checks (`interop-fresh`). Not yet repeated with files written inside Safari. |
| G0-03 Independent fixture opened by the adapter | **passed** | `tests/interop/fixtures-python/` written by PyKeePass (KDBX 4.0, Argon2id p=2); `packages/vault-adapter/test/interop.test.ts` matches passwords, protected values, history and timestamps. PyKeePass writes an empty auto-type association per entry, which kdbxweb drops; the adapter detects this and opens the file read-only (no lossy re-save). Password byte policy: NFC vs NFD, surrounding spaces, weak existing password covered in both directions. |
| G0-04 Desktop KeePass reader | **passed** (CLI) | `tests/interop/test_keepassxc.py` with KeePassXC 2.7.6: groups, every field value, Unicode, tags, recycle bin and full history match for all fixtures; wrong password refused. Desktop GUI not exercised. |
| G0-05 Production bundle under CSP on an iPhone | **partial** | Desktop Chromium (Playwright, `apps/pwa/e2e/vault.spec.ts`): the production build served with the exact `_headers` CSP creates, saves, unlocks and works offline with zero CSP violations and zero console errors. The test server redirects `/index.html` to `/` as Cloudflare Pages does; the test asserts the shell is cached under `/` as a non-redirected response and that the offline reload still works. Argon2id runs in the module worker under `'wasm-unsafe-eval'` only. **Not run on Safari or an iPhone.** |
| G0-06 Native share/download and re-import on an iPhone | **blocked** | Download fallback, file re-selection and verification pass in desktop Chromium (e2e). The iOS share sheet and Files flow need a physical iPhone. |
| G0-07 Dependencies reviewed and pinned | **partial** | Exact pins and lockfiles with hashes; `npm audit` and `pip-audit` clean on 2026-10-04; xmldom forced past advisories; patches and licences recorded in `docs/DEPENDENCIES.md`. Pending: SBOM file and a full third-party notices file. |

## Interoperability corpus (section 3)

Covered by `tests/interop/fixtures/manifest.json` and `fixtures-python/`:
empty vault, one entry, nested groups, duplicate titles/usernames,
favorites/tags/custom fields, Cyrillic/emoji/combining/RTL/bidi override,
leading/trailing spaces, multiline notes with CRLF, empty values,
XML-special characters, NFC vs NFD passwords, weak existing password, spaced
password with exact stdin bytes, three history states with a restore, recycled
entry with history, product metadata, large decimal revision, expiry and
timestamps at DST transitions, default and upper-bound KDF
(256 MiB/10/4), unchanged save, field edit, password rotation.

A stronger imported KDF profile (256 MiB/10/4) survives an ordinary edit
(`vault.test.ts` "imported KDF profile").

Not yet covered: export/re-import through the PWA, passwords containing line breaks
(PWA input cannot produce them; Python `--password-stdin` path exists, fixture pending).

## Cryptographic and parser tests (section 4)

| ID | Status | Evidence |
| --- | --- | --- |
| SEC-01 Wrong password | passed | TS `vault.test.ts`; Python `test_verify_and_wrong_passwords`, KeePassXC wrong-password test. Input bytes unchanged. |
| SEC-02 Bit flips | passed | header (malformed, before KDF), header HMAC, block HMAC, first/last ciphertext block: TS and Python. |
| SEC-03 Truncation / trailing bytes | passed | TS cuts at 11 boundaries; Python 7 cuts; trailing byte. |
| SEC-04 Huge/overflowing KDF, duplicate keys | passed | Rejected before KDF in both (Argon2 spy / monkeypatch proves it is not called). |
| SEC-05 Gzip, unknown cipher/KDF, newer schema, attachment | passed | Security corpus + header mutations; Argon2d and AES-KDF unsupported. Custom binary icons: rejected by code path, no fixture yet. |
| SEC-06 DTD/XXE/XInclude/deep XML | passed | Authenticated hostile fixtures rejected before any XML parser runs (no resolution possible). A recording network server was not needed because nothing is parsed. |
| SEC-07 Limits | partial | Field lengths, custom-field/tag counts, notes, file size, XML depth/elements tested. Entry/history/group count limits implemented in both readers but not exercised with a full-size vault. |
| SEC-08 Fresh randomness | passed | Identical content saved twice gives different SHA-256; both open. |
| SEC-09 Plaintext markers in storage/logs/build | partial | Chromium e2e: after creating a vault and an entry with marker strings, IndexedDB (all stores, blobs decoded), localStorage, sessionStorage and Cache Storage contain none of the markers or the master password. Static test: no Web Storage, history/URL writes or `Math.random` in the app source. Safari/iPhone and crash/OS logs: not run. |
| SEC-10 Malicious strings | partial | Python terminal output escapes C0/C1/bidi (fixture `malicious-strings`). PWA renders all vault text through React text nodes; a static test forbids `dangerouslySetInnerHTML`/`innerHTML`; stored URLs open only for HTTPS (HTTP with a warning), never `javascript:`/`data:`/`file:` or URLs with credentials (unit test). Rendering the malicious fixture in the UI: not run. |
| SEC-11 CSP / network inspection | partial | e2e: response headers match the baseline policy (no `unsafe-eval`, no `unsafe-inline`); during the full flow the page makes no request outside its own origin. Static test: no `fetch`/XHR/WebSocket/beacon in app code. Deployed host (2026-10-04): headers pass; the injected Cloudflare analytics script is blocked by the CSP but is still present (see "Deployed site"). Safari: not run. |
| SEC-12 RNG failure | passed | Generator and vault creation stop with RNG_UNAVAILABLE; `Math.random` never called. |

## Persistence and lifecycle (section 5)

Storage layer and controller: `packages/vault-core` (IndexedDB through
`fake-indexeddb` 6.2.5 in Node; real Argon2id in every session test). Browser
IndexedDB and physical-iPhone runs are still required before these count for
release.

| ID | Status | Evidence |
| --- | --- | --- |
| DATA-01 Termination at each save boundary | passed (Node, fake IndexedDB) | `storage.test.ts`: faults before blob insert, after blob insert, after head switch abort the transaction; a new connection sees the old complete head and no partial blob. `session.test.ts` re-opens the old vault after a failed commit. Real process kill in a browser: not run. |
| DATA-02 QuotaExceededError | passed (Node, fake IndexedDB) | Injected `QuotaExceededError` maps to `QUOTA`; old head intact; verified candidate kept for Retry (no second revision bump) and encrypted export. |
| DATA-03 Two tabs, same generation | passed (Node, fake IndexedDB) | Concurrent commits: exactly one wins, the loser inserts nothing and reports `CONFLICT`; session keeps the candidate for export, refuses Retry, reloads on discard. |
| DATA-04 Transaction auto-close during async work | partial | By design: `commit` receives finished ciphertext and hash; transactions issue only IndexedDB requests from callbacks (no awaits). "Saved" only after `complete` plus hash read-back (read-back failure test). No browser test of auto-close yet. |
| DATA-05 Corrupt head, older snapshots | passed (Node, fake IndexedDB) | Damaged head gives `head-unreadable`; unlock refuses; snapshots listed by generation/date; restore requires authentication; damaged blob kept and exportable byte for byte. |
| DATA-06 Persistence denied/unavailable | passed (unit) | `requestPersistence` returns `persisted` / `not-persisted` / `unavailable`, never throws. UI status: not built. |
| DATA-07 Storage cleared | passed (Node, fake IndexedDB); UI in Chromium | Empty factory gives `empty`; `create` refuses when any head exists. The empty state shows the Welcome screen with Create and Restore (e2e starts from it). |
| DATA-08 History, restore, recycle bin | partial | Adapter tests (Gate 0) plus session test: one history version per change, none for a no-op save. Backup-includes-history: covered by interop tests. |
| DATA-09 Interrupted password change | passed (Node, fake IndexedDB) | Wrong current password refused; commit fault leaves only the old password working; success switches to the new password with content and history intact. |
| DATA-10 Rotation cleanup fails | passed (Node, fake IndexedDB) | Cleanup fault reports remaining old-password copies; the new vault keeps working. |
| DATA-11 Older backup restored | passed (Node, fake IndexedDB) | Candidate labelled `older-revision`; adoption refused without confirmation; adopted file gets a new lineage, revision bumped once, previous head kept as rollback. |
| DATA-12 Failed migration / SW update | partial | Service worker caches only build assets, installs only if every asset is cached, waits for an explicit "Update now" (no unconditional `skipWaiting`), deletes only its own old caches after activation, and never touches IndexedDB. Schema upgrades are additive and no code path deletes the database (static test). An injected failed update: not run. |

Lock policy: `AutoLock` (30 s / 1 / 2 / 5 / 10 / 30 / 60 min / 6 / 12 / 24 h, default 2 min, no
"never"; `check()` locks on return even when timers were suspended) and session
tokens (lock during a save or unlock discards the late result) are unit-tested.
Lifecycle in desktop Chromium (e2e): an app switch (hidden, then visible) keeps
the vault open and redacts the UI while hidden; the inactivity interval locks
and removes record text from the DOM; reload starts locked; the worker holding
the vault is terminated on every lock. iPhone events (app switch, screen lock,
call, share sheet, bfcache): not run.

**Deviation from the specification (user decision, 2026-10-05).** SECURITY_AND_FORMAT.md
section 4 requires locking as soon as the page is hidden. The owner chose to lock
only by the inactivity interval and asked for 10, 30 and 60 minute options. Time
spent in the background counts as inactivity and is checked on return, but within
the interval anyone holding the unlocked phone can switch back into an open vault.
The UI is hidden while the page is hidden (best effort for the app switcher
snapshot; not guaranteed by iOS).

## Backups and recovery (section 6)

| ID | Status | Evidence |
| --- | --- | --- |
| BAK-01 / BAK-02 Cancelled or offered export | passed (core) | `export-cancelled`, `export-offered` and `user-reported` receipts never count as verified. Share sheet / download UI: not built. |
| BAK-03 Exact exported file verified | passed (core) | Hash matches the head, authenticated revision `same-revision`, active vault unchanged. |
| BAK-04 Different older file | passed (core) | Labelled `older-revision`; head not marked backed up. |
| BAK-05 Verification creates no revision | passed (core) | Generation and revision unchanged after verifying. |
| BAK-06 Changes after verified export | passed (core) | Changes-since-backup returns; banner escalation after 10 commits or 24 hours. |
| BAK-07 Backup after password rotation | partial | Gate 0 fixtures; PWA flow not built. |
| BAK-08 .. BAK-10 | not run | Need the PWA, a second origin and a physical iPhone. |

## Python-specific tests (section 7)

| Requirement | Status | Evidence (`tools/vault-recovery/tests/test_cli.py` unless noted) |
| --- | --- | --- |
| No-echo prompt; fails without terminal; no password argument/env | passed | `test_no_terminal_means_no_prompt_and_no_echo`, `test_no_password_option_exists` |
| Exact stdin bytes, bounds, encoding | passed | `test_password_stdin_*` |
| `inspect` runs no KDF, labelled unauthenticated | passed | `tests/security/test_hostile_files.py::test_inspect_*` |
| `verify` authenticates all blocks, safe summary | passed | interop + bit-flip tests |
| `list`/`show` reveal/history rules, escaping | passed | `test_list_*`, `test_show_*`, `test_safe_text_*` |
| `export-json` complete (history, recycle bin, groups, tags, times, protection) | passed | interop tests + JSON Schema validation |
| Unsupported content blocks export before output | passed | security corpus, `test_unsupported_content_creates_no_output` |
| Existing/symlink/source/missing/unwritable/shared output paths | passed (POSIX) | `test_export_*`; unwritable-directory test skipped when running as root |
| Disk full / interruption cleanup | not run | Code path removes the temp file; no injected-failure test yet |
| POSIX 0600 | passed | `test_export_success_permissions_and_warning` |
| Windows ACL | passed | `test_export_windows_acl_restricted` on `windows-latest` (Python 3.12 and 3.13), CI 2026-10-04: protected DACL with a single full-control ACE for the current user, read back and verified |
| Runs with network denied | passed | `test_export_runs_with_network_denied` (socket calls fail) |
| Offline install from wheelhouse on clean Windows | passed | `offline-kit` job on a fresh `windows-latest` runner, CI 2026-10-04: `--no-index --require-hashes` install, then `verify` |
| No plaintext in errors | passed | messages are fixed strings; `test_unexpected_errors_do_not_print_reprs`, security corpus checks stderr |
| Exit codes | passed | across all tests |

## UI, accessibility and performance (section 8)

**Partial.** `apps/pwa`: Welcome, Create (with locally generated passphrase
suggestion), required onboarding export-and-verify drill, Unlock, damaged-vault
recovery, vault list with search options, groups, tags, sort, favorites, entry
detail with explicit reveal/copy, edit (group picker to move an entry; website,
notes, tags, expiry and custom fields collapsed behind "More", covered by e2e
and a worker test), history with restore, recycle bin,
Backups (status, export, verify, restore) and Settings (lock interval,
language, theme, password change). English and Russian strings with a
completeness test. 44 px touch targets, safe-area insets, light/dark themes and
reduced motion are in the stylesheet. VoiceOver, large text, small-width
overflow and contrast checks on a device: not run. KDF timing on Node/Linux x64
is roughly 0.3-0.5 s per Argon2id derivation; iPhone timing: not measured.

## Deployed site (https://passkeylocal.top/)

Checked on 2026-10-04 against the release built from `main` at `4105088`
(Cloudflare Pages, uploaded by hand). Desktop Chromium (Playwright 1.63,
headless) on Linux x64, through an outbound HTTPS proxy.

| Check | Status | Evidence |
| --- | --- | --- |
| Deployed files equal the build | **passed** | Every file in the release zip fetched from the live origin has the same SHA-256 (`/sw.js` f3a62c2e29efc4e3, `/assets/index-gUvwOCuV.js` a2c125f4c68a9159, `/assets/vault.worker-9t8Wn5ft.js` 2a9d8068f71484e3, CSS, icons, manifest, shell) when requested without `Accept: text/html`. `/_headers` is not served (404). |
| Response headers | **passed** | CSP, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`, COOP and HSTS on every response including `sw.js`, the worker and 404s; `no-cache` on `/` and `sw.js`, `immutable` on `/assets/*`; JavaScript as `application/javascript`, manifest as `application/manifest+json`. `/index.html` answers 307 to `/` (the local test server answers 308; the e2e accepts both). |
| Full e2e flow on the live origin | **failed** | `E2E_BASE_URL=https://passkeylocal.top npx playwright test` (in `apps/pwa`): create, backup drill, add entry, lock on hide, wrong password, no plaintext at rest, reload, offline unlock all pass; the final assertion fails because Cloudflare Web Analytics injects `<script src="https://static.cloudflareinsights.com/beacon.min.js...">` into HTML responses for browsers (`Accept: text/html`). The CSP blocks it, so no request leaves the origin, but the served shell differs from the build and `docs/DEPLOYMENT.md` forbids it. Fix: turn off Web Analytics for the Pages project, then rerun. |
| HTTP to HTTPS redirect | **failed** | `curl http://passkeylocal.top/` returns 200 with the app instead of a redirect (HSTS is ignored over plain HTTP). Fix: enable "Always Use HTTPS" in the Cloudflare zone. Not covered by the e2e because the test proxy only carries HTTPS. |

## Known limitations and open items

- Every Safari and physical-iPhone gate is open (G0-05, G0-06, lifecycle,
  share sheet, performance).
- kdbxweb is unmaintained since 2022; the adapter compensates for the gaps
  listed in `docs/DEPENDENCIES.md`. Replacing or forking it remains an option if
  Safari or CSP testing exposes further problems.
- Licence: GPL-3.0-only (`LICENSE`).
- No independent security audit has been performed.

## 2026-10-06 — additive Windows integration

The Tauri target reuses the existing frontend/worker/KDBX engine. See [implementation](windows/IMPLEMENTATION.md), [acceptance ledger](windows/ACCEPTANCE.md), [Hello decision](windows/HELLO_SECURITY_DESIGN.md) and [download folder](../deploy/windows-desktop/). Local validation passed: typecheck/158 TypeScript tests, six production Chromium scenarios, both builds/isolation, 13 Linux native tests, Windows GNU production/capability Clippy compilation, full native-file/independent Python parity. Inactivity covers exact deadlines, immediate interval changes and no expired-session revival. npm audit: zero vulnerabilities; RustSec: zero vulnerability advisories, two informational non-Windows graph warnings documented in the acceptance report.

[Windows run 37424185908](https://github.com/kurasis/passkeylocal/actions/runs/37424185908) and [normal CI 37424185848](https://github.com/kurasis/passkeylocal/actions/runs/37424185848) passed. Code head `edb9405eac3b5b18fbcc3cc944b57d1c3c3d6a03`; tested PR merge source `e88ba87c9ac0c96a0042928b2b0240b6ece4f17a`. Hosted environment: windows-2025 x64, Node 22.23.3, Rust 1.90.0, Python 3.12.10, WebView2 Edg 153.

Executed: 158 TypeScript tests, Windows Clippy/14 native tests (actual replacement/protected ACL readback), full shared-engine/native-file/independent Python parity, both frontend builds/isolation and independent recovery (74 passed, 14 skipped). Normal CI also passed browser scenarios and the Python matrix.

Installed-app smoke passed: per-user NSIS installation, installed/built executable byte equality, generic main window, native autosave/autofill disabled and read back, shared React UI, real IPC/session/worker/Argon2, vault creation/reload/password unlock, entry save, manual lock, direct Hello rejection, saved KDBX reopened in Node, and no foreign application requests/page errors. The fixture shortcut skips native backup-dialog automation. This is hosted evidence, not complete clean offline/standard-user/physical Windows 11 acceptance.

[Unsigned installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37424185908/artifacts/11395251579): 217,415,126 bytes. Downloaded SHA-256 matches the sidecar/build metadata: `70725fd831a40e3c1ac9f89eac90283e51e947c4caa820391207e3b28218640d`. Small metadata and a synthetic locked-window screenshot are retained in the Windows download folder. The large installer has 30-day Actions retention. Lock hashes describe Windows CRLF checkout bytes; equivalent Linux LF bytes differ only in line endings.

Runtime 150+ ignores environment debugger overrides on elevated hosts ([Wry issue](https://github.com/tauri-apps/wry/issues/1782)). The disposable CI runner uses app-specific HKLM debugging policy with readback and cleanup; the installer/release configuration has no debugging switch. Bundle-type executable patching is disabled because there is no updater, allowing strict byte comparison.

These are unsigned experimental builds. Windows Hello remains unavailable; physical TPM/Kensington/Safari, clean offline/standard-user installation and the full lifecycle/fault/upgrade matrix remain open. No production release is claimed.

## 2026-10-06 — restore completion and long inactivity options

The owner requested 6, 12 and 24 hour inactivity options; the default remains two minutes with no "never" option. Both the shared worker and Windows native preference validation accept these choices. Background time still counts towards expiry.

Successful backup replacement previously left a consumed preview and its replacement button visible; a second click returned `INVALID_STATE` even though replacement had succeeded. The shared control now clears the consumed preview and acknowledgement, disables cancellation while committing, and the Backups tab closes the form and announces that the replacement was saved. A fresh restore starts with no stale success message. Successful native byte verification no longer displays a permanent global banner; Settings retains the concise external-backup saved status without claiming master-password recovery verification.

Local checks passed: typecheck; 161 TypeScript tests (96 adapter, 39 core, 26 worker/UI); 14 Linux native tests, including all three extended preference values and restart persistence; both frontend builds and target isolation. Fake-clock tests cover each long deadline with suspended timers and idempotent expiry. Worker tests read the selected values through a fresh handler. Windows GNU production Clippy compilation passed. The new restore Chromium regression was first run against the previous production build and failed at the missing completion status, reproducing the original behavior. A new browser deadline scenario also caught an existing language-change bug: replacing the lock callback recreated AutoLock without rearming it. The arming effect now tracks that callback. All eight production Chromium scenarios now pass, including repeated replacement/reload and 24 hour expiry after switching to Russian. [Windows run 37430858051](https://github.com/kurasis/passkeylocal/actions/runs/37430858051) passed on head `8ee765b` / PR merge source `e78bcad`. The installed Windows smoke now selects all three long intervals through the real UI, reads back native persistence and checks the selection after reload.

The Russian hour options use the neutral `ч.` abbreviation, consistent with the existing `мин` labels. After this wording adjustment, both builds/isolation and the localized persistence/24 hour deadline scenario passed again. [Normal CI 37430858042](https://github.com/kurasis/passkeylocal/actions/runs/37430858042) passed on head `8ee765b` / PR merge source `e78bcad`; Windows packaging and installed-app smoke for that source also passed.

Windows evidence for the behavior changes: Clippy, 15 native tests (including long intervals/restart and actual Windows protected replacement), full native-file/shared-engine/independent Python parity, both builds/isolation, independent recovery (74 passed, 14 skipped), offline NSIS installation and packaged UI/worker/native-save/lock smoke. The installed smoke selected all three intervals, read back `state.json`, reloaded and verified the 24 hour selection. Source head `8ee765b` / tested merge `e78bcad6edee0509e536fdffe0ad9e8b1bc1ffa1`; the only subsequent product change is the Russian hour-label abbreviation, verified by rebuilding both targets and rerunning the localized deadline scenario. Physical-device acceptance remains open as above.

[Downloaded unsigned installer](https://github.com/kurasis/passkeylocal/actions/runs/37430858051/artifacts/11397316873): 217,413,328 bytes, SHA-256 `df5de92db41ebae11e0e5f60c26b1246b1000b7335dd814e720e4bf92d331b62`; sidecar verified independently. Small build/smoke metadata and a synthetic locked screenshot are retained in [the Windows download folder](../deploy/windows-desktop/). [Latest Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-1f6d2e0.zip): 201,527 bytes, SHA-256 `50fb0c8e2602eca5d818e0f4b597dae49b89d21a9cee3dd9e00b0fa3ae2807cd`; every archive file equals the production build. Neither archive was deployed to the user's server by this change.

## 2026-10-06 — experimental encrypted file safe

The Windows target now has an independent encrypted file store, virtual folders, bounded metadata pages, authenticated streaming import/export, version history/trash, root-key rotation, ciphertext-only backup scheduling/managed retention and staged full-copy restore. File contents and keys remain in Rust, with no document parser or plaintext document IPC. The password module and Cloudflare PWA retain their existing storage format. Preview isolation and physical hardware Hello gates remain BLOCKED; this is an unsigned experimental storage/recovery increment, not full feature acceptance. See [the acceptance ledger](file-safe/ACCEPTANCE.md) for individual unrun fault, privacy and physical-device requirements.

Local validation: 31 Linux native tests passed / one explicit resource test excluded from routine runs; original 161 TypeScript tests; typecheck, both production frontends and isolation; eight production PWA browser scenarios and two bounded-metadata desktop UI scenarios; 91 Python tests passed / 12 skipped; Windows GNU all-target Clippy; independent fresh bidirectional Rust/Python verification and full extraction. Real native 10,000-file catalog restore took 5.332 s and search 0.184 s. Optimized Linux 5 GiB streaming verification took 20.422 s (20.629 s process), peak RSS 8,448 KiB. A debug attempt was stopped at 610.545 s and is not counted as passed. A fresh hash-locked Linux no-index wheel kit verified file-safe and KDBX fixtures. Hosted Windows installer, installed UI and resource evidence will be recorded after execution.

The first hosted Python jobs exposed a test-runner assumption: pytest adds the source tree to its own import path, but child CLI processes do not inherit it. The new CLI test helper/fresh fixture extractor now set their source PYTHONPATH explicitly, matching the existing KDBX helper. Offline kit verification already passed with its packaged source path. This changes test launch wiring, not format or crypto behavior.
The Windows test run also exposed a fixture manifest read using the host code page; new fixture/report tests now read UTF-8 explicitly. Production format/report I/O already uses explicit UTF-8 bytes.

Final review added Windows console/superscript device-name sanitization for independent extraction (COM¹/²/³, LPT¹/²/³, CONIN$/CONOUT$) and regression cases. Resource evidence now records actual hosted CPU/RAM/disks plus separate native encryption/verification timings; physical TPM/reader testing remains explicitly absent. These are follow-up verification changes, not a preview/Hello implementation.

A final metadata UI regression reproduced language switching invalidating pending search while resetting the token reference. Status/lock subscription now stays stable across language changes, while status errors use the current language. The new scenario verifies pending search completion and subsequent redaction after switching to Russian. This is tested against the prior implementation before applying the fix.

Password admission now includes the native generation observed before the UI submits its password. This closes the late-IPC case where a previously submitted request reaches Rust after Lock All; capture only on command entry cannot bind that earlier submission. Native tests refuse the stale observed generation and accept a fresh explicitly observed one. The generation travels as an exact decimal string and does not replace native token/deadline checks.
Verified restores now enqueue their completed ciphertext snapshot before native keys are disposed, so automatic backup can run while the restored safe stays locked. The locked-candidate regression verifies this pending snapshot after a previously completed managed copy.

Hosted fresh-KDBX compatibility checks exposed a pre-existing intermittent synthetic writer race: changing the weak-password fixture before constructor credentials finished hashing could save the original password while the manifest declared `weak`. The writer now awaits credential readiness before replacement, checks every emitted file using a fresh declared-password credential, and supports temporary output via INTEROP_FIXTURE_OUTPUT. No production password engine/profile or committed fixture bytes change.

## Final hosted evidence — 2026-10-06

Code head `ad3a8de8bbd6e86161390f5d29690ceeb5271654`; tested PR merge source `2ebf75fbfd49291bd3cb678aada7e1167fcd3c34`. [Normal CI 37463813032](https://github.com/kurasis/passkeylocal/actions/runs/37463813032) and [Windows CI 37463813205](https://github.com/kurasis/passkeylocal/actions/runs/37463813205) passed. Earlier Windows run 37455672245 passed code/resource tests but two packaging attempts failed fetching the official WebView2 offline installer with `Peer disconnected`. The second attempt was canceled during cache saving to obtain logs promptly. The final build uses the Windows HTTPS client with bounded retries to prefetch the official installer, validates its trusted Microsoft Authenticode signature and seeds Tauri’s cache; the installed app smoke passes. No TLS/signature bypass was used. Windows run 37460830936 packaged successfully but its installed smoke caught immediate re-unlock after Lock All using a stale native generation. The form now disables password admission until a fresh status is observed; the held-status regression first failed on the old UI and all four metadata UI scenarios now pass.

Windows: Clippy and 32 native tests passed (one resource test is separately executed); 161 TypeScript tests; full existing native/KDBX parity; fresh independent file-safe round trips including the real 10,000-file catalog; both isolated production frontends; Python 88 passed / 15 skipped. Normal CI also passed all five Python environments, fresh KeePassXC/KDBX compatibility, the offline Windows recovery kit, eight PWA and four bounded-metadata UI scenarios. Missing platform/hardware tests are not counted as passes.

The installed application passed real native/UI file-safe creation, virtual folder creation, module independence, Lock All and subsequent explicit file-safe password unlock. This also exercises the exact generation-bound password IPC admission. [Downloaded installer](https://github.com/kurasis/passkeylocal/actions/runs/37463813205/artifacts/11415511148) SHA-256 `a5d8e4f709cb0b8e7e59614fbf7e77b0ee0b2b5c118e1aa29c526a7f1afe199d`, 217,789,444 bytes, matches the sidecar/build metadata. [Small verified metadata](../deploy/windows-desktop/) is retained in Git.

Optimized native Windows 5 GiB resource gate: encryption 29.301 s; verification 38.421 s; total 67.726 s; process 68.404 s; sampled peak working set 8,368,128 bytes. CPU/RAM/disk/runner image and OS are recorded in [the resource JSON](../deploy/windows-desktop/file-safe-resource-2ebf75f.json). This is a native streaming-primitive measurement on a hosted virtual machine, not an end-to-end import/export or physical-machine performance claim. Linux final measurement: encryption 12.263 s + verification 10.259 s, process 22.718 s, peak RSS 10,304 KiB.

Preview/physical Hello, clean offline standard-user Windows 11, exhaustive fault/path-race/lifecycle and installed privacy gates remain open as identified above. **Full feature release remains BLOCKED.**

Final hosted 10,000-file restore: 181.867 s; native search: 0.225 s (one matched row). The full restore verifies all referenced encrypted objects; this is not a catalog-only unlock measurement. All four metadata UI scenarios pass, including held-status admission after lock.

Latest [Cloudflare upload archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-fcc9511.zip): 201,838 bytes, SHA-256 `2b55a76d9c6fd9f019017ec226b07412158bcda372212cca5c65070d5eaccb12`. Every archive file equals the final production PWA build; the Windows admission fix is excluded from that target. No server deployment is performed.
