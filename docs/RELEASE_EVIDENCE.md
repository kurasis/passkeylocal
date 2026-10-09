# Release evidence and gate status

## File Safe placement, context actions and isolated TXT implementation (2026-10-09)

The desktop module switches move into the header and imports/new folders into the
left explorer panel. Right-click/keyboard menus reuse file editing, favorites,
versions, recycle/restore and consent-gated export. Native folder rename preserves
children; confirmed removal refuses root/nonempty folders, including recycled
files. The portable catalog/object format and password/Hello recovery are unchanged.

An additive focused-window preview command authenticates one bounded selected TXT
version before launching a fixed separate unprofiled LPAC worker. Read-only input,
explicit two-handle inheritance, zero-capability token readback, job-at-creation,
child/clipboard restrictions, 256 MiB memory, timeout/cancel and correlated output
are implemented. Strict UTF-8/BOM and inert virtualized, paged text are the only supported
parser path; no plaintext file, broad path API or fallback exists.

Local: 148 Linux native tests passed (three new folder/content/ticket tests).
Cross-Windows GNU Clippy checks the worker/proof FFI; decoder/protocol tests pass.
Six new browser scenarios cover actual menu requests/consent, folder mutations,
keyboard/menu edge placement, inert/virtualized TXT, delayed lock reply and sidebar
placement. Local full UI: 61 passed; TypeScript: 174; production PWA: eight. Typecheck, both
frontends and bundle isolation passed. Actual Windows LPAC/installed results
are recorded at publication; Windows enforcement is **pending**, not claimed by
these local doubles. Initial UI execution needed the supplied Chromium path;
one new assertion needed scope across the existing version-export buttons. The
existing header geometry check now verifies that modules are inside the header
and separate from the brand, rather than requiring their previous lower row.

The first Windows run stopped before application checks because the upstream floating
libsodium stable archive changed (observed SHA-256 `31d03aa0b2855f431c689518fae44e9f6191aea8bc195c0487d69764189672c9`).
The original local archive was reverified with the binding's pinned upstream minisign
public key and retained in the repository with its original signature. The original expected archive
hash remains unchanged; no dependency upgrade or signature bypass was made.
TXT paging bounds browser scroll height to 20,000 segments per section; a 100,000-line
fixture verifies the final line remains reachable. Paging UI and typecheck passed.

The first actual LPAC launch refused creation with Win32 2. Startup now explicitly
sets all standard handles to null, matching the section-only handle list and
Chromium's process startup practice, rather than inheriting CI/console streams.
The actual enforcement tests must pass after this correction.

[TXT implementation/scope](file-safe/TXT_PREVIEW.md). The hostile worker is test-only,
never installed. Full standard-user/indirect-broker/crash/physical preview matrix,
PDF/images and new hardware Hello acceptance remain unverified. Historical owner
reports retain their source and scope; no repeated old diagnostic is requested.

## File Safe explorer publication (2026-10-09)

[PR #35](https://github.com/kurasis/passkeylocal/pull/35) merged as `e63a2859b9f6757603f63a73a5e1e7b474a8826c`;
application tree equals tested source `db201b1edae9dbee69bcd38e54ffc1ba97d8833d` (head `6572c6f939cb5d27c9a0e39aa9222122505dbb5d`).
[General CI 37911616095](https://github.com/kurasis/passkeylocal/actions/runs/37911616095) and
[Windows CI 37911616203](https://github.com/kurasis/passkeylocal/actions/runs/37911616203)
passed all 11 checks. Logs confirm 177 Windows routine native tests, 145 Linux,
174 TypeScript, 55 desktop/browser and eight production PWA scenarios. MSVC/header
ABI, 5 GiB resource, five Python environments, offline recovery kit and fresh
native/Python parity passed. Native storage, permissions, crypto and recovery
source bytes are unchanged by the explorer increment.

Original artifact ZIP matches GitHub digest `sha256:e346db52b3e0a8782e671fe548947bc3b96a521f5cc58f440860ba71edab9915`.
Installer: 219,910,733 bytes; SHA-256 `8e5ded99e1eedf836938c0ccba15e8c5f2e7b29d6660d6ae945fcd37b4afa94f`,
matching original build metadata and sidecar. Real per-user installation,
executable equality, UI/native commands, lock and source correlation passed.
The installed app created native nested folders and traversed parent row,
history and breadcrumb paths. Separate settings retain the fixed Hello command,
password admission and default-session form. An original
[installed explorer screenshot](../deploy/windows-desktop/windows-file-safe-explorer-db201b1.png)
and metadata are retained byte-for-byte in the [download folder](../deploy/windows-desktop/).
Hosted Hello is unavailable; no new physical protected-unlock result is claimed.

Six new UI cases cover nested navigation/current-parent creation, settings/secrets,
late folder replies after lock, bounded 205-folder pages, Russian layout across
three palettes, sort requests and exact sizes above 2^53. Existing independent
Hello and owner reports retain their scope. Physical file-safe biometric, account
isolation, standard-user and preview gates remain unverified; no old diagnostic
repeat is requested. [Explorer guide](file-safe/EXPLORER.md) and
[acceptance ledger](file-safe/ACCEPTANCE.md) explain remaining limits.

Hosted 10,000-file restore: 81.461 s; 5 GiB process:
35.556 s, sampled peak working set 10,649,600 bytes.
[Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-e63a285.zip): 218,294 bytes;
SHA-256 `e514033b6d390ebb52a73e2dc2e09dd283474c0862bdafa124984cef3707206c`. All ten files equal a fresh merged-main web build; native IPC
is absent. No server deployment occurred. Publication changes only docs/artifacts;
application, tests, dependencies and workflows retain the tested bytes.

## File Safe explorer and separate settings (2026-10-09)

The [explorer interface](file-safe/EXPLORER.md) now displays folders before files
in one virtualized column list, with native name/date/size sorting, exact integer
size labels, parent row, logical breadcrumbs and bounded Back/Forward history.
New folders and imports target the current native folder. Native file/folder
pagination limits are preserved. Folder navigation clears stale selection/search
and paging offsets; lock clears both metadata and navigation history and rejects
late folder replies. Settings (Hello, backups/recovery, password, inactivity) are
a separate view that returns to the same location and clears unsubmitted secrets.

Local type checks, both frontends and target isolation passed. All 174 TypeScript
tests, 55 desktop/browser UI scenarios and eight production PWA scenarios passed.
Six new synthetic scenarios cover nesting/history/parent/breadcrumbs, correct
parent creation, separate settings and password clearing, late folder reply at
lock, 205-folder bounded paging, Russian responsive layouts in all three themes,
sort requests and large exact sizes. Existing Hello and session tests remain.
One initial new check exposed the inactivity select's ambiguous implicit label;
an explicit label/control association corrected it and the full suite passed.

Installed Windows smoke is extended to create actual native nested folders,
traverse the parent row/history/breadcrumb path and verify the separate Hello
settings screen. Final Windows/MSVC artifact provenance and original screenshot
are recorded at publication. Native storage/crypto/IPC permissions, portable
format and Python recovery bytes are unchanged. No new biometric, preview or
physical reader result is claimed; their existing evidence limits remain.

## File Safe Windows Hello publication (2026-10-09)

[PR #34](https://github.com/kurasis/passkeylocal/pull/34) merged as `58084c47377d17e634a0d1839baf7cff24a96d46`;
application tree equals tested source `5369fadd0dc35c03cb568125cae7c444ec9e8472` (head `93821b69e978f9f75a7862cccb397b6eecc73dfb`).
[General CI 37893262472](https://github.com/kurasis/passkeylocal/actions/runs/37893262472) and
[Windows CI 37893262653](https://github.com/kurasis/passkeylocal/actions/runs/37893262653)
passed all 11 checks. Logs confirm 177 Windows routine native tests, 145 Linux,
174 TypeScript, 49 desktop/browser and eight production PWA scenarios. MSVC/header
ABI, 5 GiB resource, five Python environments, offline recovery kit and fresh
native/Python recovery parity passed. Locally the Python corpus was 91 passed /
12 skipped (Windows ACL and absent KeePassXC), never counted as passes.

Original artifact ZIP matches GitHub digest `sha256:b8d036e2f5d85ad2784a545e37be5003bfdb276d3194b48232471dec190dcd52`.
Installer: 219,901,819 bytes; SHA-256 `4fdd5dbc13a323f1de41766d048b96ce2b8e1d02144b7840138f775563bf255a`,
matching original build metadata and sidecar. Real per-user installation,
executable equality, worker/native command admission, UI, lock and source
correlation passed. File-safe status/no-record revoke exposes no root; stale and
malformed requests and a wrong safe password are refused. The actual connection
form has four modes, session default and required empty password. Original
[file-safe controls](../deploy/windows-desktop/windows-file-safe-hello-5369fad.png)
and other metadata are retained byte-for-byte in the [download folder](../deploy/windows-desktop/).
Hosted Hello is unavailable; physical file-safe unlock is not claimed.

Independent experimental opt-in is available. Existing password-vault enrollment
AAD/namespace bytes remain compatible; its prior owner feedback retains its own
scope. New physical file-safe acceptance, broader lifecycle/negative cases and
excluded account-isolation measurement remain unverified. No completed diagnostic
repeat is requested. [File-safe connection guide](file-safe/WINDOWS_HELLO.md) and
[acceptance ledger](file-safe/ACCEPTANCE.md) describe these limits; preview remains
blocked by separate OS-isolation requirements.

Hosted 10,000-file restore: 159.504 s; 5 GiB process:
46.463 s, sampled peak working set 10,645,504 bytes.
[Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-58084c4.zip): 217,566 bytes;
SHA-256 `ebf4fe5dc264712fde436356535c74350fbf8c94130c954cd259b46d0dc78459`. All ten files equal a fresh merged-main web build; native IPC
is absent. No server deployment occurred. Publication changes only docs/artifacts;
application, tests, dependencies and workflows retain the tested bytes.

## Independent File Safe Hello integration (2026-10-09)

[File-safe Hello](file-safe/WINDOWS_HELLO.md) now protects the safe's random root
with its own native WebAuthn PRF/TPM envelope. Enrollment confirms the safe password
again; unlock authenticates the current catalog before publishing its independent
token. Root/PRF material never reaches the renderer. Separate RP/key/domain/journal
and authenticated full safe/store/root-epoch binding reject cross-module use.
Shared-envelope changes preserve existing password-vault serialized AAD/namespaces.
Session mode is memory-only/default; 6/12/24-hour remembered modes are explicit.
Rotation/restore durably invalidate before storage writes; exact-object removal
retains failed cleanup for retry. Portable v1 bytes and Python recovery are unchanged.

Local checks passed: 145 routine native tests (one separate resource test ignored),
174 TypeScript tests and 49 desktop/browser scenarios. Ten new native tests cover
actual safe/catalog/file opening, backup/password recovery, fresh password/token
admission, cancellation/wrong root/late result, restart, rotation/restore, failed
cleanup, fixed IPC, cross-purpose substitution and legacy AAD compatibility.
Three new UI cases cover opt-in/modes/cancel/password fallback, late lock replies
and Russian responsive controls. Type checks and Linux/Windows GNU Clippy pass.
Final Windows/MSVC, independently recovered format and installed artifact results
are recorded at publication; GNU cross-checking is not a Windows hardware run.

New file-safe physical acceptance on the owner's Kensington remains pending.
Existing password-vault owner/synthetic reports retain their original scope and
bytes. No prior diagnostic repetition or excluded second-account test is requested.
Preview isolation remains a separate incomplete gate.

## Windows Hello developer handoff and owner feedback (2026-10-09)

The owner replied “works” after delivery of the PR #32 installer. This records
basic owner-reported application-flow success, not a new source-stamped hardware
report or a complete lifetime/restart/revocation/negative-case matrix. The reply
did not specify a mode or new prompt count. Earlier raw diagnostic reports and
their flags remain unchanged; other-account manual testing stays excluded and
unverified. This scoped feedback updates the earlier blanket pending-flow notes.

The standalone [developer handoff](windows/WINDOWS_HELLO_DEVELOPER_HANDOFF.md)
documents the actual PRF/TPM envelope, code/IPC boundaries, fixed namespaces,
lifetimes, ownership/cleanup, unsuccessful candidates, native ABI/parser pitfalls,
test requirements, evidence limits and a reusable development-agent brief.
README and the enrollment guide link it. Its baseline is published source
`c18894e210a07546ba66cf178b8048ae5c40ac61`, not a new installer.

Documentation-only validation checks relative links, source symbols/constants,
preserved raw owner reports, whitespace and unchanged application/test/workflow/
artifact bytes. No new runtime tests, hardware run, build or deployment are
claimed for this documentation change.

## Windows Hello enrollment publication (2026-10-08)

[PR #32](https://github.com/kurasis/passkeylocal/pull/32) merged as `6185e8008c8f1b943cb61de61ac2e7c8875d2523`;
application tree equals tested source `c18894e210a07546ba66cf178b8048ae5c40ac61` (head `977fe6a4bab63992868dbb2462fddb786e2e8107`).
[General CI 37815672521](https://github.com/kurasis/passkeylocal/actions/runs/37815672521) and
[Windows CI 37815672528](https://github.com/kurasis/passkeylocal/actions/runs/37815672528)
passed all 11 checks. Logs confirm 167 Windows routine native tests, 135 Linux
routine native tests, 174 TypeScript tests, 46 desktop/browser scenarios and
eight production PWA scenarios. MSVC/header ABI, 5 GiB resource, OS/version
recovery matrix, offline kit and independent native/Python parity passed.

Original artifact ZIP matches GitHub digest `sha256:8582406d26631b43b6df6240ea1d3d577c5be2367933059e71f107602dfdf960`.
Installer: 218,130,545 bytes; SHA-256 `cde3091431697da7b8d958c271dc91f6d67186bc266b9b4f120723cf7d537642`,
matching original build metadata and checksum sidecar. Actual installation,
binary equality, UI/IPC/lock and provenance checks passed. The new fixed command
returned off/no-record revoke without a component, refused malformed actions and
stale sessions, and populated the installed worker-backed connection form.
The original Russian screenshot shows the lifetime/password/connect controls.
Hosted Windows has no usable Hello/TPM; this is not a physical enrollment pass.

[Installer/evidence](../deploy/windows-desktop/) and
[connection procedure](windows/HELLO_VAULT_ENROLLMENT.md) are published.
Experimental explicit opt-in is available; physical application-lifecycle,
standard-user and remaining OS-negative acceptance are pending. The owner's
completed synthetic evidence is unchanged. Other-account manual testing remains
excluded and unverified; no previous diagnostic repeat is requested.

10,000-file restore: 78.239 s. Hosted 5 GiB process:
50.399 s; sampled peak working set 10,551,296 bytes.
[Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-6185e80.zip): 217,566 bytes;
SHA-256 `7a5f9614dfca533d83d121a7103f52a6aa9e5c211dcca59220dd61b63fe05365`. All ten files match a fresh production build;
native enrollment IPC and the desktop worker are absent. No server deployment
occurred. Publication changes only documentation/artifacts; application/test/
dependency/workflow bytes remain the tested version.

## Experimental active-vault Hello integration (2026-10-08)

[Vault enrollment](windows/HELLO_VAULT_ENROLLMENT.md) now connects native PRF/TPM
protection to the active crypto worker. Session mode is the default; remembered
6/12/24-hour modes are explicit opt-ins. Each unlock needs protected authorization
and current head/session checks. Password change/restore/replacement invalidates
the old enrollment before the write. Disable revokes only app-owned keys;
deferred deletion remains visible, and password-based recovery is preserved.
No master-password string or new password verifier is stored in the envelope.

Local checks passed: 135 routine native tests (13 new enrollment/input
cases; one resource test excluded from the routine run), 174 TypeScript tests
(including six new real KDBX worker cases), 46 desktop/browser scenarios and
eight production PWA scenarios. The actual vault worker/native bridge was
exercised with synthetic IPC. Type checks, Linux and Windows GNU Clippy, both
frontend builds, native/web separation and independent Python recovery passed. Full
Windows/MSVC and installed smoke results are recorded on publication; GNU checking
is not a physical Windows runtime pass. The new packaged IPC smoke checks only
nonsensitive off/revoke, malformed input and stale-session behavior, plus the
real worker-populated connection form and its default lifetime on the hosted
runner. Physical acceptance of this new opt-in lifecycle remains pending.

The initial installed-form check caught the lifetime label including nested
option text in exact label queries. An explicit label/control association fixes
that boundary; the same exact-label regression is covered by the local UI test.
The failed installer was not published; final packaging must pass this check.

The completed owner recovery/copy/restart reports retain their original flags
and scope. Second-account manual testing stays excluded and unverified. No new
hardware success or repetition of completed diagnostic procedures is requested.

## Completed owner KDBX recovery integration (2026-10-08)

The [original owner report](../deploy/windows-desktop/hello-target-9200a4b-vault-recovery.json)
identifies installed source `9200a4b0bb3d4fc33b9e50fc356cc355b3ff51ae` and passes
all 27 stages. The actual native-unwrapped component opened and re-saved the
built-in public KDBX. Temporary passkey absence, a live TPM positive control,
TPM deletion/exact absence (`0x80090016`) and journal cleanup passed. A wrong
password was refused; fresh ordinary password credentials recovered two entries
and one historical version with full logical integrity after key removal.

Outcome/state is `vault-recovery-passed` / `no-test`; scope is
`public-synthetic-kdbx` / `same-process`. This completes the
[one-button physical sequence](windows/HELLO_VAULT_RECOVERY.md), without a new
prompt-count/modality or fresh-process claim. No repeat, additional cleanup or
new installer is requested. Production enrollment/lifecycle and remaining
authorization negatives remain pending. Other-account manual testing stays
excluded and unverified. Original false flags and static `remaining` are intact.
This result supersedes the physical-result-pending notes in the earlier entries.

Evidence-only validation checked report structure, ordered stages, source and
fixture correlation, local documentation links, whitespace and unchanged
application/test/dependency/workflow/artifact bytes. No new test suite, build,
installer or deployment is claimed for this documentation update.

## KDBX recovery integration publication (2026-10-08)

[PR #30](https://github.com/kurasis/passkeylocal/pull/30) merged as `8d2d95b4d074cb37fd6f7c0f78cfa9468a9e9a47`;
application tree equals tested source `9200a4b0bb3d4fc33b9e50fc356cc355b3ff51ae` (head `c1d55c3f7a3a54b818bce8bfb3a0324c49935d5b`).
[General CI 37795750725](https://github.com/kurasis/passkeylocal/actions/runs/37795750725) and
[Windows CI 37795750712](https://github.com/kurasis/passkeylocal/actions/runs/37795750712)
passed all 11 exact-head checks. Logs verify 154 Windows routine native tests
(32 portable combined/copy/recovery cases), separate MSVC/header ABI and 5 GiB
resource checks, 122 Linux native tests, 168 TypeScript tests, 43 desktop/browser
worker scenarios and eight production PWA scenarios. Recovery matrix/offline
kit/fresh interop passed, including the new component-opened/re-saved KDBX check:
independent Python wrong-password refusal and complete logical recovery parity.
10,000-file restore: 136.150 s; hosted 5 GiB process:
45.269 s; sampled peak working set 10,616,832 bytes.

Downloaded original ZIP matches GitHub digest `sha256:079a62b476df23f554d0aa8bf31be656144f06f8877d5d91615985e35e0317f6`.
Installer matches original build metadata and sidecar: `d92b83420c8b2e0d6110a1e998effdef00dd255472db1f5c41331532293ac13a`,
218,094,016 bytes. Actual installation/binary equality and packaged
UI/IPC smoke passed. The new recovery no-record revoke and existing-test refusal
return no credential or ticket. Hosted Windows has no usable Hello/TPM; no
physical success is inferred from these paths or synthetic IPC browser doubles.

[Installer/evidence](../deploy/windows-desktop/) and the [one-button procedure](windows/HELLO_VAULT_RECOVERY.md)
are published. The owner needs only the current account and one report; previous
copy/restart/object-loss measurements are complete. This actual KDBX integration
uses a public fixture and temporary native keys; arbitrary user-vault enrollment
remains disabled. Physical integration observation, production lifecycle and
remaining authorization negatives are pending. Other-account manual testing
remains excluded and unverified. Original owner reports/flags are unchanged.

[Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-8d2d95b.zip): 215,568 bytes,
SHA-256 `0528aec8d4fdb193f17393048e3e1ec99d8f1c4cd04717b749947d101024338b`; all ten files equal freshly rebuilt production output. Native
IPC and the built-in desktop recovery worker/fixture are absent from the web build.
No server deployment occurred. Publication changes only docs/deploy artifacts;
application/test/dependency/workflow bytes remain the tested version.

## Current-account KDBX recovery integration (2026-10-08)

The [one-button recovery experiment](windows/HELLO_VAULT_RECOVERY.md) connects a
native-unwrapped public fixture password component to the actual KDBX engine,
re-saves with fresh salts, deletes its scoped native keys, then independently
checks wrong-password refusal and full password recovery with entries/history.
The adapter uses kdbxweb's public passwordHash component interface; portable KDBX
and Python recovery stay unchanged. A dedicated worker never accesses the active
vault. Native tickets, session redaction and durable cleanup prevent stale work
from adopting/deleting another test. No production user vault is enrolled.

Local validation passed: 122 routine native tests (33 combined/copy/recovery),
168 TypeScript tests, 43 desktop/browser-worker scenarios, independent Python
recovery of component-opened/re-saved KDBX, Linux and Windows GNU Clippy, both
frontend builds and target isolation. Windows/MSVC, installed smoke and publication
subsequently passed as recorded above. Physical KDBX/Hello acceptance awaits the owner. Prior
restart/copy/key-loss evidence remains complete, and other-account manual testing
remains excluded and unverified. Real-vault enrollment/lifecycle is still pending.

## One-account manual acceptance and completed copy observation (2026-10-08)

At the owner's explicit request, the [current manual plan](windows/HELLO_OWNER_ACCEPTANCE.md)
uses the existing Windows account and excludes a second-account test on the same
PC. That isolation is unverified, not passed, and does not block development of
current-account password recovery and lifecycle coverage. Native account scoping,
cryptographic requirements and automated boundary tests remain in force. The
Kensington H-08 row and active procedures now distinguish second-PC evidence from
excluded other-account testing; older investigation text is historical.

[Destination](../deploy/windows-desktop/hello-target-cdcc954-copy-destination.json)
passes six stages with `copy-isolation-observed`, `different-installation`, and
both keys missing (exact TPM open `0x80090016`; passkey `combined-credential-missing`).
[Source recheck](../deploy/windows-desktop/hello-target-cdcc954-copy-source.json)
passes seven stages with `copy-source-roundtrip-passed`, matching current context,
both keys opened and authenticated decryption. Both identify cdcc954 source and
`processScope: not-measured`. The supplied 3,119-byte file SHA-256 is
`844f0313dd5a69463d1cb817d4e151857ae807a4dfaa969d1300fa6df02ebcef`,
matching both reports. The initial export report was not supplied or reconstructed;
the later authenticated source roundtrip and identical file digest support the
narrow observed transfer result. No fingerprint count/modality is inferred.

[Cleanup](../deploy/windows-desktop/hello-target-cdcc954-copy-cleanup.json) passes
all four stages: journal cleanup, passkey deletion, TPM-key deletion and journal
deletion. Outcome/state is `combined-cleaned` / `no-test`; its shared-command
purpose and same-process scope are preserved. No repeated measurement is needed.
[Evidence index](../deploy/windows-desktop/hello-target-cdcc954-copy-evidence.json)
records the scopes and missing initial export report. Real enrollment/unlock
and all original false flags/static remaining arrays are unchanged.

This change updates requirements, procedures and received evidence only. Validation
checks report stages/codes/sources, exact uploaded-file hash/size, documentation
links, and unchanged application/installer/Pages bytes. No new hardware test,
application test suite, build or deployment is claimed. Production master-password
fallback, remaining authorization negatives and enrollment/lifecycle integration
are pending; the current installer does not yet run that recovery sequence.

## Copy-file publication (2026-10-08)

[PR #28](https://github.com/kurasis/passkeylocal/pull/28) merged as `241e2b515914089754a1815219eec74b4ad85a36`;
application tree equals tested source `cdcc9542b891b808824c1ca7ce471a260ef176b5` (head `ae6143d520964f5a6e6b3a073fa1c3c705134ad6`).
[General CI 37783742796](https://github.com/kurasis/passkeylocal/actions/runs/37783742796) and
[Windows CI 37783742741](https://github.com/kurasis/passkeylocal/actions/runs/37783742741)
passed all 11 exact-head checks. Logs verify 147 Windows routine native tests
(25 portable combined/copy plus four Windows context/command cases), separately
executed MSVC/header ABI and 5 GiB resource checks, 115 Linux native tests,
161 TypeScript tests, 37 desktop UI and eight production PWA scenarios,
recovery matrix/offline kit/fresh interop.
10,000-file restore: 108.959 s; hosted 5 GiB process:
44.633 s; sampled peak working set 10,604,544 bytes.

Downloaded original ZIP matches GitHub digest `sha256:eb4d5a2fa700077131e483d2de7ffed6eecca0ac9bd1f1c06fd10ba0a9646b6f`.
Installer matches original build metadata and sidecar: `b987738eed24eb11aab84d74d1636d44e8be0b78b1ea5edc6884e024c799405b`,
217,970,294 bytes. Actual installation/binary equality and packaged
UI/IPC smoke passed. Fourteen source-matched reports retain false enrollment,
eligibility and unlock. No-record copy export returns without a dialog or keys;
the read-only check control is available without Hello. The hosted machine has
no usable Hello/TPM. Unit tests cover native-dialog orchestration, but actual
cross-computer execution awaits the owner; automated checks do not replace it.

[Download evidence](../deploy/windows-desktop/) and the [two-computer protocol](windows/HELLO_COPY_TEST.md)
are published: export → foreign observation → matching source decryption → cleanup.
Correlate all three complete-file digests; imported metadata alone is untrusted.
Only the synthetic envelope is transferred, not native private-key containers.
Prior restart/cancellation/key-loss observations remain complete. Other-account
copy, password fallback, remaining authorization negatives and production
integration remain open; real-vault Hello enrollment/unlock stays disabled.

[Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-241e2b5.zip): 214,600 bytes,
SHA-256 `78374ea220b914d45a99b827417addf0a7679f177773d546f41e67d413549442`; all ten files equal freshly rebuilt production output, with
native IPC absent. No server deployment occurred. Publication changes only docs
and deploy artifacts; application/test/dependency/workflow bytes remain tested.

## Synthetic copy-file implementation (2026-10-08)

The [copy-file experiment](windows/HELLO_COPY_TEST.md) adds source export/re-export
and a read-only destination/source check through fixed native commands. Source
context labels are authenticated with the encrypted record; foreign observations
require full-file digest correlation with export and subsequent source decryption.
The import adapter cannot create/delete keys or persist an imported journal.
Only exact missing-key observations count; provider errors and unexpected foreign
decryption fail. Old restart/key-loss measurements remain completed and unchanged.

The owner has a second Windows computer. The documented next measurement is
source export → destination observation → source positive control → cleanup.
Real cross-computer/account-copy results, password fallback and production
integration remain pending; enrollment and unlock remain disabled.

Local validation: 26 combined/copy tests, all 115 routine native tests (one
resource test ignored in the routine run), 161 TypeScript tests and 37 desktop
UI scenarios passed. Linux and Windows GNU Clippy, both production frontends
and target isolation passed. MSVC CI, installed-app smoke and installer
publication subsequently passed as recorded above.

## Completed owner temporary key-loss measurement (2026-10-08)

The [owner report](../deploy/windows-desktop/hello-target-4b3ba34-key-loss.json)
for source `4b3ba340f684fc6adefc5b5e2a2e0295add18249` passes all 20 stages.
It records successful combined decryption before deliberate deletion, an absent
passkey on scoped reopen, a successful independent TPM reopen before deletion,
and then `NTE_BAD_KEYSET` (`0x80090016`) from the exact deleted-key open operation.
Both cleanup paths, journal deletion and the final session check passed.
Outcome/state is `combined-key-loss-passed` / `no-test`.

The requested synthetic object-loss procedure is complete on the owner's target;
no repeat, manual deletion, restart or replacement installer is requested.
Preserve `processScope: same-process` and false eligibility/enrollment/unlock.
The static `remaining` array is not a list of failed stages. This report does not
measure cross-account/machine copying, production password recovery after key
loss, physical memory erasure or silent-PRF refusal. It contains no explicit
prompt-count/modality observation, so no additional fingerprint confirmation is
inferred. Earlier owner reports remain valid within their original scope.

Next implementation/acceptance work is account/machine-copy resistance, password
fallback and production enrollment/lifecycle coverage, plus remaining
authorization negatives. Real-vault Hello unlock remains disabled.

This evidence-only update validates report source, exact ordered stages, absence
codes/operations, state/flags and links. It changes no application, installer or
Pages archive and claims no new automated test run or build.

## Temporary key-loss publication (2026-10-08)

[PR #27](https://github.com/kurasis/passkeylocal/pull/27) merged as `0eb2a195a15567bba124fc0cd2591a5028b5ac50`;
application tree equals tested source `4b3ba340f684fc6adefc5b5e2a2e0295add18249` (head `a4e9a3cb2870a4716f8350e5735d0c6ba3246ab6`).
[General CI 37773038077](https://github.com/kurasis/passkeylocal/actions/runs/37773038077) and
[Windows CI 37773037961](https://github.com/kurasis/passkeylocal/actions/runs/37773037961)
passed all 11 exact-head checks. Logs verify 133 Windows routine native tests
(including 15 combined cases), separately executed MSVC/header ABI and 5 GiB
resource checks, 105 Linux native tests, 161 TypeScript tests, 34 desktop UI and
eight production PWA scenarios, recovery matrix/offline kit/fresh interop.
10,000-file restore: 119.156 s; hosted 5 GiB process:
92.363 s; sampled peak working set 10,563,584 bytes.

Downloaded original ZIP matches GitHub digest `sha256:683f1f401e401a5404b57f8394bf2ae171ed21d5613c9d9183938d0041d67f67`.
Installer matches original build metadata and sidecar: `06d06cdfdcc016de8dfb4f44ecf5e07b43281f528a92d6e538fe6d2bdf7f7a63`,
217,949,570 bytes. Actual installation/binary equality and packaged
UI/IPC smoke passed. Thirteen source-matched reports retain false enrollment,
eligibility and unlock. On the hosted machine the new key-loss IPC stops at
unavailable PRF preflight, creates no native keys and retains its recovery
journal when the unavailable TPM provider prevents absence verification. This
is a tested failure path, not a physical key-loss success.

[Download evidence](../deploy/windows-desktop/) and the [new single-button target
procedure](windows/HELLO_KEY_LOSS.md) are published. The subsequently supplied
owner report above completes the physical key-loss observation. Prior restart/cancellation/cleanup observations
remain complete. Account/machine copy, password fallback, remaining authorization
negatives and production enrollment/lifecycle acceptance remain open.

[Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-0eb2a19.zip): 213,004 bytes,
SHA-256 `bc357044cde261cefa8db26e46eb34cdab3168e81f5be5e1d5f23012c90fd967`; all ten files equal freshly rebuilt production output, with
native IPC absent. No server deployment occurred. Publication changes only docs
and deploy artifacts; application/test/dependency/workflow bytes remain tested.

## Temporary key-loss implementation (2026-10-08)

The [next synthetic experiment](windows/HELLO_KEY_LOSS.md) adds one fixed native
command and RU/EN button. It creates its own PRF/TPM pair, verifies decryption,
then deliberately deletes and reopens each identity with strict absence checks.
Nonresumability is journaled before deletion; failures retain cleanup recovery.
It refuses to reuse an existing restart experiment. Real vault enrollment and
unlock remain disabled. The physical key-loss observation subsequently passed
as recorded above; account/machine copy, password fallback and remaining
authorization/production gates remain open.

Local validation: TypeScript typechecks and all 161 package tests PASS; 105
routine native tests PASS (one resource test remains ignored in the routine
suite); 33 desktop UI scenarios PASS, then all three key-loss scenarios PASS
including the added late-result/Lock All case. Native clippy, both production
frontend builds and bundle isolation PASS. Windows CI, the packaged command and
the owner-facing installer subsequently passed as recorded above. The earlier owner reports
below remain intact and need no repeated measurement.

## Completed owner cancellation/cleanup sequence (2026-10-08)

After the [cancelled first assertion](../deploy/windows-desktop/hello-target-a7f56d8-combined-cancel.json),
the owner supplied the requested [cleanup report](../deploy/windows-desktop/hello-target-a7f56d8-combined-cleanup.json)
for source `a7f56d80d6029bcd4185ca6d3ad22d08f957561a`. All four cleanup
stages PASS: journal marked for cleanup, test passkey deleted, test TPM key
deleted, and journal deleted. Outcome is `combined-cleaned`, final state `no-test`.

The requested cancellation followed by explicit cleanup is complete. Together
with the earlier successful preparation/restart reports and the owner's four
fingerprint confirmations, this completes the current target procedure. No
repeat, new test, manual key deletion or installer is requested from the owner.
The reports are attributed to the owner's supplied sequence; they do not expose
credential/key identifiers for independent cross-report identity correlation.

Preserve `processScope: same-process` in this cleanup report: it is the cleanup
operation's scope, not another fresh-process unlock measurement. The earlier
restart and cancellation reports retain their own `fresh-process` scope. No
additional fingerprint prompt, successful retry after cancellation, silent-access
denial or production enrollment is inferred. False eligibility/enrollment/unlock
and the original static `remaining` list are preserved.

Next implementation/acceptance work is synthetic account/machine-copy and
key-loss/password-fallback coverage, remaining authorization negatives, and
production enrollment/lifecycle integration. Real Hello unlock remains disabled.
A future target procedure must exercise new coverage rather than repeat the
completed component, successful restart or first-cancellation/cleanup sequence.

This documentation/evidence update validates report source, stages, flags and
links. It changes no application code, installer or Pages archive and claims no
new cloud test execution, build or deployment.

## Owner cancellation measurement (2026-10-08)

The [owner cancellation report](../deploy/windows-desktop/hello-target-a7f56d8-combined-cancel.json)
matches installed source `a7f56d80d6029bcd4185ca6d3ad22d08f957561a`.
In a fresh process, exact-object reopening/binding passed, then the first
WebAuthn assertion returned `0x80090036` (`NTE_USER_CANCELLED`). The combined
unwrap stage and overall outcome are `cancelled`; no successful unwrap or
later operation is reported. Eligibility, enrollment and unlock remain false.

`ready-to-resume` is the expected retained test state after cancellation. It
indicates availability for retry/cleanup, not a measured successful retry.
This completes the requested first-assertion cancellation observation. It does
not by itself establish silent-access denial, cancellation of every other stage
or cleanup. The owner has now supplied the separate cleanup report above; the
earlier successful run's deletion was not substituted for this observation.

The requested cleanup is now complete as recorded above. No repeat, restart or
new installer is needed. Account/machine copies, key-loss/password fallback,
remaining authorization negatives and production lifecycle acceptance remain open.

The original report and static `remaining` array are preserved. This evidence
update checks source/stage/flag consistency, links and documentation-only scope;
it does not change application code or claim a new cloud test/build/deployment.

## Completed owner combined/restart measurement (2026-10-08)

The owner supplied [preparation](../deploy/windows-desktop/hello-target-a7f56d8-combined-prepare.json)
and [restart](../deploy/windows-desktop/hello-target-a7f56d8-combined-resume.json)
reports for installed source `a7f56d80d6029bcd4185ca6d3ad22d08f957561a`.
All nine preparation stages and all seven restart stages PASS. The combined
Hello PRF/AES-GCM + locally bound TPM envelope recovered its synthetic secret
in a fresh process with two separate authorization/decryption operations.
The passkey, TPM key and journal were deleted; final state is `no-test`.

The owner's separate statement, translated from Russian, is **"Two fingerprint
verifications for each button."** This confirms four fingerprint verifications:
creation plus the first combined unwrap during preparation, then each of the two
combined unwraps after restart. Fresh prompting on this successful path is now
owner-observed; it is not inferred solely from the required-UV flag or HRESULT.
Previously supplied Windows/Kensington context is unchanged; these reports do
not contain a new OS build, device or driver observation.

The successful combined, fresh-process and per-operation fingerprint measurement
is complete. Do not ask for that successful run or the standalone component
probes again. First-assertion cancellation is now recorded above; silent-access
negatives, account/machine copies,
key-loss/password fallback and production enrollment/lifecycle acceptance remain
open. Keep both original three-item `remaining` arrays and false eligibility,
enrollment and unlock flags intact: they are static release-state metadata,
not three failed measurements. No real vault was enrolled or unlocked.

The subsequently supplied cancellation report above completes the next requested
negative observation, and its separate cleanup report now completes the requested
sequence. Do not repeat the successful path, first-assertion cancellation or cleanup.

This update records owner evidence and updates current guidance only. Report
source/stages/flags, relative links and documentation-only scope were checked.
No application change, new software test execution, rebuild or deployment is
claimed; the published installer and Pages archive remain unchanged.

## Combined Hello PRF + TPM restart publication (2026-10-08)

[PR #26](https://github.com/kurasis/passkeylocal/pull/26) merged as `cedae01de4a19b8810c4bf6a3a0bbc9d3323f170`;
application tree equals tested source `a7f56d80d6029bcd4185ca6d3ad22d08f957561a` (head `c757fdc45eb79b110c7835173e31ba28d476cb87`).
[General CI 37764316873](https://github.com/kurasis/passkeylocal/actions/runs/37764316873) and
[Windows CI 37764316715](https://github.com/kurasis/passkeylocal/actions/runs/37764316715)
passed all 11 exact-head checks. Logs verify 127 Windows native tests (including
nine portable combined cases and the exact RP/user selector), separately run
MSVC/header ABI/resource gates, 99 Linux routine native tests, 161 TypeScript
tests, 31 UI/eight PWA scenarios,
recovery matrix/offline kit/native parity/fresh encrypted-file recovery.
10,000-file restore: 108.248 s; 5 GiB process: 92.980 s,
sampled peak working set 10,592,256 bytes.

Downloaded original artifact ZIP matches GitHub digest `sha256:2af3386c15442dcfff2b419e64ad1de49c676563aaf307eb62dfe0816abc130f`.
Installer matches original metadata/sidecar: `5f280928cb26bab52f114be629dfd578b682de8615548af932c02cef616db547`,
217,960,718 bytes. Actual NSIS install, binary equality, packaged
UI/storage/lock and twelve source-matched native reports PASS. The combined
status/resume/cleanup commands were exercised without a saved test. Hosted
Hello/TPM preflight blocks target crypto creation; no physical combined success
is inferred. [Original download evidence](../deploy/windows-desktop/) and the
[new target procedure](windows/HELLO_COMBINED_RESTART.md) are published.

The subsequent owner measurement above completes the successful combined
authorization/restart path. Cancellation/silent negatives, account/machine-copy
and real enrollment acceptance remain pending. Prior component reports remain valid.
Publication adds only download evidence and deployment archives; no app changes.

[Cloudflare downloads](../deploy/cloudflare-pages/) contain `passkeylocal-cloudflare-pages-cedae01.zip`,
212,202 bytes, SHA-256 `2d91e4089a647ce117688f98c065d04bc2c484c36975917693c6e202eaead045`. All ten files equal freshly rebuilt production
output; native IPC is absent. No server deployment occurred. Publication changes
only docs and deploy artifacts; tested app/test/dependency/workflow bytes match.

## Combined Hello PRF + TPM restart implementation (2026-10-08)

The [combined synthetic protocol](windows/HELLO_COMBINED_RESTART.md) now composes
Hello PRF/HKDF/AES-GCM with the locally verified nonduplicable TPM RSA key. It
adds a bounded atomic per-user journal before either key creation, exact
RP/user-scoped credential recovery after a crash, full-process restart
discrimination, two new required-UV decryptions and retryable independent cleanup.
No real-vault enrollment, unlock or copied-account/device proof is claimed.

Local verification: ten portable combined orchestration/crypto/journal cases
PASS, 31 desktop UI scenarios PASS, 161 TypeScript tests and typechecks PASS;
Windows-target Clippy with warnings denied PASS. Desktop/PWA production builds
and independent bundle/IPC separation PASS. The earlier full Linux native
run passed 97 tests with one explicit resource gate ignored; the subsequently
added fixed-staging crash test passed in the focused run. A new injected
unreadable-journal cleanup test first reproduced a missing failure stage; the
corrected ten-case combined suite passes. No native deletion occurs after that
read failure. Windows
MSVC ABI/native tests, packaged IPC and installer validation subsequently passed
as recorded above. The owner has now completed the successful combined/restart
measurement; cancellation negatives remain pending. Standalone evidence is preserved.

## Completed local TPM binding target measurement (2026-10-08)

The [owner report](../deploy/windows-desktop/hello-target-bbead07-tpm-local-binding.json)
matches installed/tested source `bbead0731ae5fc1bbb4171e861306c70b5257369`.
All 12 stages PASS, including exact CNG/PCP/TPM public-key and SHA-256 Name
comparisons before/after reopening, actual OAEP/SHA-256 decrypt, negative controls
and deletion. `objectAttributes: 132210` (`0x00020472`) includes fixedTPM,
fixedParent, sensitiveDataOrigin, userWithAuth, noDA and decrypt. Local binding
and duplication restrictions of this exact synthetic key are now observed under
the trusted Windows/Platform KSP/TBS model. The target measurement is complete.

The report explicitly remains same-process / no-Hello-authorization with empty
export checks and false eligibility/enrollment/unlock. Preserve its four-item
`remaining` list verbatim: it is static release-state metadata, not a failed-test
list. No new fingerprint, driver, OS, signed-attestation or private-export-denial
evidence is inferred. The key was deleted; no production enrollment exists.

Next is [synthetic PRF/TPM composition](windows/HELLO_LOCAL_TPM_BINDING.md#next-implementation-boundary),
fresh authorization/cancellation, durable cleanup and full app restart, followed
by account/machine copies and production lifecycle acceptance. Component success
does not satisfy those release gates. Do not rerun completed standalone probes.

This update preserves owner evidence and corrects current documentation only.
Source/stage/schema/attribute consistency and relative links were checked. No new
software or hardware test was executed in the cloud; application, tests,
dependencies, workflows, installer and Pages archive are unchanged. No rebuild,
new deployment, policy change or feature activation is claimed.

## Local TPM binding publication (2026-10-08)

[PR #25](https://github.com/kurasis/passkeylocal/pull/25) merged as `c5e3481a118fd9c50cb2adcb3cc741cacba1ea2a`;
application tree equals tested source `bbead0731ae5fc1bbb4171e861306c70b5257369` (head `2f51e3d4e60eea9a34e0066d85a2a39dc9d29f89`).
[General CI 37755898901](https://github.com/kurasis/passkeylocal/actions/runs/37755898901) and
[Windows CI 37755898908](https://github.com/kurasis/passkeylocal/actions/runs/37755898908)
passed all 11 exact-head checks. The first macOS job acquired no runner and was
cancelled for GitHub ARM64 capacity; a queued retry did not execute. The same
recovery tests now pass on supported macOS 15 Intel; no new ARM64 execution is
claimed. Logs verify 117 Windows native tests, separately
executed ABI/resource tests, six ReadPublic parser cases and actual Software KSP
context rejection; 161 TypeScript tests, 28 UI/eight PWA scenarios, recovery
matrix/offline kit/native parity/fresh encrypted-file recovery all PASS.
10,000-file restore: 87.543 s; 5 GiB process: 42.634 s,
sampled peak working set 10,596,352 bytes.

The downloaded original artifact ZIP matches GitHub's digest `sha256:69203071873dbd9446accde61dd12f87996e3b7d460a32ff89f375b4491e143d`.
Installer checksum matches metadata/sidecar: `0a152600b527188e729618d5f1ec1eec24b06e2c4cc965d6135bd8d1a4cc8868`,
217,915,248 bytes. Actual NSIS install, installed/built binary equality,
packaged UI/storage/lock and eleven source-matched native reports PASS. Hosted
TPM/Hello preflight blocks creation; no target hardware evidence is inferred.
[Download evidence](../deploy/windows-desktop/) preserves original artifacts.
All four physical gates and real enrollment/unlock remain blocked pending target
and combined-mechanism proof; see [the exact local trust boundary](windows/HELLO_LOCAL_TPM_BINDING.md).

Shared translations also change web assets. [Cloudflare downloads](../deploy/cloudflare-pages/)
now contain `passkeylocal-cloudflare-pages-c5e3481.zip`, 210,513 bytes, SHA-256 `a5a7d447186f855d9770efa40af6bdc53a6d0e315a0320d90875f7b9847f9a5b`.
All ten files equal freshly rebuilt production output; native IPC is absent.
No server deployment occurred. Publication changes only docs and deploy artifacts;
tested application, test, dependency and workflow bytes remain identical.

## Recovery CI runner capacity correction (2026-10-08)

The initial source `ddfed6f6cbfdff8fbc8c2e0b654800e8519a3e6c` passed Windows CI
(including 117 native tests and packaged installation), plus nine general jobs.
The macOS job in run 37753407079 executed no steps: GitHub cancelled it after
15 minutes with "The job was not acquired by Runner of type hosted" and an
explicit macOS ARM64 capacity notice. A failed-jobs-only retry also stayed queued.

Route the same Python 3.12 recovery suite and hash-locked dependencies to the
supported `macos-15-intel` image documented by [GitHub runner-images](https://github.com/actions/runner-images#available-images).
No test, assertion or dependency is removed. This measures Intel macOS 15 rather
than ARM64 macOS 26; do not claim new ARM64 execution. Application bytes are
unchanged by this CI correction. The updated workflow/source passed the checks
recorded above; the published installer uses that new source.

## Local per-key TPM route after absent direct attestation (2026-10-08)

Added the [documented provider/TBS ReadPublic measurement](windows/HELLO_LOCAL_TPM_BINDING.md)
and an argument-free native command plus English/Russian Settings action. The
complete public area/attributes/Name are bound to the exact CNG/PCP app key before
and after reopening, with real OAEP roundtrips, tamper controls and unconditional
cleanup. No AIK provisioning, settings changes, certificate-trust inference,
private-export reclassification, raw command IPC or vault material is involved.
The old raw-export and direct-attestation reports retain their original meaning.

Local validation: native Rust 89 PASS / 1 resource test intentionally ignored in
routine Linux execution; 14 targeted TPM tests PASS. Linux and Windows GNU
all-target clippy with warnings denied PASS, formatting PASS. Separate PWA and
desktop production builds and target-isolation checks PASS. TypeScript 161 tests
and workspace typechecks PASS. UI: 27 initial cases PASS, the new report-reading
test was corrected and both new local-binding cases then PASS (28 distinct cases
validated overall). Windows MSVC, packaged command ACL/smoke and full CI results are recorded in
the publication above. Target hardware execution remains pending.
The initial UI test read a newly collapsed report with innerText; the test now
opens the report before reading it. No application failure was hidden or ignored.

Success means local-read-public-observed only; all eligibility/enrollment/unlock
flags remain false and all four physical acceptance gates remain open. No device
result is inferred from software fixtures or from Microsoft's documentation.

## Completed direct-attestation target measurement (2026-10-08)

The [owner JSON](../deploy/windows-desktop/hello-target-bdb2a03-direct-attestation.json)
matches the installed/tested source `bdb2a034e15f483dcbaadb29781234248a26dfed`.
All six stages PASS: load/API/platform/route, temporary passkey creation and
exact deletion. Windows build 26200/API 9 reports one unlocked Hello candidate
and platform availability. The direct preference returns `format: none`, decode
zero, statement length one and object length 194; outcome is
`direct-attestation-not-provided`. No decoded attestation/certificate/signature
was supplied or verified. No new prompt observations accompanied the JSON.
This is owner-provided target evidence, not a cloud-executed hardware test.

The acquisition measurement is complete; unchanged direct/PRF/provider/inner/
export retests are unnecessary. This does not establish the omission's cause,
defective hardware, accepted per-key TPM binding, PRF-secret protection or the
separate RSA key's certification. Eligibility/enrollment/unlock remain false
and all four gates stay open. The next blocker is supported same-inner-key
certification/authority acquisition with trusted signature/certificate/chain/
revocation policy, documented in [the source follow-up](windows/SOURCES_AND_REVIEW.md#direct-attestation-target-follow-up-2026-10-08).

This update records the report and corrects pending owner instructions only.
JSON source/schema/stage/false-flag/gate consistency and relative document links
were checked; no application/test/dependency/workflow bytes changed and no new
software or hardware test was executed. The checked bdb2a03 installer and
536e5f7 Cloudflare archive remain unchanged; no replacement build/deployment
or security-policy change occurred.

## Direct WebAuthn attestation discovery (2026-10-08)

Added the fixed argument-free `hello_webauthn_attestation` command and localized
Windows Settings action. It creates one unique temporary platform/UV-required,
resident ES256/PRF-enabled passkey with direct attestation, reuses native HWND/
single-flight/cancellation/session guards and unconditionally deletes only the
exact created ID. No old PRF/TPM export rerun, enterprise policy, raw TPM codec,
OS AIK/EK read, dependency or real-vault enrollment/secret is introduced.

The native inspector records known format and bounded numeric sizes/counts only;
it neither reads raw certificate/payload bytes nor parses/verifies the claim.
New common-attestation/X5C bindings are generated from pinned metadata with an
independent official-header ABI reference. Unknown formats/versions, missing
pointers, oversized certificates and total budgets fail. A software-shaped
impostor and even valid native observations stay explicitly unverified. `none`
is reported as no attestation provided. PRF-secret protection and the separate
inner RSA key remain unverified/unattested; all four gates and false eligibility/
enrollment/unlock remain. Native state is now also checked after PRF/direct
cleanup to reject a late successful observation. [Contract and completed owner measurement](windows/HELLO_DIRECT_ATTESTATION.md).

Local native 81 tests PASS (one explicit resource ignored), focused PRF tests,
Windows GNU production/all-target Clippy, typecheck, all 26 isolated UI scenarios,
both production builds and target-isolation check PASS. Pinned binding regeneration
is byte-identical. [PR #24](https://github.com/kurasis/passkeylocal/pull/24) merged automatically as
`536e5f7d0be4de4d27a8f2066b1a9db17fbad05a`; its tree equals tested source `bdb2a034e15f483dcbaadb29781234248a26dfed`
(code head `99b8ff20ea9cac364963e659e71d340be5b7906b`). [General CI 37745006594](https://github.com/kurasis/passkeylocal/actions/runs/37745006594)
and [Windows CI 37745006593](https://github.com/kurasis/passkeylocal/actions/runs/37745006593)
completed all 11 exact-head checks successfully. Hosted Windows confirms 108
routine native tests, including six new direct-attestation shape controls; the
two ignored ABI/resource gates were separately executed and passed. Independent
official-header/MSVC ABI, binding regeneration, public fixtures, 161 TypeScript
tests, 26 UI/eight PWA scenarios, Python OS/version matrix/offline kit,
KDBX parity, fresh bidirectional encrypted-file recovery and 10,000-file restore PASS.
Restore: 83.317 s; 5 GiB process: 43.236 s,
sampled peak working set 10,588,160 bytes.

Actual NSIS install, installed/built binary equality, packaged UI/IPC/storage/lock
and ten source-matched diagnostic reports PASS. Hosted Hello/Platform KSP is
unavailable, so creation/PRF/TPM operations do not run there. Downloaded original
installer checksum matches metadata/sidecar: `1d64c660da0909911f9688f62af3071595258594adc7e9a9ebc48c54e54fd3d2`,
217,901,754 bytes. [Windows download evidence](../deploy/windows-desktop/)
retains original metadata/screenshots and source-correlated artifact link.
The completed owner measurement is recorded above; no unchanged direct/PRF/provider/
inner/export rerun is needed. No physical TPM/fingerprint or attestation trust is
inferred from hosted/software checks. All four gates remain open.

Shared desktop translations changed web assets, so [Cloudflare downloads](../deploy/cloudflare-pages/)
now include `passkeylocal-cloudflare-pages-536e5f7.zip` from the merged source: 210,033 bytes,
SHA-256 `2ec7eada082d614c6d9c11e33d004cfb0a98061e137644efe28202da899cc627`. All ten archived files equal freshly rebuilt production output;
native IPC remains absent. No direct server deployment occurred. This final
publication changes documentation and deployment artifacts only; tested
application, test, dependency and workflow bytes are retained.

The [initial installed-app smoke](https://github.com/kurasis/passkeylocal/actions/runs/37743378217) for tested source
`ef0da0ae9bb4c5514bedcdf62b1a1414fa55b89e` failed before executing the new
command: Tauri correctly denied it because the main-window capability omitted
`allow-hello-webauthn-attestation`. The correction adds only that generated
permission to the existing local `main` capability, retaining its window/origin
scope and every native session/HWND guard. The corrected hosted and installed-app
checks passed before publishing the source-correlated installer above. The
failed installer was not published.

## PCP certification framing and completed target measurement (2026-10-08)

The [owner JSON from installed source c83ce3facce7abdae040b27133e5aec258d4ec23](../deploy/windows-desktop/hello-target-c83ce3f-tpm-inner.json)
is retained unchanged in meaning. The first nine stages and exact-key cleanup
PASS: actual Platform KSP OAEP/SHA-256 wrap/decrypt, same-process reopening and
changed-ciphertext/wrong-hash negative controls now execute successfully. Policy
observations are export zero, common decrypt-only one, RSA2048, PCP raw 65538,
kind two/flag 65536 and opaque key-name length 34. The private-export stage is
FAILED: all three fixed formats return `0x8009000A` (`NTE_BAD_TYPE`), not explicit
permission denial. Outcome remains BLOCKED; false eligibility/enrollment/unlock,
no Hello authorization, same-process scope and all four gates are preserved.
This is owner evidence, not a cloud-executed hardware proof. Do not request an
unchanged PRF/provider/inner/export rerun.

Added a bounded zero-allocation parser for the exact SDK version-1 Platform KSP
KAWA certification wrapper, connected to existing exact native subject/nonce/
Name inspection and Windows public RSA signature verification. SDK size/offset
assertions and software-signed impostor tests verify framing without granting
trust. Sources and limitations: [verifier contract](windows/HELLO_ATTESTATION_VERIFIER.md#documented-platform-ksp-wrapper-2026-10-08).
No claim acquisition, authority creation, raw TPM commands, OS keys, dependency,
new IPC action or real-vault envelope is added. Trusted same-key certification,
AIK chain/policy/revocation and all four acceptance gates remain open.

[PR #23](https://github.com/kurasis/passkeylocal/pull/23) merged automatically as
`3295d9085591ef28e417b1b71d8d5028fb072f9b`; its tree equals tested PR source
`606e3c955b20f84ce27829f4c1d97a436c07f179` (code head `d205760367ded46c8d664920ea1588cb1e147cab`).
[General CI 37739092000](https://github.com/kurasis/passkeylocal/actions/runs/37739092000)
and [Windows CI 37739092065](https://github.com/kurasis/passkeylocal/actions/runs/37739092065)
PASS: all 11 exact-head checks completed successfully. Local 77 native tests
PASS (one explicit resource gate ignored), including all 15 certification tests;
Windows GNU production/all-target Clippy, formatting, independent committed and
freshly generated Python fixtures PASS. Original hosted logs confirm 98 Windows
routine tests (ABI/resource gates separately excluded) and all eight new PCP tests,
including actual BCrypt verification and stale-session rejection. Explicit MSVC/
header ABI and 5 GiB resource tests, bidirectional independent recovery, native
KDBX/Python parity, both frontend builds/isolation, actual NSIS installation and
packaged IPC/storage/lock smoke PASS. General CI also confirms 161 TypeScript
tests, 24 UI/eight PWA scenarios, Python OS/version matrix and offline recovery.
These software/hosted results do not establish physical TPM or Hello acceptance.
No owner rerun is needed; the existing source-correlated c83ce3f download and
completed target result remain the hardware experiment baseline. No application,
test or workflow bytes change in this final documentation publication.

## PCP provider-marker corrected installer evidence (2026-10-08)

[PR #22](https://github.com/kurasis/passkeylocal/pull/22), code head `d813e0d4f87a2cd44286603fdf7841a1281e4553`,
installed/tested source `c83ce3facce7abdae040b27133e5aec258d4ec23`: all 11 checks PASS. [General CI 37735902016](https://github.com/kurasis/passkeylocal/actions/runs/37735902016)
and [Windows CI 37735901888](https://github.com/kurasis/passkeylocal/actions/runs/37735901888)
completed successfully. Automatic merge `4f6fd31ea6d045e5e23478fb74aa0db34747024a` equals the tested PR tree.
Local typecheck/formatting, Windows GNU all-target production Clippy, 71 Linux
native tests (one resource ignored) and PWA build PASS.
Hosted 161 TypeScript tests, 24 UI/eight PWA scenarios, Python OS/version matrix/offline kit/fresh
interop/recovery, pinned binding regeneration and independent public fixtures PASS.
Windows 90 routine native tests PASS (ABI/resource separately excluded), explicit
MSVC/header ABI and 5 GiB native resource checks PASS, native KDBX/Python parity,
fresh bidirectional encrypted-file recovery and 10,000-file restore PASS.
Restore: 70.892 s; hosted 5 GiB primitive process:
44.509 s, sampled peak working set 10,596,352 bytes.

Actual NSIS install, installed/built binary equality, packaged UI/real IPC/worker,
native storage/lock and nine source-matched diagnostics PASS. Hosted Hello and
Platform KSP are unavailable, so private PRF/TPM operations do not execute there.
Software controls verify actual crypto/policy observation/zero-flag cleanup,
not physical hardware. Downloaded installer checksum matches original metadata
and sidecar: `f6073ba6d4079e71f36c259ea52d01e33667500f9d0d7bd36dcbf5a8376e8284`, 217,896,990 bytes. Original small
artifact metadata/screenshots and download link are retained in [Windows downloads](../deploy/windows-desktop/).
All four security gates remain open and actual Hello unlock is unavailable;
the completed corrected target measurement is recorded above. Per-key TPM 2 acceptance is not inferred from
the recognized PCP marker or software/hosted evidence. All four gates stay open.
Cloudflare's existing ZIP matches all ten freshly rebuilt production files;
no web repack or direct server deployment was performed. This publication changes docs and
small evidence artifacts only; tested application/test/workflow bytes are retained.

## PCP usage kind and provider-marker correction (2026-10-08)

The [owner report](../deploy/windows-desktop/hello-target-e3f3f0a-tpm-inner.json)
from source `e3f3f0a2ac849ecc813621852c86008d4e406c17` confirms successful
exact-key deletion and common policy readback (export zero, decrypt-only one,
2048 bits). The synthetic test remained BLOCKED because raw PCP usage was
65538 (`0x00010002`), not the adapter's whole-DWORD comparison against two.
All later crypto/export stages were NOT RUN. The low word is encryption kind
two; the pinned Microsoft SDK calls the high `0x00010000` bit
`NCRYPT_TPM12_PROVIDER`. Microsoft's pinned PCP sample masks the low word
when classifying usage. The old full-DWORD equality was incorrect for
classifying the kind. The marker's hardware meaning is not inferred away.

The bounded decoder now requires low-word kind exactly two and accepts only
zero high flags or that explicitly named SDK marker; unknown flags and any
signing/generic/storage/identity/HMAC/broader usage still fail. Raw usage,
decoded kind and all high flags are preserved in metadata. Windows compile-time
assertions tie the portable constants to maintained SDK bindings. Added
regression controls cover the owner value, broader low bits, every unknown
high bit and unchanged false eligibility/enrollment/unlock/security gates.
Common no-export/decrypt-only/length restrictions, silent crypto, exact-key
cleanup and no-software/no-interactive fallbacks remain unchanged. No new
dependency or crypto algorithm is introduced. A recognized marker is not
accepted per-key TPM 2 attestation; the four acceptance gates remain open.
Local typecheck, formatting, Windows GNU production/all-target Clippy and
71 Linux native tests PASS (one resource gate ignored). Hosted Windows checks,
installer publication and corrected target result remain pending.

## Platform KSP corrected installer evidence (2026-10-08)

[PR #21](https://github.com/kurasis/passkeylocal/pull/21), code head `af6ebb4cc3e57519238408697c2897ace943f951`,
installed/tested source `e3f3f0a2ac849ecc813621852c86008d4e406c17`: all 11 checks PASS. [General CI 37733203533](https://github.com/kurasis/passkeylocal/actions/runs/37733203533)
and [Windows CI 37733203393](https://github.com/kurasis/passkeylocal/actions/runs/37733203393)
completed successfully. Automatic merge `4fca853b35cfae8d3cbb09e2848a5e56298230cc` equals the tested PR tree.
Local typecheck/formatting, Windows GNU all-target production Clippy, 70 Linux
native tests (one resource ignored), 161 TypeScript tests and PWA build PASS.
Hosted 24 UI/eight PWA scenarios, Python OS/version matrix/offline kit/fresh
interop/recovery, pinned binding regeneration and independent public fixtures PASS.
Windows 89 routine native tests PASS (ABI/resource separately excluded), explicit
MSVC/header ABI and 5 GiB native resource checks PASS, native KDBX/Python parity,
fresh bidirectional encrypted-file recovery and 10,000-file restore PASS.
Restore: 83.943 s; hosted 5 GiB primitive process:
46.253 s, sampled peak working set 10,596,352 bytes.

Actual NSIS install, installed/built binary equality, packaged UI/real IPC/worker,
native storage/lock and nine source-matched diagnostics PASS. Hosted Hello and
Platform KSP are unavailable, so private PRF/TPM operations do not execute there.
Software controls verify actual crypto/policy observation/zero-flag cleanup,
not physical hardware. Downloaded installer checksum matches original metadata
and sidecar: `869b09422cecae751df6fd2bfe959b06fad7a668a330b2d934adc766660706e3`, 217,893,267 bytes. Original small
artifact metadata/screenshots and download link are retained in [Windows downloads](../deploy/windows-desktop/).
All four security gates remain open and actual Hello unlock is unavailable;
corrected target-device measurement is pending. Neither the original policy
mismatch nor successful correction on hardware is inferred without target evidence.
Cloudflare's existing ZIP matches all ten freshly rebuilt production files;
no web repack or direct server deployment was performed. This publication changes docs and
small evidence artifacts only; tested application/test/workflow bytes are retained.

## Platform KSP target readback and cleanup correction (2026-10-08)

Owner reports from installed source `3e31f8c645300cef8c2acf0e7e386a6fcc5847b5`
are retained unchanged in meaning: [TPM capability](../deploy/windows-desktop/hello-target-3e31f8c-tpm-capability.json)
PASS, implementation flags 1, TPM version 2, interface type 3;
[synthetic inner test](../deploy/windows-desktop/hello-target-3e31f8c-tpm-inner.json)
BLOCKED at policy readback, then exact-key deletion failed with `0x80090009`
(`NTE_BAD_FLAGS`). All subsequent crypto/export stages were NOT RUN. The old
report did not include actual key policies, so the particular mismatch cannot
be inferred. No successful hardware roundtrip or real unlock is claimed.

The adapter now requests the PCP-specific encryption usage (2) in addition
to common decrypt-only usage (1), requires both exact readbacks, and returns
actual bounded policy/length observations with property-specific failures.
Common export/decrypt/length validation remains strict. The Microsoft-pinned
PCP sample demonstrates the separate usage property and zero-flag deletion;
cleanup now uses zero directly for the exact newly created synthetic key.
Finalization/decrypt/export remain silent; no interactive crypto fallback
exists. A failed cleanup remains visible and blocks another key until exact
RAM-tracked retry. The previous process's unknown leftover synthetic key is
not recovered or broadly enumerated/deleted; durable cleanup remains open.

Added portable mismatch controls and a Windows software control that checks
actual policy observations survive unsupported PCP readback, followed by
actual zero-flag deletion. Software controls cannot satisfy hardware gates.
Local typecheck, formatting, Windows GNU production/all-target Clippy and
70 Linux native tests PASS (one resource gate ignored). Native Windows execution
and installer publication will be recorded after the hosted checks complete.
All four hardware/authorization/process/copy gates and false eligibility,
enrollment and unlock remain unchanged. Completed owner PRF evidence is retained.

## Platform KSP final hosted evidence (2026-10-07)

[PR #20](https://github.com/kurasis/passkeylocal/pull/20) code head `fdc5bfabb8623fe4f380511c052e7749ff648b0c`;
installed/tested PR merge source `3e31f8c645300cef8c2acf0e7e386a6fcc5847b5`. [General CI 37670862603](https://github.com/kurasis/passkeylocal/actions/runs/37670862603)
and [Windows CI 37670862608](https://github.com/kurasis/passkeylocal/actions/runs/37670862608)
PASS, all 11 exact-head checks. Automatic merge `2f467124202dfc0758f8cb3f095a627eb0584cfd` equals the tested PR tree.

Local: typecheck, 161 TypeScript tests, 69 Linux native tests (one resource ignored),
Windows GNU production/all-target Clippy, both frontend builds, 24 isolated UI
scenarios and eight production PWA scenarios PASS. Hosted: all ten general jobs,
Python OS/version matrix, offline kit, fresh interop/recovery, binding regeneration
and both independent public-only fixtures PASS. Windows: 87 routine native tests
PASS (ABI/resource separately excluded), explicit MSVC/header ABI and native 5 GiB
resource gates PASS, native KDBX/Python parity and fresh file-safe/Python recovery
PASS. Fresh 10,000-file restore: 127.796 s. Hosted 5 GiB primitive:
75.141 s process, sampled peak working set 10,522,624 bytes.

The initial software control's export expectation failed; only the oracle changed
for unsupported export classification, preserving the production denial requirement.
A subsequent [Windows run 37670414947](https://github.com/kurasis/passkeylocal/actions/runs/37670414947)
failed on libsodium DNS before tests. DNS recovered; the original MSVC archive
SHA-256 `4b310d0602b6217d68b3000df19af595841ba101910af8d335096f9c45c9f36a`
and original vendor minisign signature were independently verified locally.
No substitute artifact, altered checksum, skipped signature or TLS bypass was used.

Actual NSIS installation, installed/built EXE equality, packaged UI/real IPC/worker,
module isolation/native storage/lock PASS. All four original metadata source SHAs
and all nine diagnostic reports match the installed source. Hosted PRF and TPM
preflight stop before credential/key creation. Software oracles exercise actual
RSA crypto/export plumbing, reject software in hardware preflight and reject an
exportable impostor; none supply physical TPM/Kensington proof.
Downloaded installer SHA-256 independently matches original metadata/sidecar:
`0fd6e8b4791b119012cd75b923df66b44a60bbed9588991595026058e8673009`, 217,894,083 bytes. Original small metadata,
screenshots and artifact link are in [the Windows download folder](../deploy/windows-desktop/).

New [Cloudflare ZIP](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-dcd058a.zip): 209,726 bytes,
SHA-256 `95d9307e130143f55e2571ab8abfbeaf5cb885785a2a1882d42b0469881f7452`; all ten files equal the tested local production output.
Web source is `dcd058ac11a8454f577193f2cc196caab9e4e2ee`; later changes are native
or test/docs-only and preserve that frontend. No server deployment occurred.

This final publication changes evidence/docs/versioned artifacts only, retaining
tested application/test/workflow bytes. Owner TPM measurement, trusted per-key
hardware proof, PRF composition, fresh authorization/process/account/machine copies
and durable crash cleanup remain outstanding. All four gates remain open; real
Hello enrollment/unlock remains unavailable. The completed owner PRF result and
four fresh fingerprint observations are retained without an unchanged rerun.

## Platform KSP inner-envelope implementation (2026-10-07)

Initial [Windows CI 37669160028](https://github.com/kurasis/passkeylocal/actions/runs/37669160028)
failed one software-oracle assertion (85 native tests passed, two ignored).
Actual wrap/recovery, reopening and negative controls reached completion; raw
private export on Software KSP returned `NTE_NOT_SUPPORTED` (`0x80090029`),
not the test's assumed `NTE_PERM`. The oracle now requires the existing strict
classification and a failed export stage for unsupported operations/formats;
only all explicit permission denials can pass that stage. A separate exportable
software impostor control must fail it. Production policy/classifier/gates are
unchanged; packaging was skipped on the failing run. Final checks follow below.
The key-initialization call also now uses documented flags zero; key generation,
decryption, export and deletion retain their silent flags. No interactive
cryptographic fallback is introduced.

Added the separate [native TPM inner-layer experiment](windows/HELLO_TPM_INNER.md)
after the owner's completed PRF measurement. Read-only preflight creates no key;
synthetic proof measures only a unique app-owned Platform KSP RSA-OAEP/SHA-256
key, no-export/decrypt-only policy readback, bounded opaque object-name length,
actual wrap/recovery, handle/provider disposal and reopening, bracketed negative
controls, three strict private-export denials and unconditional exact-key cleanup.
The numeric TPM version comes from read-only System32 TBS device information;
unknown/emulator interfaces are rejected. The pinned Microsoft PCP sample returns
`PCP_PLATFORM_TYPE` as text, so it is not misread as a numeric version.
No source crypto implementation/dependency or OS security-setting change is added.

Reports distinguish provider metadata from per-key hardware proof and same-process
reopening from fresh launch. All four gates and false eligibility/enrollment/unlock
remain in effect. Native guards and UI invalidation reject late results.
Durable crash cleanup, trusted hardware proof, PRF composition, fresh-process/copy
tests and real enrollment remain outstanding. Hosted/owner TPM results are not
invented; publication evidence will identify the exact tested installer.

Local typecheck, formatting, Windows GNU production/all-target Clippy and 69
Linux native tests PASS (one resource gate ignored). All 161 TypeScript tests,
both frontend builds, eight production PWA scenarios and 24 isolated desktop UI scenarios PASS; the first UI
invocation could not launch the absent default Playwright browser, and the
repository-supported system Chromium override passed the complete suite.
New orchestration tests cover every failure, cleanup and all pre/post-stage
invalidations, including invalidation during cleanup. The first final-cleanup
control correctly suppressed the outcome but its test incorrectly required a
failed native stage; the corrected assertion preserves completed operation
statuses and requires the interrupted final outcome. Windows-only
tests use a software oracle for crypto plumbing and explicitly reject that
provider in hardware preflight; they cannot pass physical TPM gates. UI and
hosted checks are recorded after execution.

## Owner PRF roundtrip success (2026-10-07)

Saved the [owner's successful synthetic report](../deploy/windows-desktop/hello-target-72a0df6-prf.json)
for Windows 11 Pro 25H2 with a Kensington VeriMark Desktop reader. Its full source
`72a0df66fe107b6ef15e4c81aa010c261662287b` matches the original build, installed-app
smoke, resource and WebView2 metadata for the already published PR #18 installer.
The report observes Windows build 26200, API 9 and one unlocked routing candidate.
All ten stages PASS: capability/route, creation PRF, first/repeated same-input
assertions, changed-input assertion, actual synthetic AES-GCM roundtrip/negative
controls and exact test-passkey deletion. The owner separately reports a new
fingerprint confirmation at creation and at each of the three assertions.

This completes the same-process PRF measurement on the owner's target and confirms
the corrected creation-context parser permits the experiment. It is owner-reported
evidence, not a cloud-run hardware test or independent attestation. Repeated prompts
are useful observations but do not establish the entire fresh-authorization gate.
TPM binding is explicitly `not-verified`; `eligible`, `enrolled` and `unlocked` are
false. Per-key TPM, fresh authorization, fresh process and account/machine copy
gates remain open; real Hello enrollment/unlock remains unavailable.

This evidence-only change requires no new installer or unchanged PRF retest.
Next implementation needs a separately verified TPM inner envelope (or another
supported hardware contract), cross-process authorization/account/machine tests,
cancellation and durable cleanup before real-store integration. The earlier
creation failure and hosted-only results below remain historical evidence.

## Corrected PRF layout final evidence (2026-10-07)

[PR #18](https://github.com/kurasis/passkeylocal/pull/18) code head `6c1ebc44799111e82c8233316bf27c25817590d3`;
installed/tested PR merge source `72a0df66fe107b6ef15e4c81aa010c261662287b`. [General CI 37656775121](https://github.com/kurasis/passkeylocal/actions/runs/37656775121)
and [Windows CI 37656774985](https://github.com/kurasis/passkeylocal/actions/runs/37656774985)
**PASS**, all 11 checks. Automatic merge `287d368f0a4e8bf6776115f7677949e174245521` has the tested PR tree.

The independent public-only W3C/COSE wire fixture first FAILed on the old parser
and now PASSes. Local: independent Python layout/curve verification, 65 native
Linux tests (resource gate ignored), formatting and Windows GNU production/all-target
Clippy PASS. Hosted: 161 TypeScript tests, 22 isolated UI scenarios, eight PWA
scenarios, Python OS/version matrix, offline kit, fresh recovery/interop, binding
regeneration and both independent public fixtures PASS. Windows: 79
routine native tests PASS with ABI/resource gates separately executed/PASS;
actual MSVC/official-header comparison and native KDBX/Python parity PASS.
Fresh file-safe 10,000-file restore: 96.211 s. Native hosted
5 GiB primitive measurement: 48.033 s process; sampled peak
working set 10,514,432 bytes.

Actual per-user NSIS installation/packaged UI/worker/native storage/lock PASS.
All four original metadata source SHAs match the installed source and all seven
native diagnostic reports match it. Hosted API 7
stops PRF before creation; the corrected pure parser is tested with independent
wire data, not a physical reader. Downloaded installer SHA-256 independently
matches the original sidecar/build metadata: `37ad92d238cdafc97509894a73901e84491ed00dd5bfac515f8e879ef6ce662f`,
217,878,107 bytes. Artifact link, original small metadata and
screenshots are published in [the Windows download folder](../deploy/windows-desktop/).
The unversioned sidecar now matches this installer. Cloudflare/frontend artifacts
remain unchanged because the corrected code is native-only.

This final publication changes evidence/metadata only, preserving the tested app,
fixture and workflow bytes. Owner API-9 readiness and the old local-parser failure
remain owner-reported evidence; no new fingerprint observation or physical PRF,
TPM/fresh-process/account/machine pass is invented. Actual enrollment/unlock stays
unavailable and all four physical gates remain open.

## Owner PRF creation-context result and wire-layout fix (2026-10-07)

Saved the owner [capability](../deploy/windows-desktop/hello-target-107c49d-capability.json)
and [synthetic PRF](../deploy/windows-desktop/hello-target-107c49d-prf.json) reports.
Both match installed source `107c49d6d9d58d269ea5093b78218e76f5383437`.
The reported Windows build is 26200, API version 9; platform availability and one
unlocked display-name routing candidate pass. Synthetic creation stops at the
local `prf-created-credential-context` validation, with no native error code;
all assertions/AES remain NOT RUN and exact test-passkey deletion passes.
No prompt/fingerprint observation or PRF secret is supplied by these reports.
Eligibility/enrollment/unlock remain false and all four gates remain open.

The old parser incorrectly read the credential length at 55–56 and ID at 57.
W3C authenticator data is 32-byte RP hash + 1-byte flags + 4-byte counter,
then 16-byte AAGUID + 2-byte credential length: length is at 53–54, ID at 55.
Corrected the offsets using named prefix lengths without removing RP/UP/UV/backup,
exact-ID or public-key-tail checks. Empty credential IDs also fail explicitly.
Moved the pure parser to the portable module so Linux tests exercise real wire
parsing rather than only Windows provider orchestration.

The previous Windows fixture was hand-written with the same incorrect offset.
Replaced it with a public-only W3C-layout fixture encoded independently with Python
big-endian `struct`, a public NIST P-256 point and canonical COSE bytes. Python
validates its layout and curve point. Before the fix, the new Rust fixture test
FAILED on the old parser, reproducing the bug; validation after the fix is recorded
below. New controls cover every header/ID truncation, wrong IDs/lengths,
missing AT, RP/UP/UV/backup rejection and multi-byte network-order lengths.
Physical PRF comparisons, TPM, fresh authorization/process/account/machine proof
and real-store enrollment/unlock remain NOT RUN / BLOCKED. Hosted checks and a
corrected installer have completed; see the final evidence above.

Local validation PASS: 65 native Linux tests (one resource gate ignored), independent
Python fixture encoding/layout/curve verification, app formatting and Windows GNU
production/all-target Clippy. The regression first failed on the old parser and
now passes; no physical PRF assertion or gate is counted as passed.

## Native PRF final hosted evidence (2026-10-07)

[PR #17](https://github.com/kurasis/passkeylocal/pull/17) code head `582813c375e5e3559dbdafd6fbe3bedabbb3632e`;
installed/tested PR merge source `107c49d6d9d58d269ea5093b78218e76f5383437`. [General CI 37651173424](https://github.com/kurasis/passkeylocal/actions/runs/37651173424)
and [Windows CI 37651173428](https://github.com/kurasis/passkeylocal/actions/runs/37651173428)
**PASS**, all 11 checks. Automatic merge `1fd5aa944db4c80caf93b53564ad3e0b3695e283` has the tested PR tree.

Local: typecheck, 161 TypeScript tests, 61 Linux native tests (one resource test
ignored), Windows GNU production/all-target Clippy, byte-identical generation,
both isolated builds, both new UI scenarios and all eight production PWA scenarios
PASS. Hosted: all 22 isolated UI scenarios and eight PWA scenarios, the full Python
OS/version matrix, offline kit and fresh interop PASS. Windows: 77 native tests
PASS with two explicitly excluded ABI/resource gates; both gates independently
executed/PASS, including every generated struct size/field offset against the pinned
Microsoft header compiled by MSVC. Native KDBX/Python parity and fresh bidirectional
file-safe recovery/10,000-file restore PASS. Restore took 241.943 s.
Native hosted 5 GiB primitive measurement: 50.656 s process,
sampled peak working set 10,530,816 bytes.

NSIS installation/actual packaged app PASS. Original build, smoke, resource and
signed Microsoft WebView2 metadata all match the full installed source SHA.
All seven native diagnostics returned source-matched reports; the two PRF actions
observed hosted API version 7 and stopped before creation.
The read-only capability has four stages; synthetic proof has ten and no-op cleanup.
No PRF secret or native credential IDs were returned. Downloaded unsigned installer
matches the original SHA sidecar/build metadata: `af4f73fdedc549d29dad553d93ce628d5e804b12cf8e6033b451390523593e75`,
217,879,804 bytes. [GitHub download/evidence folder](../deploy/windows-desktop/)
contains the artifact link and original small metadata/screenshots. The unversioned
sidecar was updated to the latest build; historical versioned evidence remains.

New [Cloudflare archive](../deploy/cloudflare-pages/passkeylocal-cloudflare-pages-582813c.zip):
208,644 bytes, SHA-256 `6324fd41e57729a0b13e638f2bca4b2284b6958e667ef5129bb229b60ad6e47e`; all ten files equal the tested local
production output. No server deployment occurred. The test-header's original full
MIT license was also retained from the exact pinned Microsoft commit.

This publication changes evidence/docs/license text and versioned build artifacts
only. It does not alter the tested application or header/bindings. Physical PRF,
TPM inner envelope, fresh-process/account/machine acceptance and durable diagnostic
crash cleanup remain NOT RUN / NOT IMPLEMENTED; all four gates remain open and
real Hello enrollment/unlock remain unavailable.

## Native WebAuthn PRF implementation (2026-10-07)

Implemented the fixed native adapter and two argument-free main-window actions;
see [the contract, owner procedure and limits](windows/HELLO_PRF_PROOF.md).
API-9 route detection is read-only. The separate synthetic experiment requires
creation PRF input, exact-ID assertions, repeat/change comparisons, real libsodium
AES-GCM negative controls and exact test-passkey cleanup. Native cancellation,
60-second ceremony deadlines, single flight and session guards reject late results.
Original native codes are preserved. Diagnostics return no secrets or credential IDs.
Private bindings are reproducible from locked Microsoft metadata, with an independent
MSVC/pinned official-header ABI comparison added to Windows tests.

Initial local typecheck and Windows GNU production/all-target Clippy passed.
The generation output reproduced byte-for-byte. Final local and hosted validation is recorded above.
The first new UI run passed 21/22 scenarios; the remaining scenario had an ambiguous
text locator matching both a paragraph and collapsed JSON. Its locator is now specific.
A local official-header compilation was not executable with the workspace's header-only
GNU wrapper; actual MSVC/header comparison is delegated to Windows CI, not counted as
passed locally. Existing vault formats/recovery and release gates are unchanged.
Physical Hello PRF, TPM inner layer, fresh process/account/machine proof and durable
crash cleanup remain **NOT RUN / NOT IMPLEMENTED**. All four gates remain open;
real enrollment/unlock remain unavailable even after a synthetic PRF pass.

## Broader Windows Hello integration research (2026-10-07)

The [source review](windows/HELLO_INTERNET_RESEARCH.md) identifies native WebAuthn
PRF as a justified next synthetic experiment. W3C specifies the encryption use
case, Microsoft's pinned API v9 header adds explicit authenticator routing, and
merged Bitwarden PR #21998 supplies PRF input on creation to address incorrect
capability reporting by Windows Hello. The current PWA already supplies that
input; the desktop native adapter does not yet exist. Current `windows` 0.62.2
bindings stop at WebAuthn API v7, so the newer fields need generated, reviewed
bindings and runtime availability checks.

Pinned examples distinguish true WebAuthn PRF from a signature-derived value
also named PRF, and show a possible composition with an independent TPM-sealed
inner envelope. These are implementation references, not accepted dependencies
or proof that this owner's hardware supports the proposed route. One cited Rust
PR series remains open; public 25H2 measurements include both successful PRF
creation and a separate later-assertion failure. Authenticator names, API version,
PRF success and backup flags are not per-key hardware proof.

Validation: inspected primary API/specification contracts, pinned source
implementations and current repository integration points; checked source URLs,
local document links and whitespace. No application code/dependency changes and
no new installer. Native PRF, TPM composition and new physical ceremonies are
**NOT IMPLEMENTED / NOT RUN** here. Existing Passport reports remain unchanged,
actual enrollment/unlock stays blocked and all four physical gates remain open.

General CI [37645990383](https://github.com/kurasis/passkeylocal/actions/runs/37645990383)
**PASS**, all ten checks for head `1a1b0ea6da3f093fc08c869c25b72c73d5227566`.
[PR #16](https://github.com/kurasis/passkeylocal/pull/16) merged automatically as
`91e88b3916833210d3fcf74680472730faf5c183`; the merged tree equals the tested PR
tree. The 16 external research links and all local links in changed documents
were checked. This final result entry changes documentation only; it adds no
runtime or physical hardware evidence beyond the referenced checks.

## Target subject-only claim candidate rejected (2026-10-07)

Saved the [owner-provided 6ae6e24 report](../deploy/windows-desktop/hello-target-6ae6e24.json)
without adding observations. Its full source SHA matches the existing installer
build/smoke/resource/WebView2 metadata. Seven stages are present: configuration,
Passport provider, key creation, policy and readback PASS;
`attestation-claim` FAIL with `NTE_INVALID_PARAMETER` (`0x80090027`) and operation
`create-subject-only-attestation-claim`; exact app test-key deletion PASS.
`attestationClaim.result` is `unavailable`, verification `not-performed`, with
no returned byte count. Eligibility/enrollment/unlock remain false, outcome
blocked and all four physical gates open. No new prompt observation was supplied.
This is owner-reported evidence on the reported Windows 11 Pro 25H2 / Kensington
VeriMark Desktop setup, not an independently executed physical cloud test.

Re-read the official claim/Hello references and pinned provider implementation;
see [the acquisition/authority review](windows/SOURCES_AND_REVIEW.md#completed-subject-only-target-measurement).
The failure rejects this candidate on the reported target. It does not identify
the rejected parameter, prove missing/defective hardware or establish that
every attestation route is unsupported. A supported attestation acquisition and
authority contract for the exact decrypt-only Passport key remains
**NOT ESTABLISHED**. Trusted AIK certificate/chain/revocation, full fresh
authorization/process/copy evidence and real enrollment/unlock remain blocked.
No unchanged retest, VBS/provider substitution, OS key operation or security
downgrade is requested.

Evidence-only validation: JSON semantics, exact installed-source correlation,
stage/error/cleanup/false-flag/open-gate consistency, changed Markdown local
links and whitespace **PASS**. Application code, installer and Cloudflare ZIP
are unchanged; their earlier CI evidence below remains historical evidence,
not a new target pass. No replacement installer is needed for this update.

Final general CI [37642830565](https://github.com/kurasis/passkeylocal/actions/runs/37642830565)
**PASS**, all ten checks for head `0241e4998d6263aada6526f77e1c75e5e4951350`.
It executes 161 TypeScript tests, 20 isolated UI scenarios, eight production PWA
scenarios, 55 Linux native tests (one resource test ignored), independent fixture
verification, cross-platform recovery, fresh interop and the offline recovery kit.
Windows installer/physical diagnostics were not rerun for this evidence-only
change. [PR #15](https://github.com/kurasis/passkeylocal/pull/15) merged automatically
as `260a4fdbd951fec9c1ffc87671de0efff42042b6`; its tree matches the tested PR
merge tree `94bb18b0874801ae28ab0f28cf33c32775773431`. This final CI record changes
documentation only and closes no physical Hello gate.

## Native TPM certification inspection and same-key capability increment (2026-10-07)

Implemented bounded standard TPMS_ATTEST/TPMT_PUBLIC inspection against the
exact app RSA2048 public component, native expected nonce, certified Name and
required fixedTPM/fixedParent/sensitiveDataOrigin/decrypt attributes. Unsupported
profiles, truncation/trailing/hostile lengths, wrong subject/nonce/Name and
migratable/imported/signing/restricted templates fail. Windows fixed-provider
RSA signature verification preserves an opaque **untrusted** result and checks
request/session before and after API work. No AIK certificate/trust decision,
enrollment or credential access is implemented.

The committed public-only fixture is deliberately signed by a software RSA key,
independently generated/verified with the existing pinned Python cryptography
dependency. No private key is committed. Tests establish that valid parsing or
a correct software signature cannot enable the actual Hello enrollment/unlock
entry points. Signature padding is not approval of legacy credential encryption.
See [the implementation profile and limits](windows/HELLO_ATTESTATION_VERIFIER.md).

Added a separate argument-free `hello_attestation_capability` experiment and
EN/RU Settings action. It calls `NCryptCreateClaim` once on the exact new app
Passport decrypt-only test key, fixed subject-only type, native random nonce,
optional authority absent, flags zero and fixed zeroized 16 KiB output. No OS
AIK/Hello key enumeration/opening, fallback, arbitrary renderer parameters or
raw blob/nonce/key-name reporting/persistence. API support is a candidate to
measure, not a supported Passport contract. Returned nonempty bounded bytes are
explicitly unverified and the standard inspector is not applied to unknown
provider framing. Native failures preserve their codes; shared single-flight,
session guards and unconditional exact app-key cleanup remain authoritative.
All eligibility/enrollment/unlock flags stay false and four physical gates stay
open. The earlier owner 946514c export result remains valid/completed.

Local validation: independent Python fixture signature/subject/Name/nonce,
25 portable Hello tests, typecheck, 20 isolated UI scenarios, both production
builds/target isolation, eight production PWA scenarios and Windows GNU
cross-target Clippy with warnings denied **PASS**.
Cross-target compilation is not Windows API execution. Hosted Windows actual
signature/claim-failure tests, general/Windows CI and installed-app evidence:
**PENDING**. Target Passport claim capability/trusted TPM/fresh-process/copy
proof: **NOT RUN / BLOCKED**. Real credential envelope/enrollment/unlock:
**BLOCKED**. A transient cloud exec-server disconnect was retried after the
transport recovered; no security/verification checks were bypassed.

Final general CI [37637603317](https://github.com/kurasis/passkeylocal/actions/runs/37637603317)
and Windows CI [37637603236](https://github.com/kurasis/passkeylocal/actions/runs/37637603236)
**PASS**, all 11 checks for head `10598ed4ebcefb3940b243dd18e58c220a7836c1` and tested PR merge `6ae6e244959668f08fef849fd8018e1c1d21df06`.
[PR #14](https://github.com/kurasis/passkeylocal/pull/14) merged automatically as
`86c1d16784959ff55cd3bb0d5139c8a4b5cdcd7f`; the main merge tree equals the tested PR merge tree.
General CI: 161 TypeScript tests, 20 isolated UI scenarios, eight production
PWA scenarios, 55 Linux native tests (one resource test ignored), independent
fixture signature verification and cross-platform recovery PASS. Windows:
63 native tests PASS (one resource test ignored and separately executed/PASS),
actual CNG signature/error/session controls and independent software-fixture
verification PASS. The correctly signed software impostor leaves actual
enrollment/unlock unavailable; altered signatures/signers/signed data fail.
Native KDBX/Python parity, encrypted-file interop/10,000-file restore and
independent recovery PASS. Hosted 5 GiB gate: 72.6307547 s,
sampled peak working set 10,481,664 bytes;
native encrypt/verify 52.9308882 s /
18.6821846 s.

Actual NSIS install/packaged smoke **PASS**. All five installed native commands
report exact source `6ae6e244959668f08fef849fd8018e1c1d21df06`, false flags and four open gates;
each stops at unavailable Hello before key creation. The new action has seven
stages, cleanup PASS and `attestationClaim` omitted because no API call occurred.
No hosted provider/TPM/Kensington success is inferred. Owner target capability,
trusted AIK chain/revocation and supported provider framing remain **NOT RUN /
BLOCKED**. Actual protected envelope/enrollment/unlock remain **BLOCKED**.

Downloaded installer hash `9b5137f9d48e42e3ffd2cd8fdd7aaf9166ddbc98e31e939626a274b5ebadf486` (217,857,372 bytes) matches its
original sidecar/build metadata. Build/smoke/resource/signed-WebView2 sources
all match; original bytes/screens/checksum are published in
[the Windows folder](../deploy/windows-desktop/README.md).
[Installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37637603236/artifacts/11491601801).
Cloudflare ZIP `passkeylocal-cloudflare-pages-10598ed.zip`: 208,232 bytes,
SHA-256 `24b1c8fe7d993a5409fcc1dd73500f71e5573f39b9eb0ff5dbfd1fff7cb1365a`; ten root files byte-match production output.
Source provenance is not signed/hardware attestation. The final publication
changes evidence/archives only, not the tested application tree.

## Target per-format export measurement completed (2026-10-07)

The [owner report from published source 946514c](../deploy/windows-desktop/hello-target-946514c.json)
measures RSA private, RSA full-private and PKCS#8 private export; each returns
`NTE_BAD_TYPE` (`0x8009000A`) / `unsupported-format`. Both synthetic PKCS#1
decrypt/secret comparisons, all three strict silent refusals, policy readback
and test-key deletion PASS. The aggregate export stage remains FAILED, retaining
`private-export-rsa` and the original code. All four remaining gates and false
eligibility/enrollment/unlock flags are preserved. No new prompt observation
is inferred; earlier fingerprint observations belong to the 9fdbc05 report.
This is owner-reported same-process behavior, not independently executed
hardware attestation. The private-format diagnostic task is complete; unchanged
retests would not resolve it.

Official source review found that provider implementation flags are not per-key
TPM evidence. The documented KeyCredential attestation example concerns a
signing credential; it does not establish attestation of our existing CNG
decrypt-only key. `NCryptCreateClaim` API/binding availability does not establish
Passport support, verified TPM claims or a trust policy. A supported, verified
same-key attestation route is **NOT ESTABLISHED / NOT IMPLEMENTED**; see
[the investigation](windows/SOURCES_AND_REVIEW.md#same-key-attestation-investigation-2026-10-07).
No claim is made that the owner's TPM or reader is absent/defective. Fresh-process,
cancellation, account/machine-copy proof and real credential envelope/enrollment
remain outstanding. No production gate is weakened or unsupported error relabeled.

This change records evidence and corrects the active procedure only. Application,
tests, dependencies, workflows, installer and Cloudflare ZIP are unchanged.
Existing 946514c build/CI evidence below remains applicable to that installer;
it is not a newly executed hardware test. Local report/source consistency,
13 distinct stages, all three original export results, false flags/four gates,
74 relative-document links/anchors and whitespace validation: **PASS**.

General CI [37633159938](https://github.com/kurasis/passkeylocal/actions/runs/37633159938)
**PASS**, all ten PR checks, for documentation head
`ac0202ed16aa82e3ff6d6a10d67a1f564380e9e0`.
[PR #13](https://github.com/kurasis/passkeylocal/pull/13) merged automatically as
`311658034850dfd558ea3dccec3ed6a9c1165a59`; the main merge tree matches the tested
PR merge tree. CI executed 161 TypeScript tests, 18 isolated UI scenarios,
eight production PWA scenarios, 44 Linux native tests (one resource test
ignored), independent recovery (Linux/macOS 91 passed / 12 skipped; Windows
88 passed / 15 skipped), fresh browser-to-Python fixtures and the offline
Windows recovery kit. Dependency advisories: zero. The Windows installer
workflow is excluded for this docs/deploy-only change; no native Windows
installer or physical Hello test was rerun. This follow-up records the completed
CI outcome only and does not change application files or release artifacts.

## Target silent refusals and repeated decrypt passed; export format diagnostics (2026-10-07)

The [owner report from published source 9fdbc05](../deploy/windows-desktop/hello-target-9fdbc05.json)
passes both constant-time synthetic-secret comparisons and all three silent
refusals. Policy readback and cleanup also PASS. The owner subsequently reports
fingerprint confirmation every time in response to the question about key
creation/first/second decrypt prompts. This is owner-reported same-process
behavior, not an independently executed hardware test. It supplies no per-key
TPM, fresh-process, account/machine-copy or cancellation proof. No eligibility,
enrollment or unlock is promoted.

Private export stops at RSA private blob with `0x8009000A` / `NTE_BAD_TYPE`.
[Microsoft NCryptExportKey documentation](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptexportkey)
says this key cannot be exported into the requested blob type. It is not explicit
permission denial or evidence that all private formats are protected. The later
two export formats were not attempted by that build.

The native export stage now collects fixed RSA private/full-private/PKCS#8
results independently after unsuccessful attempts. `exportChecks` identifies
explicit refusal, unavailable format, other failure, unexpected success and
unrun formats. Every format must still return `NTE_PERM` to pass the aggregate
gate; unsupported formats are never blessed. The first unsuccessful unresolved
format retains its original aggregate code/operation. Success/cancel/session
invalidation stops further export attempts, zeroizing buffers and performing
normal unconditional test-key cleanup. Only fixed app test-key formats are
accepted; no key material or caller-selected export command is returned.

Added portable measurement regressions for mixed format results, strict denial,
unexpected export success, cancellation and invalidation. Actual Windows CNG
regressions retain actual unsupported-operation results from the zero-export
software fixture, then verify an explicitly exportable fixture fails the gate and stops later
formats. The isolated UI shows all three classifications without enabling
unlock or overflowing at 320 pixels. At initial validation, general/Windows CI
and installed evidence were **PENDING**; final execution is recorded below.
Local typecheck, both production builds/target isolation, 18 isolated
UI scenarios, 12 portable proof regressions and Windows GNU Clippy with warnings
denied **PASS**. Initial Windows test compilation failed because the newly used
SDK export policy flags are `u32`, not wrapper types; corrected the flag access
and the full cross-target Clippy rerun passed. Updated target export diagnostics:
**NOT RUN**. Actual Hello
credential envelope/enrollment/unlock and remaining physical proof: **BLOCKED**.

Initial general CI [37626225841](https://github.com/kurasis/passkeylocal/actions/runs/37626225841)
passed all ten jobs for head `ba9a419`, tested merge `8c1777d`. Initial Windows
CI [37626225937](https://github.com/kurasis/passkeylocal/actions/runs/37626225937)
**FAILED**: 47 native tests PASS, one new real export assertion FAILED and one
resource test ignored. Later resource/recovery/packaging/install stages were
NOT RUN; no successful installer was published. The software KSP with zero
export policy returned actual `NTE_NOT_SUPPORTED` (`0x80090029`) at RSA private
export, contrary to the new fixture's assumption of `NTE_PERM`. The fixture now
requires the original unresolved code/operation and completed per-format results
without successful export, rather than assuming permission-denial semantics.
The production gate still rejects unsupported operation/format errors and
requires `NTE_PERM` for every format; no production security rule was changed
for this correction. The explicitly exportable positive-control fixture was
not reached by that failed test. At that point Windows/general CI rerun and
final installed evidence were **PENDING**.

Final general CI [37627304079](https://github.com/kurasis/passkeylocal/actions/runs/37627304079)
and Windows CI [37627304056](https://github.com/kurasis/passkeylocal/actions/runs/37627304056)
**PASS** for head `587e3c13a60d17541b9ea7f45e8c763e68b8c2e7` and tested PR merge `946514c0dd590f703cd5398d9d39ec7c28d0491d`. All 11 PR checks passed;
[PR #12](https://github.com/kurasis/passkeylocal/pull/12) merged automatically.
Actual main merge `a03f74eff94ef62d55d6afe1cbe4addf83d01a80` has the identical tested Git tree `e689cf0389fe5869e8a9152293ef903685bfede2`.
General CI: 161 TypeScript tests, all 18 isolated UI scenarios, eight production
PWA scenarios, 44 Linux native tests (one resource test ignored), dependency
advisories and cross-platform independent recovery PASS. Windows: 48 native
tests PASS (one resource test ignored and separately executed/PASS), real
software CNG regressions, native KDBX/Python parity, full encrypted-file interop/
10,000-file restore and independent recovery PASS (88 tests passed / 15 skipped
on Windows). Restore/search measurements: 97.1923936 s / 0.2135383 s.
The real software fixture retained `NTE_NOT_SUPPORTED` from zero-export policy
as an unresolved result, measured all formats and returned no export success;
the explicitly exportable control actually succeeded and the gate rejected it,
stopping later formats. Both controls passed in this run.
These are hosted API/software
tests, not physical Passport/TPM/Kensington proof.

The 5 GiB hosted gate passed in 44.2160539 s with sampled peak working
set 10,567,680 bytes. Native encryption/verification:
26.4160211 s / 17.0384997 s.
These are runner measurements, not target-device performance. Actual NSIS
installation/packaged smoke **PASS**, including file-safe re-unlock metadata.
All four installed native modes name the exact build source and algorithm,
keep eligibility/enrollment/unlock false, and stop at actual
`device-not-present` before key creation; cleanup passes. The new
target export diagnostics remain **NOT RUN** and all physical gates remain
**BLOCKED**. The owner's earlier same-process behavior success is distinct evidence.

Downloaded installer: 217,852,272 bytes, SHA-256 `8ac0609e492b602014538292e28bd6dc04d775cdd408b9dfa57b5421cf68821a`,
independently matched to its original sidecar and metadata. All four metadata
sources and installed native reports match `946514c0dd590f703cd5398d9d39ec7c28d0491d`. The signed official
WebView2 evidence is retained. Updated [Windows delivery folder](../deploy/windows-desktop/README.md).
New [Cloudflare ZIP](../deploy/cloudflare-pages/README.md) for `587e3c1`:
206,877 bytes, SHA-256 `a9dc199982c0a47ba752f25a98872dea1f4043ef089c1d7a4833cba6b2cc95bc`; all ten production files and
the sidecar independently matched. Older evidence/archives remain available.

## Target PKCS#1 compatibility passed; explicit key behavior experiment (2026-10-07)

The [owner report from published source 6cbe2c4](../deploy/windows-desktop/hello-target-6cbe2c4.json)
passes real authorized PKCS#1 v1.5 decryption and constant-time synthetic-secret
comparison, with policy readback/public wrap and test-key deletion also PASS.
This is the first reported target private-decrypt success, distinct from the
previous OAEP parameter failures. No new prompt observation accompanies this
report. Silent access, second decrypt and private export remain NOT RUN;
eligibility, enrollment and unlock remain false. This is owner-reported target
evidence, not an independently executed cloud hardware test, and does not
approve legacy padding for an actual vault envelope.

Added separate argument-free `hello_pkcs1_behavior`, explicitly selected by
**Test PKCS#1 key behavior**. It uses a new random synthetic secret and one
unique app-owned Passport key: public wrap, silent refusal, authorized decrypt,
silent refusal, second authorized decrypt, silent refusal, all private-export
formats, unconditional deletion. Existing OAEP modes and the shorter legacy
compatibility test retain their scope; there is no automatic fallback. Only
`NTE_SILENT_CONTEXT` counts as silent refusal; other errors preserve their code
and scheme-specific operation. Success is `behavior-passed`, with all four
physical gates and false eligibility/enrollment/unlock unchanged. Actual
credential envelope/enrollment remain unimplemented.

Added portable regressions for every behavior stage failure, cleanup failure,
cancellation and invalidation before every stage/after completion. Extended
actual Windows software CNG tests to reject successful silent legacy decrypt,
retain parameter failures and distinguish exact refusal. Added isolated UI
checks for explicit selection, all measured stages, skipped later operations,
cleanup failure, narrow layout, shared busy state and late-result rejection
on Lock all. Installed smoke checks the fourth native command and build source
on the actual hosted Hello-absent path. At initial local validation, general/
Windows CI and new installed-app evidence were **PENDING**; final execution is
recorded below. Local typecheck, both production
frontends/target isolation, Windows GNU Clippy with warnings denied, ten portable
proof regressions and Rust formatting **PASS**. The first 17-scenario UI run had
16 PASS and one new test failure: it read a newly collapsed/replaced technical
report before completion, producing empty JSON. The test now waits for the action
to finish and opens the new report before checking its failure fields. The full
17-scenario UI rerun **PASS**; no product behavior was changed for that test correction.
Target behavior test: **NOT RUN**.
Per-key TPM, observed fresh authorization, fresh process, account/machine-copy
acceptance and actual Hello vault unlock: **BLOCKED**.

Final general CI [37621824810](https://github.com/kurasis/passkeylocal/actions/runs/37621824810)
and Windows CI [37621824873](https://github.com/kurasis/passkeylocal/actions/runs/37621824873)
**PASS** for head `f08abcccffb1d3b68c0c15d16cf8ffdc2e8a91b4` and tested PR merge `9fdbc050877c9968b77c2aa7aa76f807afe3ee3a`. All 11 PR checks passed;
[PR #11](https://github.com/kurasis/passkeylocal/pull/11) merged automatically.
Actual main merge `90f720322afa8819d0717725a8c4038428c1febf` has the identical tested Git tree `709ee5ae035e91e4140b56d27d11188806c5693c`.
General CI: 161 TypeScript tests, all 17 isolated UI scenarios, eight production
PWA scenarios, 42 Linux native tests (one resource test ignored), dependency
advisories and cross-platform independent recovery PASS. Windows: 46 native
tests PASS (one resource test ignored and separately executed/PASS), real
software CNG regressions, native KDBX/Python parity, full encrypted-file interop/
10,000-file restore and independent recovery PASS (88 tests passed / 15 skipped
on Windows). The full restore/search measurements were 96.1433745 s / 0.2064139 s.
These are hosted API/software
tests, not physical Passport/TPM/Kensington proof.

The 5 GiB hosted gate passed in 40.0962754 s with sampled peak working
set 10,543,104 bytes. Native encryption/verification:
22.7778207 s / 16.5127860 s.
These are runner measurements, not target-device performance. Actual NSIS
installation/packaged smoke **PASS**, including file-safe re-unlock metadata.
All four installed native modes name the exact build source and algorithm,
keep eligibility/enrollment/unlock false, and stop at actual
`device-not-present` before key creation; cleanup passes. The new
target behavior experiment remains **NOT RUN** and all physical gates remain
**BLOCKED**. The owner's earlier compatibility success is distinct evidence.

Downloaded installer: 217,853,467 bytes, SHA-256 `f710b52afa563e52efd44fed48008e0b80bae675cd5e48ea0cb18aeccf99c118`,
independently matched to its original sidecar and metadata. All four metadata
sources and installed native reports match `9fdbc050877c9968b77c2aa7aa76f807afe3ee3a`. The signed official
WebView2 evidence is retained. Updated [Windows delivery folder](../deploy/windows-desktop/README.md).
New [Cloudflare ZIP](../deploy/cloudflare-pages/README.md) for `f08abcc`:
206,404 bytes, SHA-256 `ddd8e7d70b936b1b544089a5e377ace7e5c50936a4eb1d9649ac7839a89a0684`; all ten production files and
the sidecar independently matched. Older evidence/archives remain available.

## Repeated authorized OAEP failure and explicit legacy compatibility (2026-10-07)

The [owner report](../deploy/windows-desktop/hello-target-f382542.json) from
published source `f382542806af13eeab6455b6d5154a7ec6c1b291` again fails actual
`authorized-oaep-sha256-decrypt` with `0x80090027` after public wrap and policy
readback pass. Cleanup passes. The owned creation-handle change did not resolve
the target failure; this report adds no new prompt observation. Skipped checks
remain NOT RUN and eligibility/enrollment/unlock remain false. It is reported
target evidence, not an independently executed cloud hardware test.

Added a separate argument-free `hello_pkcs1_compatibility` action, based on
pinned Passport clients using SDK PKCS#1 v1.5, to discover a target padding-path
difference using only a random synthetic secret. It shares exact app-owned key
policy, public-only wrap, one authorized private decrypt, cleanup and native
focus/single-flight/session guards. Its report names the legacy algorithm and
distinct compatibility purpose/outcome; it does not approve that scheme for
vault protection, pass skipped checks, return plaintext or enable enrollment.
Both OAEP actions retain OAEP/SHA-256 and never invoke this as a fallback.

Added portable regressions for explicit compatibility versus OAEP outcomes,
every stage failure/deletion failure, cancellation and invalidation around the
private call. Extended the real test-only Windows software CNG regression to
compare both schemes on the same key, reject cross-scheme decrypts and leave
stale-generation output untouched. Added isolated UI regressions for explicit
legacy labels, unchanged eligibility/skipped gates, no automatic invocation,
shared busy state, cleanup failure, narrow layout and discard after Lock all.
Installed Windows smoke now checks the third fixed command and exact source
identifier stops before key creation when Hello is absent.

The first Windows run [37614167780](https://github.com/kurasis/passkeylocal/actions/runs/37614167780)
for head `b82f146`, tested merge `d502999`, had 45 native tests PASS (one resource
test ignored and separately PASS), both real CNG padding paths PASS on the
software fixture, interop/10,000-file restore and recovery PASS. Earlier Hello
settings/conditional IPC checks did not fail; the failure artifact does not
retain those reports, so complete native IPC evidence awaits successful smoke.
Installed smoke then **FAILED** waiting for the file-safe folder after Lock all
and password re-unlock. The failure screenshot shows an unlocked but empty
metadata view with BUSY. Key-report/artifact packaging was skipped; this run
is not a successful release. The UI both explicitly reloads after admission and
reloads on the new token; concurrent native page reads contend for the store,
and a newer BUSY response invalidates the earlier successful page. A deterministic
exclusive-read UI fixture/regression reproduced this unrelated race before the
fix (failed to display the folder/file metadata after password re-unlock).
Metadata reloads are now serialized; superseded requests and their errors are
discarded, and lock/unmount reset the queue so a new session does not wait for
old replies. Native store/session validation is unchanged. The full local suite
of 14 UI scenarios, typecheck and both production builds/isolation passed, including
the previously failing regression and delayed-lock/language-change scenarios.
An additional session-queue reset regression passed separately: a fresh unlock
loads without waiting for an old held metadata reply and rejects that reply
after it is released. The final suite now contains 15 scenarios.
Final installed Windows smoke and CI execution are pending. General CI
[37614167791](https://github.com/kurasis/passkeylocal/actions/runs/37614167791)
passed all ten jobs for the initial head.

Initial local typecheck, Windows GNU Clippy with warnings denied, all nine portable
proof-runner regressions, 13 isolated UI scenarios and both production frontend
builds/target isolation **PASS**. Windows API execution/installed smoke and
general CI were pending at that point. Target PKCS#1 compatibility:
**NOT RUN**. Per-key TPM, fresh authorization, fresh process and account/machine
acceptance and actual enrollment/unlock: **BLOCKED**. See
[the experiment limits](windows/HELLO_KEY_PROBE.md).

Final general CI [37616751642](https://github.com/kurasis/passkeylocal/actions/runs/37616751642)
and Windows CI [37616751627](https://github.com/kurasis/passkeylocal/actions/runs/37616751627)
**PASS** for head `4c18104424eab35bc7f4af56c29ba091fc3f37b6`, tested PR merge
`6cbe2c4177866382d9696105a198c550849a1218`. All 11 PR checks passed;
[PR #10](https://github.com/kurasis/passkeylocal/pull/10) merged automatically.
Actual main merge `8342a7b64a3b67ec9558d0d660845a6a1d45cd9f` has the identical
tested Git tree `3d2aba6715ee63f96f0c89394af81d9fd5e0b7d0`.
General CI passed 161 TypeScript tests, all 15 isolated UI scenarios, eight
production PWA scenarios, dependency advisories and cross-platform recovery.
Windows executed 45 native tests (one resource test ignored in that run and
separately executed/PASS), both actual software CNG padding paths, fresh native
KDBX/Python parity, encrypted-file interop/full 10,000-file restore/search
(95.1276041 s / 0.1163646 s) and independent recovery (88 passed / 15 skipped).

The hosted 5 GiB gate passed in 87.5640075 s with sampled peak working set
10,514,432 bytes (74.8503865 s encryption / 12.0132429 s verification). These
are this runner's measurements, not target-device performance. Actual NSIS
installation and packaged smoke **PASS**, including file-safe metadata after
Lock all and password re-unlock. All three installed native commands name the
exact build source/algorithm, keep eligibility false and stop at actual
`device-not-present` before app-key creation; cleanup passes. No successful
Passport private operation, target legacy compatibility or physical TPM/
freshness proof is supplied by this host.

Downloaded installer: 217,848,427 bytes, SHA-256
`cdddf166cb62eb555b47df3893ca9ea832089100f1e12ec6679a92bff6ea28e3`, independently
matched to its original sidecar and metadata. Build, installed smoke, resource
and signed official WebView2 metadata name the same tested source. The
[Windows download/evidence folder](../deploy/windows-desktop/README.md) is updated.
The first failed smoke remains a failure in the historical record.

New [Cloudflare ZIP](../deploy/cloudflare-pages/README.md) for code source
`4c18104`: 205,786 bytes, SHA-256
`8b2c73d7c49c07699ed13d851ebccbb73292155ab09a0216d33ab06e69f85408`.
All ten production files and its sidecar were independently compared; older
archives remain retained. Target compatibility is **NOT RUN**, the four physical
gates and actual enrollment/unlock remain **BLOCKED**.

## Authorized OAEP failure and owned creation handle (2026-10-07)

Owner evidence from published source `fbd4347fa0e1507a25885e26fc4d0df66c19f1fe`:
the owner saw and completed a fingerprint prompt during the capability test;
public wrap PASS, actual `authorized-oaep-sha256-decrypt` FAIL with
`0x80090027`, test-key deletion PASS, all eligibility flags false. Silent/export/
second-decrypt checks were NOT RUN by design. The prompt's originating native
call is not established; key finalization may prompt, so this does not prove
the private unwrap was authorized or OAEP/SHA-256 is supported. This is a
reported physical result, not independently executed CI.

Review found that authorized decrypt reopened its key silently. Authorized
decrypts now borrow the owned flags-zero creation handle whose native parent HWND
was set before finalization, recheck mandatory policy, reset key context/fresh
gesture per call and use the same OAEP/SHA-256 decrypt. Silent probes retain
independent silent opens/decrypts. Native session identity is rechecked directly
before the private call, even within a stage after context/gesture setters.
All primary refusal, export, cleanup, epoch and single-flight gates remain
intact, and vault enrollment/unlock stays unavailable. This does not establish
the parameter error's root cause or a successful target fix.

Added a real Windows API regression using an isolated named software RSA key
and hidden app-owned window: exercise key HWND context, owned creation versus
silent reopened handles and actual OAEP decrypt, reject actual silent success
as authorization evidence, delete the exact fixture key, and check deleted
handles/keys cannot be selected or reopened. It also rejects a stale generation
at the real private-call boundary without touching output/length and preserves
a real native error when the same invalid parameters reach CNG in a current
generation. No software provider is selectable in
production; this regression supplies no Passport/TPM/physical consent proof.
The first Windows PR run [37606330878](https://github.com/kurasis/passkeylocal/actions/runs/37606330878)
had 43 native tests PASS, one FAIL, one resource test ignored. The new test
rejected provider-level HWND setup with `NTE_NOT_SUPPORTED` (`0x80090029`). This
run was cancelled during post-failure cache saving to retrieve its complete
native log; subsequent interop/resource/packaging gates were NOT RUN. That
unsupported route was removed from the final change, rather than permitting an
unowned UI open. General CI [37606331048](https://github.com/kurasis/passkeylocal/actions/runs/37606331048)
passed all ten jobs for the initial PR head `33d27d0`.

Local Windows GNU Clippy with warnings denied and all eight portable proof-runner
regressions **PASS**. Final Windows execution **PASS** in the run below. The
corrected target retest remains **NOT RUN**. The first failed/cancelled attempt
remains a historical failure, not a successful proof.

General CI [37608090880](https://github.com/kurasis/passkeylocal/actions/runs/37608090880)
and Windows CI [37608090808](https://github.com/kurasis/passkeylocal/actions/runs/37608090808)
**PASS** for final head `2e6b5d6f906ec6b9668046352333f642f0e23717`, tested PR merge
`f382542806af13eeab6455b6d5154a7ec6c1b291`. All 11 PR checks passed;
[PR #9](https://github.com/kurasis/passkeylocal/pull/9) merged automatically.
Actual main merge `685f42e8a8f56d24296c50baf56f10833e571c51` has the identical
tested Git tree. Windows executed 44 native tests, including actual owned-key
HWND context, creation/silent-reopened handle decryption, stale-generation
rejection at the private-call boundary and fixture deletion. The existing 5 GiB
test was ignored in the unit run but separately executed and passed. Fresh
native KDBX/Python parity, encrypted-file interop/full 10,000-file restore/search
(83.2139661 s / 0.2071379 s) and independent recovery (88 passed / 15 skipped)
passed. General CI passed all 10 jobs, including 161 TypeScript tests, 11 isolated
UI scenarios, eight production PWA e2e scenarios and cross-platform recovery.

The hosted 5 GiB gate passed in 41.0743134 s with sampled peak working set
10,555,392 bytes (24.2063635 s encryption / 16.0916477 s verification).
NSIS installation and packaged smoke **PASS**. Both installed native experiments
embed the exact build source and stop at `device-not-present` before app-key
creation; all eligibility flags remain false. No successful target Passport
unwrap, TPM binding or physical prompt-freshness proof is supplied by this CI.
Downloaded installer: 217,836,722 bytes, SHA-256
`d1736ae54140e26d94ff2531289891e1e8898fff15b2f5eaec00ed9e30df4672`, independently
matched to the original checksum sidecar and build metadata. Build, smoke,
resource and signed official WebView2 metadata name the tested source.
[Windows download/evidence folder](../deploy/windows-desktop/README.md) is updated.
The existing Cloudflare ZIP still matches all ten current production files and
its checksum sidecar; web source is unchanged. Physical TPM/freshness/process/
account acceptance and actual vault enrollment/unlock remain **BLOCKED**.

## Source-correlated silent decrypt and authorized capability diagnostic (2026-10-07)

The third owner report names published source `0a3bf261dfdf2f246a08b1c9136056d5a730083d`:
public-wrap PASS, silent-before FAIL with `0x80090027` at
`silent-oaep-sha256-decrypt`. Key reopen and mandatory-policy readback therefore
passed; actual silent `NCryptDecrypt` rejected a parameter. Authorized decrypts
and private exports were NOT RUN, deletion PASS, all eligibility flags false.
This is source-correlated owner evidence, not independently executed physical
CI. OAEP compatibility versus silent-call behavior remains unresolved.

Added a separately invoked argument-free authorized OAEP capability command,
using its own synthetic Passport key and unchanged mandatory policy, strong
padding, real buffers, single-flight/epoch guards and exact cleanup. Only one
authorized decrypt is attempted; skipped silent/export/second-decrypt checks
remain NOT RUN. Distinct purpose/result and unchanged four remaining gates
prevent confusing this with completed security proof or enrollment.
The primary proof still stops at any failed silent call.

Added native regressions for distinct capability versus primary sequences,
every capability failure/deletion failure, invalidation before/after the private
call, and cancellation in both experiments. Added isolated UI regressions for
explicit capability results, skipped gates, shared busy state and discard after
Lock all. Packaged smoke now checks both installed native commands and source
identifiers stop before key creation when Hello is absent. Local typecheck,
Windows GNU Clippy with warnings denied, 40 Linux native tests (one existing
resource test intentionally ignored), all eight final proof-runner regressions,
11 isolated UI scenarios and both production builds/target isolation **PASS**.
Packaged Windows checks passed in the CI execution recorded below. A target
authorized-decrypt report remains **NOT RUN**. Physical
TPM/freshness/process/account gates and vault enrollment/unlock remain **BLOCKED**.

General CI [37602394549](https://github.com/kurasis/passkeylocal/actions/runs/37602394549)
and Windows CI [37602394535](https://github.com/kurasis/passkeylocal/actions/runs/37602394535)
**PASS** for head `0d53cdce7d4b068d4b6095c44bfc0d2db2b25297`, tested PR merge
`fbd4347fa0e1507a25885e26fc4d0df66c19f1fe`. All 11 PR checks passed; [PR #8](https://github.com/kurasis/passkeylocal/pull/8)
merged automatically. Actual main merge `f37f6658dab88a7a59a9f15104d0eb96555b44db`
has the identical tested Git tree. Windows executed 43 native tests (the 5 GiB
test was separately executed and passed), fresh native KDBX/Python parity,
fresh encrypted-file interop/full 10,000-file restore/search (64.2932914 s /
0.1079788 s), and independent recovery (88 passed / 15 skipped). General CI
passed all 10 jobs, including 161 TypeScript tests, 11 isolated UI scenarios,
eight production PWA e2e scenarios and independent recovery across platforms.

The hosted 5 GiB gate passed in 38.487053 s with sampled peak working set
9,596,928 bytes (26.4442382 s encryption / 11.3783048 s verification).
NSIS installation and packaged smoke **PASS**. Both installed native diagnostics
embed the exact tested build source, report all eligibility flags false and
stop at actual `device-not-present` before app-key creation or an OS prompt;
this establishes no successful target authorized unwrap or hardware proof.
Downloaded installer: 217,833,973 bytes, SHA-256
`5d9bd857c9d30f2df3545d771112abc699b648a51024f35891b40a02e61267c9`, independently
matched to its original checksum sidecar and build metadata. Build, smoke,
resource and signed official WebView2 metadata name the same tested source.
[Windows download/evidence folder](../deploy/windows-desktop/README.md) is updated.

A new [Cloudflare upload ZIP](../deploy/cloudflare-pages/README.md) is published
for code source `0d53cdc`: 205,182 bytes, SHA-256
`692f358c33d695472ef077c650c20983b8a99e0685b58ef14255abd25bac62d4`.
All ten production files and its sidecar were independently compared; the old
archive remains retained. Target authorized OAEP capability and every
hardware/freshness/process/account gate remain **NOT RUN/BLOCKED**. No target
cryptographic fix or complete Hello implementation is claimed.

## Reported silent-before failure and precise diagnostics (2026-10-07)

The owner's next report has public-wrap **PASS**, followed by silent-before
**FAIL** with `0x80090027` (`NTE_INVALID_PARAMETER`). Authorized decrypts/private
exports are **NOT RUN**, app-key deletion **PASS**, all vault eligibility flags
false. This report has no operation/source identifier. The aggregate stage
includes silent key open, mandatory-policy readback and actual OAEP decrypt;
the exact rejecting call and OAEP/provider compatibility remain unknown.
It is not an authorization-refusal result and not independently reproduced here.

Reports now identify each decrypt sub-operation and individual private-export
format. CI-native builds embed only a validated public 40-hex source commit and
track environment changes so cached binaries cannot retain another build's
identifier; packaged smoke checks the installed IPC report against its actual
build source. The optional field is omitted for unidentified local builds.
This is provenance, not hardware/signature attestation. The mechanism, padding,
call flags, real output buffers and authorization/cleanup requirements remain
unchanged. No target-fix or completed Hello feature claim is made.

The extended Windows API regression confirms a test-only software key's
actual successful silent decrypt is rejected by the production gate, while
`NTE_INVALID_PARAMETER` retains its original error and only
`NTE_SILENT_CONTEXT` counts as authorization refusal. Its Windows execution
**PASS**. A new target report remains **NOT RUN/BLOCKED**.
Local typecheck, Windows GNU Clippy with warnings denied and 37 native Linux
tests **PASS** (one existing resource test intentionally ignored in this local
unit run). Both production build outputs and target isolation passed in CI.

General CI [37597928682](https://github.com/kurasis/passkeylocal/actions/runs/37597928682)
and Windows CI [37597928612](https://github.com/kurasis/passkeylocal/actions/runs/37597928612)
**PASS** for head `bf2a9fc5cebf8c52823259c8923f7b5c9f1b6b5f`, tested PR merge
`0a3bf261dfdf2f246a08b1c9136056d5a730083d`. Actual main merge
`24f29707532f979a215478bf72a87c842a999278` has the identical tested Git tree.
Windows passed 40 native tests and the separate optimized 5 GiB gate; fresh
native KDBX/Python parity; encrypted-file interop/full 10,000-file restore/search
(126.012 s / 0.190 s); independent recovery (88 passed / 15 skipped); actual
NSIS installation and packaged smoke. The 5 GiB gate took 42.416 s with sampled
peak working set 9,592,832 bytes (28.109 s encryption / 13.747 s verification).

Installed proof IPC's `sourceCommit` matches the tested build, but the hosted
machine reports `device-not-present` and stops before app-key creation. This is
not a successful target silent-decrypt result or Passport/TPM proof. Downloaded
installer: 217,828,038 bytes, SHA-256
`af9bab7261ca480c9e41268bcb3b1401f73b6ba77863ddef1c938be529de12ba`, independently
matched to the original checksum sidecar and build metadata. Build, smoke,
resource, signed official WebView2 and embedded native report provenance all
name the tested PR source. [Download instructions and evidence](../deploy/windows-desktop/README.md)
are updated. All ten files in the existing Cloudflare ZIP still match this
current production web build byte for byte and its checksum sidecar.

## Reported Hello public-wrap failure and correction (2026-10-07)

Owner-supplied target report: configuration/provider/key creation/policy/readback
PASS; direct Passport `NCryptEncrypt` public-wrap FAIL with `0x80090027`
(`NTE_INVALID_PARAMETER`); all private decrypt/export steps NOT RUN; app-key
cleanup PASS; eligible/enrolled/unlocked all false. Source/installer identifier
and exact Windows build are absent. This is a reported target result, not an
independently reproduced CI failure or a hardware-security proof.

The corrected public-wrap path exports only a bounded RSA public blob, imports
it into the fixed BCrypt Microsoft Primitive Provider and encrypts with unchanged
OAEP/SHA-256. The private key stays in Passport; production private decrypts,
mandatory authorization policies, silent/export refusal, cleanup and eligibility
gates are unchanged. Reports identify which public sub-operation failed.
See [procedure and limitations](windows/HELLO_KEY_PROBE.md).

Local Windows GNU Clippy with warnings denied and 37 Linux native tests **PASS**
(one existing resource test intentionally ignored in the local unit run).
The new Windows API test
exercises the actual public helper and NCrypt OAEP/SHA-256 round trip, wrong-hash
and corruption rejection using an unnamed ephemeral **test-only software key**.
Its actual execution **PASS** in Windows CI; it supplies no Passport,
TPM or physical sensor evidence. Target retest remains **NOT RUN/BLOCKED**;
vault enrollment/unlock stays unavailable.

General CI [37592611407](https://github.com/kurasis/passkeylocal/actions/runs/37592611407)
and Windows CI [37592611341](https://github.com/kurasis/passkeylocal/actions/runs/37592611341)
**PASS** for head `678fe4d66f60d657c85e7c6500175d4a61dc767f`, tested PR merge
`2cc75940c1d2c2b119d62a76cf40bb73f4cec1a9`. Actual main merge
`0a21054f89c124f35b2f074d31ea7a567667baa4` has its identical tested Git tree.
Windows passed 40 native tests and the separately executed optimized 5 GiB
gate; fresh encrypted-file interop/full 10,000-file restore/search (67.317 s /
0.148 s); independent recovery (88 passed / 15 skipped); both frontend builds
and target isolation; actual per-user NSIS installation and packaged smoke.
The resource gate took 50.972 s at sampled peak working set 9,535,488 bytes
(30.743 s encryption / 19.289 s verification). Hosted proof IPC stopped before
key creation at `device-not-present`, with all vault eligibility flags false;
this is a negative IPC result, not a successful Passport public-wrap retest.

Downloaded installer: 217,829,158 bytes, SHA-256
`eb4cbd1e74e9b70302edab2433933468a8c0ebe38054a374f71a537fcdf2667e`, independently
matched against the original checksum sidecar and build metadata. Build, smoke,
resource and signed official WebView2 metadata name the tested source. The
[Windows download folder](../deploy/windows-desktop/README.md) links this artifact
and retains its evidence. Application changes are Windows-native only; the
verified Cloudflare ZIP continues to match the web application source.

## Billing recheck and current-main validation (2026-10-07)

Validated source: `06536b18916f2402d9d0fb66a517e58d114180c8` on `main`.
The authenticated account is `kurasis`. The read-only user billing usage API
returned HTTP 403 (`Resource not accessible by integration`), so payment status,
remaining allowance and spending limits could not be inspected. No payment,
plan or budget setting was changed. Runner admission is working again: the
previously denied [general CI run, attempt 2](https://github.com/kurasis/passkeylocal/actions/runs/37587546983/attempts/2)
actually executed all ten jobs and **PASS**. Historical billing-denied attempts
below remain unexecuted; this result does not establish the financial cause of
their denial.

Local **PASS** on this source: typecheck; 161 TypeScript tests; npm audit
(zero reported vulnerabilities); both production frontend builds and target
isolation; nine isolated desktop UI scenarios and eight production-CSP PWA
browser scenarios; Rust formatting; 37 native unit tests (one existing 5 GiB
resource test intentionally ignored in this local unit run); 91 independent
Python tests, with 12 platform/tool skips (one Windows ACL test and eleven
KeePassXC tests because that executable is absent locally). Fresh native
KDBX save/restart/edit/history/password rotation matched independent Python
recovery. Fresh Rust/Python encrypted-file fixtures verified in both directions;
the 10,000-file synthetic native restore/search returned PASS (8.783 s / 0.347 s
on this Linux host). Hosted CI additionally ran KeePassXC recovery, the five
OS/Python recovery variants and the offline Windows recovery kit successfully.
Fresh browser fixtures passed all 65 independent recovery/security/KeePassXC
tests; Python dependency audit reported no known vulnerabilities. The published
Cloudflare ZIP matches all ten files of this current production build byte for
byte and its SHA-256 sidecar.

The separately dispatched [Windows run 37588409253](https://github.com/kurasis/passkeylocal/actions/runs/37588409253)
completed **PASS** on the same current-main source: Rust formatting and Clippy
with warnings denied; 39 native tests (one resource test ignored only in this
unit run); fresh native KDBX/Python parity; fresh encrypted-file interop; full
10,000-file restore/search (95.251 s / 0.206 s); both frontend builds and target
isolation; the separately executed optimized 5 GiB resource test (45.899 s wall
time, 8,429,568 bytes sampled peak working set; 27.655 s encryption and 17.372 s
verification); Python recovery corpus (88 passed / 15 skipped); actual per-user
NSIS installation and packaged-app smoke, including native password/save/lock,
independent file-safe locking, Russian layout, long inactivity preferences and
proof IPC refusal before key creation on `device-not-present`.

Downloaded current-main installer: 217,829,228 bytes, SHA-256
`50fc3bb66a8d9274a1de21872e55e1e14293cfc03562a24c793391c80bbf9647`, independently
matched against the original checksum sidecar and build metadata. Build, smoke,
resource and official signed WebView2 metadata all name the tested source.
The [Windows download folder](../deploy/windows-desktop/README.md) now links this
artifact and retains its reports/screenshots alongside previous evidence. These
delivery-only changes do not alter application code or the verified Cloudflare ZIP.
Physical Windows Hello/TPM/Kensington authorization remains untested here and
Hello vault unlock remains disabled.

## Native Hello protected-key experiment (2026-10-07)

The Settings card now runs a real, separate Microsoft Passport CNG synthetic
key experiment through fixed, focused-window IPC. It attempts mandatory policy
readback, RSA-OAEP/SHA-256 wrap and two decrypts, silent decrypts before/after
authorization, bounded private exports and app-only cleanup. It never receives
vault credentials and every report explicitly keeps vault eligibility false.
The native consent diagnostic and key proof share a single-flight guard.
Exact test-stage/HRESULT reports can be copied; key deletion errors remain
visible and known failed deletions are retried in the same process.

Local PASS: 161 TypeScript tests; typecheck; both production frontend builds
and target isolation; nine isolated browser UI scenarios; 37 native tests with
one existing 5 GiB resource test intentionally ignored in the local unit run;
Windows GNU Clippy with warnings denied. Final general CI [37585002441](https://github.com/kurasis/passkeylocal/actions/runs/37585002441)
and Windows CI [37585002476](https://github.com/kurasis/passkeylocal/actions/runs/37585002476)
PASS for head `cac0f40e750bcfffc926abc23ba7e2eee69b0f9b`, tested PR merge
`3fc5c57fcb57815030ce489ff05952ce7fe62293`. The main merge
`2c8955490944fb3514bf33b5f424679177f111c6` has its identical tested Git tree.
Windows passed 39 native tests plus the separately executed resource gate;
independent recovery passed 88 tests with 15 skipped. Synthetic browser/native service doubles
are not physical hardware evidence. See [procedure and implementation limits](windows/HELLO_KEY_PROBE.md).

The owner reports Windows 11 Pro 25H2 and Kensington VeriMark Desktop and shows
the existing consent diagnostic passing. This establishes no protected-key
result, exact build/SKU, per-key TPM binding or fresh unwrap enforcement.
Native attestation, fresh-process/copy tests, actual vault envelope/enrollment
and Hello vault unlock remain **NOT RUN/BLOCKED**; no full feature claim.

The installed NSIS app passed actual proof IPC refusal on `device-not-present`,
with no key creation or consent/enrollment prompt. Its report has all three
vault eligibility flags false; all protected-key stages are NOT RUN, and cleanup
confirms no app test key was created. The same smoke passed password/native
save/lock, independent file-safe unlock and long lock-interval persistence.
The actual 10,000-file restore took 92.256 s and search 0.1162 s. The 5 GiB
optimized gate took 78.940 s at sampled peak working set 8,409,088 bytes;
native encryption took 31.612 s and verification 46.761 s. These hosted
measurements are not physical-device evidence.

Downloaded installer: 217,831,045 bytes, SHA-256
`ce02dea783c5c4c53721cf43a58656907e3d34c219c8a1016833a94439e45409`, matched to
its original checksum sidecar and build/smoke/resource exact-source metadata.
See the [updated installer/evidence folder](../deploy/windows-desktop/README.md)
and [Cloudflare upload archive](../deploy/cloudflare-pages/README.md). The latter
has all ten production root files verified, SHA-256
`41bde0f2ba83c02ffee90f09ede44638bcd0e50b8d2ec2bb4d36f41bcca68cc8`.

Post-merge duplicate Windows [37587203249](https://github.com/kurasis/passkeylocal/actions/runs/37587203249),
general CI [37587203265](https://github.com/kurasis/passkeylocal/actions/runs/37587203265)
and delivery-doc CI [37587393485](https://github.com/kurasis/passkeylocal/actions/runs/37587393485)
are **BLOCKED by GitHub account billing**, not passed: their jobs executed no
steps. GitHub's check annotation says: "The job was not started because recent
account payments have failed or your spending limit needs to be increased.
Please check the 'Billing & plans' section in your settings". Payment failure
versus spending limit is not distinguished by that message. No billing setting
was changed. The successful exact-tree PR runs and downloaded installer above
remain the delivery evidence; later main/docs-only runs are not counted as tests.

## Desktop layout and Windows Hello actions (2026-10-06)

The desktop sidebar previously used a fixed 112-pixel top offset, which put it
over the new module switcher. Header/module controls now span both grid columns;
sidebar and content occupy separate columns beneath them in document flow.
Long Russian labels and wrapping header actions remain within the viewport.

Windows Settings now has an actual WinRT Hello configuration report, a refresh
button, a diagnostic fingerprint/PIN OS prompt owned by the trusted HWND, and
an action opening the fixed Windows sign-in settings destination. Consent is
not used to release a secret. The UI accurately separates configured Hello
from the still-unimplemented protected vault-unlock provider; no claim about
reader model/TPM/ESS is made from a successful availability or consent result.

Local PASS: typecheck, 161 TypeScript tests, 32 native tests (the existing 5 GiB
resource test is intentionally ignored in this local unit run), Windows GNU
cross-target Clippy with warnings denied, both production frontend builds and
target isolation. Seven isolated UI tests pass, including actual app-shell
geometry at 320/640/900/1311/1920 pixels and 125% zoom, configured/cancel/policy
Hello states, visible OS-action failures and stale-result refusal after lock.
The OS-settings failure regression first failed when an unrelated availability
refresh immediately erased the error; it passes after restricting that refresh
to completed settings actions. A browser control using the original CSS also
reproduced sidebar overlap (top 112 px versus module bottom 160.19 px); the
fixed sidebar starts at 198.19 px at the same 1311-pixel viewport.
Those services are synthetic
doubles and are not biometric-device evidence. All eight production PWA e2e
scenarios also pass, including CSP/offline/passkeys/themes/restore/long timeout.
Final general CI [37492302382](https://github.com/kurasis/passkeylocal/actions/runs/37492302382)
and Windows workflow [37492302591](https://github.com/kurasis/passkeylocal/actions/runs/37492302591)
PASS for code head `92593791fa16a2397ad3c3c28be8ab34f97abe03`, tested PR merge
source `b5557267e43ada24bb98f82fdb593bc0c9023164`. The Windows run passed 33
native tests plus its separately executed optimized 5 GiB gate, fresh full
10,000-file restore/search, and independent Python corpus (88 passed / 15
skipped). Its installed NSIS app exercised real WinRT readiness IPC, Russian
layout geometry, password/native save/lock, independent file-safe unlock and
long inactivity preference persistence. The actual hosted configuration was
`device-not-present`, not an inferred reader/protected-key result. The consent
prompt and OS Settings window were not automated; all physical Hello gates
remain NOT RUN/BLOCKED.

The downloaded installer is 217,811,037 bytes, SHA-256
`950e244662055a5b885b01356e74b644169ec6f2f9bc6d0d7f3499a49450bd3d`, independently
matched to its checksum sidecar and exact-source build/smoke/resource metadata.
See [installer/evidence folder](../deploy/windows-desktop/README.md) and the
[updated Cloudflare upload archive](../deploy/cloudflare-pages/README.md). See
[Hello implementation limits](windows/HELLO_SECURITY_DESIGN.md).


This is the gate ledger required by `docs/spec/ACCEPTANCE_TESTS.md`. Every gate
is **passed**, **partial**, **failed**, **not run** or **blocked**, with the
evidence or the reason. "Passed" means an automated test or a recorded manual
run exists and passed; nothing is marked passed because it "should work".

**Overall: not ready for real credentials.** No physical iPhone test has been
run. Passing automated tests is not a security audit; no
independent review has been performed.

Last updated: 2026-10-07 (current-main billing recheck and validation; prior deployed-site results below are historical).

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
