# Sources and Design Review

Prepared: 2026-10-05; Windows Hello/Kensington update: 2026-10-06. These are official primary sources checked while preparing this specification. Re-check version-sensitive APIs against the versions pinned during implementation. Source links explain platform behavior; the product requirements and acceptance criteria are the decisions in this handoff, not quotations from the sources.

## Primary documentation

| ID | Source | Relevance |
| --- | --- | --- |
| S1 | [Tauri 2 — Capabilities](https://v2.tauri.app/security/capabilities/) | Explicit capabilities, window/origin grants, app-command permissions and limits of the boundary. |
| S2 | [Tauri 2 — Vite frontend integration](https://v2.tauri.app/start/frontend/vite/) | Build hooks, packaged frontend output and development configuration; not a requirement to upgrade the existing frontend. |
| S3 | [Tauri 2 — Windows installer](https://v2.tauri.app/distribute/windows-installer/) | NSIS/MSI packaging and WebView2 installation modes. |
| S4 | [Microsoft — WebView2 security](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/security) | Content, navigation and host-message trust boundaries. |
| S5 | [Microsoft — Distribute a WebView2 app](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution) | Evergreen/Fixed Version runtime choices, bootstrapper and offline deployment. |
| S6 | [Microsoft — ReplaceFileW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-replacefilew) | Replacement semantics, partial-failure behavior and unsupported write-through flag. |
| S7 | [Microsoft — Flushing system-buffered I/O](https://learn.microsoft.com/en-us/windows/win32/fileio/flushing-system-buffered-i-o-data-to-disk) | Explicit file-buffer flushing and durability considerations. |
| S8 | [Tauri 2 — GitHub pipeline](https://v2.tauri.app/distribute/pipelines/github/) | Desktop build/release integration examples, to adapt without replacing existing web CI. |
| S9 | [GitHub — Secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use) | Least privilege, action pinning, secrets and untrusted workflow inputs. |
| S10 | [Tauri 2 — WebDriver tests](https://v2.tauri.app/develop/tests/webdriver/) | Native application test tooling and Windows driver prerequisites. |
| S11 | [Tauri 2 — Windows code signing](https://v2.tauri.app/distribute/sign/windows/) | Installer signing configuration and publisher identity. |
| S12 | [Tauri 2 — Updater plugin](https://v2.tauri.app/plugin/updater/) | Update signature requirements; optional future scope, separate from Authenticode. |
| S13 | [Kensington — VeriMark Desktop K62330WW support](https://customer.kensington.com/us/us/s/k62330ww/verimark__desktop_fingerprint_key__k62330ww_) | Manufacturer identity, Windows/USB-A and Windows Hello certification; does not establish ESS compatibility. |
| S14 | [Microsoft — Windows Hello app development](https://learn.microsoft.com/en-us/windows/apps/develop/security/windows-hello) | User verification, device-bound keys, TPM/software distinctions and signing APIs. |
| S15 | [Microsoft — IUserConsentVerifierInterop](https://learn.microsoft.com/en-us/windows/win32/api/userconsentverifierinterop/nn-userconsentverifierinterop-iuserconsentverifierinterop) | HWND-associated desktop verification; not a vault decryption API. |
| S16 | [Microsoft — NCryptDecrypt](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptdecrypt) | Native protected-key decryption, padding and provider-dependent UI behavior. |
| S17 | [Microsoft — Key storage properties](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-property-identifiers) | Export policies and provider properties; provider flags alone are not per-key TPM attestation. |
| S18 | [Microsoft — Enhanced Sign-in Security](https://support.microsoft.com/en-au/windows/security/identity-signin/enhanced-sign-in-security-in-windows) | External sensor compatibility and security-setting implications. |
| S19 | [Microsoft — Configure Windows Hello](https://support.microsoft.com/en-us/windows/security/configure-windows-hello) | OS-managed fingerprint/PIN enrollment. |
| S20 | [Microsoft — NCryptExportKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptexportkey) | `NTE_BAD_TYPE` means the key cannot be exported into the requested blob type; it is not explicit permission denial. |
| S21 | [Microsoft — NCryptCreateClaim](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreateclaim) | Key-attestation claim API; availability alone does not establish Passport support or verified TPM binding. |

## Same-key attestation investigation (2026-10-07)

### Completed subject-only target measurement

The [6ae6e24 owner report](../../deploy/windows-desktop/hello-target-6ae6e24.json)
measures the implemented no-authority, subject-only candidate on the owner-reported
Windows 11 Pro 25H2 / Kensington VeriMark Desktop setup. The exact Windows build,
reader SKU/revision, driver, TPM and ESS details have not been established. The
claim call returns `NTE_INVALID_PARAMETER` (`0x80090027`); key creation/policy
readback and deletion pass. No bytes were returned or verified. The owner did
not supply additional prompt observations. This is target evidence provided by
the owner, separate from cloud/hosted API tests. The experiment is complete and
does not need an unchanged rerun.

S21 and S14 were re-read after this failure. The generic API declares
`hAuthorityKey` optional and requires `dwFlags = 0`. This does not document
support for a no-authority `NCRYPT_CLAIM_SUBJECT_ONLY` call on Passport, or
identify the parameter rejected here. Its newer examples use VBS claim types,
Software KSP and VBS attestation flags/parameters; that is a different key and
trust model and cannot establish the required TPM binding by substitution.

The pinned [Chromium implementation](https://github.com/chromium/chromium/blob/544a340956293550ca5eeb89d7a046879527df18/crypto/unexportable_key_win.cc)
uses Platform Crypto Provider, a distinct attestation key and
`NCRYPT_CLAIM_WEB_AUTH_SUBJECT_ONLY`. This is an implementation reference,
not a Microsoft guarantee for Passport. It cannot supply the missing same-key
Passport acquisition/authority contract. S14's `GetAttestationAsync` concerns
a KeyCredential signing key; attesting a replacement signing key cannot prove
our existing decrypt key is TPM-bound.

The current failure therefore blocks the tested candidate, not every possible
attestation mechanism or the hardware itself. No supported replacement contract
was established by this review. The next implementation must first establish
same-subject acquisition/authority and authenticated public-key correspondence,
then the trusted AIK certificate/chain/EKU/revocation policy. Unverified claim
bytes, provider flags, a valid untrusted signature, another key's attestation
or successful fingerprint consent cannot close that gap. This evidence-only
update adds no claim-type retries, OS key operations, security downgrades or new
installer; master-password access remains available.

### Earlier private-export source review

Implementation follow-up to the [946514c owner report](../../deploy/windows-desktop/hello-target-946514c.json),
not part of the original handoff review. S14, S17, S20 and S21 were fetched over
verified HTTPS and read during this investigation. No physical target test or
attestation API experiment was executed here.

All three measured raw private formats return `NTE_BAD_TYPE`; S20 does not define
that response as permission denial or prove absence of other export paths.
Zero export-policy readback and the strict silent refusals remain useful
measurements, but do not establish hardware-backed, non-migratable protection.

S17 explicitly applies `NCRYPT_IMPL_TYPE_PROPERTY` to **key storage providers**.
Its hardware flag describes the provider, not the particular app key. Generic
TPM presence, the reader model, a consent result and provider properties cannot
pass the per-key gate.

S14 documents `KeyCredential.GetAttestationAsync` for a credential generated by
`KeyCredentialManager.RequestCreateAsync`, whose demonstrated operation is
signing. It requires verification of the AIK certificate and attestation, with
the attested public key matched to the credential public key. Attestation of
a separately generated signing key would not prove protection of our existing
CNG decrypt-only Passport key. No documented mapping for this integration has
been established. Signature bytes must not become an AES key or unlock token.

S21 exposes a subject-key handle for `NCryptCreateClaim`; the pinned Windows SDK
bindings also expose it. The reference does not establish a supported Passport
TPM-attestation flow for this exact decrypt-only key. Its newer VBS discussion
does not prove TPM binding. Merely returning a claim blob or reading PCP-specific
metadata is insufficient. No unsupported claim/property probe, OS AIK-key
operation, arbitrary-key IPC or security-setting change is added.

Before a same-key attestation implementation can pass the hardware gate it needs:

- A supported provider/algorithm/claim contract for the exact app-owned decrypt
  key, with fixed native parameters and no renderer-selected key or algorithm.
- Verification of the attestation signature, AIK certificate/trusted chain,
  relevant certificate policy (S14 specifies AIK EKU `2.23.133.8.3`), validity
  and revocation under a defined trust policy. A missing trust/revocation
  prerequisite must remain an explicit blocker.
- Exact comparison of the attested public key with that same app key's exported
  public component, and authenticated TPM-bound/non-migratable properties;
  nonce/freshness requirements must follow the supported claim contract.
- Bounded parsing and zeroized temporary buffers, native single-flight/session
  guards, unconditional app-key cleanup and no sensitive attestation blobs in
  public reports. Deliberately altered subject, signature, chain and claim
  fixtures must fail verification.

This route is **not established or implemented**. That is an integration/evidence
blocker, not a conclusion that the owner's hardware lacks TPM protection. A
verified attestation would address the key-binding gate only; fresh-process,
cancellation and account/machine-copy tests and an approved real credential
envelope/enrollment would still be required. The current legacy PKCS#1 experiment
cannot approve production padding or replace those checks. Unchanged per-format
retests provide no new evidence; no replacement installer is published for this
investigation.

## Deliberate design decisions

**Incremental Tauri integration, not a rewrite.** The primary efficiency gain is one maintained UI/domain implementation. Rust is introduced only for required native host responsibilities. This avoids a separate Windows product codebase while permitting proper file handling and backups.

**Discover first.** The actual ready application and its repository were not supplied. React/TypeScript/Vite/KDBX are expected from earlier planning, not verified facts. File formats, interfaces, names, scripts and workflows must be checked before editing. An unexpected stack is a design input, not permission to replace the app.

**One repository does not mean one runtime or automatic synchronization.** Build outputs, local storage, runtime lifecycle and releases stay target-specific. Vault transfer is explicit encrypted export/import in this increment. Concurrent divergent edits are not silently merged.

**Portable existing encryption.** Preserve the file format and independent Python recovery, including historical credentials. Do not bind the only usable copy to Windows account secrets or a proprietary desktop wrapper. Native file storage is not a claim that plaintext never exists in a WebView.

**Restricted host operations.** A file picker does not justify arbitrary filesystem or shell access. Validate narrowly scoped commands and selected resources, including app-command permissions. CSP and capability controls reduce exposure but do not make a compromised renderer harmless.

**Verified saves and honest backups.** Local commit, external byte-copy verification and independent cryptographic recovery are different events. A backup directory on the same drive is not a second physical copy; a cloud-synced path does not prove upload; closing the app stops its work.

**Controlled release complexity.** One per-user Windows x64 installer and manual application updates are sufficient initially. Separate channels/artifacts preserve the existing web release. Optional future auto-updates require their own signing and failure-mode work.

**Kensington through Windows Hello.** Version 1.1.0 adds native Windows Hello quick unlock, not a vendor fingerprint database or a FIDO2 flow. Hardware-backed protection and user authorization must apply to secret recovery itself. A successful verification boolean, generic DPAPI storage or a TPM-present flag is insufficient evidence. Sensor/driver/ESS compatibility and provider support remain implementation proof obligations.

**Recovery remains portable.** A protected local envelope adds convenience but must not alter exported KDBX files or require the original computer for Python recovery. The native layer now handles a narrowly scoped credential-equivalent secret during quick-unlock operations; earlier descriptions of a ciphertext-only Rust layer do not apply to that adapter.

## Review scope and limits

This package has been reviewed for consistency against the stated request: an already completed PWA, one GitHub repository, reusable code, Windows storage/backups, web compatibility and independent Python recovery. It includes implementation requirements and falsifiable acceptance scenarios rather than treating creation of a desktop window as completion.

No application source repository was inspected, application code executed, application tested, binary built, GitHub workflow changed or release published while writing this package. No physical Kensington, TPM or Windows Hello flow was tested. This is not a penetration test, cryptographic audit or guarantee against Windows malware. The implementation agent must produce actual test evidence and flag deviations before claiming delivery.

Remaining project facts to determine during repository discovery include the real engine/schema, existing backup policy, supported web release, actual Python utility, hosting/release conventions, product identifier, certificate availability and supported recovery environments. Defaults in this specification are intended to let safe additive work proceed, not to authorize incompatible or destructive changes.
