# Windows Hello integration research

Reviewed 2026-10-07 after the owner requested a broader internet investigation.
This is a source review and implementation recommendation, not a completed
Windows Hello integration or a new physical test result.

## Recommendation

Investigate **native WebAuthn PRF** as the next Windows Hello mechanism. Microsoft
publishes the native API contract, a merged Bitwarden change addresses a concrete
Windows Hello PRF interoperability bug, and current Rust implementations provide
examples. This is a new cryptographic path; it does not depend on making our
failed no-authority Passport `NCryptCreateClaim` candidate succeed.

PRF can provide a credential-bound secret after user verification, suitable for
an authenticated encryption key. It does not, by itself, prove our required
hardware binding. Evaluate a separate **TPM-sealed inner envelope protected by
a PRF/AES-GCM outer envelope** to satisfy both local authorization and machine
binding. A current implementation demonstrates this composition, but we must
review and test our own implementation before accepting it. Do not weaken the
existing release gates or enable enrollment from this research alone.

The existing PWA already implements WebAuthn PRF in
[`apps/pwa/src/biometric.ts`](../../apps/pwa/src/biometric.ts) and authenticated
wrapping in [`apps/pwa/src/worker/biometric.ts`](../../apps/pwa/src/worker/biometric.ts).
It supplies PRF input on creation and verifies the later assertion path. Desktop
explicitly disables that browser adapter. Reuse the established vault flow and
state invariants; add an owned native adapter rather than simply enabling browser
WebAuthn in the desktop WebView. Native PRF/envelope material must stay out of UI
components, logs and diagnostic JSON.

## What the sources establish

| Route | Evidence | Suitability for this repository |
| --- | --- | --- |
| Native WebAuthn PRF | W3C defines the encryption use case; Microsoft publishes native PRF inputs/outputs; current Windows reports and implementations exist. | Recommended next synthetic experiment. Exact target support, fresh authorization and hardware binding still require proof. |
| Passport RSA decrypt | KeePassWinHello uses app-owned Passport keys, PKCS#1 padding and gesture/cache properties. Our target already passes repeated synthetic PKCS#1 decrypts. | Existing compatibility evidence remains useful; production padding and same-key TPM proof remain unresolved. Another unchanged claim/export run adds nothing. |
| KeyCredential signature-derived key | KeePassXC and Bitwarden desktop hash a deterministic Windows Hello signature into encryption material. | This repository's specification explicitly excludes treating a signature/hash as the vault-unlock secret. Do not copy this construction under the name PRF. |
| Consent plus protected memory | Bitwarden desktop also documents a user-verification path with DPAPI-protected process memory. | Does not satisfy our requirement for an OS-authorized cryptographic unwrap. |
| 1Password TPM mode | Vendor documentation describes unlock after app/device restart with TPM, and different behavior for memory-only mode. | Confirms product feasibility, but does not publish the native contract needed to reproduce that implementation. |

### 1. PRF is a standard encryption primitive at the WebAuthn boundary

[W3C WebAuthn Level 3, PRF extension](https://www.w3.org/TR/webauthn-3/#prf-extension)
defines credential-associated 32-byte outputs and explicitly describes using
them as symmetric encryption keys. It is modeled on CTAP `hmac-secret`, with
domain separation from direct CTAP use. A PRF output is different from a public
authentication signature. Do not derive an AES key by hashing a signature or
mix raw HMAC-secret salts with WebAuthn PRF inputs accidentally.

### 2. The native Microsoft contract has advanced

The [Microsoft header at ef82c15](https://github.com/microsoft/webauthn/blob/ef82c157125a0490e05f6ea82a7adb1b8e1bad08/webauthn.h)
documents:

- PRF support via `bEnablePrf`, `pHmacSecretSaltValues` and returned
  `pHmacSecret`; creation-time evaluation via `pPRFGlobalEval` in make options v8.
- API v9 adds `WebAuthNGetAuthenticatorList` and `pbAuthenticatorId` routing in
  make/get options v9. API version numbers and individual structure versions
  must be checked separately.
- PRF salts are converted using the standard context hash by default; the
  raw-HMAC flag changes this behavior and must not be mixed across ceremonies.
- The authenticator list exposes identifier, display name, logo and lock state.
  A name or selected identifier is not an attestation of provider trust or TPM
  protection. Platform attachment alone is also not such proof.

Use runtime capability detection through
[`WebAuthNGetApiVersionNumber`](https://learn.microsoft.com/en-us/windows/win32/api/webauthn/nf-webauthn-webauthngetapiversionnumber).
API v9 is useful for explicit authenticator routing; it is not the first API
version to expose PRF and its presence does not prove actual Hello PRF success.
Our pinned `windows` 0.62.2 bindings currently expose WebAuthn through API v7;
they lack the new creation-evaluation/routing fields. Generate focused bindings
from a pinned current Microsoft source, verify layouts and load optional exports
from System32 dynamically so an older OS can still start the app.

### 3. A concrete creation bug has a known correction

Merged [Bitwarden PR #21998](https://github.com/bitwarden/clients/pull/21998),
merge `fb7661382ea052ea07e7b4654581d75c5c9480f1`, explains that Windows Hello may
not advertise PRF support if creation requests PRF without an evaluation input.
Their fix supplies the input **during creation**. A diagnostic that only sets
`bEnablePrf = TRUE` can therefore report a misleading unsupported result.

The [associated issue #19858](https://github.com/bitwarden/clients/issues/19858)
contains Windows 11 25H2 registration measurements and was closed by its reporter
on 2026-09-22 after successful creation of encryption-capable Hello passkeys.
This is reporter evidence, not a guarantee for the owner's machine. A separate
[open issue #23357](https://github.com/bitwarden/clients/issues/23357) reports a
later login assertion failing with `NTE_BAD_KEY_STATE` on build 26200.9457.
Successful creation must be followed by real assertions and round trips.
The reporter's discoverable-credential explanation is a hypothesis, not a
confirmed root cause. Bind tests to the exact created credential.

[Corbado's compatibility review](https://www.corbado.com/blog/passkeys-prf-webauthn)
reports Hello PRF in the February 2026 updates for 24H2/25H2, including build
26200.7840+, and creation support in Chrome 147 / recent Firefox. These are
secondary compatibility observations, not a Microsoft minimum-version contract.
Older Microsoft Q&A replies from 2025 predate these observations and cannot
establish current absence of support. Browser requirements do not automatically
apply to a native WebAuthn caller.

The owner supplied **Windows 11 Pro 25H2 / Kensington VeriMark Desktop**, without
the complete Windows build. Read the OS/API capabilities in the next diagnostic;
do not assume support from the 25H2 label or request OS/security resets.

### 4. Current native Rust examples are inspectable

[windows-native-keyring-store issue #17](https://github.com/open-source-cooperative/windows-native-keyring-store/issues/17)
reports testing on Windows 11 25H2 build 26200.9550. Its
[capability PR #28](https://github.com/open-source-cooperative/windows-native-keyring-store/pull/28)
and [ceremony PR #31](https://github.com/open-source-cooperative/windows-native-keyring-store/pull/31)
are **open**, not a released dependency approved for this app. The
[pinned native source](https://github.com/open-source-cooperative/windows-native-keyring-store/blob/be0cab4dc84fcf41f274eaac5c8b42524364df20/src/hello_native.rs)
shows System32-only dynamic loading, API v9 checks, owned HWND, cancellation,
creation PRF evaluation and an exact allowlisted credential on assertion.
It selects the Hello entry by name and rejects ambiguous names; that is a routing
assumption to review, not cryptographic provider identity. Its use of
attestation `none` does not establish our per-key TPM gate.

[Factorseal's Windows implementation at 831aa3c](https://github.com/cachix/factorseal/blob/831aa3c1eea58187ebe7e8367fc98113e757a381/crates/hardwareseal/src/windows.rs)
uses a TPM-sealed inner blob and a Hello PRF/AES-256-GCM outer envelope.
`hello_seal` seals in TPM before PRF encryption; `hello_unseal` first authenticates
and decrypts the PRF layer, then unseals in TPM. This is a useful architectural
reference for meeting our two requirements without attesting a custom Passport
decrypt key. It is not a drop-in solution: review its TBS/owner-authorization
requirements, exact non-migratable object attributes, user/account isolation,
standard-user operation and authenticator selection. Its creation currently
uses older options with PRF enabled but no creation evaluation, so do not copy
that call without addressing the interoperability finding above. No Factorseal
code or claims of hardware success were imported into this repository.

### 5. Popular managers use materially different mechanisms

[Bitwarden desktop Windows source at 06dd037](https://github.com/bitwarden/clients/blob/06dd03727c44d05b6d2e0cb646bac6c947a2e502/apps/desktop/desktop_native/biometric/src/windows.rs)
explicitly describes its consent/protected-memory and deterministic-signature
paths. Its
[`WindowsHelloPrf` type](https://github.com/bitwarden/clients/blob/06dd03727c44d05b6d2e0cb646bac6c947a2e502/apps/desktop/desktop_native/biometric/src/encryption.rs)
is derived from SHA-256 of a signature. Despite the type name, that is not the
WebAuthn PRF extension used by the separate web-vault change above.

[KeePassXC at 9e0f57a](https://github.com/keepassxreboot/keepassxc/blob/9e0f57a4a4c6c629fa6d0a593acb7d089b1d95cd/src/quickunlock/WindowsHello.cpp)
also signs a challenge with KeyCredential and hashes the signature. The prior
KeePassWinHello review demonstrates the distinct Passport RSA-decrypt approach;
see [the existing probe record](HELLO_KEY_PROBE.md). Different implementations
cannot be treated as evidence for the same cryptographic contract.

[1Password's security explanation](https://support.1password.com/windows-hello-security/)
describes both memory-only and TPM modes and recognizes that Windows Hello PIN
may also authorize access. Kensington provides the OS biometric input; the app
does not need raw fingerprint capture or a Kensington-specific crypto API.

## Concrete next increment

1. Add a fixed native **capability report**: full OS build, native WebAuthn API
   version, presence of required exports, platform availability and bounded
   authenticator routing metadata. No credential creation/deletion or prompts
   in this read-only preflight. Keep eligibility false.
2. If capability permits, add a separate **synthetic PRF experiment**, owned by
   the existing main HWND/session guards. Use app-scoped identifiers, native
   challenges/salt, required user verification and PRF input during creation.
   Verify credential/RP/challenge/UP/UV context and actual 32-byte output; compare
   repeated outputs for the same input, changed-input behavior and AES-GCM round
   trips. Cancellation, focus/session invalidation and cleanup must be observable.
   No raw PRF output, nonce, credential identifier or biometric data in reports.
3. Extend proof to a **fresh process**, failed/cancelled authorization, lockout,
   key loss and account/machine copies. PRF success, BE/BS flags, authenticator
   name or `attestation: none` must not silently close the hardware gate.
4. Prove the **TPM inner layer** and its composition with PRF on the target,
   with standard-user operation, app-owned objects, authenticated vault/enrollment
   bindings and no software fallback. Do not read/modify OS Hello/AIK keys or
   alter TPM/security policy. This is a separate design/proof task, not a claimed
   solution already validated by the old Passport reports.
5. Only then connect the native protected envelope to existing enrollment,
   credential delivery, CAS/session checks, locking and expiry. Preserve the
   independent master-password/KDBX/Python recovery path and the default
   session-only mode from the existing specification.

## Investigation limits and validation

Discovery used web search, GitHub code/issues/PRs and direct verified-HTTPS
primary/vendor sources. Some search requests returned a bot challenge or generic
results; those were not treated as evidence. GitHub sources are pinned where
code behavior is compared. Open proposals, reported hardware measurements and
vendor descriptions are distinguished from specifications and local validation.

Source contracts and current repository integration points were checked. No
Windows Hello/TPM/PRF ceremony was executed in this cloud workspace, no runtime
dependency or application code was changed, and no new installer is required
for this research note. The old reports retain their original failures and all
four physical gates remain open. The unchanged claim experiment needs no rerun.
