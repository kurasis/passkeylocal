# Platform KSP inner-envelope experiment

## Contract and purpose

The owner has completed the same-process native WebAuthn PRF experiment on
Windows 11 Pro 25H2 / build 26200 with Kensington VeriMark Desktop. The next
increment measures a separate **inner RSA-OAEP/SHA-256 wrapping layer** using
Microsoft Platform Crypto Provider. It does not rerun PRF, compose a real-vault
envelope, or enable Hello enrollment/unlock. The intended future composition
puts the TPM-wrapped secret inside authenticated encryption using the PRF key.
Both layers and their bindings need acceptance before any real credential use.

This increment uses the existing pinned Microsoft `windows` bindings and the
existing BCrypt public-RSA helper. No new crypto dependency, raw TPM command
codec or source implementation is imported. Platform KSP manages its own TPM
access; the application never retrieves TPM owner authorization, reads OS
Hello/AIK/EK keys, enumerates existing keys, clears TPM or changes security policy.
Unsupported operations stop with their original native code; there is no
software provider, legacy padding or consent/DPAPI fallback.

The relevant Microsoft contracts are
[key storage properties](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-property-identifiers),
[NCryptCreatePersistedKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreatepersistedkey),
[NCryptDecrypt](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptdecrypt),
and [NCryptDeleteKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptdeletekey).
PCP/TBS identifiers and the device-info structure come from pinned SDK bindings.
The [TBS device-info contract](https://learn.microsoft.com/en-us/windows/win32/api/tbs/nf-tbs-tbsi_getdeviceinfo)
provides the numeric TPM version. Microsoft’s
[pinned PCP sample](https://github.com/microsoft/TSS.MSR/blob/52cb9f432318e8e95cdfeaf98b824ece89370744/PCPTool.v11/exe/SDKSample.cpp)
reads `PCP_PLATFORM_TYPE` as UTF-16 text, not a version DWORD; this adapter does
not infer a numeric TPM version from that property. No sample source is imported. Measuring an opaque
`PCP_TPM2BNAME` length is not decoding or verifying an attestation statement.

## Fixed commands and measurements

- `hello_tpm_capability`: argument-free read-only open of Platform KSP, bounded
  DWORD hardware implementation and TBS device information. Requires the
  hardware flag without the software flag, TPM version 2 and a known non-emulator
  interface. TBS is loaded only from System32. No key creation,
  deletion, export, private operation or Hello prompt. These provider observations
  are necessary preflight, not sufficient per-key hardware evidence.
- `hello_tpm_proof`: argument-free synthetic experiment. Creates one unique
  app-owned, per-user RSA key, requests 2048 bits, decrypt-only usage and export
  policy zero, finalizes, reads back those policies and observes a bounded
  nonempty object-name property. Only that new key is opened/deleted.

The public component alone goes to BCrypt for encrypting 32 random native bytes
with OAEP/SHA-256. Platform KSP decrypts with `NCRYPT_SILENT_FLAG`; recovered bytes
must equal the synthetic secret. The test disposes the key and provider handles,
reopens the exact same app key and repeats the actual comparison. This is
**same-process reopening**, not a fresh-process or machine-copy proof.

Changed ciphertext and SHA-1 padding-hash controls must fail. Each negative is
bracketed by successful SHA-256 recovery, so general provider unavailability
cannot pass a negative control. Three bounded private-export attempts use the
existing strict classifier: only explicit `NTE_PERM` is refusal.
`NTE_BAD_TYPE` remains unsupported format and cannot pass the export stage.
An unexpected private export is a failure and its native buffer is zeroized.

Every report has `eligible/enrolled/unlocked: false`, `authorization:
no-hello-authorization`, `processScope: same-process`, `perKeyTpmEvidence:
not-verified` and all four unresolved security gates. A hardware flag, provider
name, opaque object-name length or successful roundtrip does not establish
trusted per-key TPM attestation. No key name, blob, ciphertext, secret or PIN is
returned to UI or logs. Only nonsensitive metadata and native errors are reported.

## Lifecycle and limits

Both commands require the focused trusted main window and share the native
Hello single-flight guard. Native session identity/generation are captured before
blocking work and checked before/after each stage and each decrypt/export.
Invalidation discards recovered data and prevents later stages. Unconditional
cleanup runs after failure or invalidation. CNG synchronous calls have no new
forced timeout/cancellation guarantee here; lock rejects their eventual result.

Deletion failures remain visible. The exact app key name stays in RAM for retry
and must be deleted before another synthetic key is created. Read-only capability
never retries deletion. No wildcard deletion occurs. Crash/power-loss cleanup is
not durable; production enrollment requires a protected bounded cleanup journal.
Real credential delivery, PRF composition, fresh-process authorization, verified
per-key hardware evidence, account/machine copies and enrollment lifecycle are
not implemented or accepted by this experiment.

## Owner procedure

Install the new build from [the Windows download folder](../../deploy/windows-desktop/).
In Settings → Windows Hello select **Check TPM provider** / **Проверить провайдер TPM**,
then **Test TPM inner layer** / **Проверить внутренний слой TPM**. A fingerprint
prompt is not expected for this inner-layer experiment; PRF supplies authorization
in the future composition. Copy the complete technical JSON including source SHA.
Do not reset TPM, change Windows Hello or repeat the completed PRF experiment.

`tpm-inner-roundtrip-passed` means the listed synthetic inner-layer operations
passed; hardware and authorization acceptance still remain open. A blocked
report identifies the exact stage/native operation without inventing its cause.
Standard-user target operation is still required; hosted Windows evidence is
recorded separately and does not prove the owner's TPM or Kensington setup.
