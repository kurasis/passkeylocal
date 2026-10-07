# Windows Hello protected-key experiment

This continues the required native synthetic-secret proof from
[WINDOWS_HELLO_KENSINGTON.md](WINDOWS_HELLO_KENSINGTON.md), before actual vault
enrollment/unlock. It is a real CNG experiment in the existing app, not a
UserConsentVerifier boolean followed by a credential read. All reports keep
`eligible`, `enrolled` and `unlocked` false.

## Run on the intended computer

The owner reports Windows 11 Pro 25H2 and Kensington VeriMark Desktop, with the
existing Hello consent test passing. Exact Windows build, reader SKU/revision,
driver, TPM and ESS details have not been independently established.

1. Install the latest [Windows test build](../../deploy/windows-desktop/README.md).
2. Unlock normally with the master password and open Settings → Windows Hello.
3. Click **Test protected key**. Windows may prompt during key creation, then
   for two decryptions. Record whether both decryptions actually request fresh
   confirmation; a successful decrypt result alone cannot count those prompts.
4. Copy the test report. CI builds include their public `sourceCommit` identifier
   so a report can be correlated with the downloaded installer. This is build
   provenance, not signed attestation. It also contains fixed test names/statuses,
   optional error codes/operation names and remaining gates, not passwords, key names, public
   keys, ciphertext, account IDs or biometric data. If clipboard access fails,
   expand Technical report and select its text.

Cancel in the system dialog to abort. Lock All/session invalidation stops further
operations after the current native call returns. The app attempts to delete only
its own test key on every exit path. A failed deletion is visible; repeat the test
in the same app process to retry cleanup before making another key, even if
Hello has since become unavailable. An interrupted/crashed process may leave an
unused app-owned test key: the name-to-cleanup mapping is only in native process
memory, so automatic cleanup across crashes is **not implemented**. Such a key
never protected a vault credential, and no wrapped secret/report is persisted.
Do not reset Windows Hello or clear the TPM to run this test.

## Native sequence and limits

The focused trusted main window chooses its actual HWND. A shared native guard
permits only one consent test or CNG experiment at a time. The native callback
checks both the lock generation and original storage-session identity before
every next operation, so worker/session replacement also stops later prompts.
Remaining key handles are freed before the provider even on deletion failure.
IPC accepts no key
name/path, ciphertext, secret, algorithm or provider from the renderer.

- Check actual WinRT Hello configuration. Unconfigured/absent Hello stops before
  key creation; cleanup of any known prior test key still runs.
- Open only Microsoft Passport Key Storage Provider and create a current-user,
  uniquely named `<current-SID>//PassKeyLocal.Proof/v1/<UUID>` RSA key using
  Passport's account/domain/subdomain/identity naming convention. Obtain the
  current SID from the native process token, never the renderer or a script;
  omit it from every report. Never overwrite,
  enumerate or open the user's OS Hello keys.
- Request 2048 bits, decrypt-only usage, zero export policy (or verify an
  already-zero intrinsic policy without a redundant write) and mandatory
  authorization policy. Read back the exact policy; unsupported settings,
  changed values or missing properties are blockers, without software fallback.
- Export only the app key's bounded RSA public blob. Import that public component
  into the fixed Microsoft Primitive Provider with `BCryptImportKeyPair` and
  encrypt 32 random synthetic bytes with `BCryptEncrypt` RSA-OAEP/SHA-256.
  Public encryption has no private-key/Hello dependency. The private key stays
  in Passport; all production decrypts still use `NCryptDecrypt` on the original
  Passport key. This is not a software private-key fallback. Test full-buffer
  private decrypts, not size queries that may bypass authorization checks.
- Reopen the app key before each private operation. Silent attempts before and
  after each authorized decrypt must return `NTE_SILENT_CONTEXT`. Unexpected
  success or any other error stops the proof. Normal decrypts request
  `PinCacheIsGestureRequired`, use owned-window context and must match the random
  secret in constant time. Temporary native plaintext/private-export buffers
  use `Zeroizing`; neither returned output nor comparison results are credentials.
- Attempt RSA private, RSA full-private and PKCS#8 private export with real
  bounded buffers. Only explicit `NTE_PERM` is measured as export rejection;
  an unsupported format is an unresolved result, not proof of protection.
- Delete the exact app-created key. No vault data/settings/backup is changed.

The implementation uses pinned maintained Windows 0.62.2 bindings. Official
references are [NCryptDecrypt](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptdecrypt),
[NCryptExportKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptexportkey),
[BCryptImportKeyPair](https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptimportkeypair),
[BCryptEncrypt](https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptencrypt),
[key properties](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-property-identifiers),
and the [current SDK ncrypt.h](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/ncrypt.h).
The provider-specific `NgcCacheType` property is a candidate observed in
[KeePassWinHello](https://github.com/Angelelz/KeePassWinHello/blob/581faa6d67eff58af8b6b8240a860f2cbd5925b0/src/AuthProviders/WinHelloProvider.cs),
not a public SDK guarantee. No deprecated alias or weaker padding is tried.
The candidate's presence/readback does not prove its security semantics.

## Reported target failure and public-wrap correction (2026-10-07)

The owner supplied a version-1 report from the reported Windows 11 Pro 25H2 /
Kensington VeriMark Desktop computer: Hello configuration, Passport provider
open, app-key creation, key policy and policy readback passed. `public-wrap`
failed with `0x80090027` (`NTE_INVALID_PARAMETER`); every subsequent private
operation was NOT RUN. App test-key deletion passed and all vault eligibility
flags remained false. The report does not include a source/build identifier,
so it cannot establish which installer was tested or the exact rejected
parameter. It is not evidence of a fingerprint failure or TPM key protection.

The earlier path called `NCryptEncrypt` directly on the Passport key. The
correction separates public encryption from protected private decryption using
the fixed public-only export/import route described above. OAEP/SHA-256 and
every authorization/export gate remain mandatory; no weaker padding is tried.
The report now distinguishes `public-key-export`, `public-key-import` and
`public-oaep-sha256-encrypt` errors. BCrypt NTSTATUS errors are converted to
HRESULT by the maintained bindings, as are the other native report codes.

A Windows API regression uses a **test-only unnamed ephemeral software RSA
key** to verify this exact public-wrap helper interoperates with NCrypt
OAEP/SHA-256 decrypt and rejects a wrong OAEP hash and corrupted ciphertext.
It requires no enrollment and supplies no Passport/TPM/sensor evidence. The
corrected path still requires a fresh report on the intended computer; even a
successful public wrap cannot prove Passport supports the next private step.

## Reported silent-before failure and diagnostic refinement (2026-10-07)

The next owner-supplied report has `public-wrap` PASS, but `silent-before` FAIL
with `0x80090027` (`NTE_INVALID_PARAMETER`). Subsequent authorized decrypts and
private exports were NOT RUN; app-key deletion passed. The old report groups
three native calls into this stage and contains neither an operation name nor
source identifier. It therefore cannot establish whether silent key reopening,
mandatory-policy readback or the actual OAEP decrypt rejected a parameter.
In particular, this error is not proof that silent decryption was denied for
authorization, and it does not establish OAEP incompatibility.

The refined report distinguishes `decrypt-key-open-silent`,
`decrypt-policy-readback`, policy length/value mismatches,
`silent-oaep-sha256-decrypt`, owned-window/context setters, fresh-gesture setup,
`authorized-oaep-sha256-decrypt`, secret mismatch and individual private-export
formats. CI builds embed a validated 40-hex source commit, with build-script
environment-change tracking; installed-app smoke checks the actual IPC report
matches the build source, catching a stale cached executable. Local builds
without a valid source identifier omit that optional field.

This increment improves localization of the blocker; it does **not** claim to
resolve the target cryptographic failure. RSA-OAEP/SHA-256, call flags, real
output buffers, mandatory stored policy and failure cleanup are unchanged.
Only `NTE_SILENT_CONTEXT` from the decrypt call can count as silent refusal.
An extended real Windows regression deliberately observes a test-only software
key decrypt successfully in silent mode and verifies the production gate rejects
that success. Parameter errors remain failures with their original native code.
Another target run is needed to identify the failing operation before changing
the selected mechanism; there is no automatic weaker-padding fallback.

## Source-correlated decrypt failure and separate capability test (2026-10-07)

The third owner-supplied report names source
`0a3bf261dfdf2f246a08b1c9136056d5a730083d`, matching the published PR #7
installer. Public wrap passes; `silent-before` fails with `0x80090027` at
`silent-oaep-sha256-decrypt`. Thus reopening the exact app key and reading its
mandatory policy succeeded; the actual `NCryptDecrypt` call rejected a
parameter. Authorized decrypts/private exports remain NOT RUN, cleanup passes,
and all eligibility flags remain false. This reported result is not a physical
test run by CI. It still does not distinguish OAEP/SHA-256 support from silent
flag behavior or establish successful authorization denial.

Settings now offers an **independent, explicitly invoked** action, **Test OAEP
with confirmation**, backed by the argument-free `hello_oaep_capability` command.
It creates its own unique synthetic key with the same fixed Passport provider,
stored authorization/export policy, public wrap, real buffer and OAEP/SHA-256
parameters. It attempts **one** decrypt with owned-window context and a fresh
gesture request, with Windows confirmation allowed, then deletes its key.
Silent attempts, the second decrypt and private export are explicitly NOT RUN.
The primary security proof still stops on a failed silent operation; neither
automatic continuation nor weaker padding is introduced.

Fully close the old app, install the latest build, open Settings → Windows
Hello and click **Test OAEP with confirmation**. Note whether a Windows prompt
appears and whether you confirm or cancel it; never share a PIN or biometric
data. Copy the complete technical report including `sourceCommit` and failed
`operation`. Its purpose is `synthetic-oaep-capability`; a successful synthetic
comparison reports `capability-passed`, never `roundtrip-passed`. The report
does not infer that a gesture actually occurred merely because a private call
succeeded. Failure may localize a policy/context setter before the decrypt.
Both experiments share the native single-flight guard, generation checks,
focus/trust requirements and exact app-key cleanup. A result after lock cannot
enable or resurrect an unlock state. No settings or vault credentials change.

Even a capability pass leaves every hardware/freshness/account/process gate
open and all eligibility/enrollment/unlock flags false. It establishes only
that this target can decrypt the chosen algorithm in the authorized call path.
It cannot replace the primary proof's required silent-access refusal.

## What a successful report does not establish

Per-key TPM attestation/non-migration, reliable fresh prompt enforcement,
fresh-process authorization and account/machine-copy resistance remain **NOT
RUN/BLOCKED**. Provider-wide `Impl Type`, the provider name and generic TPM
presence cannot replace per-key evidence. No actual key attestation or target
hardware eligibility is implemented in this increment.

The next implementation requires that hardware/provider evidence, then a
reviewed binary credential adapter and authenticated local envelope with session
and remembered modes, native expiry, generation checks and revocation. Native
enrollment/unlock stay disabled until those requirements are met. Web/Python
master-password recovery stays independent.
