# Windows Hello direct attestation discovery

This is a separate synthetic capability measurement, not enrollment or accepted
TPM protection. The completed PRF and Platform KSP tests should not be repeated
unchanged. Direct WebAuthn attestation is a different documented acquisition
route from the failed no-authority Passport `NCryptCreateClaim` experiment.

## Fixed native operation

`hello_webauthn_attestation` has no renderer arguments. It reuses the existing
System32 WebAuthn loader, API-9/platform/unique-Hello-route checks, real main HWND,
single-flight attempt and native session/generation checks. It creates one
unique app-owned resident ES256 test credential for the fixed `.invalid` RP,
requires platform user verification and enables the already measured PRF option.
The only changed creation preference is **direct** attestation; the existing
PRF experiment retains **none**. No enterprise attestation, alternate provider,
raw TPM command, OS AIK/EK access or security-policy change is requested.

The creation response must pass the existing native RP/user-presence/verification,
backup-flag, credential-ID, resident/PRF-support and internal-transport checks.
The exact created ID is retained before inspecting other response fields, for
unconditional exact-key cleanup even after cancellation, malformed output or
session invalidation. PRF output is not copied into the report or retained by
this action; native RAII wipes it before freeing the creation response. No
assertion, AES roundtrip or real vault credential is used.

## Bounded public observations

The pinned Microsoft API defines the direct conveyance constant and the
`WEBAUTHN_COMMON_ATTESTATION`/`WEBAUTHN_X5C` structures. New bindings are generated
from the existing pinned metadata; independent official-header/MSVC ABI tests
cover sizes and every field offset. There are no handwritten FFI declarations
or new dependencies.

Only exact known format labels (`none`, `tpm`, `packed`, `fido-u2f`) are recorded;
unknown/null formats produce `unsupported` and fail. No arbitrary native string,
certificate, credential ID, AAGUID, challenge, signature or claim payload is
copied to IPC, files, logs or portable backups. Inspect only native structure
versions, pointer/length shapes and bounded totals:

- Encoded statement/object at most 64 KiB each; object must be nonempty.
- Known non-none format requires nonempty statement and common decode version
  exactly one. Missing/future/unknown decode does not trigger CBOR guessing.
- Signature at most 1 KiB; signer COSE algorithm is an unverified numeric
  observation, not approval of an algorithm for credential wrapping.
- At most eight certificates, at most 8 KiB each and 32 KiB in total.
- TPM format requires version `2.0`, a certificate and nonempty certify-info/
  public-area fields at most 1 KiB each. Other formats cannot carry TPM fields.

**Payload bytes are not parsed or cryptographically verified by this action.**
Synthetic garbage can satisfy these shapes; native tests explicitly retain
`verification: not-performed`. A direct request can legitimately return `none`;
that means no attestation was provided, not a missing/defective reader or TPM.

## Report and acceptance boundary

Six checks: load, API, platform, route, `webauthn-direct-create`, delete. A failure
stops later stages; original native cancellation/error classification is retained.
Cleanup failures stay visible and retry only the exact pending app credential
before another creation. Crash cleanup remains RAM-only and is not production
enrollment readiness. Native state is rechecked after cleanup as well as around
each stage; late results cannot be published as successful observations.

Purpose is `synthetic-webauthn-direct-attestation`, algorithm label
`webauthn-es256-direct-attestation`. Successful bounded creation with format
`none` gives `direct-attestation-not-provided`; known non-none shape gives
`direct-attestation-returned-unverified`. These describe API observations only.
The optional `directAttestation` contains fixed labels and numeric sizes/counts:
`requested: direct`, `verification: not-performed`,
`subject: synthetic-webauthn-prf-credential`,
`prfSecretProtection: not-verified`, `innerRsaKey: not-attested`.

The WebAuthn credential is **not the separate decrypt-only inner RSA key**.
Even a later trusted passkey-signing attestation would not automatically prove
where its PRF secret is stored or attest a different wrapping key. Existing
decrypt-only RSA inspection must not be applied to this ES256 credential by
guessing a compatible profile. Signature, exact signed-data/challenge/public-key
binding, AIK certificate chain/EKU/trust/revocation, PRF storage guarantees and
same-inner-key evidence remain separate implementation prerequisites.

Every result keeps false eligibility/enrollment/unlock, `tpmBinding: not-verified`
and all four remaining hardware/authorization/process/account-machine gates.
The new UI uses existing localization and busy/late-response/cleanup controls.
It never offers actual Hello vault unlock.

## Completed owner measurement (2026-10-08)

The [owner's complete JSON](../../deploy/windows-desktop/hello-target-bdb2a03-direct-attestation.json)
matches installed source `bdb2a034e15f483dcbaadb29781234248a26dfed`.
All six stages PASS, including temporary credential creation and exact deletion.
Windows reports build 26200, API 9, one unlocked Hello candidate and an available
platform. It returns `format: none`, decode type zero, statement length one and
object length 194 despite the direct preference. Outcome is
`direct-attestation-not-provided`; no certificate, signature, TPM certify-info
or public area was provided in the decoded report. The object bytes were not
parsed. No new fingerprint/privacy-prompt observation was supplied with this
JSON; the earlier PRF prompt observations remain separate.

This completes this acquisition measurement on the owner's Windows 11 Pro 25H2 /
Kensington baseline. It does not establish why attestation was omitted or prove
that the TPM/reader is absent, defective or incapable of every attestation route.
The result cannot attest the separate inner RSA key or PRF-secret storage; all
four gates and false eligibility/enrollment/unlock remain. It is owner-provided
evidence, not a cloud-executed hardware result. **Do not repeat this unchanged
direct test, PRF test or inner/export diagnostics.** No replacement installer
or OS-policy change is needed for this evidence update.

Supported same-inner-key certification/authority acquisition and trusted
certificate/signature/chain/revocation verification remain the next integration
blocker. See [the source review](SOURCES_AND_REVIEW.md#direct-attestation-target-follow-up-2026-10-08).

## Historical owner procedure

Use the source-correlated build in [Windows downloads](../../deploy/windows-desktop/).
Open Settings → Windows Hello and select **Get Windows Hello attestation** /
**Получить удостоверение Windows Hello** once. Windows may ask for fingerprint,
PIN or an attestation privacy choice; use its owned system dialog. Copy the full
technical JSON including `sourceCommit`. No repeated PRF or TPM export test is
needed. Do not clear TPM, reset Hello or change enterprise/security policy.
That source-correlated measurement is now complete above; this procedure records
how it was obtained and is not a request for another run.

Sources: [pinned Microsoft WebAuthn header](https://github.com/microsoft/webauthn/blob/ef82c157125a0490e05f6ea82a7adb1b8e1bad08/webauthn.h),
[Microsoft make-credential API](https://learn.microsoft.com/en-us/windows/win32/api/webauthn/nf-webauthn-webauthnauthenticatormakecredential),
[W3C attestation conveyance](https://www.w3.org/TR/webauthn-3/#enumdef-attestationconveyancepreference),
and [existing source review](SOURCES_AND_REVIEW.md).
