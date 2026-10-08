# Windows desktop test installers

Latest: **local TPM key-binding measurement** — [download installer artifact](https://github.com/kurasis/passkeylocal/actions/runs/37755898908/artifacts/11540507240), [successful Windows run 37755898908](https://github.com/kurasis/passkeylocal/actions/runs/37755898908). [PR #25](https://github.com/kurasis/passkeylocal/pull/25) merged automatically as `c5e3481a118fd9c50cb2adcb3cc741cacba1ea2a`. Code head `2f51e3d4e60eea9a34e0066d85a2a39dc9d29f89`; installed/tested source `bbead0731ae5fc1bbb4171e861306c70b5257369`. The merged application tree equals the tested PR tree.

Open the artifact while signed in to GitHub, extract it and run `PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe`. The installer is unsigned and experimental; Microsoft's signed x64 WebView2 offline installer is included. Node/Python are not required. Artifact retention is 30 days; after expiry run the [Windows workflow](https://github.com/kurasis/passkeylocal/actions/workflows/windows.yml) on main.

Installer: 217,915,248 bytes; SHA-256 `0a152600b527188e729618d5f1ec1eec24b06e2c4cc965d6135bd8d1a4cc8868`, independently matched to original metadata and checksum sidecar. Original evidence: [build](build-bbead07.json), [installed-app smoke](smoke-bbead07.json), [5 GiB resource measurement](file-safe-resource-bbead07.json), [signed WebView2](webview2-download-bbead07.json), [Russian settings](windows-settings-bbead07.png), [locked window](windows-locked-bbead07.png). The unversioned sidecar matches this installer.

## One new target measurement

Fully close the old app, install this build, unlock with the master password and open Settings → Windows Hello → **Check key binding to TPM** / **Проверить привязку ключа к TPM**. This test requires no fingerprint. Copy that technical JSON; `sourceCommit` must be `bbead0731ae5fc1bbb4171e861306c70b5257369`. Do not repeat the completed PRF, direct-attestation or private-export actions. Do not reset TPM, Hello or security policy.

The [new native route](../../docs/windows/HELLO_LOCAL_TPM_BINDING.md) follows Microsoft's provider/TBS handle documentation. It reads only the app-created key with fixed TPM2_ReadPublic, matches its public material, SHA-256 Name and duplication restrictions against CNG/PCP, repeats after reopening and exercises OAEP/tamper controls. It always deletes its synthetic key. The provider owns borrowed handles. No system keys, policy changes, arbitrary TPM-command IPC or real vault material are involved.

`local-read-public-observed` means a local measurement under trusted Windows/Platform KSP/TBS assumptions; it is not a signed attestation, remote authority, PRF storage proof or completed Hello unlock. All four release gates remain open. The target run is pending; cloud tests cannot prove this owner's hardware. Master-password unlock and independent recovery remain available.

## Completed owner baseline

- [PRF 72a0df6](hello-target-72a0df6-prf.json): all ten stages passed on Win11 Pro 25H2 / build26200, API9, Kensington VeriMark Desktop. The owner confirmed a fresh fingerprint at creation and each assertion.
- [TPM inner c83ce3f](hello-target-c83ce3f-tpm-inner.json): OAEP, same-process reopening, negative controls and cleanup passed. Three raw private exports returned NTE_BAD_TYPE (unsupported format), not explicit denial. The new action does not reclassify or repeat those results.
- [Direct attestation bdb2a03](hello-target-bdb2a03-direct-attestation.json): all six stages passed, but Windows returned `none`; no certificate/signature was supplied. Its precise OS cause remains unknown. The new route addresses the application's dependency on that absent certificate.

## Validation

[General CI 37755898901](https://github.com/kurasis/passkeylocal/actions/runs/37755898901) and Windows CI passed all 11 checks. Windows: 117 routine native tests, including six bounded ReadPublic parser controls and an actual Software KSP rejection; independent MSVC/header ABI and 5 GiB tests executed separately; storage/Python parity, bidirectional file recovery, installer and packaged UI/IPC/lock checks passed. The installed application returned eleven source-correlated diagnostic reports; hosted Hello/TPM preflight blocks crypto creation. No hardware pass is inferred.

GitHub could not supply an ARM64 runner for the first macOS job; it executed no test steps and a failed-jobs-only retry stayed queued. The workflow now runs the identical recovery tests on supported macOS 15 Intel. It reported 91 passed and 12 explicitly skipped; this does not claim new ARM64 coverage.

TypeScript: 161 tests; desktop UI: 28 scenarios; production PWA: eight scenarios. Python OS/version recovery matrix, offline kit and fresh recovery fixtures passed. Local Linux: 89 routine native tests / one resource test reserved for CI; typechecks, Linux/Windows GNU Clippy, both frontends and target isolation passed. The initial new UI assertion was corrected to open its collapsed report; all 28 cases passed together in hosted CI.

10,000-file restore: 87.543 seconds. Hosted 5 GiB primitive: 42.634 seconds; sampled peak working set 10,596,352 bytes. These hosted performance observations are not target-device guarantees. All original metadata retains the tested source.

The [Cloudflare ZIP](../cloudflare-pages/) is a separate web build, not Windows Hello deployment. [Release evidence](../../docs/RELEASE_EVIDENCE.md) and [Hello design](../../docs/windows/HELLO_SECURITY_DESIGN.md) distinguish completed software checks from pending hardware, composition, fresh authorization/process/copy and enrollment work.
