# Windows desktop test installers

Latest: **Monthly backup reminders and shared File Safe feedback** — [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37936826027/artifacts/11620690157), [successful Windows run 37936826027](https://github.com/kurasis/passkeylocal/actions/runs/37936826027). [PR #37](https://github.com/kurasis/passkeylocal/pull/37) merged as `bd359391d4a42a42fd3b0dbdec8e7af128972522`. Code head `44095ff65be8b26bdab0d6ec57722a323b823f05`; installed/tested source `98a714b4335cb91fed752ad1d4880601f8eb39a5`. The merged application tree equals the tested PR tree.

Open the artifact while signed in to GitHub, extract it and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. This is an unsigned experimental installer; Microsoft's signed x64 WebView2 offline installer is included. Node/Python are not required. Artifact retention is 30 days; after expiry run the [Windows workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) on main.

Installer: 219,954,926 bytes; SHA-256 `5ceac8231a208b13699e1ea9acc247501603b7447001bed76d8319621b3da051`, matched to original metadata and checksum sidecar. Original evidence: [build](build-98a714b.json), [installed-app smoke](smoke-98a714b.json), [5 GiB resource](file-safe-resource-98a714b.json), [signed WebView2](webview2-download-98a714b.json), [installed explorer](windows-file-safe-explorer-98a714b.png), [file-safe Hello form](windows-file-safe-hello-98a714b.png), [password-vault Hello](windows-hello-98a714b.png), [settings](windows-settings-98a714b.png), [locked window](windows-locked-98a714b.png). The unversioned sidecar matches this installer.

## Changes in this build

Password backups remind after changes, or after 30 days since the last successful matching backup verification even without edits. Ten unbacked commits retain the visible warning. Exporting alone does not reset the verification deadline; rechecking the current backup does. The unlocked app checks on focus and once a minute. Initial onboarding remains unchanged.

Successful password/Hello admission to File Safe is quiet. Explicit action success, errors and progress appear next to the heading; results expire after six seconds. Navigation, heading, forms, buttons and search share the Passwords design in all three themes. On narrow screens controls and long notifications wrap without overlap.

## Use the explorer and TXT preview

Module switches are in the header; file imports and new folders are in the left panel, with safe settings separate above the explorer. Right-click a file or folder (or use Shift+F10) for applicable actions. Folder deletion requires confirmation and an empty folder, including recycled files. File export and permanent deletion retain explicit consent.

Select a `.txt` file or **Предпросмотр TXT / Preview TXT** from its menu. UTF-8 and optional BOM are supported up to 8 MiB. Text is inert and read-only; adjust its size or navigate bounded sections for large files. Close cancels the worker and lock clears the preview. No document plaintext temp file or privileged decoder fallback exists. [TXT scope](../../docs/file-safe/TXT_PREVIEW.md), [actual hosted isolation proof](text-preview-sandbox-98a714b.json), [installed TXT screenshot](windows-file-safe-txt-98a714b.png).

Folders and files share a compact Name/Type/Size/Modified list. Select a folder to enter it, use **[..] / Родительская папка** to go up, navigate **Назад / Вперёд** or select an ancestor in the logical breadcrumb path. Create a new folder or import into the currently displayed folder. Folder and file pages stay bounded; only a small visible window is rendered. Size/Modified sort files descending, names ascending. Narrow screens retain a sort selector when columns are hidden.

**Настройки сейфа / File-safe settings** opens a separate screen for Hello, backups/recovery, password and inactivity. **К файлам / Back to files** returns to the same folder. Lock clears metadata, path and history; a new unlock begins at the root and late replies cannot repopulate it. Folder rename/removal and a focused TXT preview command are additive; the encrypted format and recovery bytes retain their version. No migration is required. [Explorer guide](../../docs/file-safe/EXPLORER.md).

## Connect File Safe

1. Close the previous app and install this build. Open **Файловый сейф / File Safe** with its own master password; keep a verified encrypted password backup.
2. Open **Настройки сейфа / File-safe settings**, then expand **Windows Hello для файлового сейфа / Windows Hello for File Safe**. The default lasts until the app closes, for at most 24 hours. Remember this computer for 6, 12 or 24 hours only by explicit choice.
3. Re-enter the **file-safe** master password and select **Подключить файловый сейф к Windows Hello / Connect file safe to Windows Hello**. Windows performs creation and a separate authorization round trip; enabled appears only after protected recovery succeeds.
4. Lock File Safe and select **Открыть файловый сейф через Windows Hello / Unlock file safe with Windows Hello**. Fingerprint, face or PIN is verified by Windows. Cancellation leaves it locked and the password form available; no automatic retry occurs.
5. **Отключить Hello и удалить его ключи / Disable Hello and remove its keys** removes only the safe's exact owned objects. Failed deletion remains cleanup-required for retry.

File Safe and Passwords have separate connections, roots/components, namespaces and tokens. Opening one never opens the other. Existing password-vault connections retain their exact AAD and require no migration; their [connection guide](../../docs/windows/HELLO_VAULT_ENROLLMENT.md) remains applicable. The owner's prior “works” reply confirms basic password-vault flow only.

Safe password/root change, restore, expiry and observed clock rollback invalidate its old envelope. Rotation/restore keep old owned objects journaled until explicit removal. Session mode needs a password after app exit and removal before reconnecting. Ordinary saves/imports retain the connection. Portable v1 backup bytes and independent Python recovery stay unchanged.

[File-safe design, operation and evidence limits](../../docs/file-safe/WINDOWS_HELLO.md). Existing physical file-safe Hello acceptance on Kensington remains pending; this layout change is not a new biometric result and requests no repeated diagnostic. Broader lifetime/restart/negative cases remain separately unverified. Same-PC second-account testing remains excluded. No completed standalone diagnostic is requested again. TXT preview is experimental and read-only: UTF-8/BOM up to 8 MiB, with an actual zero-capability LPAC worker. PDF/images remain unavailable. The separate standard-user/indirect-broker/crash/hardware matrix remains unverified.

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

[General CI 37936825771](https://github.com/kurasis/passkeylocal/actions/runs/37936825771) and Windows CI passed all 11 checks on code head `44095ff65be8b26bdab0d6ec57722a323b823f05`. Windows: 180 routine native tests; Linux: 148; TypeScript: 176; desktop/browser UI: 63; production PWA: eight. Two new UI scenarios cover monthly reminders for unchanged vaults, quiet admission, action placement/expiry, shared navigation styles in all palettes and responsive Russian headings. New regressions cover the exact 30-day boundary, verification-only reset and native JSON-unit normalization; existing folder, TXT and lifecycle regressions passed again. MSVC/header ABI, 5 GiB resource, OS/version recovery matrix, offline kit and fresh independent native/Python interop passed separately.

Actual NSIS installation, executable equality, worker/native UI/IPC, module locks and provenance passed. Native folder action feedback appeared beside the safe title; successful password admission showed no save notification. Two decoder/protocol tests and two actual Windows LPAC integration tests passed separately: unrelated file/profile/TEMP/registry, parent memory, clipboard, inherited handles, writable input, native networking, child launch and allocation limits, plus timeout/cancel. LPAC refused Winsock startup with 10107; unrestricted TCP/UDP succeeded using the identical minimal environment. Individual transport attempts were NOT RUN after startup refusal. The installed release worker SHA-256 equals the proof worker and its native selected-version TXT path, inert rendering, lock redaction and context rename passed. Standard-user hostile execution and exhaustive service-broker/WER/crash tracing remain NOT RUN. The file-safe command returned off/no-record revoke without secret material, rejected malformed input and stale generation, and refused a wrong safe password before native object creation. Its installed connection form defaulted to session mode with four choices and an empty required password. Actual native nested folder creation, parent-row/history/breadcrumb navigation and separate settings passed, with an original installed explorer screenshot. Existing password-vault smoke and diagnostic report boundaries passed. Hosted Windows has no usable Hello/TPM; this is not a physical protected-unlock result.

10,000-file restore: 177.918 seconds. Hosted 5 GiB primitive: 48.963 seconds; sampled peak working set 10,571,776 bytes. These are hosted observations, not target guarantees.

[Release evidence](../../docs/RELEASE_EVIDENCE.md). The [Cloudflare ZIP](../cloudflare-pages/) remains a separate web build.
