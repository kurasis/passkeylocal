# Release evidence and gate status

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
