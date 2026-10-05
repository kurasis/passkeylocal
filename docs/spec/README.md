# Local Password Vault PWA — Development Handoff

Specification version: 1.0.0  
Prepared: 2026-10-04  
Document language: English  
Status: design specification, not an implemented or audited product

## Instruction to the development agent

Build a personal, local-first password manager as an installable iPhone PWA, plus a separate Python recovery utility. Prioritize confidentiality, preservation of committed data, independently readable backups, and honest recovery status. Deliver working software and the evidence required by the acceptance tests; do not stop at a visual prototype.

The user explicitly chose a PWA experiment despite its platform limitations. Do not replace it with a native app or require an account, backend, subscription, cloud vault, App Store publication, or Apple Developer membership. A static HTTPS deployment is sufficient. The Python utility is a required deliverable, not an optional follow-up.

This archive contains requirements only. It does not contain a working PWA, recovery utility, or completed security review.

## Read in this order

1. [PRODUCT_AND_ARCHITECTURE.md](PRODUCT_AND_ARCHITECTURE.md): scope, UX, data model, persistence, implementation stages.
2. [SECURITY_AND_FORMAT.md](SECURITY_AND_FORMAT.md): threat model, exact supported vault profile, cryptographic and browser requirements.
3. [BACKUP_AND_PYTHON_RECOVERY.md](BACKUP_AND_PYTHON_RECOVERY.md): backup lifecycle, recovery workflows, Python CLI contract.
4. [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md): release gates and meaningful test cases.
5. [SOURCES_AND_DECISIONS.md](SOURCES_AND_DECISIONS.md): primary references and reasons for the design.

MUST/MUST NOT are release requirements; SHOULD is a recommendation that needs a written reason if changed. Product defaults and limits in this package are engineering decisions, not claims that a platform guarantees them.

## Core decisions

- Store a standard **KDBX 4.1** file as the encrypted database and backup. Avoid a proprietary cryptographic container.
- Use the KDBX authenticated-encryption construction with **AES-256-CBC plus HMAC-SHA-256**, **Argon2id**, and the standard protected-field mechanism. Do not substitute unauthenticated CBC or mix this with an invented AES-GCM wrapper.
- Browser implementation: TypeScript, React, Vite, `kdbxweb`, a bundled Argon2id WASM implementation, IndexedDB, and a deliberately small service worker.
- Python recovery implementation: a separate CLI built on `PyKeePass`, with its own dependency lock and no browser or JavaScript runtime requirement.
- Store credentials, history, custom fields, tags, and product metadata inside the encrypted payload. Persist no plaintext search index.
- External backups are ordinary `.kdbx` files. A local rollback snapshot is not an external backup.
- Complete browser-to-Python compatibility and physical-iPhone backup tests before investing in UI polish.

## Non-negotiable limits on claims

Do not claim protection against a compromised unlocked device, malicious code served by the application's own origin, guaranteed erasure of JavaScript memory, guaranteed browser-storage survival, guaranteed background backups, or recovery without the required master password.

Keep the interface clear about three different states: a revision saved locally, a file offered to an external destination, and a file actually re-opened and verified. A successful share dialog is not proof of a durable backup.

## Expected implementation repository

```text
apps/pwa/                  # UI, worker, persistence, installability
packages/vault-adapter/    # KDBX integration; no custom cryptographic primitives
tools/vault-recovery/     # Python source, CLI, dependencies, offline packaging
tests/interop/            # Synthetic browser/Python/KeePass compatibility corpus
tests/security/           # Tamper, parser, leakage and resource-limit cases
tests/e2e/                # Browser flows and physical-device test instructions
docs/                     # Setup, user recovery guide, threat model, release evidence
```

The implementing agent may adjust directory names. It may not weaken encryption, remove independent recovery, silently omit history from backups, or mark unexecuted tests as passed.
