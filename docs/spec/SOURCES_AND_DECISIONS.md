# Sources, Decisions and Verification Boundaries

Reviewed: 2026-10-04. The links below are primary specifications, platform documentation or project-maintainer documentation. No software was built or cryptographically tested while preparing this design package. The development agent must verify pinned versions and produce the runtime evidence listed in the acceptance tests.

## Primary sources

| ID | Primary source | Relevance |
| --- | --- | --- |
| S1 | [KeePass KDBX format specification](https://keepass.info/help/kb/kdbx.html) | Canonical container, KDF units, authenticated header/block layout and public-versus-encrypted metadata. |
| S2 | [KeePass security documentation](https://keepass.info/help/base/security.html) | Existing cipher/authentication design and password-derived protection. |
| S3 | [KDBX 4.1 notes](https://keepass.info/help/kb/kdbx_4.1.html) and [KDBX 4 notes](https://keepass.info/help/kb/kdbx_4.html) | Version distinctions; do not confuse every KDBX file with the exact chosen profile. |
| S4 | [kdbxweb repository and API documentation](https://github.com/keeweb/kdbxweb) | Browser/Node format integration; external Argon2 hook and entry history APIs. |
| S5 | [hash-wasm project](https://github.com/Daninet/hash-wasm) | Candidate bundled WASM Argon2 implementation; API uses memory in KiB and can return raw bytes. |
| S6 | [PyKeePass project](https://github.com/libkeepass/pykeepass) | Independent Python format reader and data/history access; review exact pinned behavior. |
| S7 | [RFC 9106: Argon2](https://www.rfc-editor.org/rfc/rfc9106.html) | Password-based KDF design and published test vectors. |
| S8 | [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) | IndexedDB/storage quotas, eviction and heuristic persistent-storage requests. |
| S9 | [WebKit tracking prevention](https://webkit.org/tracking-prevention/) | Home Screen web apps have specific storage treatment; do not claim a universal seven-day deletion rule. |
| S10 | [Web Cryptography specification](https://www.w3.org/TR/webcrypto/) | Crypto APIs, same-origin trust and limits on memory/key-storage guarantees. The linked Level 2 publication is a working draft; the selected design relies on established operations. |
| S11 | [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) | Browser-storage/XSS risks; IndexedDB is not protection from executing same-origin code. |
| S12 | [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) | Authenticated protection, random values, key handling and using established designs. |
| S13 | [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) | Safe rendering and injection defenses. |
| S14 | [W3C Web Share](https://www.w3.org/TR/web-share/) and [WebKit Web Share notes](https://webkit.org/blog/13708/allowing-web-share-on-third-party-sites/) | User-driven OS sharing; implementation behavior must be tested, not treated as proof of a durable saved file. |
| S15 | [W3C Service Workers](https://www.w3.org/TR/service-workers/) | Offline asset/update lifecycle; cached PWA code does not eliminate origin trust. |
| S16 | [Apple Password AutoFill](https://developer.apple.com/documentation/security/password-autofill) | Native credential-provider integration is a separate app-extension capability, outside this PWA scope. |

## Decision record

### D1 — Use KDBX, not a proprietary AES-GCM archive

The recovery requirement is stronger than “decrypt a blob with a Python script.” It calls for a documented, portable database readable by an independent implementation, with native representation of history. KDBX is selected for that reason. Earlier high-level AES-GCM discussion was an example of browser encryption, not a requirement to invent a new format. The selected cipher/authentication suite must remain the one specified by KDBX.

This reduces custom protocol work but does not certify the chosen libraries. Their integration, parsers, dependency health and compatibility remain release gates. The browser and Python sides should not share the same crypto implementation disguised in different command wrappers.

### D2 — Restrict v1 to a narrow, recoverable profile

Attachments, compression, key files and uncommon algorithms add compatibility and resource-abuse complexity that is not needed for the user's login/password use case. Writer and reader limits are intentional. An unsupported file is preserved and rejected clearly; compatibility must never be simulated by silently discarding content.

The files remain standard KDBX. An independent compatible application can open app-created files, but an externally edited file that introduces unsupported features need not be accepted for further editing in v1. State this distinction in the user documentation.

### D3 — Manual external export with verification

PWA storage persistence and iOS background execution are insufficient foundations for an unconditional automatic-backup promise. The user explicitly prioritizes backups, so the product makes export, re-open verification and separate-device copies first-class workflows. Local snapshots address a different failure class.

### D4 — Master password first; no biometric shortcut in v1

Avoid dependence on device-bound keys for recovery. A later Face ID/passkey feature would need a separately reviewed key-wrapping and recovery design, feature detection, real-device tests and a clear explanation of possible credential synchronization. A biometric-looking login screen by itself does not protect encrypted data.

### D5 — Offline recovery is separately packaged

The Python utility is read-only with respect to source vaults and performs no network access. Installation dependencies must also be available offline for a true disappearance-of-the-service scenario. A portable encrypted backup without a usable recovery environment is an incomplete emergency plan.

### D6 — Honest limits rather than reassuring labels

A compromised hosting origin can eventually deliver code that steals secrets at unlock. A copied vault can be attacked offline. Browser storage can be cleared. Old valid files can be replayed. No local-only design can recover data when all copies and the required password are lost. These limitations shape implementation and user-facing wording, without preventing the requested PWA experiment.

## What remains to be established during development

- Exact dependency versions and security advisories; no claim that the linked default branches are immutable or audited.
- Correct browser/Python KDBX 4.1 field/history preservation with the chosen profile.
- WASM/XML integration under strict CSP, with resource limits before expensive work.
- Physical iPhone performance, storage failure behavior, share/download, background lock and offline cold-start behavior.
- Offline Windows recovery-kit installation and cross-platform output permissions.
- The actual static host's headers, update behavior and security configuration.

These are concrete implementation gates, not unresolved product choices that should be pushed back to the user before beginning work.
