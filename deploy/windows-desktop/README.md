# Windows desktop test installers

Latest: **opt-in Windows Hello for the active password vault** — [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37815672528/artifacts/11567523288), [successful Windows run 37815672528](https://github.com/kurasis/passkeylocal/actions/runs/37815672528). [PR #32](https://github.com/kurasis/passkeylocal/pull/32) merged as `6185e8008c8f1b943cb61de61ac2e7c8875d2523`. Code head `977fe6a4bab63992868dbb2462fddb786e2e8107`; installed/tested source `c18894e210a07546ba66cf178b8048ae5c40ac61`. The merged application tree equals the tested PR tree.

Open the artifact while signed in to GitHub, extract it and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. This is an unsigned experimental installer; Microsoft's signed x64 WebView2 offline installer is included. Node/Python are not required. Artifact retention is 30 days; after expiry run the [Windows workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) on main.

Installer: 218,130,545 bytes; SHA-256 `cde3091431697da7b8d958c271dc91f6d67186bc266b9b4f120723cf7d537642`, matched to original metadata and checksum sidecar. Original evidence: [build](build-c18894e.json), [installed-app smoke](smoke-c18894e.json), [5 GiB resource measurement](file-safe-resource-c18894e.json), [signed WebView2](webview2-download-c18894e.json), [Russian Hello controls](windows-hello-c18894e.png), [settings](windows-settings-c18894e.png), [locked window](windows-locked-c18894e.png). The unversioned sidecar matches this installer.

## Connect the vault

1. Close the previous app and install this build. Open the vault with its master password; keep a verified password backup.
2. Open Settings → **Вход через Windows Hello / Unlock with Windows Hello**. The default is until the app closes, for at most 24 hours. Remembering this computer for 6, 12 or 24 hours is a separate explicit choice.
3. Re-enter the master password and select **Подключить Windows Hello / Connect Windows Hello**. Windows performs credential creation and a separate protected round trip. The setting becomes enabled only on success.
4. Lock the app and select **Войти через Windows Hello / Unlock with Windows Hello**. Windows may accept fingerprint, face or PIN. Cancellation leaves the password form available. **Отключить Hello и удалить его ключи / Disable Hello and remove its keys** removes the local connection.

Password change, vault replacement/restore, expiry and detected clock rollback disable the old connection. Session mode requires a password after app exit; remove its old objects before reconnecting. Failed deletion remains visible as cleanup-required, with a retry action. The master-password KDBX format and independent recovery stay unchanged.

[Design, boundaries and remaining acceptance](../../docs/windows/HELLO_VAULT_ENROLLMENT.md). This is experimental opt-in, off by default. The new packaged application lifecycle still needs physical owner acceptance; prior synthetic passes do not constitute that result. Same-PC/other-account manual testing remains excluded and unverified. Earlier diagnostic buttons are under **Диагностика Windows Hello / Windows Hello diagnostics**; no completed diagnostic needs repeating.

## Prior owner measurements

The following reports predate active-vault enrollment and preserve their original scope/flags. Their references to unavailable production enrollment describe those earlier builds; the new implementation and remaining physical acceptance are described above.

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

[General CI 37815672521](https://github.com/kurasis/passkeylocal/actions/runs/37815672521) and Windows CI passed all 11 checks on code head `977fe6a4bab63992868dbb2462fddb786e2e8107`. Windows: 167 routine native tests, including 12 enrollment lifecycle cases and one fixed-command input test; independent MSVC/header ABI and 5 GiB resource checks executed separately. Linux: 135 routine native tests; TypeScript: 174; desktop/browser UI: 46; production PWA: eight. Recovery OS/version matrix, offline kit and independent Python interop passed.

The installed NSIS app passed binary equality, UI/IPC/lock checks and source correlation. The new enrollment command returned off/no-record revoke without a component, refused malformed actions and stale sessions, and populated the actual worker-backed connection form with session mode as default. Hosted Windows lacks usable Hello/TPM; no physical enrollment success is claimed from those paths or synthetic browser IPC.

10,000-file restore: 78.239 seconds. Hosted 5 GiB primitive: 50.399 seconds; sampled peak working set 10,551,296 bytes. These are hosted observations, not target guarantees.

[Release evidence](../../docs/RELEASE_EVIDENCE.md) records the remaining physical lifecycle acceptance. The [Cloudflare ZIP](../cloudflare-pages/) is a separate web build.
