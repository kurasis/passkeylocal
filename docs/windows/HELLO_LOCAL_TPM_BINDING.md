# Local per-key TPM binding after Windows returned no attestation

## Finding and scope (2026-10-08)

The owner's bdb2a03 result successfully creates and deletes a Hello credential,
but Windows returns `none` despite the direct attestation preference. PRF already
works with fresh fingerprints. The result does not identify an application bug,
a broken Kensington reader, an algorithm limitation, or an OS provisioning fault.
Repeated unchanged attestation requests do not resolve it.

Broader research found reports of the same omission, and real Windows 11 ES256
TPM attestations. Switching to RSA or removing PRF is therefore not a supported
universal fix. One separate 25H2 report describes an AIK provisioning error; its
hardware and local error logs are different and cannot diagnose this owner.
No TPM reset, policy change, AIK enrollment or downgrade is requested.

The integration had treated remotely verifiable AIK certification as the only
possible per-key evidence. Microsoft's documented local provider/TBS route offers
a separate measurement for our trusted-Windows local threat model. The original
[Kensington specification](WINDOWS_HELLO_KENSINGTON.md#3-prove-the-cryptographic-mechanism-before-wiring-the-ui)
requires actual per-key hardware evidence, rather than a particular remote CA.
The new route does not claim remote attestation, PRF-secret protection or complete
Hello eligibility. Those conclusions require separate evidence.

## Implemented fixed operation

`hello_tpm_local_binding` accepts no arguments and is allowed only to the local
main Windows webview. It shares native focus, session, single-flight and
post-operation invalidation guards with the existing experiments. It creates one
unique, per-user, decrypt-only RSA-2048 Platform KSP test key with export policy
zero, using random data unrelated to any vault or PRF output.

1. Verify the hardware-provider and TPM 2 preflight and exact key policy readback.
2. Read the provider-owned TBS context (pointer width) and that key's virtualized
   TPM handle (DWORD) through `NCRYPT_PCP_PLATFORMHANDLE_PROPERTY`.
3. Send only `TPM2_ReadPublic` (0x173, no sessions, 14 bytes) through that context.
   No arbitrary TPM command, handle, name, path or ciphertext comes from IPC.
4. Bound the response to 1 KiB; reject malformed framing, sizes, tags, TPM errors,
   trailing bytes and unsupported public templates. Match the complete RSA-2048
   modulus/exponent to the CNG public export. Require `fixedTPM`, `fixedParent`,
   `sensitiveDataOrigin` and decrypt-only attributes. Hash the exact TPMT_PUBLIC
   with SHA-256 and compare its Name with both the TPM response and PCP property.
   Check the qualified Name's shape without claiming parent-chain verification.
5. Wrap and recover fresh random bytes with OAEP/SHA-256. Close both CNG handles,
   reopen the exact same named app key, recover again and repeat ReadPublic.
   Require the same public key, Name and attributes after reopening. Run existing
   changed-ciphertext/wrong-hash negative controls with successful decrypts around
   each rejection.
6. Always delete only the exact app-owned key, including on failure/invalidation.
   The borrowed TBS context and TPM handle are never closed or flushed by us;
   the provider owns their lifetime. Load `tbs.dll` only from System32.

Success reports `tpm-local-binding-observed` and
`perKeyTpmEvidence: local-read-public-observed`, only after cleanup and a final
session check. It does **not** enable enrollment/unlock or close any release gate.
The JSON contains bounded numeric properties and classifications, never raw
public blobs, object Names, handles, credentials or random secrets.

This action does not run the old raw-private-export experiment: that separate
measurement still correctly classifies NTE_BAD_TYPE as unsupported format. TPM
object duplication restrictions are a different property and must not be
reported as successful raw-export permission-denial tests.

## Trust boundary and outstanding work

A successful ReadPublic response binds the precise app public key and its
attributes to the provider's live TPM object under the trusted local Windows,
Platform KSP and TBS assumptions. It is not cryptographically signed evidence
against a malicious OS/provider, a remote TPM identity, a certificate chain, or
proof about the separate Hello PRF credential. Software-shaped fixtures alone
cannot establish hardware binding. The existing hardware preflight must pass;
there is no software-provider fallback.

The first target run is still required. This experiment remains same-process;
there is no persisted envelope and no process/account/machine-copy proof. The
combined PRF + inner-envelope authorization, tamper/cancel/restart/copy cases,
crash cleanup and actual enrollment lifecycle remain pending. All four release
gates and the master-password fallback remain unchanged. No claim that Windows
will now supply a direct attestation is made.

On the new installed build, use Settings → Windows Hello → **Check key binding
to TPM** (Russian: **Проверить привязку ключа к TPM**). It requires no fingerprint;
copy that one report. Do not repeat the old direct/PRF/private-export probes.
A failure includes the exact bounded operation and native error; no OS settings
should be changed to force a passing result.

## Sources checked

- Microsoft [Platform Crypto Provider guide, “Using Storage Provider Keys with
  Custom Commands”](https://github.com/microsoft/TSS.MSR/blob/52cb9f432318e8e95cdfeaf98b824ece89370744/PCPTool.v11/Using%20the%20Windows%208%20Platform%20Crypto%20Provider%20and%20Associated%20TPM%20Functionality.pdf):
  explicitly documents the two `PLATFORMHANDLE` properties, `Tbsip_Submit_Command`
  and borrowed-handle lifetime. Download SHA-256
  `bbaf7aec1b0cedb8e4d1bf68b71049b5065a9045be8dfa451e9502e2695bfce8`.
- Microsoft [AttestationApi.cpp](https://github.com/microsoft/TSS.MSR/blob/52cb9f432318e8e95cdfeaf98b824ece89370744/PCPTool.v11/dll/AttestationApi.cpp):
  concrete `TBS_HCONTEXT` / `UINT32` property widths. We do not invoke its AIK flow.
- Microsoft [TPM reference ReadPublic](https://github.com/microsoft/ms-tpm-20-ref/blob/ee21db0a941decd3cac67925ea3310873af60ab3/TPMCmd/tpm/src/command/Object/ReadPublic.c),
  [output definition](https://github.com/microsoft/ms-tpm-20-ref/blob/ee21db0a941decd3cac67925ea3310873af60ab3/TPMCmd/tpm/include/private/prototypes/ReadPublic_fp.h),
  and [TPM constants/attributes](https://github.com/microsoft/ms-tpm-20-ref/blob/ee21db0a941decd3cac67925ea3310873af60ab3/TPMCmd/tpm/include/public/TpmTypes.h).
- [FIDO2 library issue 18](https://github.com/webauthn-open-source/fido2-lib/issues/18):
  reports direct requests returning none; secondary evidence, not a diagnosis.
- [FIDO2 .NET issue 305](https://github.com/passwordless-lib/fido2-net-lib/issues/305)
  and [Wax issue 52](https://github.com/tanguilp/wax/issues/52): actual Windows 11
  ES256 TPM attestations and library parser bugs; reject an unsupported claim
  that ES256 inherently prevents TPM attestation. No real-user payload copied.
- [Separate Windows 11 25H2 report](https://learn.microsoft.com/en-in/answers/questions/6022813/windows-hello-hardware-attestation):
  direct none and AIK enrollment errors on different hardware; no confirmed fix
  applicable to this owner and no authority to reset/provision their TPM.
