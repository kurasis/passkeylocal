# Release evidence and gate status

This is the gate ledger required by `docs/spec/ACCEPTANCE_TESTS.md`. Every gate
is **passed**, **partial**, **failed**, **not run** or **blocked**, with the
evidence or the reason. "Passed" means an automated test or a recorded manual
run exists and passed; nothing is marked passed because it "should work".

**Overall: not ready for real credentials.** No physical iPhone test has been
run. Passing automated tests is not a security audit; no
independent review has been performed.

Last updated: 2026-10-05 (local passkey and appearance validation; deployed-site results below are historical).

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

Lock policy: `AutoLock` (30 s / 1 / 2 / 5 / 10 / 30 / 60 min, default 2, no
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

See [Windows baseline](windows/BASELINE.md), [acceptance ledger](windows/ACCEPTANCE.md) and [Hello security decision](windows/HELLO_SECURITY_DESIGN.md). Baseline TypeScript 158 tests/build/typecheck and Python 76 tests passed; native Linux algorithm tests and real file-service/shared-engine/full Python parity passed. Physical Windows installation/TPM/Kensington/Safari are not claimed. Windows workflow artifacts are unsigned test builds, not published releases.

Post-change: typecheck, 158 TypeScript tests, web/desktop frontend isolation, 6 Chromium scenarios, 12 native Linux tests, Windows GNU production-origin/permissions compilation and full native-file/Python interoperability passed. npm audit: zero vulnerabilities; RustSec: zero vulnerability advisories, two informational non-Windows graph warnings documented in the Windows report. Full installed Windows/physical-device gates remain open.

Native inactivity regression: exact deadline, activity extension, interval changes and no revival of expired sessions pass in the twelfth Rust test. Native session/status commands run off the Windows event thread; timeout revocation uses an independent clock, avoiding a blocked file write delaying lock. Physical lifecycle tests remain open.

Windows runner execution exposed an ACL setup failure (SetSecurityInfo error 5); native handles now include READ_CONTROL and verify the exact protected DACL after assignment. The Windows rerun is pending.

Windows runner run 37413908839: native Clippy, 12 Windows tests (real replacement + protected ACL verification) and full Python interoperability passed. Windows frontend build exposed an existing file-URL/path conversion bug, now fixed with fileURLToPath. Packaged installer checks remain pending.

Windows run 37414339835 additionally passed both frontend builds, bundle isolation and independent recovery tests. The Tauri build hook workspace selection was corrected and validated from apps/desktop; the installer rerun is pending.
