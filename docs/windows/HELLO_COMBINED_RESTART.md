# Combined Hello PRF and TPM restart experiment

This increment composes the two components already observed on the owner's
Windows 11 Pro 25H2/Kensington computer. It uses a new synthetic secret and never
reads, enrolls, or unlocks either real vault. The successful standalone reports
remain valid; they need not be repeated.

## Completed owner measurements

[Preparation](../../deploy/windows-desktop/hello-target-a7f56d8-combined-prepare.json)
passed all nine stages; [restart](../../deploy/windows-desktop/hello-target-a7f56d8-combined-resume.json)
passed all seven for source `a7f56d80d6029bcd4185ca6d3ad22d08f957561a`.
The owner confirmed two fingerprint verifications for each button: creation and
first unwrap, then both unwraps in the new process. Both native objects and the
journal were removed. The successful combined/restart path is complete.

[First-assertion cancellation](../../deploy/windows-desktop/hello-target-a7f56d8-combined-cancel.json)
is now owner-observed in a fresh process: reopening/binding passed, then
`webauthn-prf-assertion` returned `0x80090036` (`NTE_USER_CANCELLED`) and the first
unwrap was cancelled. No successful unwrap or later operation is reported.
`ready-to-resume` retained the test for retry/cleanup; a successful retry has not
been measured. The subsequently requested explicit cleanup is recorded below.

[Cleanup after cancellation](../../deploy/windows-desktop/hello-target-a7f56d8-combined-cleanup.json)
now passes all four stages: mark journal for cleanup, delete the test passkey,
delete the TPM key, then delete the journal. Final outcome/state is
`combined-cleaned` / `no-test`. Preserve this report's `same-process` scope;
it is a cleanup operation, not another fresh-process authorization measurement.
No additional fingerprint prompt is inferred from its authorization metadata.

The current target procedure is complete. No new test, restart, manual key
deletion or installer is requested. The static `remaining` list is release-state
metadata and does not negate the completed observations. Next work is synthetic
account/machine-copy and key-loss/password-fallback coverage, remaining
authorization negatives, and production lifecycle integration.

## Reference procedure (successful path and first cancellation/cleanup completed)

1. Install the build linked from `deploy/windows-desktop/README.md`. In Windows
   Hello settings choose **1. Create Hello + TPM test**. Allow creation and the
   subsequent fresh Hello verification. Copy the report: success says
   `restart-required`, with all executed stages passed.
2. **Fully quit the application**, then launch it again. Reloading its web page,
   changing tabs, or locking/unlocking the vault does not count as a new process.
3. Choose **2. Continue after restart**. Windows must ask for a new fingerprint,
   face, or PIN for **each of the two** decryptions. Copy the report. Expected
   success is `combined-restart-passed`, `processScope: fresh-process`, and both
   object deletions plus journal deletion passed. Note whether each prompt
   actually required a new verification; the app cannot infer that interaction
   from an HRESULT alone.
4. To measure cancellation separately, create another test and restart. Cancel
   the first Windows verification. Expected: `cancelled`, no decryption success,
   and the saved test remains available for retry or **Remove test and temporary
   keys**. Cleanup is available even if Hello becomes unavailable.

If creation is interrupted or cleanup fails, the journal survives; use the
cleanup button before starting another test. Do not reset the TPM, delete other
credentials, or weaken Windows settings. Report an error with its native code
and operation; do not repeat the older export or direct-attestation experiments.

## Protocol and persistence

The native host derives the directory from the app-local managed root; IPC
accepts no paths, key names, salts, credential IDs, ciphertext, or secrets. Four
fixed commands offer status, prepare, resume, and cleanup. The existing managed
Store process lock and global native authentication single-flight guard serialize
access. Session generation and active-vault identity cancel stale work; raw
secrets never cross IPC. A process-random UUID held in native `OnceLock` prevents
a renderer reload from satisfying the restart boundary.

Before creating either native object, a bounded journal is exclusively staged,
atomically replaced, and read back under the protected per-user directory. It
contains a random test UUID, creator-process UUID, source version, and random
PRF salt. The key name and dedicated WebAuthn user handle are derived only from
that journaled UUID. An interrupted fixed `test.pending.json` staging file is
pruned without guessing paths or touching unrelated files. Symlinks/reparse
points and malformed/oversized journals fail closed.

The new Platform KSP RSA-2048 key is decrypt-only with no export policy. The
existing local TPM ReadPublic verifier checks the exact CNG public key, PCP Name,
TPM public area, and fixedTPM/fixedParent/sensitiveDataOrigin/decrypt attributes.
The random 32-byte test secret is wrapped with RSA OAEP/SHA-256. HKDF-SHA-256
(domain separated) derives an AES-256-GCM key from Hello PRF. AES protects the
256-byte TPM ciphertext. Canonical authenticated metadata binds protocol/version,
source, UUIDs, salt, credential ID, TPM public area/Name and comparison digest.
Every outer encryption uses a fresh 96-bit random nonce.

Only encrypted data, public identities and a SHA-256 comparison digest of the
random synthetic secret persist. The PRF result, derived AES key and decrypted
secret are wiped on scope exit. A fresh OS-required UV assertion opens the outer
envelope, then the same TPM key opens the inner envelope. Secret length/digest
and session identity are checked before declaring the stage passed. No secret is
returned, including on cancellation or session invalidation. Tampered ciphertext,
AAD, and wrong PRF-derived keys must fail authenticated decryption, bracketed by
successful controls. The second assertion is a new WebAuthn request/challenge.

After a full restart, reopen the exact existing TPM key and reverify its local
binding against the saved public area/Name. Reopen the exact credential under the
dedicated RP, then request two separate Hello authorizations/decryptions. Neither
PRF output nor a native key handle is recovered from process memory.

## Crash recovery and credential ownership

The dedicated RP is `combined.passkey-local.desktop.invalid`, with its matching
HTTPS origin. Before MakeCredential, the journal already identifies the exact
random user handle. The documented `WebAuthNGetPlatformCredentialList` call is
always scoped to this RP; returned entries must also match that exact user and
RP. It never enumerates all RPs. More than one matching credential is ambiguous
and blocks deletion. The newly returned credential must appear in this scoped
lookup before preparation can pass.

This closes the crash window between native credential creation and receipt of
its ID. Cleanup resolves only that app-owned test credential, including after a
crash before MakeCredential returns. The exact TPM name is known before key
creation/finalization. Both deletions are attempted independently, even if one
fails. The record is marked nonresumable **before** either deletion and retained
until both absence checks and journal deletion succeed. Windows provider errors
are reported without being relabeled as an export refusal or success.

The WebAuthn declarations are generated from the pinned Microsoft metadata. New
credential-list structures are included in the independent MSVC/pinned-header
layout comparison. The existing System32-only loader, bounded native outputs,
required UV, internal transport, RP hash/credential/backup-flag validation and
per-request cancellation watcher are reused.

## Evidence limits

Local unit tests exercise orchestration, persistence, tamper rejection, stale
sessions, restart discrimination and retryable cleanup using synthetic backend
controls. Windows CI additionally checks the generated ABI and native software
controls. These software controls are distinct from the owner reports above,
which now establish the successful combined/restart measurement on the target.

Trust remains local Windows/WebAuthn/Platform KSP/TBS, not remote certificate
attestation or protection from a compromised unlocked process. Assertions rely
on the trusted native WebAuthn API, with its required UV and context validation;
this experiment does not add an independent ES256 signature verifier. It does
not assert that the PRF secret itself has a remotely attested TPM binding.

The exposed WebAuthn API has no implemented silent-PRF experiment here: required
UV is requested on every assertion. Actual fresh prompting on the successful
path is owner-confirmed, as is cancellation of the first assertion after restart.
Cleanup after that cancellation is also owner-confirmed. Other cancellation
points and silent-access negatives remain open.
No simulated silent failure is reported as proof.
Account/machine copying, native-object loss/password fallback, complete production
lifecycle and independent review remain acceptance work. Reports always keep
`eligible`, `enrolled`, and `unlocked` false. Their `remaining` list is release
state, not a list of failed stages in this synthetic run.

## Official API reference

- Microsoft [WebAuthNGetPlatformCredentialList](https://learn.microsoft.com/windows/win32/api/webauthn/nf-webauthn-webauthngetplatformcredentiallist)
  and [credential options](https://learn.microsoft.com/windows/win32/api/webauthn/ns-webauthn-webauthn_get_credentials_options).
- Pinned official [header](../../tests/hello/vendor/webauthn.h), including
  `NTE_NOT_FOUND`, credential user/RP ownership fields and matching free API.
- [Accepted local TPM binding](HELLO_LOCAL_TPM_BINDING.md) and
  [existing PRF baseline](HELLO_PRF_PROOF.md).
