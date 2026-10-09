# Windows Hello for File Safe

This is an experimental, explicit opt-in for the existing file safe. It reuses
the native PRF/TPM mechanism measured for the password vault, with separate
objects, purpose binding and session state. Physical acceptance of this new
file-safe flow on the owner's reader is pending; the owner's earlier “works”
response concerns password-vault Hello only.

## Connect and use

1. Open File Safe using its own master password and keep a verified encrypted
   backup recoverable by that password.
2. Open **File-safe settings / Настройки сейфа**, then expand **Windows Hello for File Safe / Windows Hello для файлового сейфа**.
   Choose session mode (default) or remember this computer for 6, 12 or 24 hours.
3. Re-enter the **file-safe** master password and select **Connect file safe to
   Windows Hello / Подключить файловый сейф к Windows Hello**. A wrong password
   stops before credential/key creation. Windows performs creation and a separate
   authorization round trip; enabled is shown only after protected recovery succeeds.
4. Lock File Safe and select **Unlock file safe with Windows Hello / Открыть
   файловый сейф через Windows Hello**. Windows may verify fingerprint, face or
   PIN. Each unlock requests fresh verification. Cancellation leaves it locked;
   the master-password form remains available and there is no automatic retry.
5. **Disable Hello and remove its keys / Отключить Hello и удалить его ключи**
   first makes the envelope nonresumable, then deletes only the safe's exact
   credential and TPM key. Failed deletion remains cleanup-required for retry.

The default protected envelope stays only in native process memory, at most
24 hours. Session-mode restart needs a password and removal of old owned objects
before reconnecting. Remembered modes persist only encrypted envelope bytes and
expire from enrollment time; unlock does not extend them. Expiry and observed
clock rollback invalidate the connection. This is application time policy, not
TPM monotonic expiration or a defense against a whole-profile rollback.

Changing the safe's password/root or restoring a package invalidates the envelope
before the storage write. Its old owned objects stay journaled as cleanup-required
until explicit removal; a provider error cannot be bypassed to unwrap them. A
wrong current password in the rotation form does not invalidate a valid connection.
Ordinary imports, metadata changes, versions and backups retain enrollment.

Opening File Safe never opens Passwords, and opening Passwords never opens File
Safe. Module-local lock affects its own session; Lock All and native Windows
lock/suspend events revoke both. No password-vault token authorizes File Safe.

## Protection and format compatibility

The 32-byte **random file-safe root** stays in Rust. The service freshly unwraps
the existing password header and checks that root against the current unlocked
session before enrollment. It does not derive a root from KDBX or reuse a password
component. During unlock, the recovered root must authenticate the real selected
catalog and its references before a new safe token is published.

```text
root -> Platform KSP RSA-2048 OAEP/SHA-256 ciphertext
     -> AES-256-GCM with HKDF-SHA256(native WebAuthn PRF, enrollment salt, safe domain)
```

Every key create/reopen uses the existing strict Platform KSP policy and exact
local TPM ReadPublic/public/Name checks. The same WebAuthn creation-time PRF
evaluation, exact credential/route, required user verification and bounded result
validation are reused. No consent boolean, software-key or DPAPI-only fallback
is provided. The threat model trusts Windows/KSP/TBS and the application; this
is local TPM evidence, not remote AIK or PRF-secret hardware attestation.

Independent namespaces:

| Context | Password vault | File Safe |
| --- | --- | --- |
| RP | `vault.passkey-local.desktop.invalid` | `file-safe.passkey-local.desktop.invalid` |
| Key prefix | `PassKeyLocal.VaultHello.` | `PassKeyLocal.FileSafeHello.` |
| HKDF/AEAD domain | `PassKeyLocal.VaultHello.v1` | `PassKeyLocal.FileSafeHello.v1` |
| Local journal | `hello-vault/enrollment.json` | `<safe base>/hello-file-safe/enrollment.json` |
| Protected material | Password-only KDBX component | Independent random safe root |

The shared strict 16 KiB journal/envelope state machine takes a fixed native
purpose. It authenticates the full safe vault ID, selected local store ID and
root key-epoch ID, plus enrollment/mode/deadline/credential/TPM metadata. Native
context binds individual operations to a digest of exact ACTIVE + HEAD bytes;
the shared component binding's numeric generation is reserved as zero for the
safe, while its own session generation separately protects IPC admission.
Cross-purpose records are rejected before authorization. Optional safe metadata
is omitted entirely for the password vault, preserving its existing serialized
AAD, domain, user identity, keys and usable enrollments without migration.

Journal ownership is durable before creation. Cleanup matches both the fixed RP
and the pre-journaled random enrollment user; exact-key deletion checks absence.
Both object deletions are attempted. Native global Hello single-flight and
file-safe transfer admission serialize protected operations. Lock/revocation
generations and current selection are checked before and after authorization;
late results cannot publish a session. OS UI uses the real trusted main HWND.

The renderer-facing `file_safe_hello` request accepts only status, enrollment
(safe token/password/mode), unlock (observed session generation), or revocation
(observed session generation). It accepts no root, component, path, RP, key name
or arbitrary ciphertext. Replies contain nonsensitive enrollment status and,
only after actual unlock, a safe session token. Root/PRF/wrapping secrets are
zeroized where feasible; the root never enters JavaScript or support reports.

The portable v1 key header/catalog/object format is unchanged. Backups contain
only their matching encrypted headers/catalog/objects, never this local journal
or Windows keys. Independent Python recovery still uses only the applicable
password. Old backups retain their old passwords after rotation.

## Code and checks

- [Native safe coordinator](../../apps/desktop/src-tauri/src/file_safe/hello.rs).
- [Native root/catalog admission](../../apps/desktop/src-tauri/src/file_safe/store.rs).
- [Safe session and rotation/restore invalidation](../../apps/desktop/src-tauri/src/file_safe/manager.rs).
- [Shared purpose-bound envelope](../../apps/desktop/src-tauri/src/hello/enrollment.rs).
- [Safe root/session tests](../../apps/desktop/src-tauri/src/file_safe/hello/tests.rs).
- [Purpose isolation and existing-vault compatibility](../../apps/desktop/src-tauri/src/hello/enrollment/tests.rs).
- [File-safe UI cases](../../apps/desktop/test/ui/file-safe-hello.spec.ts).
- [Installed Windows checks](../../apps/desktop/scripts/packaged-smoke.mjs).
- [General developer handoff](../windows/WINDOWS_HELLO_DEVELOPER_HANDOFF.md).

Automated tests use explicit synthetic backend doubles plus real encrypted safe
storage. They cover root/catalog/file export, normal saves, password-only backup,
wrong password/token/root, cancellation, stale generation/late lock, session and
remembered restart, rotation/restore invalidation, cleanup failure/retry, strict
requests, cross-purpose copying/tamper and byte-compatible old vault AAD. UI
tests cover modes, default, cancellation, stale replies and Russian responsive
labels. Hosted installed smoke checks real command permissions, safe password
admission, stale/malformed refusal and worker-independent actual controls without
creating hardware objects on the unavailable hosted Hello route.

The owner's new physical check needs only their existing Windows account and a
disposable safe: connect, lock, explicit Hello unlock, export a small test file
and open a password backup. Record the build and actual observations. Broader
expiry/restart/revoke/negative cases remain separately unverified. No previous
standalone diagnostic or excluded second-account test is requested.

[TXT preview](TXT_PREVIEW.md) has separate experimental LPAC/installed evidence; full multi-format and standard-user isolation gates remain pending. Adding
Hello does not approve document parsers or complete full file-safe acceptance.
See [release evidence](../RELEASE_EVIDENCE.md) and [acceptance ledger](ACCEPTANCE.md).
