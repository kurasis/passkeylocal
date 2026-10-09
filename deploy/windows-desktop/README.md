# Windows desktop test installers

Latest: **independent Windows Hello for File Safe and Passwords** — [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37893262653/artifacts/11599464003), [successful Windows run 37893262653](https://github.com/kurasis/passkeylocal/actions/runs/37893262653). [PR #34](https://github.com/kurasis/passkeylocal/pull/34) merged as `58084c47377d17e634a0d1839baf7cff24a96d46`. Code head `93821b69e978f9f75a7862cccb397b6eecc73dfb`; installed/tested source `5369fadd0dc35c03cb568125cae7c444ec9e8472`. The merged application tree equals the tested PR tree.

Open the artifact while signed in to GitHub, extract it and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. This is an unsigned experimental installer; Microsoft's signed x64 WebView2 offline installer is included. Node/Python are not required. Artifact retention is 30 days; after expiry run the [Windows workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) on main.

Installer: 219,901,819 bytes; SHA-256 `4fdd5dbc13a323f1de41766d048b96ce2b8e1d02144b7840138f775563bf255a`, matched to original metadata and checksum sidecar. Original evidence: [build](build-5369fad.json), [installed-app smoke](smoke-5369fad.json), [5 GiB resource](file-safe-resource-5369fad.json), [signed WebView2](webview2-download-5369fad.json), [file-safe Hello form](windows-file-safe-hello-5369fad.png), [password-vault Hello](windows-hello-5369fad.png), [settings](windows-settings-5369fad.png), [locked window](windows-locked-5369fad.png). The unversioned sidecar matches this installer.

## Connect File Safe

1. Close the previous app and install this build. Open **Файловый сейф / File Safe** with its own master password; keep a verified encrypted password backup.
2. Expand **Windows Hello для файлового сейфа / Windows Hello for File Safe**. The default lasts until the app closes, for at most 24 hours. Remember this computer for 6, 12 or 24 hours only by explicit choice.
3. Re-enter the **file-safe** master password and select **Подключить файловый сейф к Windows Hello / Connect file safe to Windows Hello**. Windows performs creation and a separate authorization round trip; enabled appears only after protected recovery succeeds.
4. Lock File Safe and select **Открыть файловый сейф через Windows Hello / Unlock file safe with Windows Hello**. Fingerprint, face or PIN is verified by Windows. Cancellation leaves it locked and the password form available; no automatic retry occurs.
5. **Отключить Hello и удалить его ключи / Disable Hello and remove its keys** removes only the safe's exact owned objects. Failed deletion remains cleanup-required for retry.

File Safe and Passwords have separate connections, roots/components, namespaces and tokens. Opening one never opens the other. Existing password-vault connections retain their exact AAD and require no migration; their [connection guide](../../docs/windows/HELLO_VAULT_ENROLLMENT.md) remains applicable. The owner's prior “works” reply confirms basic password-vault flow only.

Safe password/root change, restore, expiry and observed clock rollback invalidate its old envelope. Rotation/restore keep old owned objects journaled until explicit removal. Session mode needs a password after app exit and removal before reconnecting. Ordinary saves/imports retain the connection. Portable v1 backup bytes and independent Python recovery stay unchanged.

[File-safe design, operation and evidence limits](../../docs/file-safe/WINDOWS_HELLO.md). New physical file-safe acceptance on Kensington is pending: use a disposable safe, connect, lock, unlock explicitly, export a small test file and verify a password backup. Broader lifetime/restart/negative cases are separately unverified. Same-PC second-account testing remains excluded. No completed standalone diagnostic is requested again. Preview remains unavailable under its separate isolation gates.

## Prior owner measurements

The following historical reports preserve their original source, scope and flags. Earlier descriptions of unavailable production enrollment refer to those earlier builds.

## Completed single-button KDBX recovery

The [owner report](hello-target-9200a4b-vault-recovery.json) for source
`9200a4b0bb3d4fc33b9e50fc356cc355b3ff51ae` passes all 27 stages. The built-in
public KDBX opened through actual native Hello/TPM keys and was re-saved. After
temporary key removal and exact absence checks, a wrong password was refused,
and fresh master-password credentials recovered both records and one historical
version with full logical integrity. The TPM error `0x80090016` is the expected
missing-key result. Both temporary keys and the cleanup journal were removed.

Outcome is `vault-recovery-passed`, `combinedState: no-test`, scope
`public-synthetic-kdbx`, process scope `same-process`. This procedure is complete;
no repeat, new installer, restart or additional cleanup is requested. The
[reference procedure and limits](../../docs/windows/HELLO_VAULT_RECOVERY.md)
remain available. No new prompt count or biometric modality is inferred from
the JSON; original false eligibility/enrollment/unlock flags are preserved.

Production enrollment of your own vault remains disabled. The
[one-account acceptance plan](../../docs/windows/HELLO_OWNER_ACCEPTANCE.md)
excludes a second-account manual test and leaves that isolation unverified.

## Completed two-computer result and next procedure

The owner supplied [destination](hello-target-cdcc954-copy-destination.json),
[source recheck](hello-target-cdcc954-copy-source.json) and
[cleanup](hello-target-cdcc954-copy-cleanup.json) reports. The destination finds
both keys missing; the source opens both and decrypts successfully. SHA-256 of
the supplied 3,119-byte test file matches both copy reports. The
[evidence record](hello-target-cdcc954-copy-evidence.json) notes the absent initial
export report without inventing it. Cleanup passed all four stages and ended in
`no-test`. This synthetic envelope-only procedure is complete; no repeat,
additional cleanup or replacement installer is requested.

The owner excluded a second Windows account from manual testing. Follow the
[revised one-account acceptance plan](../../docs/windows/HELLO_OWNER_ACCEPTANCE.md).
Account isolation remains unverified; automated logic tests are not a Windows
account-isolation measurement. Next work is production password recovery and
lifecycle integration using a synthetic vault in the existing account. The
current installer does not yet provide that production acceptance sequence.
Real-vault Hello enrollment/unlock remains disabled. The [copy protocol](../../docs/windows/HELLO_COPY_TEST.md)
is retained as a reference, not a request to repeat completed measurements.

## Completed key-loss measurement

The [owner report](hello-target-4b3ba34-key-loss.json) for the earlier `4b3ba34` installer passes
all 20 stages: decryption before deletion, passkey absence on reopen, the
still-existing TPM key's positive reopen control, then its absence after deletion.
`0x80090016` at `loss-tpm-reopen` is the expected `NTE_BAD_KEYSET` observation.
Cleanup of both native objects and the journal passed; final state is `no-test`,
outcome `combined-key-loss-passed`.

**That key-loss test is complete.** It needs no repeat or manual cleanup;
the new copy-file procedure above is separate. [Reference procedure and limits](../../docs/windows/HELLO_KEY_LOSS.md)
remain available. This is a `same-process` synthetic object-loss observation;
it does not enable real vault unlock or establish account/machine-copy resistance
or password recovery after key loss. No prompt count or fingerprint modality is
inferred from this JSON. Eligibility/enrollment/unlock stay false and the static
`remaining` array is unchanged.

## Completed restart and cancellation baseline

The owner supplied [preparation](hello-target-a7f56d8-combined-prepare.json) and
[restart](hello-target-a7f56d8-combined-resume.json) reports for the earlier `a7f56d8` installer:
all nine preparation and seven restart stages passed, ending in
`combined-restart-passed` / `fresh-process` / `no-test`. The owner confirmed **two
fingerprint verifications for each button**, covering creation/first unwrap and
the two unwraps after restart. Both temporary keys and the journal were deleted.
The successful path is complete; the cancellation/cleanup sequence below is
also complete and does not need to be repeated.

The [cancellation report](hello-target-a7f56d8-combined-cancel.json) now confirms
that the first assertion after restart was cancelled with `0x80090036`
(`NTE_USER_CANCELLED`), after reopening/binding passed. No successful unwrap is
reported. `ready-to-resume` was the expected retained test state. A successful
retry is not claimed; the separate deletion measurement follows below.

The [cleanup report](hello-target-a7f56d8-combined-cleanup.json) now passes all
four stages, including deletion of both native test objects and the journal.
Outcome/state is `combined-cleaned` / `no-test`. The report correctly retains
`processScope: same-process` for cleanup; it is not another unlock measurement.

**That earlier target procedure is complete.** The separate key-loss procedure
above is now also complete. The later second-PC observation is complete too.
Other-account manual testing is excluded and unverified; password fallback,
remaining authorization negatives and production integration remain pending.

False eligibility/enrollment/unlock and the static `remaining` array are preserved
in the original reports. The completed synthetic test does not enable real-vault
Hello enrollment. Other cancellation points, silent-access negatives, key-loss fallback and
production lifecycle acceptance remain open under the revised one-account plan.

[Protocol, recovery and evidence limits](../../docs/windows/HELLO_COMBINED_RESTART.md) explain the bounded journal written before creation, dedicated RP/exact-user recovery after a crash, locally verified TPM key, authenticated metadata, new authorization for every decryption and native process boundary. Only random synthetic data is used. No real vault credentials or PRF output are persisted or returned by IPC. Do not repeat completed standalone probes, reset TPM/Hello or weaken security policy.

## Completed owner baseline

- [Combined a7f56d8 cancellation](hello-target-a7f56d8-combined-cancel.json): the first assertion after restart was cancelled before a successful unwrap; [subsequent cleanup](hello-target-a7f56d8-combined-cleanup.json) passed all four stages and ended in `no-test`.
- [Combined a7f56d8 preparation](hello-target-a7f56d8-combined-prepare.json) and [restart](hello-target-a7f56d8-combined-resume.json): all 16 stages passed across two reports; four fingerprint verifications confirmed by the owner, with cleanup complete.
- [PRF 72a0df6](hello-target-72a0df6-prf.json): all ten stages passed on Win11 Pro 25H2/build26200, API9, Kensington VeriMark Desktop. The owner confirmed a new fingerprint at creation and each assertion.
- [Local TPM binding bbead07](hello-target-bbead07-tpm-local-binding.json): all 12 stages passed, including exact public key/Name/duplication restrictions before and after reopening, OAEP negative controls and deletion. This is accepted local evidence under trusted Windows/KSP/TBS, not a remote signed attestation.
- [TPM inner c83ce3f](hello-target-c83ce3f-tpm-inner.json): raw private exports returned NTE_BAD_TYPE (unsupported format), not explicit permission denial. [Direct attestation bdb2a03](hello-target-bdb2a03-direct-attestation.json) returned `none`. Neither result is relabeled or repeated.

## Validation of this installer

[General CI 37893262472](https://github.com/kurasis/passkeylocal/actions/runs/37893262472) and Windows CI passed all 11 checks on code head `93821b69e978f9f75a7862cccb397b6eecc73dfb`. Windows: 177 routine native tests; Linux: 145; TypeScript: 174; desktop/browser UI: 49; production PWA: eight. Ten new native and three new UI cases cover safe lifecycle, purpose isolation and old-vault compatibility. MSVC/header ABI, 5 GiB resource, OS/version recovery matrix, offline kit and fresh independent native/Python interop passed separately.

Actual NSIS installation, executable equality, worker/native UI/IPC, module locks and provenance passed. The file-safe command returned off/no-record revoke without secret material, rejected malformed input and stale generation, and refused a wrong safe password before native object creation. Its installed connection form defaulted to session mode with four choices and an empty required password. Existing password-vault smoke and diagnostic report boundaries passed. Hosted Windows has no usable Hello/TPM; this is not a physical protected-unlock result.

10,000-file restore: 159.504 seconds. Hosted 5 GiB primitive: 46.463 seconds; sampled peak working set 10,645,504 bytes. These are hosted observations, not target guarantees.

[Release evidence](../../docs/RELEASE_EVIDENCE.md). The [Cloudflare ZIP](../cloudflare-pages/) remains a separate web build.
