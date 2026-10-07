# Native Windows Hello PRF increment

## Owner target success (2026-10-07)

The [source-correlated owner report](../../deploy/windows-desktop/hello-target-72a0df6-prf.json)
from installed source `72a0df66fe107b6ef15e4c81aa010c261662287b` passes all ten
stages on Windows 11 Pro 25H2 / build 26200, API 9, Kensington VeriMark Desktop.
Creation and three assertions yield the expected same-input/changed-input PRF
behavior; synthetic AES-GCM checks and exact test-passkey deletion pass.
The owner separately confirms a new fingerprint request at creation and each of
the three assertions. These are same-process owner measurements, not independent
TPM proof or completed fresh-authorization/process/account/machine acceptance.
All four gates remain open and real enrollment/unlock remains unavailable.
The completed experiment needs no unchanged rerun or replacement installer.

## Creation-context correction (2026-10-07)

The owner reports API 9 and one available route on Windows build 26200.
The initial synthetic build `107c49d` stops at a local creation-context check;
cleanup passes and assertions/PRF/AES are not executed. See the
[capability report](../../deploy/windows-desktop/hello-target-107c49d-capability.json)
and [creation result](../../deploy/windows-desktop/hello-target-107c49d-prf.json).
The report supplies no new fingerprint/prompt observation.

Corrected a two-byte parser error: the ID length occupies bytes 53–54 and
credential ID begins at 55, following the 37-byte authenticator header and
16-byte AAGUID. The original test copied the same incorrect layout. An independently
Python-encoded public-only wire fixture now reproduces rejection before the fix and
covers the real layout plus negative controls in Linux and Windows tests.
The [W3C authenticator-data layout](https://www.w3.org/TR/webauthn-3/#sctn-authenticator-data)
and [attested-credential layout](https://www.w3.org/TR/webauthn-3/#sctn-attested-credential-data)
are authoritative. All other validation and physical gates remain in effect.


The app now implements a native WebAuthn PRF **synthetic capability experiment**,
based on the [source review](HELLO_INTERNET_RESEARCH.md). It does not yet enroll
or unlock either real store. All four physical security gates remain open.

## Fixed native contract

Two argument-free, main-window-only Tauri commands are permitted:

- `hello_webauthn_capability`: read-only OS build, WebAuthn API version, platform
  availability and authenticator-routing metadata. No make/get/delete ceremony.
- `hello_prf_proof`: one uniquely created resident test passkey, three exact-ID
  assertions, AES-256-GCM synthetic encryption and unconditional exact-ID deletion.

The adapter loads only `System32/webauthn.dll` with the System32-only loader flag.
API 9 is required for explicit authenticator-ID routing; creation PRF input itself
was introduced earlier. Older Windows versions remain installable and produce a
blocked report before any ceremony. API version does not establish PRF support.
A single unambiguous, unlocked `Windows Hello` display-name candidate is selected.
That name is a routing hint, **not** a trusted identity or hardware certificate.
No existing user credentials, OS Hello keys, AIKs or TPM owner settings are opened
or changed. Only authenticator metadata is enumerated.

The synthetic RP/origin is `passkey-local.desktop.invalid` /
`https://passkey-local.desktop.invalid`, an app-reserved namespace with no remote
service. Every ceremony uses a fresh native random challenge. Creation requests
UV-required, platform-only, resident ES256, attestation-none and a PRF evaluation
input immediately, including the compatibility fix described in the source review.
The same route ID and exact one-element credential allowlist are used on assertion.
Default PRF flags request the WebAuthn-specified domain separation; raw-HMAC flags
are not mixed with that mode.

Checks require native PRF-enabled creation, exact 32-byte PRF output, internal
transport, matching RP hash, user presence/verification and no backup eligibility
or backup state flags. Creation also binds the returned credential ID to its
attested-credential data. The first and repeated same-input assertions must match
the creation output; a changed input must produce a different result. These are
local trusted-API observations, not independent signature/attestation verification
or proof that authorization is fresh in another process.

The existing maintained libsodium implementation encrypts a random synthetic
message using the PRF key, a fresh nonce and fixed associated data. It checks
successful recovery and rejects wrong keys, changed associated data and tampered
ciphertext. AES-unavailable machines return an explicit failure. No vault content,
master password, key, PRF output, salt, native credential or attestation blob is
returned to the renderer or written to a diagnostic report. Secret copies and
bounded native PRF buffers are zeroized before disposal.

## Cancellation and cleanup

All Hello actions share the native single-flight guard. Windows UI is owned by
this app's HWND. Every native stage checks the password-session identity and lock
generation before and after work. A scoped cancellation watcher polls at 20 ms,
invokes the native cancellation API once on session invalidation or the 60-second
ceremony deadline, and keeps the DLL/GUID alive until the synchronous call returns.
A late successful response cannot pass the stage after invalidation or expiry.
The API's timeout/cancellation cooperation remains an OS behavior to measure.

Deletion runs after success, failure, cancellation or invalidation. If creation
returns an ID even with an unsuccessful/late result, that exact ID is retained for
cleanup. Deletion failures are reported and the exact ID remains in RAM for retry;
no subsequent test creation can bypass that retry. A retry stopped at capability
checks still attempts pending deletion if the DLL is available. Read-only capability
never retries deletion. Successful creation without a usable returned ID reports
cleanup failure. No wildcard deletion is possible.

**Crash recovery is not implemented for this diagnostic credential.** Forced
termination/power loss or an ID-less OS response may leave its test passkey in
Windows. The app does not enumerate user credentials to find it. An owner can
remove a leftover `PassKey Local PRF test` passkey for the reserved test RP in
Windows Settings; real vaults do not depend on it. Production enrollment needs a
durable, bounded, protected cleanup journal before acceptance.

## Owner procedure and interpretation

1. Install the unsigned build linked in [the download folder](../../deploy/windows-desktop/).
2. Open Settings → Windows Hello → **Check PRF support**
   (Russian: **Проверить поддержку PRF**). Copy its technical report; it includes
   the actual Windows build, API version and build source commit.
3. When Windows Hello is configured, select **Test Windows Hello PRF**
   (Russian: **Проверить Windows Hello PRF**). Windows may ask for confirmation
   at creation and each of the three assertions. Complete the requested prompts,
   then copy the technical report. Cancellation is an expected measurable outcome.
4. Note which individual requests actually required a new fingerprint/PIN and
   whether canceling and Lock All behaved correctly. Do not reset Hello or TPM.

`prf-roundtrip-passed` means these synthetic PRF/AES comparisons and cleanup passed.
`eligible`, `enrolled` and `unlocked` stay false. `tpmBinding` remains `not-verified`.
An API-9 capability pass alone means the route can be attempted. Original HRESULTs
and static operation names identify failures without assigning an invented cause.
A blocked API-7 report on a hosted Windows Server runner is not a Windows 11 target
failure. The previous Passport claim/export results are completed, separate evidence;
this test does not rerun or reinterpret those candidates.

## Reproducibility and next gate

Private declarations are generated from exactly pinned `windows-bindgen` 0.100.0
and its locked metadata dependencies using the isolated Rust 1.95 generator.
The app compiler remains Rust 1.90. CI regenerates and compares the checked-in file.
Separately, MSVC compiles the pinned MIT-licensed official Microsoft API-9 header;
Windows Rust tests compare every generated struct size and field offset with
that C program's output. See [the header provenance](../../tests/hello/vendor/README.md).

Portable tests cover each stage failure, each pre/post-stage invalidation,
unconditional cleanup, unresolved success gates and actual AES negative controls.
Windows tests additionally cover loading, cancellation, bounded PRF output/wiping,
RP/UV/backup/credential binding and ambiguous/locked routing. Browser doubles cover
readonly access, synthetic results, deletion errors, single flight and late lock
results. Installed-app CI invokes the read-only command and invokes the synthetic
command only when preflight is blocked, proving permitted IPC and early stop without
creating a credential or automating biometric UI.

Physical PRF behavior is still **NOT RUN** in cloud. Before real enrollment, implement
and verify a separately TPM-sealed inner envelope (or another supported hardware
contract) for the exact protected object, account/machine binding, fresh authorization
across processes, cancellation and durable cleanup. No consent+DPAPI fallback,
signature-derived key or software-private-key fallback is added by this increment.
