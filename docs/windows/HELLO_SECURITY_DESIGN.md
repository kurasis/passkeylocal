# Windows Hello eligibility decision

The source-correlated owner report from build `0a3bf26` reaches actual silent
`NCryptDecrypt` and returns `NTE_INVALID_PARAMETER`; this is not authorization
denial. The separate, explicit OAEP capability experiment may attempt one
synthetic decrypt with Windows confirmation allowed, while reporting skipped
silent/export gates as NOT RUN. It shares native guards/cleanup and cannot
enroll, unlock or substitute for the primary security proof. See
[the target procedure](HELLO_KEY_PROBE.md).

Status: **BLOCKED — no eligible protected-secret provider or physical proof**. This is a deliberate fail-closed implementation of the handoff's rule: "If the proof cannot satisfy the requirements, leave Hello unavailable with an actionable reason ... Continue safe work on the rest of the app."

No Windows 11/TPM/Kensington device is attached to this environment. Microsoft Passport provider RSA decrypt/unwrap support, non-exportability and per-key TPM binding have not been established on the target device; repeated/fresh authorization and cache behavior have not been demonstrated there. A TPM-present flag or successful consent dialog would not establish those properties. The release binary therefore cannot enroll, unwrap or expose a stored credential-equivalent secret. `hello_enroll` and `hello_unlock` return sanitized UNAVAILABLE even when directly invoked; `hello_revoke` reports that no enrollment key was created. Settings show the specific blocker and the master-password fallback. No synthetic service double can be activated by environment, configuration, arguments or IPC. The real native synthetic-secret experiment described below is separate and cannot enroll a vault.

Candidate investigation references were checked against Tauri 2.12.1 source/bindings and the official sources in [SOURCES_AND_REVIEW.md](SOURCES_AND_REVIEW.md): Microsoft Windows Hello app development, NCryptDecrypt, key storage properties and desktop UserConsentVerifier interop. They do not promise an arbitrary Passport-provider decryption algorithm or fresh authorization on every operation. No consent-plus-DPAPI, signature-derived AES key, software fallback, or generic decrypt IPC is implemented. No provider is claimed eligible merely because its name contains Passport.

The current shared engine supports exact master-password credentials and in-memory kdbxweb ProtectedValue credentials. This increment does not change its portable credential interface or cache a password in native settings. When an eligible provider is proven, a separately reviewed binary credential adapter and AES-GCM/versioned local envelope can be added; that work is still outstanding, including session-only/default and remembered/24h modes, native clock-rollback rejection, enrollment round trip/CAS, per-request epochs, tampering and key revocation. Documenting a proposed envelope is not implementation evidence.

Threat model: native file operations do not isolate the existing decrypted JS/WASM vault from the WebView. A compromised unlocked process or same-user malware can access secrets. Standard Hello trusts the current Windows account's accepted methods, potentially including PIN; it cannot identify one finger or bind authorization to one reader serial. No Hello material belongs in portable KDBX, external backups or Python packages. Password recovery remains independent.

## Controlled hardware proof procedure

Use a synthetic vault and a separate test account/machine. Record exact Kensington VeriMark Desktop SKU/revision (manufacturer candidate K62330WW), USB topology, official Windows Update/Kensington driver version, Windows 11 build, WebView2, TPM2 readiness, per-key evidence and ESS policy. OS enrollment remains in Windows Settings; the app never captures biometrics or a Windows PIN, installs drivers or changes ESS/VBS/Memory Integrity/Secure Boot/TPM policies.

A native synthetic-secret proof must establish supported wrap/unwrap algorithms and padding, per-key non-exportable TPM protection, rejection of silent unwrap and private-key export, fresh authorization on repeated attempts in one/fresh process, cancellation/lockout returning no secret, account/machine copy resistance, and fallback after key loss. Only then implement/enroll the actual protected envelope and execute H-01–H-16 in [WINDOWS_HELLO_KENSINGTON.md](WINDOWS_HELLO_KENSINGTON.md). Do not clear the owner's TPM or reset real Hello enrollment as a test. Driver/ESS incompatibility is an owner OS-policy decision; keep password access usable.

## OS configuration and diagnostic actions (2026-10-06)

The Settings card now distinguishes actual Windows configuration from vault
unlock eligibility. `hello_status` calls WinRT
`UserConsentVerifier.CheckAvailabilityAsync` on an initialized blocking-thread
apartment, returning configured/available, missing device, unconfigured user,
policy disabled, busy or unknown. It never promotes consent availability to
protected-key eligibility. No reader model, TPM binding or ESS compatibility is
inferred from this report.

`hello_settings` opens only the fixed `ms-settings:signinoptions` destination
from the focused trusted main window. `hello_verify` invokes
`IUserConsentVerifierInterop.RequestVerificationForWindowAsync` with that
window's actual HWND and a fixed message saying this is a test. Only one native
test can run at a time. Its result is nonsensitive diagnostic data and has no
credential/envelope/key access. A changed native session generation discards
the response; unmounted UI also rejects late results. The UI explicitly says a
passed test does not unlock or enroll a vault. These are useful troubleshooting
actions for an already-configured fingerprint or PIN, **not an implementation
of Hello vault unlock** and not evidence for H-02/H-03.

Automated evidence includes diagnostic enum handling, UI availability/actions,
cancel/policy states and late-result redaction with synthetic service doubles.
The installed Windows smoke checks the real WinRT availability command and
the Russian layout; it does not automate the consent dialog or OS Settings.
All physical provider/sensor acceptance gates remain NOT RUN/BLOCKED.
Kensington support and Windows Hello vault unlocking are **not complete**.

## Native protected-key experiment (2026-10-07)

[Test protected key](HELLO_KEY_PROBE.md) is now implemented in the same app.
It creates a uniquely named application test key in the real Microsoft Passport
CNG provider, exports only its public RSA component for BCrypt
RSA-OAEP/SHA-256 encryption, and attempts two authorized Passport decryptions,
tests silent decrypt before/after them on reopened handles, and attempts three
private export formats with bounded output buffers. Failures include the exact
stage, exact failing sub-operation and sanitized HRESULT. CI builds also include
their public source commit for installer/report correlation; this is not signed
attestation. Cleanup always runs; a failed key deletion is shown
and retried before another test key is created in the same process.

This is executable capability discovery, **not an eligible provider**. The
provider-specific `NgcCacheType` property is not in the public SDK header and its
actual behavior must be established. Unsupported algorithms/properties stop the
experiment without a weaker fallback. Successful round trips do not attest
TPM binding, prove that both operations prompted, prove fresh-process behavior,
or establish account/machine-copy resistance. These remain explicit unresolved
gates in every report, including a successful one. Vault credential material,
native envelopes, enrollment and unlock have deliberately not been enabled.
