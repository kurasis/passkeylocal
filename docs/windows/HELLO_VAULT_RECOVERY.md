# One-account KDBX recovery integration experiment

This increment joins the actual native PRF/TPM envelope with the shared KDBX
engine. It runs one isolated, built-in public test vault in the current Windows
account. It does not enroll or unlock the owner's active vault, and no account
switch, transport file, password entry or OS security-setting change is needed.
Production enrollment/lifecycle acceptance remains separate.

## Owner procedure

Install the current build from [Windows downloads](../../deploy/windows-desktop/).
Unlock normally, open Settings → Windows Hello and select **Test vault recovery
after Hello key removal / Проверить восстановление после удаления ключей Hello**.
Allow two Windows verifications: temporary credential creation and the protected
unwrap. The rest of the sequence runs automatically. Save the single JSON report.

Expected success is `vault-recovery-passed`, `combinedState: no-test`, all reported
checks passed, and `recovery.scope: public-synthetic-kdbx`. It confirms:

1. A separate KDBX with two records and one historical version was generated.
2. The exact native-unwrapped password component opened it and preserved its
   complete recovery model; a save with fresh salts/IVs was independently reopened.
3. The temporary passkey was deleted and its exact absence observed. The same TPM
   key was reopened as a positive control, then deleted and its exact absence
   observed (`0x80090016`). The durable cleanup journal was removed.
4. A wrong master password was rejected. Fresh ordinary password credentials
   recovered the re-saved KDBX and matched all fields, records and history.

Cancellation/interruption and provider/deletion errors do not count as success.
The worker attempts cleanup of its own ticket on failure; an interrupted app can
use **Remove test and temporary keys** on the next launch. An existing saved test
blocks new creation and is never adopted. Do not repeat the completed standalone,
restart, copy-file or object-loss procedures. Do not create another Windows account.

## Credential and isolation boundaries

The adapter's `openVaultWithPasswordHash` consumes exactly 32 bytes representing
kdbxweb's password-only SHA-256 component, before composite hashing and Argon2.
It uses the library's public `passwordHash`/`ProtectedValue` interface after
`credentials.ready`; using `setPassword` would double-hash the component. Opening
still performs the normal bounded preflight, authenticated KDBX decryption,
profile/fidelity checks and limits. Password, key-file and challenge-response
credentials are not silently reinterpreted. Input bytes are cleared on every path.
Tests include wrong component/length, repeated saves and old-component refusal
after a password change. The portable KDBX format and password recovery do not change.

Both native and worker code compile in the same clearly public synthetic fixture
password/ID. Native code wraps its fixed SHA-256 component; it never accepts a
renderer password/hash, ciphertext, path or native-key identifier. The returned
component must come from a successful fresh PRF/TPM unwrap, not from a success
boolean. The worker's positive opening uses only that result: a wrong native
component fails before password fallback. The known fixture password is used
separately to create the fixture and test independent recovery, not to hide an
unwrap failure. No claim of secrecy is made for a public fixture's credential.

The native response keeps this component outside the nonsensitive report. The
private desktop bridge transfers it to a dedicated worker and clears transport
arrays; the worker consumes it and releases the opened credential object before
revocation. Reports/clipboard never contain the component, ticket or password.
No active vault/storage/IndexedDB client is imported by this worker. Worker
termination on native lock or settings unmount drops late results; a late native
prepare still schedules ticket-scoped cleanup. Native session checks redact a
late credential reply. This does not claim guaranteed JavaScript memory erasure.

An optional authenticated fixture marker distinguishes the shared journal's
`recovery-ready` record. Old records retain byte-compatible AAD. The restart/copy
paths cannot consume it; normal explicit cleanup can recover it after a crash.
Revoke validates the exact UUID ticket, creator process and fixture marker before
native access. Late callbacks cannot delete a different experiment. The existing
precreation journal, fixed RP/user cleanup, per-key TPM binding, negative controls,
single-flight and native session guards remain in use. Cleanup failure retains
an accurate recoverable state. No production test provider or bypass switch exists.

## Evidence limits and validation

This measures one real synthetic KDBX lifecycle through actual OS-protected keys,
not production enrollment of an arbitrary user vault. Enrollment/eligibility/
unlock flags remain false. The original diagnostics' `remaining` list is static
release metadata, not a request for another account. The [owner acceptance plan](HELLO_OWNER_ACCEPTANCE.md)
excludes other-account manual testing and leaves that isolation unverified.

Automated native tests cover ticket scoping, cancellation, stale replies, deletion
failures, preserved old tests, marker binding and cleanup. Real KDBX tests cover
fresh-salt saves, native-component failure, password refusal/recovery and full
logical fidelity. The independent Python interop check opens the hash-re-saved
file with only its test password, rejects a wrong password and compares the full
recovery JSON. No Hello envelope or key metadata is part of that portable file.
Browser tests exercise the one-button flow and redaction; installed smoke checks
no-record revoke and refusal to overwrite an existing recovery journal. Hosted
Windows has no usable sensor/TPM, so those paths are not physical success evidence.
The full physical sequence awaits the owner's report for the new build.
