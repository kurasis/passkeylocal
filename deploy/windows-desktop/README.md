# Windows desktop test installers

Latest: **Hello + TPM encrypted test-file transfer** — [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37783742741/artifacts/11554127672), [successful Windows run 37783742741](https://github.com/kurasis/passkeylocal/actions/runs/37783742741). [PR #28](https://github.com/kurasis/passkeylocal/pull/28) merged as `241e2b515914089754a1815219eec74b4ad85a36`. Code head `ae6143d520964f5a6e6b3a073fa1c3c705134ad6`; installed/tested source `cdcc9542b891b808824c1ca7ce471a260ef176b5`. The merged application tree equals the tested PR tree.

Open the artifact while signed in to GitHub, extract it and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. This is an unsigned experimental installer; Microsoft's signed x64 WebView2 offline installer is included. Node/Python are not required. Artifact retention is 30 days; after expiry run the [Windows workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) on main.

Installer: 217,970,294 bytes; SHA-256 `b987738eed24eb11aab84d74d1636d44e8be0b78b1ea5edc6884e024c799405b`, matched to original metadata and checksum sidecar. Original evidence: [build](build-cdcc954.json), [installed-app smoke](smoke-cdcc954.json), [5 GiB resource measurement](file-safe-resource-cdcc954.json), [signed WebView2](webview2-download-cdcc954.json), [Russian settings](windows-settings-cdcc954.png), [locked window](windows-locked-cdcc954.png). The unversioned sidecar matches this installer.

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

## Validation

[General CI 37783742796](https://github.com/kurasis/passkeylocal/actions/runs/37783742796) and Windows CI passed all 11 exact-head checks. Windows: 147 routine native tests, including 25 portable combined/copy cases and four Windows context/command cases; independent MSVC/header ABI and 5 GiB resource tests executed separately. TypeScript: 161 tests; desktop UI: 37 scenarios; production PWA: eight scenarios; Linux: 115 routine native tests. Recovery OS/version matrix, offline kit and fresh native/Python parity passed.

Actual NSIS installation, binary equality, packaged UI/IPC/lock and source correlation passed. Fourteen source-matched diagnostic reports preserve false eligibility/enrollment/unlock. The new installed copy-export command reports `no-test` without opening a dialog or creating keys. The destination-check control remains available without Hello. Hosted Windows has no usable Hello/TPM; native-dialog orchestration is unit-tested, while actual cross-computer hardware behavior awaits owner reports.

10,000-file restore: 108.959 seconds. Hosted 5 GiB primitive: 44.633 seconds; sampled peak working set 10,604,544 bytes. These are hosted observations, not target guarantees.

[Release evidence](../../docs/RELEASE_EVIDENCE.md) records the scoped copy result, excluded account test, and outstanding password-fallback, authorization and production integration work. The [Cloudflare ZIP](../cloudflare-pages/) is a separate web build.
