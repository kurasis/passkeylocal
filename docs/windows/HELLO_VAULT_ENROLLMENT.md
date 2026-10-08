# Windows Hello vault enrollment

This increment connects the previously measured native PRF/TPM mechanism to the
active KDBX crypto worker. It is an experimental, explicit opt-in, off by default.
The original synthetic reports and their false flags remain historical evidence;
they are not runtime enrollment settings or a request to repeat those tests.
Physical acceptance of this new application lifecycle is still pending. The
owner's same-PC/other-account test remains excluded and unverified.

## User flow

1. Open the vault with its master password. In Settings → **Unlock with Windows
   Hello / Вход через Windows Hello**, choose the lifetime and re-enter the master
   password. The worker must authenticate the exact committed vault again.
2. Select **Connect Windows Hello / Подключить Windows Hello**. Windows creates a
   dedicated credential, then authorizes a separate round trip. Enrollment is
   enabled only when the recovered component matches and the vault/session is
   still current. A wrong password never starts native enrollment.
3. Lock the app. Select **Unlock with Windows Hello / Войти через Windows Hello**
   explicitly. A new OS authorization is required; cancellation leaves the vault
   locked without retry. The normal password form remains available.
4. **Disable Hello and remove its keys / Отключить Hello и удалить его ключи**
   invalidates the envelope before deleting only this app's exact objects. If
   deletion fails, Settings keeps a cleanup-required state and offers retry.

The default session mode retains the envelope only in native process memory,
for at most 24 hours. The cleanup journal stores only object ownership, never
that mode's nonce/ciphertext. App exit/crash loses the envelope; the next launch
requires a master password and removal of the old objects before re-enrollment.

Remembered mode is an additional explicit choice of 6, 12 or 24 hours since
password verification/enrollment. Only the protected envelope is persisted.
No unlock extends this deadline. Expiry or observed backward clock movement
makes the record durably nonresumable. This is application clock policy, not a
TPM clock or a defense against rollback of an entire system/profile. Normal
content saves keep the enrollment; password change, replacement/import and
snapshot restore revoke it before the credential-changing storage operation.

Windows checks fingerprint, face or PIN according to its own configuration.
The app cannot assert the biometric modality or require a particular Kensington
serial number. TPM loss/provider errors do not change the KDBX password path.
A failed key deletion after durable invalidation does not prevent a subsequent
password change/restore; its remaining cleanup stays visible in Settings.

## Native boundary and persistence

The separate `hello_enrollment` command accepts only status/enroll/unlock/revoke,
a current native storage-session token, and bounded mode/binding/component inputs
for enrollment. It never accepts an unwrapping ciphertext, path, key name or
caller-selected target. Focus is required for enrollment and unlock. The real
host HWND owns OS UI; ordinary owned-dialog focus transfer does not cancel it.
Minimize, session/power lock, inactivity, worker disposal and explicit revocation
invalidate pending results. Native/session checks run before and after the
protected operation; the worker also checks the current KDBX head after opening.

Each enrollment uses an independent random UUID and dedicated namespaces:
`vault.passkey-local.desktop.invalid`, `PassKeyLocal.VaultHello.<UUID>` and the
per-user `hello-vault/enrollment.json`. Synthetic diagnostics cannot select or
delete these objects. The managed store's opaque owner ID and password epoch
bind the record to the local active vault. The exact generation and ciphertext
SHA-256 bind each enrollment/unlock attempt, while later normal saves remain
possible with fresh KDF salts/IVs.

Authenticated metadata includes version/domain, UUID/native-key identity, opaque
vault binding and credential epoch, mode, fixed creation/expiry times, PRF salt,
credential ID and TPM public area/Name. AES-256-GCM with domain-separated
HKDF-SHA-256 PRF material protects the RSA-2048 OAEP/SHA-256 inner ciphertext.
The key is created/reopened through Platform KSP with exact local TPM ReadPublic
comparison and fixed-object restrictions, as in the completed combined proof.
WebAuthn API 9+, available Hello routing and real PRF output are required. There
is no consent-boolean, DPAPI-only or software-provider fallback.

The bounded native record is written atomically under restrictive per-user ACLs.
Object ownership is durable before creation, including recovery of a credential
whose ID was not returned before a crash. A nonresumable journal is saved before
deleting either native object; both deletions are attempted and checked. Native
single-flight prevents overlapping native key experiments/enrollment operations.
The host invalidates requests before credential-changing commits; busy operations
are retryable and cannot race a write using the previous enrollment.

The worker sends only the freshly verified 32-byte password component, never the
master-password string, to the native enrollment command. No component digest
or other new offline password verifier is stored. Native unwrap returns the
component only to the live crypto-worker bridge with its current head binding;
no screen, status, report or clipboard receives it. Native buffers and transport
arrays are cleared where feasible. Terminating the vault worker removes its
decrypted database and pending calls; guaranteed JavaScript memory erasure is
not claimed. A compromised unlocked process remains outside this protection.

Hello metadata never enters a KDBX file, portable backup, web storage or Python
recovery package. Browser builds contain neither the enrollment IPC nor this
native worker implementation. The KDBX format and independent password recovery
remain unchanged.

## Validation and remaining physical acceptance

Automated native tests cover memory-only session envelopes, remembered restart,
fresh authorization calls, expiry/rollback, head/epoch/vault mismatch, tampered
metadata/ciphertext, cancellation, stale enrollment/unwrap, failed creation and
cleanup, key revocation/replay and storage-invalidation classification. Portable
tests also reject arbitrary action/target fields and unbounded mode choices.
These backend doubles test state logic, not physical OS behavior.

Real KDBX worker tests verify wrong-password admission, component-only transport,
normal saves/history, independent password opening, wrong component/head refusal,
lock during opening and password rotation. Browser tests use the actual worker,
KDBX engine and desktop bridge with explicitly synthetic native IPC; they verify
transport clearing and late-result disposal. Packaged Windows smoke checks the
installed command boundary, off/no-record revoke, malformed action and stale
session refusal without claiming a physical enrollment on the hosted runner.

The existing independent Python check opens the component-opened/re-saved KDBX
with only its password and compares full records/history. See the
[release ledger](../RELEASE_EVIDENCE.md) for actual run results.

No production physical pass is inferred from the owner's completed public-fixture
report. Remaining owner acceptance is the new packaged opt-in/lock/unlock/revoke
flow, remembered restart and session expiry behavior, and interruption/negative
cases using a disposable vault in the existing Windows account. No previous
standalone diagnostic or second-account procedure is requested. Broader sensor,
ESS, standard-user and lockout coverage retains its original unverified scope.
