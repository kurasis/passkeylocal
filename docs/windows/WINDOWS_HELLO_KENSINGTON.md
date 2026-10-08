# Kensington VeriMark Desktop and Windows Hello

Specification version: 1.2.0 — 2026-10-08.

Owner-requested manual acceptance amendment: use the existing Windows account;
no second-account test on the same PC is required from the owner. Follow the
[current acceptance plan](HELLO_OWNER_ACCEPTANCE.md). Other-account isolation
remains unverified and must not be claimed as tested. Preserve native account
scoping and automated boundary checks; this amendment does not enable Hello.

This is required additional scope for the existing Windows extension in the same GitHub repository. Preserve already implemented web and desktop code. This document supersedes version 1.0.0's exclusion of Windows Hello; all compatible persistence, backup and release requirements remain in force.

## 1. Product behavior and boundaries

Add **Unlock with Windows Hello**, tested with **Kensington VeriMark Desktop Fingerprint Key**. The known manufacturer SKU is K62330WW; record the user's actual SKU/revision, including any suffix, rather than assuming similar VeriMark products are identical. Use Windows Hello and OS-managed enrollment. Do not implement raw fingerprint capture, template storage, matching, a custom credential provider, or a Kensington-specific authentication protocol. [S13, S19]

The sensor verifies biometrics; it is not storage for the password vault or a portable copy of the computer's TPM key. Standard Hello can offer PIN and other configured verification methods. Do not label the feature fingerprint-only, claim knowledge of the exact finger used, or promise authorization is tied to the serial number of one USB reader. Any accepted Hello method for this Windows user is within this feature's trust model. Do not invent an API that restricts standard Hello to Kensington. [S14, S15]

The master password remains a complete independent unlock/recovery path. This feature is an alternative local access path, not mandatory two-factor protection for the vault file. Keep it off until the owner opts in after a successful master-password unlock. No server, account registration, network connection or YubiKey is required for normal enrolled use.

The app must remain usable with the master password when the reader is missing, Hello is unavailable, or the OS blocks biometrics. Unsupported hardware must not prevent ordinary installation or corrupt a vault.

## 2. Hardware and OS preflight

Implement a non-sensitive readiness report with separate states for Hello configuration, protected-key support and device troubleshooting. Record:

- Windows 11 version/build, installed Tauri/WebView2 versions and standard-user operation.
- Actual Kensington model/SKU, driver source/version and direct USB vs hub test setup.
- TPM 2.0 readiness and evidence about the actual protection key, not just the presence of a TPM.
- Windows Hello setup and current provider availability.
- Enhanced Sign-in Security (ESS) state and whether this exact reader/driver works under the current policy.

Obtain drivers through Windows Update or Kensington's official support route for that SKU. The app must not silently install a driver, require permanent elevation, bundle an unsigned driver, or ask for the Windows account password/PIN in its own form. OS/driver setup may involve network access or OS-managed elevation; distinguish that from offline vault operation.

Windows Hello certification does not prove ESS support. Some external readers are blocked when ESS is enabled; support depends on the actual hardware, driver and OS configuration. Never automatically disable ESS, VBS, Memory Integrity, Secure Boot or TPM protections, nor edit policy/registry to bypass them. If the selected reader requires a security downgrade, report the precise conflict and retain master-password access; any OS security-setting change is a separate owner decision. Do not assert this Kensington SKU is ESS-compatible or incompatible without evidence. [S18]

## 3. Prove the cryptographic mechanism before wiring the UI

Implement a small native Windows proof of concept with synthetic secrets before enabling the feature. Deliver `docs/windows/HELLO_SECURITY_DESIGN.md` documenting the chosen APIs/provider, supported Windows builds, key configuration, authorization behavior, threat model and test results.

Required property: obtaining the vault-unlock secret from its protected envelope must require an OS-enforced, user-authorized cryptographic operation. A normal logged-in Windows session by itself must not be sufficient for the intended unlock flow.

A candidate route is a Windows Hello-associated CNG key storage provider and protected decryption/key unwrapping through NCrypt. Investigate the Microsoft Passport provider and compatible supported mechanisms on the target builds; do not assume a provider name makes arbitrary algorithms, TPM binding or per-operation prompting work. `NCryptDecrypt` is an API entry point, not proof of these properties. Use maintained Windows bindings and standard cryptographic libraries. [S16, S17]

Prove all of the following on actual hardware:

1. The protection key is non-exportable and hardware-backed by the intended TPM. Document per-key evidence, provider guarantees and limitations. A provider-wide hardware flag or `TPM present` check alone is insufficient; fail eligibility when the claimed binding cannot be established.
2. The actual unwrap operation requires Windows Hello authorization for each quick-unlock attempt, including repeated attempts in the same process and after a fresh launch. Reject a path that silently reuses a cached authorization to reopen a locked vault.
3. Cancel, failed verification and unsupported/locked-out states return no usable secret. Attempts to perform the same unwrap silently, without satisfying authorization, must not succeed.
4. Copying app files and the envelope must not bypass native account/machine binding. Manual acceptance uses a second computer and a matching source decryption control. Same-PC/other-account testing is excluded by the owner; record that isolation as unverified, keep account scoping and automated boundary checks, and do not claim a physical account-isolation pass. Production file/envelope recovery still requires its own acceptance.
5. Key reset/loss causes a recoverable fallback to the master password, not loss of the portable vault.

Do not substitute any of these weaker constructions:

- `UserConsentVerifier` returns success, then the application reads an otherwise accessible plaintext or DPAPI-only secret. The verifier supplies user consent; it is not a cryptographic unwrap operation. HWND interop is useful for desktop consent UI but does not solve secret protection. [S15]
- A JS `isAuthenticated` flag, an IPC argument claiming authentication, or renderer-side gating of a generic key-read command.
- Storing a master password in plaintext settings, IndexedDB, a Credential Manager entry without additional suitable key protection, logs or environment variables.
- Treating a signature or its hash as a secret encryption key. Windows Hello signing APIs do not automatically provide a decryption API; signatures are verification outputs, not a designed secret-derivation mechanism.
- Quietly switching to software-only storage when TPM-backed protection or required authorization semantics are unavailable.

If the proof cannot satisfy the requirements, leave Hello unavailable with an actionable reason and deliver the specific blocker. Continue safe work on the rest of the app. Do not ship a cosmetic biometric gate or claim the requested feature is complete.

## 4. Protect an unlock secret without changing the vault format

Keep the shared KDBX engine and password-based portable format. Inspect the engine to identify the minimal credential-equivalent material it can safely accept for reopening the vault. For example, an engine-supported pre-KDF composite secret may differ from a per-save encryption key; do not assume the current file's final encryption key works after salts or KDF parameters change. Test repeated save/reopen and password changes.

Prefer a supported binary credential-equivalent interface instead of caching the master-password string. If the engine lacks it, document and implement the smallest reviewed adapter change; do not invent unsupported internal APIs or switch vault formats. Treat any such material as fully sensitive, since it may substitute for the password.

Use a versioned local protected envelope with standard authenticated encryption and a random wrapping key protected by the approved Windows mechanism. A conventional construction is AES-256-GCM for the small secret, with its random key wrapped by an approved native asymmetric key using supported secure padding; the provider proof must establish the actual algorithms and parameters before selecting this construction. Never encrypt an entire vault directly with RSA, reuse GCM nonces, or implement cryptographic primitives manually.

Authenticate envelope metadata: format version, opaque vault binding, enrollment ID, protection-key identifier, policy mode and credential generation. Use bounded parsing and reject substitution/tampering. Keep record titles, passwords and history out of metadata. Locate any persistent envelope in the existing per-user managed data directory with restrictive Windows ACLs and atomic writes. Do not accept arbitrary renderer-supplied ciphertext/path/key identifiers for decryption.

Enrollment must verify the master password for the selected current vault and confirm the round trip through the new protection mechanism before enabling the setting. Re-read/check the current vault revision to avoid enrolling against a stale or replaced file. Recovery material must never be logged or retained in general application state.

The native Hello adapter necessarily handles a secret during enrollment/unwrap. Deliver it only to the existing trusted crypto path for the matching vault, request and session epoch. Do not return the master-password string to UI components. Minimize copies and lifetime; clear native buffers where feasible and destroy workers/crypto state on lock. Do not promise reliable zeroization in JavaScript or secrecy from a compromised process after unlock. This feature does not move the existing cryptographic engine out of the WebView.

## 5. Modes and lifecycle

The defaults below apply to the new feature; preserve stricter existing security policies.

| Mode | Required behavior |
| --- | --- |
| Off, initial default | Every unlock uses the existing master-password flow. |
| Session quick unlock, default when enabled | After master-password enrollment in the current app process, retain only the protected envelope in memory. Lock clears usable secret material. Hello can reopen the vault during that process; exiting/crashing discards the envelope and the next launch requires the master password. |
| Remember on this computer, explicit additional opt-in | Persist only the protected envelope. Allow Hello across process restarts, with a default maximum 24-hour interval since the last successful master-password verification, plus earlier existing policy restrictions. |

The 24-hour interval is application policy, not a claimed tamper-proof TPM expiry. Enforce it in native code before unwrap, reject suspicious backward clock movement, and require a master password when the decision is uncertain. Do not claim immunity to rollback of the entire system state. Permit a shorter interval, not an unlimited default. Explain that Windows Hello PIN and other accepted methods can unlock while enrollment remains valid.

For every quick unlock:

1. Require an explicit action in the focused trusted main window; allow only one in-flight Hello request. Associate OS UI with the real host HWND where the chosen API supports it.
2. Native code checks enrollment, mode, age, vault binding and request epoch before requesting protected unwrap.
3. OS UI verifies the user. Never capture or forward the Windows PIN through the app.
4. Recheck epoch, deadline and vault identity after the asynchronous response. Authenticate the current vault with the recovered material before showing any contents. Discard stale results and remain locked on any failure.
5. Release temporary secret copies and close/restrict provider handles so subsequent attempts cannot bypass the required authorization.

Foreground changes caused by an owned Hello dialog need explicit state handling: the vault stays redacted throughout authentication. Do not unconditionally invalidate a pending unlock merely because its OS dialog took focus, and do not exempt session lock, suspend, user switching, timeout or a real cancellation. When the provider UI cannot be reliably correlated, cancel safely. Test this in the packaged app, not only a browser mock.

Cancel leaves the vault locked without automatically retrying. Lockout, absent sensor, removed device or unavailable provider shows a safe fallback; PIN may still be offered by Windows. Unplugging the Kensington is not removal of a cryptographic possession factor and is not a guaranteed auto-lock signal. Existing inactivity/minimize/session/power locking remains authoritative.

## 6. Revocation, password changes and recovery

Provide Disable Windows Hello and Forget this computer enrollment. Disable immediately cancels pending requests and deletes app-owned envelopes/protection keys as applicable; handle errors visibly and never delete the user's OS Hello enrollment, fingerprints or unrelated keys. Re-enable only after a fresh master-password unlock and new successful enrollment.

Changing the master password, replacing/restoring/importing the active vault, or detecting an incompatible credential generation must invalidate the old local enrollment before allowing another quick unlock. Coordinate this with atomic vault writes. A crash between vault change and envelope update must result in a valid password-openable vault and disabled/stale Hello enrollment, never reuse an old secret for a new vault. Prefer requiring explicit re-enrollment after such changes over complex automatic secret migration.

Known Hello/TPM resets, missing protection keys, account changes and failed hardware checks also invalidate enrollment. The app cannot necessarily detect every biometric-template change or prove which finger was used. Do not promise to reject every newly enrolled finger: this feature trusts the current Windows user's accepted Hello methods. Document this account boundary.

Each persistent enrollment should have an app-owned protection key whose deletion revokes that enrollment without affecting other apps. Test old-envelope replay after successful revocation. Report any inability to delete the key; do not claim irrevocable erasure merely because a settings flag changed. Full machine rollback or a previously stolen plaintext secret is outside this deletion guarantee.

Never include Hello envelopes, OS key containers, machine/account bindings or fingerprints in portable vault exports, external backups or Python recovery packages. Loss of all local Hello metadata, a broken reader, TPM clearing or Windows reinstall must still permit web/Python recovery from the encrypted vault and master password. Do not clear the TPM or reset the user's Hello settings as an automated test on their real computer.

## 7. UI and native interface

Use existing design components and localization. Show Unlock with Windows Hello and Use master password. In settings, explain session-only vs remembered enrollment, expiry, accepted PIN fallback, device/account binding and recovery. The setup action may direct the user to Windows Settings, but fingerprint enrollment remains OS-managed.

Expose narrow native operations for availability, enrollment, requested unlock, revocation and sanitized status. Use opaque vault/enrollment IDs resolved by Rust. Do not expose general-purpose `decrypt`, `readSecret`, `exportPrivateKey`, arbitrary key-container operations or caller-selected unwrapping targets. Restrict app-command capabilities to the trusted desktop window and validate arguments, state and request generations natively. Test direct IPC calls, not just UI routes.

Web builds keep the existing master-password behavior and must neither load native Hello modules nor require biometric enrollment. Keep the Windows code in the existing same-repository platform boundary. This feature must not add a new server or change web release workflows.

## 8. Additional acceptance gates

Use only synthetic vaults in the owner's existing Windows account; a second account is not a manual prerequisite. Record actual SKU, driver, Windows build, TPM/provider evidence, ESS state, app commit and PASS/FAIL/NOT RUN/BLOCKED. Hosted CI cannot supply physical biometric evidence. Do not enroll the owner's fingerprints remotely, capture biometrics in test artifacts, or disable system protections for a green test result.

| ID | Test | Required result |
| --- | --- | --- |
| H-01 | Real Kensington setup and offline enrollment/unlock after OS setup | Standard-user app works with recorded hardware/driver; no raw biometric data enters app code. |
| H-02 | Hardware protection and export attempts | Actual key binding established; private-key export rejected; absent/unverifiable TPM disables Hello without blocking password access. |
| H-03 | Silent/native unwrap, forged success flag, bypassed UI and repeated unlocks | No recovery without required protected authorization; repeated attempts do not reuse authorization invisibly. |
| H-04 | Valid fingerprint, nonmatching finger, cancel, PIN fallback and lockout | Correct OS-managed behavior; failed/canceled attempts return no secret; UI does not claim fingerprint-only verification. |
| H-05 | Session mode restart/crash and persistent mode restart/expiry | Session envelope disappears; opt-in persistent mode works until policy expiry; password path remains available. |
| H-06 | Lock/suspend/user switch/close while prompt is pending; owned-dialog focus changes | No stale response reveals secrets; owned-dialog flow can complete safely without disabling real lock triggers. |
| H-07 | Envelope corruption, wrong vault, swapped enrollment/key ID and clock rollback | Authentication/binding/policy checks fail closed; vault file is not modified. |
| H-08 | Copy files/envelope to another machine and recheck source | Hello cannot unwrap on the other machine; source still decrypts; master-password recovery works independently. Synthetic envelope observation is complete; production recovery remains pending. Same-PC/other-account manual testing is excluded by the owner and remains unverified. |
| H-09 | Multiple normal saves, KDF salt changes and reopen | Engine-compatible unlock material continues to work without format changes or lost history. |
| H-10 | Password change/import/restore plus injected crashes between stages | Valid vault retained; previous enrollment invalid; re-enrollment uses the new credential after master-password verification. |
| H-11 | Disable/revoke, replay old envelope, missing key and simulated reset | No silent re-enrollment; replay fails after confirmed key revocation; errors accurately reported. |
| H-12 | Unplug/replug reader, driver unavailable, RDP/unavailable provider | No data loss or retry loop; fallback works; do not claim USB presence is required when OS PIN is accepted. |
| H-13 | ESS enabled/disabled as permitted on a controlled test machine | Exact compatibility recorded; app never changes security settings; policy-blocked configuration remains honest and usable by password. |
| H-14 | Remove all Hello metadata, open latest Windows backup in web and Python | Full entries/history recover using master password only; backup contains no Hello secret envelope. |
| H-15 | Release bundle, logs, IPC and crash handling inspection | No plaintext secret cache, raw biometrics, generic decrypt command or activatable test provider. |
| H-16 | Existing PWA CI/deployment and desktop upgrade | Web behavior unchanged; desktop enrollment remains valid when compatible or safely requires re-enrollment; vault is preserved. |

Document provider/API choices and unresolved limitations instead of inferring them from a successful prompt. A mock passing H-04 cannot establish H-02/H-03. If the exact selected sensor or a suitable TPM machine is unavailable, mark hardware gates NOT RUN/BLOCKED and do not claim Kensington support is verified.
