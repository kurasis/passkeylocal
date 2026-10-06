# Encrypted File Safe — Additive Feature Handoff

Version: 1.0.0  
Prepared: 2026-10-06  
Language: English  
Status: specification for implementation; no application or hardware tests performed

## Instruction to the development agent

Add an encrypted file safe for **storage and read-only viewing** to the existing Windows password-vault application. Keep all work in its existing GitHub repository alongside the web/PWA version. Reuse the established Tauri 2, Rust and frontend architecture, design system, lock handling, backup UX and native Windows Hello integration. Inspect the actual repository before choosing file paths or dependencies. Do not regenerate the app, move it to another repository or rewrite its password-vault engine.

The owner selected Kensington VeriMark Desktop Fingerprint Key for Windows Hello. This feature must support independent opt-in Hello enrollment for the file safe while preserving master-password recovery and an independent Python recovery tool.

The requested product is a file safe, not a virtual desktop, mounted drive or Office editing environment. V1 stores arbitrary ordinary files and previews only supported PDF, raster image and plain-text documents. The preview process is isolated from the vault service and the password database. A separate ordinary process or a second Tauri window is not by itself the required security boundary.

## Read in order

1. [PRODUCT_AND_INTEGRATION.md](PRODUCT_AND_INTEGRATION.md) — scope, UX, existing-repository integration and lock/Hello behavior.
2. [ENCRYPTION_AND_STORAGE.md](ENCRYPTION_AND_STORAGE.md) — key hierarchy, portable v1 format, atomic commits, history and corruption handling.
3. [ISOLATED_VIEWER.md](ISOLATED_VIEWER.md) — Windows sandbox, parser restrictions, broker protocol and plaintext handling.
4. [BACKUP_AND_PYTHON_RECOVERY.md](BACKUP_AND_PYTHON_RECOVERY.md) — consistent snapshots, independent recovery and safe extraction.
5. [ACCEPTANCE_AND_DELIVERY.md](ACCEPTANCE_AND_DELIVERY.md) — test matrix, implementation order and completion evidence.
6. [SOURCES_AND_DECISIONS.md](SOURCES_AND_DECISIONS.md) — checked primary documentation and boundaries of this review.

## Relationship to previous work

This is a separate feature specification. It does not replace the existing Windows/PWA handoff or its Kensington/Windows Hello requirements. Relevant requirements are restated here so this archive can be handed to a developer independently. Preserve stricter applicable repository requirements. The actual source repository was not provided to the author of this document; source inspection and a baseline report are mandatory implementation steps.

The password database retains its current format and Python recovery behavior. The file safe has a separate portable encrypted format, random root key, password enrollment, lock state and storage directory. Opening one does not implicitly unlock the other. File-safe payloads and keys must not be embedded in the password KDBX database.

MUST/MUST NOT are release gates. Defaults are concrete starting requirements, not statements about features already implemented. If a required isolation or crypto property cannot be established, report that specific blocker rather than weakening it silently. Continue other safe implementation work. Do not claim completion using mocks in place of physical Windows/TPM/reader evidence.

## Required outcome

One existing app gains a usable file safe with encrypted names/content/history, independent locking, supported read-only previews, explicit plaintext export, verified encrypted backups and standalone Python recovery. The existing password manager and deployed PWA continue to work. Deliver implementation, tests, installer, recovery utility, format documentation and honest verification results. This archive contains requirements only, not the implementation.
