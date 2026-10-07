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
4. Copy the test report. It contains fixed test names/statuses, optional error
   codes/operation names and remaining gates, not passwords, key names, public
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
permits only one consent test or CNG experiment at a time. IPC accepts no key
name/path, ciphertext, secret, algorithm or provider from the renderer.

- Check actual WinRT Hello configuration. Unconfigured/absent Hello stops before
  key creation; cleanup of any known prior test key still runs.
- Open only Microsoft Passport Key Storage Provider and create a current-user,
  uniquely named `PassKeyLocal.Proof.v1.<UUID>` RSA key. Never overwrite,
  enumerate or open the user's OS Hello keys.
- Request 2048 bits, decrypt-only usage, zero export policy and mandatory
  authorization policy. Read back the exact policy; unsupported settings,
  changed values or missing properties are blockers, without software fallback.
- Encrypt 32 random synthetic bytes with RSA-OAEP/SHA-256. Test full-buffer
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
[key properties](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-property-identifiers),
and the [current SDK ncrypt.h](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/ncrypt.h).
The provider-specific `NgcCacheType` property is a candidate observed in
[KeePassWinHello](https://github.com/Angelelz/KeePassWinHello/blob/581faa6d67eff58af8b6b8240a860f2cbd5925b0/src/AuthProviders/WinHelloProvider.cs),
not a public SDK guarantee. No deprecated alias or weaker padding is tried.
The candidate's presence/readback does not prove its security semantics.

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
