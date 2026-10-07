# Windows Hello eligibility decision

The [broader internet review](HELLO_INTERNET_RESEARCH.md) identifies native
WebAuthn PRF as the recommended next experiment, including a concrete
creation-input compatibility fix and a possible separate TPM-sealed inner layer.
This is a new candidate architecture, not approval of the failed Passport claim
path or completed hardware proof. Native enrollment/unlock remains unavailable.

The [6ae6e24 owner report](../../deploy/windows-desktop/hello-target-6ae6e24.json)
completes the no-authority, subject-only attestation capability measurement.
Passport key creation/policy/readback and exact test-key deletion PASS; the
claim call returns `NTE_INVALID_PARAMETER` (`0x80090027`). There is no returned
statement and no verification. This rejects the tested candidate on the reported
target without identifying the rejected parameter or proving defective hardware.
Do not request an unchanged rerun. A supported same-decrypt-key acquisition and
authority contract remains the prerequisite; real enrollment/unlock is blocked.

Native standard TPM certification inspection, Windows RSA signature checks and
the separate same-key `NCryptCreateClaim` capability experiment are now implemented.
See [HELLO_ATTESTATION_VERIFIER.md](HELLO_ATTESTATION_VERIFIER.md). Returned claims
and even valid signatures remain untrusted; supported Passport framing and AIK
certificate/trust/revocation validation are not established/implemented. This
new capability action does not repeat the completed private-export diagnostic
and cannot enroll/unlock a vault or close a physical gate.

The [946514c owner report](../../deploy/windows-desktop/hello-target-946514c.json)
completes the private-format diagnostic: all three raw private formats return
`NTE_BAD_TYPE`, while both synthetic PKCS#1 decrypt comparisons, three strict
silent refusals and cleanup pass. This closes the measurement task, not the
non-exportability/TPM gate. No unchanged retest or replacement installer is
needed. A supported, verified attestation route for the exact decrypt-only
Passport key remains unestablished; see the
[source review](SOURCES_AND_REVIEW.md#same-key-attestation-investigation-2026-10-07).
No new prompt observation is inferred from this JSON. Actual enrollment/unlock
remain unavailable and all four physical gates remain open.

The [9fdbc05 owner report](../../deploy/windows-desktop/hello-target-9fdbc05.json)
now passes both synthetic PKCS#1 decrypts and three explicit silent refusals.
The owner reports fingerprint confirmation every time for the queried prompts.
Private export returns `NTE_BAD_TYPE`, meaning the requested format is unavailable
for this key; that does not establish non-exportability. The subsequent diagnostic
reported every fixed private export format without accepting unsupported types
as denial. Per-key TPM, fresh-process/account/machine/cancellation proof and
actual credential envelope/enrollment remain outstanding; vault unlock stays
disabled. See [the export result/procedure](HELLO_KEY_PROBE.md#target-repeated-decrypt-and-export-result-2026-10-07).

The [6cbe2c4 owner report](../../deploy/windows-desktop/hello-target-6cbe2c4.json)
now passes authorized PKCS#1 v1.5 decryption and synthetic-secret comparison;
cleanup passes. Prompt observations and silent/second-decrypt/export results
are absent. A separately selected `hello_pkcs1_behavior` measures those native
operations on a new test key while preserving all physical gates and false
eligibility. Legacy padding is not approved for a real credential envelope;
actual enrollment/unlock remain unavailable. See [the next procedure](HELLO_KEY_PROBE.md#target-compatibility-result-and-next-behavior-check-2026-10-07).

The source-correlated `f382542` target retest still fails actual authorized
OAEP decrypt with `NTE_INVALID_PARAMETER` on the owned creation handle. That
change did not solve the target failure. A separately selected synthetic
PKCS#1 v1.5 compatibility action investigates the padding-path difference
suggested by pinned Passport-client implementations. It cannot approve this
legacy scheme for vault access, pass skipped gates or act as an OAEP fallback.
No vault material is used. Both OAEP actions retain their algorithms and actual
enrollment/unlock remains blocked. See [the recorded result and compatibility
procedure](HELLO_KEY_PROBE.md#creation-handle-target-result-and-legacy-compatibility-discovery-2026-10-07).

The owner also reports a completed fingerprint prompt during the separate
`fbd4347` capability test, followed by actual authorized OAEP decrypt parameter
failure. The prompt's originating native operation is unknown, and no secret
comparison passed. Authorized decrypts now use the owned flags-zero creation
handle, with key context/gesture requirements reset per call; silent probes
reopen independent handles. Provider-level HWND setup was rejected by a real
Windows API test and removed. No authorized open occurs before parent ownership
can be set. Padding/eligibility are unchanged, and target proof is still needed.

The source-correlated owner report from build `0a3bf26` reaches actual silent
`NCryptDecrypt` and returns `NTE_INVALID_PARAMETER`; this is not authorization
denial. The separate, explicit OAEP capability experiment may attempt one
synthetic decrypt with Windows confirmation allowed, while reporting skipped
silent/export gates as NOT RUN. It shares native guards/cleanup and cannot
enroll, unlock or substitute for the primary security proof. See
[the target procedure](HELLO_KEY_PROBE.md).

Status: **BLOCKED — no eligible protected-secret provider or physical proof**. This is a deliberate fail-closed implementation of the handoff's rule: "If the proof cannot satisfy the requirements, leave Hello unavailable with an actionable reason ... Continue safe work on the rest of the app."

No Windows 11/TPM/Kensington device is attached to this environment. The owner has reported successful repeated synthetic PKCS#1 v1.5 Passport decrypts, three strict silent refusals and fingerprint confirmation for the earlier queried prompts. These are same-process observations; fresh-process authorization, complete cancellation behavior, non-exportability and per-key TPM binding have not been established on the target device. A TPM-present flag or successful consent dialog would not establish those properties. The release binary therefore cannot enroll, unwrap or expose a stored credential-equivalent secret. `hello_enroll` and `hello_unlock` return sanitized UNAVAILABLE even when directly invoked; `hello_revoke` reports that no enrollment key was created. Settings show the specific blocker and the master-password fallback. No synthetic service double can be activated by environment, configuration, arguments or IPC. The real native synthetic-secret experiment described below is separate and cannot enroll a vault.

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
