# File-safe integration baseline

Baseline: `670e41fda3935258dde8dc4f095e666370ad7bfb` (`main`, 2026-10-06). One repository; existing source changes were absent before this branch.

- React/TypeScript shared UI: `apps/pwa/src/ui`, English/Russian, colorful/light/dark/system palettes. PWA output `apps/pwa/dist`; native output `apps/desktop/dist-desktop`. Cloudflare archives: `deploy/cloudflare-pages/`.
- Tauri 2.12.1 / Rust 1.90 Windows service: `apps/desktop/src-tauri`. Password crypto remains the existing JavaScript KDBX worker; native storage receives ciphertext through `worker-storage.ts`. No existing bulk encrypted-file store or preview worker.
- Generic mechanics available in `filesystem.rs`: protected Windows DACL with readback, reparse-point rejection, directory handle pinning, exclusive creation, ReplaceFileW with readback. The file safe adds streaming handles instead of using the password vault's bounded whole-file byte IPC.
- Main-window-only capabilities and generated custom-command permissions are defined by `capabilities/main.json` and `build.rs`. Native dialog authorization remains in Rust. No renderer-supplied filesystem paths.
- Password lock lifecycle: `host.rs` WTS/power notifications, monotonic native inactivity and `App.tsx` worker termination/redaction. File safe needs a separate session/epoch and native key ownership; global OS lock affects both.
- Windows Hello provider in `hello.rs` fails closed: no proved non-exportable TPM-bound per-unwrap authorization. Reusing its unavailable state is safe; enabling file-safe Hello is BLOCKED by physical provider/Kensington evidence.
- No proved AppContainer/LPAC parser isolation or disk-write denial. Document preview remains BLOCKED rather than adding a parser to the main WebView/service. Storage/export/recovery development can proceed independently.
- Existing Python KDBX recovery remains `tools/vault-recovery/src/vault_recovery`; the new file format uses a separate module/CLI in that package.
- Local environment: Linux x64, Node 24/npm 11, Python 3.12, Rust 1.90, Chromium `/usr/bin/chromium`. Existing Linux native tests: 14 passed. Original frontend tests/builds and native Windows cross-check are recorded in the release ledger as executed.

No physical Kensington/TPM, standard-user Windows AppContainer or parser proof is available in this environment. Hosted Windows CI is suitable for native file/ACL/installer and interoperability evidence, not those physical gates. No production data is used.
