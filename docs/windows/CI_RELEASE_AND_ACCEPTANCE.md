# CI, Releases and Acceptance

This document is part of the Windows extension specification. Adapt names to the existing repository; preserve its web deployment contract.

Version 1.1.0 also requires every acceptance gate in [WINDOWS_HELLO_KENSINGTON.md](WINDOWS_HELLO_KENSINGTON.md). Hosted-runner mocks cannot establish fingerprint/TPM acceptance. A desktop build may remain useful with master-password unlocking when Hello is unavailable, but the requested Kensington feature is not complete until its hardware gates pass.

## 1. Windows distribution

### Supported first release

- Windows 11 x64, standard user, one per-user NSIS installer (`.exe`). Add other architectures or installer formats only as separately agreed scope.
- Bundle production frontend assets. No development server, website connection, Rust, Node.js or Python installation is required to run the desktop app.
- Use a stable application identifier and stable user-data directory. Installer version and internal vault format/schema version are separate concepts.
- Upgrade in place without deleting, moving or silently migrating existing vaults and backups. If an incompatible future migration becomes necessary, stop and propose a reversible procedure.
- Uninstall preserves vault data and external backups by default. Any optional data removal needs a separate explicit confirmation describing the exact owned files, without promising secure erasure. Never recursively remove a selected user backup directory.

### WebView2 and offline operation

Use the Evergreen WebView2 Runtime with a documented installer strategy. Detect an existing compatible runtime. For an online installation, a supported bootstrapper may download a missing runtime; make that network dependency explicit. An ordinary online bootstrapper is not a fully offline installer. [S3, S5]

Provide a tested offline installation path for a clean machine without WebView2, using Tauri's supported bundled offline-runtime option or an accompanying official architecture-matched standalone installer. Do not rely on the developer machine already having Edge/WebView2. Include necessary licensing/distribution notices. After prerequisites are installed, launching, unlocking, editing, saving, exporting and restoring must work without network access.

Evergreen's update mechanism is not proof that every installation is currently patched: policies, offline use and service failures can prevent updates. Document runtime servicing for offline machines. A fixed runtime is not the default; using one transfers runtime security-update responsibility to this project and requires an explicit maintenance plan.

### Signing and application updates

Initial scope is manual application updates: obtain the versioned installer from the authorized project release location, close the application and upgrade. Do not silently add an automatic updater or a server solely for updates.

Authenticode signing is recommended for distributed Windows installers. For private use without an available certificate, an explicitly labeled unsigned build is acceptable for this increment; document its trust limitations. Do not invent signing credentials, claim the binary is signed, or instruct users to disable Windows security protections. Verify publisher/signature where present and publish SHA-256 checksums; a checksum hosted beside a binary does not independently authenticate its publisher. [S11]

If automatic updates are requested later, use a reviewed signed-update flow. Tauri updater signatures are distinct from Windows Authenticode signatures. Keep private signing keys outside Git, require signature verification, define a release channel and test failure/recovery behavior before enabling it. Tauri's updater requires signed update artifacts. [S12]

## 2. One GitHub repository, independent delivery

### Existing web pipeline

Keep the established web build command, deploy output, hosting configuration, public base path, environment variable contract and triggers working. Do not replace the web deploy job with a Tauri build. Web contributors must still be able to build/test the PWA without a Windows machine or Rust toolchain.

Inspect current release conventions before choosing new tag names. Do not rename existing tags, overwrite published releases or change web deployment secrets. Update shared code through the repository's normal review workflow.

### Desktop checks

Add a Windows-runner workflow, or an isolated matrix target consistent with the existing CI. It must install the pinned compatible JS/Rust/Tauri tools and prerequisites, use lockfiles, and perform:

1. Existing frontend type checks, lint and applicable tests.
2. Rust formatting, lint and unit/integration tests, with repository-appropriate treatment of existing warnings.
3. Both frontend target builds, including checks that their output directories stay separate.
4. Shared synthetic vault fixtures and Python recovery interoperability tests.
5. Native persistence, conflict, backup and lifecycle integration tests on Windows.
6. Packaged application smoke tests and installer generation.

Add automated Windows Hello state-machine, envelope tampering, IPC authorization and recovery tests using a test-only provider. It must be impossible to activate this fake provider in a release build through an environment variable, config file or command-line switch. Real Hello/TPM/Kensington tests run separately on a controlled physical Windows machine with synthetic vaults. Never run untrusted PR jobs on an owner's personal machine or one containing enrolled production credentials.

Use Tauri's supported WebDriver testing route where suitable. On Windows, arrange compatible WebView2/driver versions and record them. Browser-only Playwright tests may cover shared UI, but do not count them as evidence that Tauri IPC, native dialogs, Windows ACLs or installed-app behavior work. Combine native integration tests, fault injection and documented manual tests where automation cannot cover a surface. [S10]

Changes to shared UI/core/fixtures, relevant dependency locks or platform contracts must test both web and desktop. Desktop-only native changes must test desktop plus relevant interop; web-only changes must still follow existing web checks. Be conservative with path filters: a shared change must not skip an affected target. Do not accidentally prevent required status checks from completing through inappropriate workflow-level filters.

### Release isolation

Use the existing conventions if they already distinguish targets. Otherwise a desktop tag such as `desktop-v1.0.0` and a separate manually triggered release workflow are acceptable. Tag naming is a proposal, not permission to publish.

Desktop releases must not become an unintended default for web consumers using GitHub's latest-release endpoint. Configure latest-release behavior/channel lookup explicitly; do not assume a tag prefix alone creates a separate release channel. Use deterministic target-specific artifact names, for example `VaultName-Windows-x64-1.0.0-setup.exe`, without changing the actual product name arbitrarily.

Record app version, source commit, frontend/native dependency locks, target architecture and checksums in release metadata. Keep a release draft until authorized publication. A successful CI upload is not authorization to deploy the PWA or publish a production desktop release. Include source changes, test evidence and any remaining limitations in the handoff.

### CI supply-chain and secret handling

- Use minimum GitHub token permissions, narrowed further per job. Only an authorized release job needs write access to releases.
- Pin third-party actions to reviewed full commit SHAs and maintain updates deliberately. Validate any action inputs derived from untrusted content. [S8, S9]
- Never expose signing keys, release credentials or production secrets to untrusted pull-request code. Do not use `pull_request_target` to check out and execute untrusted PR code with privileged credentials.
- Avoid letting privileged release jobs consume untrusted executable caches/artifacts. Protect release environments and validate the source revision.
- Use only synthetic credentials and fixtures. Never upload real vaults, user directories, full environment dumps or secret-bearing crash logs.
- If credentials, Windows runners or devices are unavailable, report the affected steps as blocked/not run; do not simulate success. Do not add replacement accounts or integrations without authorization.

## 3. Required acceptance matrix

Every result must identify the source commit, environment/tool versions, fixture and evidence. Use PASS, FAIL, NOT RUN or BLOCKED; a specification assertion is not a passed test.

| ID | Scenario | Required observable result |
| --- | --- | --- |
| WEB-01 | Build/test existing web target before and after integration | Baseline differences recorded; no new unexplained failures; original commands still work without Rust. |
| WEB-02 | Existing deployment, installability, service-worker update and offline use | Web deployment path and PWA behavior remain intact; desktop configuration does not leak into web assets. |
| WEB-03 | Shared-code changes on actual iPhone/Safari PWA | Existing unlock, edit, search, history, export/import and lock behavior still work; record device/browser evidence or mark not run. |
| BUILD-01 | Build both targets consecutively and concurrently in supported configurations | Independent outputs; no destructive output cleanup, port collision or recursive build hooks. |
| DESK-01 | Install and launch as a standard Windows user | Correct product identity/data location; no unnecessary elevation or developer runtimes. |
| DESK-02 | Clean offline machine with no preinstalled WebView2 | Documented offline prerequisites/install path works; the online-only installer is not mislabeled offline. |
| DESK-03 | Disable network after installation | Packaged UI, workers/WASM, unlock, search, save, export and restore work; no remote assets are required. |
| DESK-04 | Packaged asset origin and routing | Refresh/restart routes, WASM and cryptographic APIs work under the real host, not only the dev server. |
| DESK-05 | Desktop profile/service worker | No desktop SW registration or stale web updates; web SW remains enabled and tested separately. |
| DATA-01 | Released web export → Windows edit/export → released web reopen | All supported data, UUIDs, groups, custom fields, tags and full retained history survive. |
| DATA-02 | Windows export → independent Python verification and full recovery | Same semantic data and history are recovered with no Tauri, browser profile, sidecar or running app. |
| DATA-03 | Wrong password, truncation, bit flips and unsupported format/features | Clear failure; no partial trusted data, destructive replacement, empty-vault recreation or false authentication success. |
| DATA-04 | Unicode passwords/fields and allowed parameter extremes | Matches existing encoding/KDF behavior; bounded failures for excessive resource parameters before expensive processing. |
| DATA-05 | Change master password, restore older backup | New vault opens under the new password; old backups require their original password; UI explains the distinction. |
| SAVE-01 | Successful edit/save/restart | Acknowledged ciphertext revision reopens; dirty state clears only after verified native commit. |
| SAVE-02 | Kill process before/during/after each write/flush/replace/acknowledge stage | Current or prior recoverable revision remains; ambiguous states are reconciled; no silent empty database. |
| SAVE-03 | Disk full, access denied, destination changed, replacement partial failure | Honest error, recoverable files retained, unsaved state visible; no delete-current-then-rename fallback. |
| SAVE-04 | Second launch and external modification during an edit | Existing instance is focused without unlocking; revision mismatch stops overwrite; no silent merge. |
| SAVE-05 | Old revision replaced while an immutable backup job is queued | Backup contains its recorded revision or reports unavailable/coalesced status; never labels newer bytes as an older backup. |
| PATH-01 | Traversal, ADS/device paths, reparse-point changes and stale picker handles | Native commands reject unauthorized destinations and prevent access outside granted scope. |
| PATH-02 | Managed current/temp/rollback file permissions | Windows ACLs follow intended per-user access; temp/backup files are not more exposed than current data. |
| BACKUP-01 | Successful external backup, then independent open | Byte equality and cryptographic recovery are reported distinctly; independent recovery succeeds. |
| BACKUP-02 | Missing removable drive, read-only folder, full disk or offline cloud placeholder | Local save succeeds independently; pending/failed status is visible; bounded retry works without stored password. |
| BACKUP-03 | Retention with unrelated files, renamed manual exports and misleading timestamps | Only authorized tracked backups are pruned after a good new copy; unrelated files and the last good copy survive. |
| BACKUP-04 | Restore invalid file, then restore valid file | Invalid source cannot replace current data; valid replacement requires authentication/confirmation and preserves recoverability. |
| LOCK-01 | Manual lock, timeout, session lock, user switch and suspend/resume | Secrets are redacted and session invalidated; resuming/focusing does not flash prior unlocked content. |
| LOCK-02 | Lock during native dialog, save, import, restore or worker result | Stale results cannot unlock/repopulate secret UI; authorized ciphertext saves may finish safely. |
| UX-01 | Normal close while dirty vs forced shutdown | Save/Discard/Cancel works on normal close; last committed data survives forced termination without final-save promises. |
| UX-02 | Keyboard, resize, high DPI, accessibility and clipboard | Existing design remains usable; no secrets in locked titles/notifications; clipboard rules do not destroy unrelated later copies. |
| SEC-01 | Unauthorized native/plugin commands, stale session and unauthorized window/origin | Calls fail; app-command permission coverage is tested, not inferred from plugin configuration alone. |
| SEC-02 | Stored HTML/script-like fields, navigation attempts and malicious external URLs | Rendered as inert data; no privileged navigation or arbitrary shell/network execution. |
| SEC-03 | Logs, errors, traces, packaged content and CI artifacts inspection | No real data, keys, passwords, decoded vaults or unexpected telemetry; permissions and CSP documented. |
| UPGRADE-01 | Upgrade and reinstall using the same app identity | Existing vault/settings and backups remain usable; no unintended fresh data directory. |
| UPGRADE-02 | Uninstall with external backup folder configured | Default uninstall leaves user data/backups intact and does not delete unrelated folder content. |
| RELEASE-01 | Desktop workflow/tag/artifact alongside normal web release | Correct target artifact; no overwritten web deploy output, unintended web deployment or latest-release collision. |
| HELLO-00 | H-01 through H-16 with the [owner procedure amendment](HELLO_OWNER_ACCEPTANCE.md) | Record actual sensor/TPM evidence; distinguish unsupported, failed, unrun and owner-excluded cases. Same-PC/other-account manual testing is excluded and unverified; no mocked hardware success. |

Fault injection must cover explicit Windows replacement error paths, not just generic exceptions in a mocked browser filesystem. Power-loss durability claims must stay within what the implementation and environment can establish.

## 4. Python recovery continuity

Keep the existing independent utility and its CLI stable where practical. It must work with the same portable encrypted files, without Windows-account-bound secrets or a running PWA/desktop process. It remains a recovery tool, not an always-running companion service.

Use existing locked dependencies and supported Python versions. If the utility is absent or incomplete, record the gap, then implement/document offline verify and full recovery export using a maintained compatible library; do not write a custom KDBX parser or cipher. Prepare an offline dependency-installation path for a declared recovery environment if one is not already provided. Do not claim a wheel bundle works on all Python versions and operating systems.

Master passwords must not be passed in command-line arguments or written to logs. Recovery output is sensitive plaintext: require an explicit output destination, avoid overwriting existing files without confirmation, restrict permissions where supported, and document deletion limitations. Terminal verification should not dump credentials by default.

Interop tests must examine entries, groups, custom fields and historical values, not merely return a successful open. Establish the existing recovery contract before adding new export formats. Fixture secrets may be checked into tests only when unmistakably synthetic and never reused elsewhere.

## 5. Completion report and handoff

The implementing agent delivers:

1. A concise inventory of baseline findings and integration decisions.
2. The additive source changes in the same repository, with no duplicate maintained frontend.
3. Web and desktop build/test instructions and Windows development prerequisites.
4. The Windows installer, SHA-256 checksum and exact signing status, produced from the reported commit.
5. Offline WebView2 installation and runtime maintenance instructions.
6. Updated backup/restore/migration instructions and independent Python recovery evidence.
7. A completed acceptance report with passed, failed, blocked and unrun items, plus security/compatibility limitations.
8. A summary of workflow/release changes and confirmation that no production publication occurred without authorization.
9. Windows Hello provider decision, Kensington setup/troubleshooting guide, exact tested hardware/software combination, key-lifecycle tests and independent recovery results after deleting all Hello metadata.

A Linux build, browser mock or generated installer alone does not establish Windows acceptance. Do not claim complete delivery until required Windows and interoperability tests pass; explicitly identify any physical-device or external-signing checks awaiting the owner. No audit-level security claim may be inferred from passing this checklist.
