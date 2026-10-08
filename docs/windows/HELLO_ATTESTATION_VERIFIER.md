# TPM certification inspection and Passport capability experiment

This increment adds native verification building blocks and a separate,
argument-free capability experiment. It does **not** deliver a trusted TPM
attestation route or Hello vault enrollment/unlock. The earlier 946514c private
export measurement is complete and should not be repeated unchanged.

## Native inspection and signature boundary

`hello::attestation::inspect` parses standard `TPMS_ATTEST` / `TPMT_PUBLIC`
components, not an assumed Passport/provider-specific wrapper. It requires:

- Exact byte consumption and bounded input (certify-info ≤1 KiB, public area
  ≤512 bytes, total ≤4 KiB); malformed sizes, truncation and trailing data fail.
- TPM generated magic, the CERTIFY tag, SHA-256 Name profile and an exact
  native expected 32-byte nonce. TPM clock `safe` must be one; no app expiry,
  hardware presence or authorization is inferred from other clock/firmware data.
- Unrestricted decrypt-only RSA2048, exponent zero/default or 65537, NULL
  symmetric/scheme profile, empty or 32-byte policy and only supported object
  attributes. Require `fixedTPM`, `fixedParent`, `sensitiveDataOrigin`, `decrypt`;
  reject imported/migratable, signing/restricted, encrypted-duplication and
  reserved templates. This limited supported profile rejects alternatives.
- Exact modulus/exponent correspondence to the app's canonical RSA1 public CNG
  blob. Private/full-private blob types, invalid lengths/bit sizes and
  noncanonical public components fail.
- Exact Name match: SHA-256 of **TPMT_PUBLIC**, excluding TPM2B framing. Policy,
  template and key substitution cannot retain the certified Name.

The result is an opaque, non-serializable `UnverifiedCertification`. It has no
eligibility, enrollment or unlock flag. On Windows, its `check_signature` uses
the maintained SDK's `BCryptVerifySignature`, fixed Microsoft Primitive Provider
and RSA/RSASSA PKCS#1 SHA-256 verification. It checks the native request/session
callback before work, before verification and after the API. RAII closes the
public key before its provider on success/failure/interruption.

That second result is **SignatureCheckedCertification**, still untrusted. An
attacker-owned software AIK can sign convincing TPM-format metadata. Correct
parsing, Name/nonce matching and a valid signature cannot establish TPM origin
without trusted AIK certificate/chain/EKU/revocation verification and appropriate
restricted-key guarantees. Neither type is an unlock capability. Signature
PKCS#1 padding does not approve legacy PKCS#1 credential **encryption**.

The public-only synthetic fixture is deliberately such a software-signed
impostor. Its RSA signature is independently generated/verified by the existing
hash-pinned Python `cryptography` dependency, then verified by actual Windows
CNG tests. No private key, real certificate, account/TPM identity or credential
is committed. Rust tests reject every truncated component, wrong key/nonce/Name,
unsafe/unsupported attributes, hostile lengths, extra bytes, wrong signature,
wrong AIK and signed-data substitution. Even its correct signature leaves direct
`hello_enroll` / `hello_unlock` unavailable. This is hosted software/API evidence,
not a hardware certificate or a physical target result.

## Documented Platform KSP wrapper (2026-10-08)

`inspect_pcp_web_authn` now accepts only the SDK's version-1
`NCRYPT_PCP_TPM_WEB_AUTHN_ATTESTATION_STATEMENT`: six little-endian DWORDs,
magic `0x4B415741` (bytes `AWAK`, named `KAWA`), version one, header size 24,
then exact certify-info, raw RSA signature and TPM public-area lengths.
It borrows bounded slices without allocation or unchecked length sums,
rejects all trailing data, unknown versions/header extensions, oversized or
truncated fields and alternate TPM2B/TPMT_SIGNATURE framing. The existing
standard inspector still binds the native expected subject/nonce and exact
TPMT_PUBLIC Name. Windows compile-time assertions check header size and all
six offsets against maintained SDK bindings.

The [pinned Microsoft header](https://github.com/microsoft/win32metadata/blob/1bfb76db1c360653bdcb56512af0fdf987aceab8/generation/WinSDK/RecompiledIdlHeaders/um/ncrypt.h)
defines the wrapper. [Pinned Chromium](https://github.com/chromium/chromium/blob/544a340956293550ca5eeb89d7a046879527df18/crypto/unexportable_key_win.cc)
parses that order and produces it via `NCRYPT_CLAIM_WEB_AUTH_SUBJECT_ONLY`
with an actual **separate restricted attestation authority**. Its authority
creation uses raw TPM commands/PCP opaque import, not the failed no-authority
Passport experiment. No such command codec, OS AIK/EK access, authority creation,
claim API fallback or new renderer command is added here. The format is
established; supported same-app-key acquisition and trusted authority remain
unimplemented. This parser must not be applied to an unknown Passport/VBS blob.

The existing public-only software impostor now includes a **synthetically
assembled** wrapper, independently verified by Python against the original
components and RSA signature. It is not captured PCP output. Six additional
portable tests cover complete/truncated/hostile envelopes, component ordering,
native key/nonce substitution and unsupported framing; two Windows tests pass
the wrapped input through actual BCrypt verification, reject wrong signatures,
signers and stale sessions, and retain false enrollment/unlock. Correct framing
and signature still return only `UnverifiedCertification` /
`SignatureCheckedCertification`, never trusted hardware evidence.

The [c83ce3f owner report](../../deploy/windows-desktop/hello-target-c83ce3f-tpm-inner.json)
completes the inner RSA capability measurement: wrap/decrypt, same-process
reopen, negative controls and cleanup PASS. All three private exports remain
unsupported format (`NTE_BAD_TYPE`), not explicit denial. Do not repeat either
completed PRF or unchanged inner/export test. This verification increment has
no new owner action and closes no hardware/authorization/process/copy gate.

## Separate same-key capability experiment

**Target measurement completed:** the [6ae6e24 owner report](../../deploy/windows-desktop/hello-target-6ae6e24.json)
matches the published installer source. Configuration, Passport opening, app-key
creation, policy/readback and deletion PASS. The subject-only claim call fails
with `NTE_INVALID_PARAMETER` (`0x80090027`), operation
`create-subject-only-attestation-claim`. No claim bytes were returned;
verification was not performed. All four gates remain open and all three
eligibility/enrollment/unlock flags are false. This is owner-reported target
evidence, not a cloud-executed hardware test. No new prompt observation was
provided. Do not request another unchanged run.

The experiment is selected with **Test key attestation capability** (Russian:
**Проверить возможность аттестации ключа**) in Windows Settings → Windows Hello.
The fixed native command
is `hello_attestation_capability`. It uses the existing focused main-window,
single-flight and native storage-session/generation guards.

It checks configured Hello, opens only Passport, creates a new uniquely named
app test key and verifies the existing RSA2048/decrypt-only/zero-export/candidate
authorization policy. It invokes the documented `NCryptCreateClaim` entry point
**once** on that same created key, with `NCRYPT_CLAIM_SUBJECT_ONLY`, a fresh random
32-byte native nonce, no authority key and flags zero. The official API allows
an optional authority; this choice is a **provider capability candidate**, not
a claim that Passport supports this contract. It opens/enumerates no OS AIK or
user Hello key and tries no aliases, alternate claim types or fallback providers.
Key creation or the claim API may show an owned Windows confirmation dialog.

The output buffer is fixed 16 KiB and zeroized. There is no size-query allocation,
raw claim/public-key/certificate/nonce/key-name report, persistence or generic
renderer-selected operation. A zero/out-of-bounds length fails. Native errors
retain their original code/operation. Cancellation/session changes stop later
work; unconditional exact app test-key deletion and existing pending-delete
retry apply. Crash cleanup across restarts remains unimplemented.

The report has seven stages (configuration, provider, create, policy, readback,
claim, delete), purpose `synthetic-attestation-capability`, key profile
`rsa-2048-decrypt-only` and optional `attestationClaim` metadata:

```json
{
  "api": "NCryptCreateClaim",
  "claimType": "subject-only",
  "result": "returned-unverified",
  "verification": "not-performed",
  "bytes": 1024
}
```

This example is a schema illustration, not an observed target result. Bytes
are present only after a successful bounded nonempty API return. Failed APIs
report `unavailable`; invalid returned lengths report `invalid-length`. The
metadata is omitted if the API was not reached. `attestation-capability-observed`
means only that the API returned bytes. Their framing, signature and signer
trust have **not** been verified; the new standard-component inspector is not
applied to an unknown provider blob. Every report retains false eligibility,
enrollment/unlock and all four remaining physical gates. No unwrap/export stage
or real vault material is used by this action.

The source-correlated build and completed report are retained in the
[Windows folder](../../deploy/windows-desktop/README.md). A replacement installer
is not needed for this evidence update. The error does not identify which
parameter or provider constraint rejected the candidate, establish that all
attestation routes are unsupported, or show an absent/defective TPM or reader.
Do not repeat either completed diagnostic or reset Hello/clear TPM.

## Remaining prerequisites

The measured no-authority, subject-only candidate failed on the reported target.
Passport support/output framing for this exact decrypt-only key is **NOT
ESTABLISHED**. The next prerequisite is a supported same-key acquisition and
authority contract; changing claim types, nonce aliases or VBS parameters by
trial is not an established fix. The generic API's optional authority parameter
does not guarantee that every provider/claim combination accepts its absence.
Returned bytes alone would not resolve the trust blocker. Trusted AIK chain,
certificate policy/revocation and supported same-key acquisition/normalization
remain **NOT IMPLEMENTED**. The verifier must receive its expected key/nonce
from native app state and validate authenticated TPM-bound/non-migratable
properties before any eligibility decision.

Fresh-process authorization, cancellation/lockout, account/machine-copy proof,
approved wrapping algorithm and the real credential adapter/envelope/enrollment
remain outstanding. Master-password access and portable KDBX/Python recovery
are unchanged. No actual Hello unlock is claimed delivered.

Sources: [NCryptCreateClaim](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreateclaim),
[BCryptVerifySignature](https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptverifysignature),
[Microsoft TPM structure definitions](https://github.com/microsoft/TSS.MSR/blob/52cb9f432318e8e95cdfeaf98b824ece89370744/TSS.Py/src/TpmTypes.py),
and the [existing source/trust review](SOURCES_AND_REVIEW.md#same-key-attestation-investigation-2026-10-07).
[Chromium's certification implementation](https://github.com/chromium/chromium/blob/544a340956293550ca5eeb89d7a046879527df18/crypto/unexportable_key_win.cc)
uses a separate authority with the Platform Crypto Provider; it does not prove
the current no-authority Passport candidate or its returned format.
