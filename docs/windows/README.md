# Windows Extension for an Existing Password Vault PWA

Version: 1.1.0  
Prepared: 2026-10-05; updated: 2026-10-06  
Language: English  
Status: implementation specification, not a completed port or security audit

## Task for the development agent

Add a Windows desktop application to the **existing, working password-vault PWA in the same GitHub repository**. Use Tauri 2 and reuse the existing web frontend and vault logic. This is an incremental integration task, not permission to rebuild the product, fork it into another repository, replace its encryption format, or reorganize the entire repository.

The current source repository was not supplied when this specification was written. Inspect it before implementation. Existing source, fixtures, repository instructions and deployed behavior determine the baseline; this package specifies the desired Windows extension and its safety constraints.

Read:

1. [WINDOWS_EXTENSION_SPEC.md](WINDOWS_EXTENSION_SPEC.md) — architecture, repository integration, security, native persistence, backups and Windows behavior.
2. [WINDOWS_HELLO_KENSINGTON.md](WINDOWS_HELLO_KENSINGTON.md) — Kensington VeriMark Desktop, Windows Hello/TPM key protection, setup, recovery and hardware acceptance tests.
3. [CI_RELEASE_AND_ACCEPTANCE.md](CI_RELEASE_AND_ACCEPTANCE.md) — builds, GitHub workflows, release separation and acceptance tests.
4. [SOURCES_AND_REVIEW.md](SOURCES_AND_REVIEW.md) — checked primary documentation, design decisions and verification limits.

## Change in version 1.1.0

The owner selected **Kensington VeriMark Desktop Fingerprint Key**. Windows Hello unlocking is now explicitly in scope, superseding its exclusion in version 1.0.0. Integrate it through a native Rust adapter in the same repository. Keep the vault format, master-password recovery, independent Python tool and web behavior unchanged. If the Windows port already exists, extend it; do not regenerate or overwrite it.

Windows Hello is optional for the end user but a required implementation deliverable. It is an alternative unlock path, not mandatory two-factor protection for exported vaults. Standard Windows Hello may accept the user's PIN or another configured method; this specification does not promise fingerprint-only access or bind authentication to one USB unit. A working Windows Hello dialog alone is not sufficient: protected-key operations and real Kensington hardware tests are release gates.

## Non-negotiable outcomes

- The existing web/PWA version still builds, deploys, installs and opens existing vaults.
- Windows uses bundled local frontend assets, not a window pointed at the live website.
- Shared UI, vault format, search/history rules and test fixtures have one source of truth.
- Windows persists encrypted vault files through a narrow Rust layer and supports verified native backups.
- Windows supports opt-in Windows Hello unlocking tested with Kensington VeriMark Desktop, with verified TPM-backed key protection and master-password fallback.
- Web, Windows and the independent Python recovery tool remain file-compatible.
- Web and Windows build/release pipelines coexist without hijacking one another's outputs, tags or deployment.
- Real credentials, real vaults and signing secrets never enter Git, CI artifacts or test logs.

Deliver implementation, tests, Windows installer, documentation and an honest verification report. No actual application code or working Python tool is included in this specification archive. Preserve and extend the Python utility already in the repository; if it is missing, report that gap and implement the required offline recovery capability in the same repository before claiming complete compatibility.

MUST/MUST NOT are release requirements. Examples of directory and command names are illustrative; adapt them to the inspected project. Do not execute destructive migrations or publish a production release merely because this document describes how they should work.
