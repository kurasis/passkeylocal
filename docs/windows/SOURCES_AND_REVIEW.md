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
