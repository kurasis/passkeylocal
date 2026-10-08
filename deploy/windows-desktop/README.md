# Windows desktop test installers

Latest: **combined Hello PRF + TPM restart test** — [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37764316715/artifacts/11544901097), [successful Windows run 37764316715](https://github.com/kurasis/passkeylocal/actions/runs/37764316715). [PR #26](https://github.com/kurasis/passkeylocal/pull/26) merged as `cedae01de4a19b8810c4bf6a3a0bbc9d3323f170`. Code head `c757fdc45eb79b110c7835173e31ba28d476cb87`; installed/tested source `a7f56d80d6029bcd4185ca6d3ad22d08f957561a`. The merged application tree equals the tested PR tree.

Open the artifact while signed in to GitHub, extract it and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. This is an unsigned experimental installer; Microsoft's signed x64 WebView2 offline installer is included. Node/Python are not required. Artifact retention is 30 days; after expiry run the [Windows workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) on main.

Installer: 217,960,718 bytes; SHA-256 `5f280928cb26bab52f114be629dfd578b682de8615548af932c02cef616db547`, independently matched to original metadata and checksum sidecar. Original evidence: [build](build-a7f56d8.json), [installed-app smoke](smoke-a7f56d8.json), [5 GiB resource measurement](file-safe-resource-a7f56d8.json), [signed WebView2](webview2-download-a7f56d8.json), [Russian settings](windows-settings-a7f56d8.png), [locked window](windows-locked-a7f56d8.png). The unversioned sidecar matches this installer.

## Completed target result

The owner supplied [preparation](hello-target-a7f56d8-combined-prepare.json) and
[restart](hello-target-a7f56d8-combined-resume.json) reports for this installer:
all nine preparation and seven restart stages passed, ending in
`combined-restart-passed` / `fresh-process` / `no-test`. The owner confirmed **two
fingerprint verifications for each button**, covering creation/first unwrap and
the two unwraps after restart. Both temporary keys and the journal were deleted.
The successful path is complete; the cancellation/cleanup sequence below is
also complete, with no new download requested.

The [cancellation report](hello-target-a7f56d8-combined-cancel.json) now confirms
that the first assertion after restart was cancelled with `0x80090036`
(`NTE_USER_CANCELLED`), after reopening/binding passed. No successful unwrap is
reported. `ready-to-resume` was the expected retained test state. A successful
retry is not claimed; the separate deletion measurement follows below.

The [cleanup report](hello-target-a7f56d8-combined-cleanup.json) now passes all
four stages, including deletion of both native test objects and the journal.
Outcome/state is `combined-cleaned` / `no-test`. The report correctly retains
`processScope: same-process` for cleanup; it is not another unlock measurement.

**The current target procedure is complete.** No new test, restart, manual key
deletion, repeated report or installer is requested. Next implementation and
acceptance work concerns synthetic account/machine-copy and key-loss/password
fallback coverage, remaining authorization negatives and production integration.

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

[General CI 37764316873](https://github.com/kurasis/passkeylocal/actions/runs/37764316873) and Windows CI passed all 11 exact-head checks. Windows: 127 routine native tests, including nine portable combined protocol/persistence cases and an exact RP/user cleanup-selector test; independent MSVC/header ABI and 5 GiB resource tests executed separately. Native storage/Python parity, bidirectional file recovery, actual NSIS install, packaged UI/IPC/lock and source correlation passed. Hosted hardware observations are not owner-target evidence. The installed combined status/resume/cleanup commands reported no saved test and kept enrollment/unlock disabled.

TypeScript: 161 tests; desktop UI: 31 scenarios; production PWA: eight scenarios. Python OS/version recovery matrix, offline kit and fresh recovery fixtures passed. Locally, ten combined tests passed (including the Unix link control), alongside Windows GNU Clippy, both frontends and target isolation. The final hosted Linux native suite passed 99 routine tests; its explicit 5 GiB resource gate ran separately.

10,000-file restore: 108.248 seconds. Hosted 5 GiB primitive: 92.980 seconds; sampled peak working set 10,592,256 bytes. These are hosted observations, not target-device guarantees.

Physical combined restart and fresh prompting on its successful path are owner-confirmed above. First-assertion cancellation after restart and cleanup of that cancelled test are also owner-observed. Other cancellation points, silent-access negatives, account/machine copies, key-loss fallback and production lifecycle acceptance remain pending. The [Cloudflare ZIP](../cloudflare-pages/) is a separate web build. [Release evidence](../../docs/RELEASE_EVIDENCE.md) distinguishes completed software checks from owner hardware observations and real-vault enrollment.
