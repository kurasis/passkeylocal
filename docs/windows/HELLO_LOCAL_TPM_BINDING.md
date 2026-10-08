# Local per-key TPM binding after Windows returned no attestation

## Completed owner measurement (2026-10-08)

The [owner report](../../deploy/windows-desktop/hello-target-bbead07-tpm-local-binding.json) matches installed source
`bbead0731ae5fc1bbb4171e861306c70b5257369`. All 12 stages PASS, including both
ReadPublic comparisons, OAEP/SHA-256 wrap/decrypt, reopening, tamper controls
and exact test-key deletion. Outcome is `tpm-local-binding-observed`.
This completes this target measurement; no unchanged rerun is needed.

`objectAttributes: 132210` is `0x00020472`: fixedTPM, fixedParent,
sensitiveDataOrigin, userWithAuth, noDA and decrypt. The first three flags
bind the generated sensitive part to the TPM/parent and prohibit TPM duplication;
userWithAuth alone does not mean Hello authorization, and noDA is not evidence
of fingerprint prompting. Policy zero, decrypt-only usage one, 2048-bit length,
TPM version two and both matched Names/public keys support local per-key evidence
for this exact synthetic key under the trusted Windows/KSP/TBS assumptions below.

This is owner-executed target evidence, not a cloud hardware test. The JSON
contains no new OS/sensor/driver or fingerprint observations. `authorization`
is explicitly `no-hello-authorization`; the process scope is `same-process`.
`exportChecks` is empty because this action did not request private export.
It does not change the earlier unsupported-format results or supply an AIK
certificate. The test key was deleted; no usable vault key/enrollment persists.

The report's fixed four-item `remaining` list and false eligibility flags are
preserved exactly. They are conservative release placeholders, not four failed
stages in this successful probe. Local binding of the tested key is now observed;
production per-key verification, combined authorization, process/account/machine
acceptance and actual enrollment still need implementation and validation.

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

The first target run is complete as recorded above. This experiment remains
same-process: it closes/reopens key and provider handles, not the application.
There is no persisted combined envelope or process/account/machine-copy proof.
All four application release gates remain conservatively open; the completed
local per-key measurement must not be described as still missing. No claim that
Windows will now supply a direct attestation is made.

## Next implementation boundary

The next increment is a **synthetic combined PRF + TPM envelope**, not another
standalone capability/export/attestation probe and not real-vault enrollment.
The existing PRF and TPM results establish the component baseline; they do not
prove that the combination enforces authorization.

- Wrap a fresh synthetic secret through the verified app TPM key and protect
  that ciphertext with authenticated encryption using the Hello PRF result.
  Bind credential/key identity and envelope version in authenticated metadata;
  verify each new protection key using the same accepted local readback route.
- Use fresh OS-required user verification for every combined unwrap. Exercise
  cancellation, silent access, changed metadata/ciphertext and late session
  results; failures must return no usable synthetic secret.
- Add a bounded, per-user, atomic synthetic-test record and durable cleanup
  before introducing persisted temporary keys/credentials. Persist ciphertext
  and a synthetic comparison digest only, never the secret or PRF output.
  On a full app exit/relaunch, open the exact existing test objects and verify
  both their binding and a newly authorized combined unwrap.
- Subsequently validate copying to another account/machine and key-loss
  fallback, using only the app-owned test objects and independent password
  recovery. Keep real enrollment/unlock unavailable until the mechanism passes.

These are implementation requirements, not features of the bbead07 installer or
executed tests. No action is currently required from the owner. Do not repeat the
completed local-binding, PRF, direct-attestation or raw-private-export probes.
No TPM reset or OS security-policy change is required by this result.

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
