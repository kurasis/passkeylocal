# Sources and Design Decisions

Prepared 2026-10-06. Sources below are primary documentation or upstream code checked for this handoff. Pin and re-check the actual stable versions used during implementation; a documentation site's `latest` branch is not a dependency pin.

| ID | Primary source | Use in this specification |
| --- | --- | --- |
| S1 | [Libsodium — Encrypted streams and file encryption](https://doc.libsodium.org/secret-key_cryptography/secretstream) | Chunked authenticated file encryption, final tags and bounded streaming. |
| S2 | [Libsodium — XChaCha20-Poly1305](https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction) | AEAD primitive for headers/catalogs; do not confuse its nonce with ordinary ChaCha20-Poly1305. |
| S3 | [Libsodium — Password hashing/key derivation](https://doc.libsodium.org/password_hashing/default_phf) | Explicit Argon2id selection and serialized work/memory parameters. |
| S4 | [PyNaCl — Upstream secretstream bindings](https://github.com/pyca/pynacl/blob/main/src/nacl/bindings/crypto_secretstream.py) and [cryptography — HKDF](https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/) | Independent Python implementation using maintained crypto libraries. |
| S5 | [Microsoft — AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation) | OS-level resource isolation for untrusted parsing. |
| S6 | [Microsoft — Launch an AppContainer](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer) | Desktop AppContainer/LPAC setup, tokens, capabilities and profile-storage considerations. |
| S7 | [Microsoft — Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | Resource/lifecycle control complementary to the access sandbox. |
| S8 | [PDFium — Upstream project](https://pdfium.googlesource.com/pdfium/+/refs/heads/main/README.md) and [upstream build-option example](https://pdfium.googlesource.com/pdfium/+/11825a391a7fdcd231baea1e37d4253557a37a6e) | Parser/build provenance; historical option example is not a recommended version pin. Verify JS/XFA-disabled configuration in the selected current build. |
| S9 | [Tauri — Capabilities](https://v2.tauri.app/security/capabilities/) | Restrict app commands and plugin grants; an extra window is not sufficient isolation. |
| S10 | [Kensington — VeriMark Desktop K62330WW](https://customer.kensington.com/us/us/s/k62330ww/verimark__desktop_fingerprint_key__k62330ww_) | Named hardware and Windows Hello support; actual revision/ESS compatibility still requires testing. |
| S11 | [Microsoft — Windows Hello](https://learn.microsoft.com/en-us/windows/apps/develop/security/windows-hello) | User/device credentials, hardware/software distinctions and authorized key operations. |
| S12 | [Microsoft — Enhanced Sign-in Security](https://support.microsoft.com/en-au/windows/security/identity-signin/enhanced-sign-in-security-in-windows) | External sensor compatibility and prohibition on silently weakening OS settings. |
| S13 | [Microsoft — ReplaceFileW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-replacefilew) | Safe replacement design must account for partial failure and platform semantics. |
| S14 | [Cryptomator — Security target](https://docs.cryptomator.org/security/security-target/) | Illustrates limits of file encryption when plaintext is used by applications and metadata remains observable. Not a dependency or a claim that this format is Cryptomator-compatible. |

## Decisions specific to this project

1. **Additive Windows feature.** Keep the ready PWA/password manager and one repository. Native file streaming belongs in Rust; do not reuse a browser-oriented password database as a bulk document store.
2. **Independent file-safe keys and lock state.** Reuse UI/infrastructure, not root keys. Master-password recovery survives loss of Windows Hello and the original machine.
3. **Portable self-contained snapshots.** Backups contain matching key header, catalog and referenced objects. Their success is distinct from local saves and from independent decryption verification.
4. **Standard primitives, explicit container contract.** The v1 file format is a product design, not a recognized external standard or audited cryptosystem. Cross-language vectors, strict parsing and review are mandatory.
5. **Sandbox before parser.** Isolation must be demonstrated through denied access, not inferred from using Rust, WebView2, a separate process or a PDF library. A sandbox worker is not a complete virtual machine.
6. **Limited preview scope.** PDF rasterization, JPEG/PNG and UTF-8 text cover the agreed storage/viewing use case. Complex editing, mounting, external apps, active content and arbitrary parsers are intentionally outside v1.
7. **Honest plaintext handling.** No intentional document temp files for preview; originals and exports remain ordinary files. OS paging, crash artifacts, screenshots and a compromised host are outside an absolute erasure/confidentiality guarantee.
8. **Hardware uncertainty is explicit.** No Kensington, TPM or Windows sandbox was exercised while authoring this package. Provider proof and actual hardware tests belong to implementation acceptance.

The repository was not provided or inspected. This archive is an English specification for a development agent, not source code, an installer, a recovery executable or a completed security audit. Earlier Windows/Hello project requirements remain applicable where compatible; this package independently states the file-safe additions.
