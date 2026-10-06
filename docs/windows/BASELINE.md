# Repository baseline and integration decisions

Discovery started on 2026-10-06 at commit `be52275e23a5c8bc0eabbf62198f4ee0c4f75d4d`; `main` was clean. `CLAUDE.md` applies. The uploaded handoff README was read first, followed by all four linked documents. Their original English requirements are retained here; they describe required delivery, not evidence of completed tests.

| Area | Actual repository |
| --- | --- |
| Frontend | npm workspaces, one React 19.3 / TypeScript 7 / Vite 8.3 frontend in `apps/pwa`; no router or PWA framework plugin. Hand-written SW plugin. Web output `apps/pwa/dist`. |
| Engine | `packages/vault-adapter`: kdbxweb 2.1.1, hash-wasm 4.12, xmldom 0.9.12; KDBX 4.1, AES-256-CBC/HMAC, Argon2id, no compression, 16 MiB limit. Exact Unicode password encoding, no normalization/trimming. Stronger supported reader parameters preserved. |
| Persistence | `packages/vault-core/src/storage.ts`: ciphertext IndexedDB, generation CAS, immutable blobs, readback SHA-256, five rollback copies / 80 MiB; verified candidate produced outside transaction. Password rotation removes older local epochs and reports failures. |
| Recovery | Independent Python 3.12/3.13 utility under `tools/vault-recovery`, pinned/hash-checked requirements, portable KDBX plus full recovery JSON including history. Existing Windows offline-kit workflow retained. |
| UI | One English/Russian frontend, colorful/light/dark/system themes, dedicated crypto worker destroyed on lock. Owner policy: app switching redacts but does not immediately lock; hidden time counts as inactivity. Default 2 minutes; selectable 30s, 1/2/5/10/30/60 minutes and 6/12/24 hours (owner extension, 2026-10-06). Clipboard uses explicit browser write, no destructive timed clearing. |
| Biometrics | Browser WebAuthn PRF passkeys already present. No existing native Windows host/Hello provider. No Kensington, Windows host or TPM is attached to this Linux workspace. No per-key hardware evidence. |
| Delivery | GitHub CI, Cloudflare Pages `_headers`, manual versioned ZIPs in `deploy/cloudflare-pages`. No desktop tags/releases/signing certificate found or supplied. No web deployment secrets changed. Latest baseline CI was cancelled before test steps; no test-failure log. |
| Tests before changes | Typecheck, adapter 96 / core 36 / PWA 26 tests and production web build passed locally. Python: 76 passed, 12 skipped (Windows ACL / unavailable KeePassXC). Existing synthetic `full.kdbx` corpus retains UUIDs, nested groups, Unicode, tags, custom data, recycle bin, history and expected full logical JSON. Physical iPhone/Safari remains unverified. |

Integration adds `apps/desktop`, referencing the same `apps/pwa/src` through explicit Vite aliases. It does not copy screens, replace npm, move existing packages, change KDBX or make Rust necessary for web builds. `VaultStore` is the public shape of the existing storage class; browser behavior remains IndexedDB. A worker transport forwards ciphertext and opaque metadata to fixed native operations. No passwords are sent through storage IPC.

Stable Windows identity: `com.passkeylocal.vault`; managed data resolves via Tauri's LocalAppData API to `%LOCALAPPDATA%\com.passkeylocal.vault`. This is independent of the browser origin. Import/export transfers copies; there is no automatic sync or browser-profile scraping. Native secrets remain in the same JavaScript/WASM crypto worker while unlocked. The Windows Hello provider remains ineligible until the hardware proof obligations are satisfied.
