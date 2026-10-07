# Windows Hello protected-key experiment

This continues the required native synthetic-secret proof from
[WINDOWS_HELLO_KENSINGTON.md](WINDOWS_HELLO_KENSINGTON.md), before actual vault
enrollment/unlock. It is a real CNG experiment in the existing app, not a
UserConsentVerifier boolean followed by a credential read. All reports keep
`eligible`, `enrolled` and `unlocked` false.

## Target repeated decrypt and export result (2026-10-07)

The [9fdbc05 owner report](../../deploy/windows-desktop/hello-target-9fdbc05.json)
passes both decrypt/secret comparisons and the three explicit silent refusals;
cleanup passes. Asked about creation and each decrypt, the owner reports
fingerprint confirmation every time. These are reported same-process results,
not per-key TPM attestation or fresh-process/account/machine evidence.
RSA private export returns `NTE_BAD_TYPE` (`0x8009000A`); the original build
stopped before RSA full-private/PKCS#8. Microsoft documents this as the key not
being exportable into the requested blob type, not an explicit permission denial.

In the next build, run **Test PKCS#1 key behavior** once to collect `exportChecks`
for all three fixed formats. Unsuccessful attempts continue to the next format;
actual success, cancellation or native-session change stops later attempts.
Only `NTE_PERM` for every format passes the existing aggregate gate. Unavailable
formats remain unresolved; subsequent results cannot erase that failure.
Buffers are zeroized and no exported material leaves the native probe. The
report labels unattempted formats NOT RUN and still performs key cleanup.
No real credentials, enrollment or production legacy envelope are added.

## Target compatibility result and next behavior check (2026-10-07)

The [owner report from 6cbe2c4](../../deploy/windows-desktop/hello-target-6cbe2c4.json)
passes actual authorized PKCS#1 v1.5 decrypt and comparison of the random test
secret; cleanup also passes. It adds no prompt observation. This is a measured
target padding-path difference from the earlier OAEP failures, not an exact
explanation of the rejected OAEP parameter or approval of legacy padding.
Silent/second-decrypt/export checks were NOT RUN. All physical gates remain open.

Select **Test PKCS#1 key behavior** (Russian: **Проверить поведение ключа PKCS#1**)
in the next published build. This separate fixed native mode uses legacy padding
only for synthetic measurements and runs the complete sequence below on a new
app test key. It requires three silent refusals, two successful decrypts and
explicit refusal of each private export format. Any failure stops later steps;
cleanup still runs. Normal decrypts permit the owned Windows prompt and request
a fresh gesture. Observe whether key creation and each decryption actually prompt,
and whether you confirm or cancel; a successful JSON result cannot count prompts.
Share the complete nonsensitive JSON and those observations, never PINs or
biometric data. `synthetic-pkcs1-behavior` / `behavior-passed` never establishes
TPM binding, fresh-process or account/machine-copy protection. There is no
production credential/envelope access and no automatic OAEP fallback.

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
- Reopen the app key for each silent operation. Authorized decrypts use the
  flags-zero creation handle, whose parent HWND is set before finalization;
  key context and the fresh-gesture request are set again for every decrypt.
  Check the exact mandatory stored policy on each selected handle. Silent attempts before and
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
not a public SDK guarantee. Neither OAEP action tries a deprecated alias or
weaker padding after a failure. The separate legacy compatibility action below
is explicitly selected and cannot substitute for either OAEP action.
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

## Authorized failure and UI-mode alignment (2026-10-07)

The owner reports seeing and completing a fingerprint prompt during the
independent capability test from source
`fbd4347fa0e1507a25885e26fc4d0df66c19f1fe`. The report passes public wrap but
fails the actual `authorized-oaep-sha256-decrypt` with `0x80090027`;
cleanup passes and all enrollment/unlock eligibility stays false. The report
does not identify which native operation displayed that prompt; app-key
finalization can request consent before decryption. Thus seeing a successful
prompt does not establish an authorized private unwrap or a successful secret
comparison. The owner result is not independently reproduced by CI.

Code review found that the authorized decrypt used a key handle opened with
`NCRYPT_SILENT_FLAG`, even though `NCryptDecrypt` itself allowed UI. Authorized
decrypts now borrow the original flags-zero creation handle, whose native parent
HWND was set before finalization. Set the key's context and fresh-gesture request
again before each decrypt, and re-read its exact mandatory policy. Silent probes
continue reopening independent handles and use silent decrypt, without a gesture
request. Borrowing the original handle never duplicates ownership or frees it
early. It remains alive until exact app-key cleanup.

A real Windows API test rejected the attempted provider-level parent HWND with
`NTE_NOT_SUPPORTED`. That route was removed, rather than opening with permitted
UI before a parent could be set. The final route uses key-level HWND context;
it performs no authorized key open and no provider-level HWND setup. Native
session identity is checked again immediately before the private call, including
after context/gesture setters. Session interruption returns no accepted result
and never skips cleanup.

The [NCryptOpenKey documentation](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptopenkey)
describes the silent flag as a request to suppress KSP UI. The
[parent HWND property](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-property-identifiers#ncrypt_window_handle_property)
defines ownership for key UI. The pinned KeePassWinHello candidate opens
its authorized key with flags zero, but uses different padding, so that source
does not prove this target supports OAEP. The SDK does not promise that a
silent-open handle caused the owner's parameter error; using the owned creation
handle is a controlled parameter correction, **not a confirmed root cause or
target fix**. Repeated prompts on that handle, silent attempts on reopened
handles and fresh-process behavior still require independent physical proof.

Repeat **Test OAEP with confirmation** in the latest installer and share the
full JSON, including build source and failed operation, and whether any Windows
prompt appeared. RSA-OAEP/SHA-256, public-only BCrypt wrap, secret comparison,
export policy, primary silent refusal requirements and native cleanup/epoch/
single-flight guards are unchanged. No PKCS#1 v1.5, SHA-1 or software-private-key
fallback is introduced. Vault enrollment/unlock remains unavailable.

## Creation-handle target result and legacy compatibility discovery (2026-10-07)

The next [owner-supplied report](../../deploy/windows-desktop/hello-target-f382542.json)
names delivered PR #9 source `f382542806af13eeab6455b6d5154a7ec6c1b291`.
The authorized OAEP action passes configuration, provider open, key creation,
policy/readback and public wrap, but actual `authorized-oaep-sha256-decrypt`
again fails with `NTE_INVALID_PARAMETER` (`0x80090027`). Cleanup passes; skipped
silent/export/second-decrypt checks remain NOT RUN and eligibility stays false.
The creation-handle correction therefore did **not** resolve the target failure.
This report includes no observation about a new fingerprint prompt; the earlier
reported prompt belongs to the `fbd4347` run. Neither report proves which exact
parameter is rejected or that Passport universally lacks OAEP.

Three pinned implementation references use RSA-PKCS#1 v1.5 with null padding
information for Passport private decrypt: the existing
[KeePassWinHello reference](https://github.com/Angelelz/KeePassWinHello/blob/581faa6d67eff58af8b6b8240a860f2cbd5925b0/src/AuthProviders/WinHelloProvider.cs),
[Keyguard](https://github.com/AChep/keyguard-app/blob/7a08ecb9724125fd114eeb606e592413ca0c9d40/desktopLibNative/src/src/biometrics/windows.rs),
and [ByteNess/keyring](https://github.com/ByteNess/keyring/blob/199d6f55ce4706c00e12b0ab0ce9f00e939b2745/winhello/wrap.go).
These are candidate implementations, not a Microsoft contract or independent
security review. Keyguard also creates decrypt-only RSA-2048 keys with mandatory
cache policy, so these references do not justify permitting signing. The SDK's
NCrypt algorithm enumeration reports algorithm classes/names, not supported
OAEP hashes or padding combinations.

The new **Test PKCS#1 compatibility** button invokes the separate argument-free
`hello_pkcs1_compatibility` command. It creates its own unique app test key using
the same Passport provider, exact authorization/export policy, public-only
BCrypt wrap, 32 random synthetic bytes and bounded real private-decrypt buffer.
Only this explicitly chosen experiment uses SDK PKCS#1 v1.5 padding and null
padding info. It attempts one authorized decrypt and constant-time comparison,
then deletes its own key. Native focus/trust, single-flight, generation and
cleanup guards still apply.

The report identifies `purpose: synthetic-pkcs1-compatibility`,
`algorithm: rsa-pkcs1-v1_5` and `outcome: compatibility-passed` only if comparison
and cleanup succeed. Errors distinguish `public-pkcs1-v1_5-encrypt` and
`authorized-pkcs1-v1_5-decrypt`; cancellation/interruption stop and run cleanup.
Silent/export/second-decrypt stages remain NOT RUN, all four physical gates
remain open, and eligibility/enrollment/unlock remain false. New OAEP reports
name `algorithm: rsa-oaep-sha256`; older reports without the additive field
remain readable.

This is **legacy compatibility discovery, not an approved vault wrapping
construction**. PKCS#1 v1.5 is more vulnerable to padding-oracle attacks than
OAEP; compatibility cannot approve production use. No vault credential/envelope
is supplied, no caller-controlled ciphertext/padding is accepted, and no
plaintext is returned/persisted. Existing OAEP actions retain their padding and
stop on failure; neither invokes compatibility as a fallback. A compatibility
pass alongside the reported OAEP failure supports a target padding-path
difference, without resolving every provider parameter or enabling enrollment.

Fully close the old process and install the latest Windows build. In Settings
click **Test PKCS#1 compatibility** once and share its full JSON and whether a
system prompt appeared. Do not repeat the unchanged OAEP action solely to
reproduce the recorded failure. A test-only software CNG regression checks both
schemes on the same RSA key, rejects cross-scheme decrypts and stale-generation
output, without claiming Passport/TPM/gesture evidence.

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
