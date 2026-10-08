# Windows desktop test installers

Latest: **temporary Hello + TPM key-loss test** — [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37773037961/artifacts/11549687082), [successful Windows run 37773037961](https://github.com/kurasis/passkeylocal/actions/runs/37773037961). [PR #27](https://github.com/kurasis/passkeylocal/pull/27) merged as `0eb2a195a15567bba124fc0cd2591a5028b5ac50`. Code head `a4e9a3cb2870a4716f8350e5735d0c6ba3246ab6`; installed/tested source `4b3ba340f684fc6adefc5b5e2a2e0295add18249`. The merged application tree equals the tested PR tree.

Open the artifact while signed in to GitHub, extract it and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. This is an unsigned experimental installer; Microsoft's signed x64 WebView2 offline installer is included. Node/Python are not required. Artifact retention is 30 days; after expiry run the [Windows workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) on main.

Installer: 217,949,570 bytes; SHA-256 `06d06cdfdcc016de8dfb4f44ecf5e07b43281f528a92d6e538fe6d2bdf7f7a63`, matched to original metadata and checksum sidecar. Original evidence: [build](build-4b3ba34.json), [installed-app smoke](smoke-4b3ba34.json), [5 GiB resource measurement](file-safe-resource-4b3ba34.json), [signed WebView2](webview2-download-4b3ba34.json), [Russian settings](windows-settings-4b3ba34.png), [locked window](windows-locked-4b3ba34.png). The unversioned sidecar matches this installer.

## New key-loss procedure

1. Fully quit the old app and install this build. Unlock with the master password and open Settings → Windows Hello → **Test temporary key loss / Проверить потерю временных ключей**.
2. Allow both Windows verifications. This creates a **new temporary pair**, verifies decryption, then deletes each key and checks reopening. No restart or manual key deletion is needed.
3. Copy the technical report. Expected: `combined-key-loss-passed`, `combinedState: no-test`, all 20 stages passed, source `4b3ba340f684fc6adefc5b5e2a2e0295add18249`. The `loss-tpm-reopen` stage deliberately expects `0x80090016` (missing key). No vault is enrolled or unlocked.
4. If any stage fails or is cancelled, send its report. Cleanup is attempted automatically; **Remove test and temporary keys** remains available if needed. Do not reset TPM/Hello or change Windows security policy.

An existing saved test disables the new action and is never overwritten. Your last supplied cleanup ended in `no-test`, so no repeat of the older procedure is requested. [Protocol and limits](../../docs/windows/HELLO_KEY_LOSS.md): this is same-process object loss, not cross-account/machine or master-password fallback evidence. Physical key-loss measurement is pending your new report.

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

**That earlier target procedure is complete.** The new key-loss procedure above
is separate. Account/machine-copy, password fallback after key loss, remaining
authorization negatives and production integration still need acceptance work.

False eligibility/enrollment/unlock and the static `remaining` array are preserved
in the original reports. The completed synthetic test does not enable real-vault
Hello enrollment. Other cancellation points, silent-access negatives,
account/machine copies,
key-loss fallback and production lifecycle acceptance remain open.

[Protocol, recovery and evidence limits](../../docs/windows/HELLO_COMBINED_RESTART.md) explain the bounded journal written before creation, dedicated RP/exact-user recovery after a crash, locally verified TPM key, authenticated metadata, new authorization for every decryption and native process boundary. Only random synthetic data is used. No real vault credentials or PRF output are persisted or returned by IPC. Do not repeat completed standalone probes, reset TPM/Hello or weaken security policy.

## Completed owner baseline

- [Combined a7f56d8 cancellation](hello-target-a7f56d8-combined-cancel.json): the first assertion after restart was cancelled before a successful unwrap; [subsequent cleanup](hello-target-a7f56d8-combined-cleanup.json) passed all four stages and ended in `no-test`.
- [Combined a7f56d8 preparation](hello-target-a7f56d8-combined-prepare.json) and [restart](hello-target-a7f56d8-combined-resume.json): all 16 stages passed across two reports; four fingerprint verifications confirmed by the owner, with cleanup complete.
- [PRF 72a0df6](hello-target-72a0df6-prf.json): all ten stages passed on Win11 Pro 25H2/build26200, API9, Kensington VeriMark Desktop. The owner confirmed a new fingerprint at creation and each assertion.
- [Local TPM binding bbead07](hello-target-bbead07-tpm-local-binding.json): all 12 stages passed, including exact public key/Name/duplication restrictions before and after reopening, OAEP negative controls and deletion. This is accepted local evidence under trusted Windows/KSP/TBS, not a remote signed attestation.
- [TPM inner c83ce3f](hello-target-c83ce3f-tpm-inner.json): raw private exports returned NTE_BAD_TYPE (unsupported format), not explicit permission denial. [Direct attestation bdb2a03](hello-target-bdb2a03-direct-attestation.json) returned `none`. Neither result is relabeled or repeated.

## Validation

[General CI 37773038077](https://github.com/kurasis/passkeylocal/actions/runs/37773038077) and Windows CI passed all 11 exact-head checks. Windows: 133 routine native tests, including 15 portable combined cases; independent MSVC/header ABI and 5 GiB resource tests executed separately. TypeScript: 161 tests; desktop UI: 34 scenarios; production PWA: eight scenarios; Linux: 105 routine native tests. Recovery OS/version matrix, offline kit and fresh native/Python parity passed.

Actual NSIS installation, binary equality, packaged UI/IPC/lock and source correlation passed. The new packaged key-loss command refused unsupported hosted preflight before creating native keys and preserved cleanup failure rather than relabeling it as success. Hosted Windows has no usable Hello/TPM; no physical loss success is inferred.

10,000-file restore: 119.156 seconds. Hosted 5 GiB primitive: 92.363 seconds; sampled peak working set 10,563,584 bytes. These are hosted observations, not target guarantees.

[Release evidence](../../docs/RELEASE_EVIDENCE.md) records outstanding account/machine-copy, password-fallback, authorization and production integration work. The [Cloudflare ZIP](../cloudflare-pages/) is a separate web build.
