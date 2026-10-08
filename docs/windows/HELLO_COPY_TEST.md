# Synthetic Hello envelope copy experiment

The owner has another Windows computer available. This increment exports only a
bounded encrypted synthetic test file, keeps its source keys, and reads the file
in another Windows context without importing state or creating/deleting keys.
It extends the completed restart/cancellation/key-loss observations. It does not
enroll or unlock a real vault or close production eligibility gates.

## Completed owner result and revised scope

The [current one-account acceptance plan](HELLO_OWNER_ACCEPTANCE.md) records the
completed second-PC observation, hash-matched source decryption and cleanup.
The initial export report was not supplied; its absence is documented, not filled
in. The actual file hash plus later authenticated source roundtrip correlates the
received destination result. No repeat or new installer is requested.
The owner excluded a second Windows account from manual acceptance; account
isolation remains unverified and does not create a new owner task.

## Two-computer reference procedure (completed)

Use the same current installer from [Windows downloads](../../deploy/windows-desktop/)
on both computers. Settings → Windows Hello contains the following actions.
On a fresh installation you may use an empty test vault to access Settings;
no real vault or master password needs to be copied to the other computer.

1. On the **source** computer, choose **Create copy-test file / Создать файл
   проверки переноса** and select a new `.hello-test` filename. Allow the two
   Windows verifications (creation and a positive decryption control). Save the
   report: expected `copy-exported`, `combinedState: copy-ready`. Keep its
   `copyEvidence.fileSha256` and source commit. Leave the source test keys intact.
2. Copy **only that file** to the other Windows computer. Choose **Check a
   copy-test file / Проверить тестовый файл** and open it. Save the report.
   Expected observation: `copy-isolation-observed`, `different-installation`,
   and at least one required native key `missing`, with no provider/API errors.
   No fingerprint should be needed if a key is missing. Errors and unsupported
   hardware are reported as blocked, not as successful copy resistance.
3. On the **source** computer, open the same file with **Check a copy-test file**.
   Allow fresh Hello verification and save the report. Expected:
   `copy-source-roundtrip-passed`, `same-account-and-installation`. This checks
   that the source keys still exist and authenticate/decrypt this exact file.
4. Supply the export, destination and source-recheck reports. Their
   `copyEvidence.fileSha256` values must match exactly. Only after these reports
   have been collected, choose **Remove test and temporary keys** on the source
   computer and save its cleanup report. Delete the transport file normally when
   no longer needed; it contains only synthetic ciphertext/public metadata.

The `different-account` classification remains supported by the diagnostic code
and covered by synthetic logic tests. An actual second-account measurement is
excluded from the owner's manual plan and is not marked passed. The two-PC result
only establishes the documented envelope-only observation.
No old standalone/restart/key-loss procedure needs repeating.

If saving fails after creation, the source test stays `copy-ready`; use **Save
the test file again / Сохранить тестовый файл ещё раз** and a new filename. This
reopens/revalidates both keys and performs a fresh full decryption before export.
File dialogs never overwrite an existing file. Cancelling the initial save
dialog creates no keys. Cleanup remains available for an interrupted source
creation even if Hello becomes unavailable. Never manually copy a managed
journal into another profile or reset TPM/Hello for this test.

## Format, context and trust

The version-1 `PassKey Local synthetic Hello copy test` JSON wrapper has a strict
schema, a 32 KiB input/output limit, a ready synthetic record, and required copy
context labels. It contains the same double-encrypted random secret, public key
metadata and exact synthetic credential identity needed for read-only reopening.
It contains no raw SID, MachineGuid, password, PRF output or private key. Copy
labels are domain-separated SHA-256 hashes salted per test, derived locally from
the process token's SID and the native 64-bit Windows `MachineGuid` registry value.
The labels are bound into the record's AES-GCM authenticated metadata. Existing
records without this optional field keep their original authenticated encoding.

`MachineGuid` labels a Windows installation, not a remotely attested physical
computer. Clones/reinstallation/account changes can affect the classification.
The owner must identify the actual target context. Labels never authorize access
or short-circuit native key-open probes: both keys are queried independently. If
both open, the app attempts actual fresh-authorized full decryption; success in
a foreign context is a failed isolation measurement. Same-context success
requires full decryption, not just matching labels. Missing source keys fail the
positive control. Cancellation, denied permissions, wrong key identity,
unsupported APIs and generic provider failures do not count as missing keys.

A foreign context without the keys cannot authenticate the imported envelope or
its origin labels. Consequently, `copy-isolation-observed` alone is insufficient:
its complete-file digest must match a successful subsequent source decryption
report. Also correlate the original export report when available. The received
owner sequence lacks that initial report; the checked file bytes and later
authenticated source recheck support the narrower recorded observation. Reports explicitly request this correlation and keep
eligibility/enrollment/unlock false. The hash is a comparison aid, not a signature
or automatic source attestation. `processScope: not-measured` makes no new
restart claim. No native key-container/private files or complete Windows profile
are exported: this measures envelope-only copying, not OS-profile cloning.

## Native and filesystem boundaries

Three fixed commands accept no renderer paths, file bytes, key IDs or contexts.
Native HWND-owned dialogs select paths; the focused/trusted main-window checks,
single-flight guard and native session epochs apply throughout. Source creation
uses the existing durable precreation journal and exact-RP/user cleanup.
A copy-ready record cannot be consumed by the old restart action. Existing
experiments are never overwritten or adopted by the copy-creation action.

The import adapter implements only the read/decrypt interface. It opens no
managed journal, ignores existing (even corrupt) local experiments, persists no
input, and has no native create/delete or vault methods. Import reports omit
`combinedState` so they cannot replace the source journal's UI state. Native
handles/PRF-derived plaintext are scoped and zeroized as before. Only outcomes,
public comparison digests and sanitized operation/status values cross IPC.

Export uses exclusive creation, pinned/reparse-checked parent directories,
write/flush/readback, and the destination's inherited ACL. Because the file is
intentionally transferable and contains only synthetic encrypted data/public
metadata, it does not acquire the managed journal's source-account-only DACL.
Imported files use the existing bounded, regular-file, no-reparse read path.
An export error keeps the source journal recoverable; no failed operation is
reported as a completed transfer.

## Validation and outstanding evidence

Portable tests exercise strict parsing, context/AAD binding, old-record
compatibility, same-context decryption, cross-context key absence, unexpected
foreign decryption, cancellation/error classification, stale sessions, exclusive
export and preservation of imported files/local journals. UI tests cover source
retention, read-only checks without configured Hello, digest display, unchanged
local state, single flight and late-result redaction.

Windows tests additionally exercise the real local SID/MachineGuid reader and
native command orchestration with cancelled dialogs, malformed files, and
existing journals; test dialogs are supplied by an internal function parameter,
not a production IPC/configuration switch. Installed smoke checks no-record
export IPC without a dialog. The owner has completed the narrow cross-computer
observation and cleanup described above. Actual account isolation is unverified
and excluded from manual acceptance; production password fallback and
enrollment/lifecycle acceptance remain pending.

References: Microsoft [RegGetValueW](https://learn.microsoft.com/en-us/windows/win32/api/winreg/nf-winreg-reggetvaluew),
[GetTokenInformation](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation),
[NCryptOpenKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptopenkey),
and [WebAuthNGetPlatformCredentialList](https://learn.microsoft.com/en-us/windows/win32/api/webauthn/nf-webauthn-webauthngetplatformcredentiallist).
