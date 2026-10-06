# PassKey Local

A personal, local-first password vault delivered as an installable iPhone PWA,
plus an independent Python recovery tool. The encrypted database and every
backup is a standard **KDBX 4.1** file (AES-256-CBC + HMAC-SHA-256, Argon2id),
so it can be opened without this app: by the bundled Python tool or by a
compatible KeePass reader.

> **Status: experimental, not ready for real secrets.** Gate 0 (format,
> interoperability and parser safety) is implemented and tested in CI; the PWA
> user interface, local persistence and the physical-iPhone gates are not done
> yet. See [docs/RELEASE_EVIDENCE.md](docs/RELEASE_EVIDENCE.md) for the exact
> state of every acceptance gate.

## Experimental Windows file safe

The same Windows application now includes an independently locked encrypted file safe: native streaming import/export, virtual folders, search, versions, recycle bin and complete encrypted backups. Its portable v1 format uses libsodium secretstream; it is separate from the existing KDBX password database. Independent recovery lives in `vault_recovery.file_safe` and can run without Windows/TPM/the app. The PWA remains a password manager.

Preview and file-safe Windows Hello remain unavailable pending their required OS isolation and hardware proofs. This is an unsigned experimental implementation, not full feature acceptance. Start with the [operating guide](docs/file-safe/OPERATING_GUIDE.md), [independent recovery](docs/file-safe/RECOVERY.md), [format](docs/file-safe/FORMAT.md) and [acceptance evidence](docs/file-safe/ACCEPTANCE.md). The original uploaded handoff is preserved in [docs/file-safe/spec/README.md](docs/file-safe/spec/README.md).

## Repository layout

```text
packages/vault-core/      Durability core: atomic IndexedDB saves of encrypted blobs, rollback
                          snapshots, sessions and lock policy, backup receipts, restore
packages/vault-adapter/   KDBX integration (kdbxweb + hash-wasm Argon2id): profile enforcement,
                          bounded preflight, XML guard, data model, history, search, generator
tools/vault-recovery/     Independent Python CLI (PyKeePass): inspect, verify, list, show, export-json
tests/interop/            Synthetic corpus written by the browser adapter and by PyKeePass,
                          with expected logical models; Python and KeePassXC cross-checks
tests/security/           Hostile and unsupported authenticated payloads with expected outcomes
docs/                     Specification, release evidence, dependency record, recovery guide
apps/pwa/                 React PWA: vault worker (KDF, format, IndexedDB), RU/EN UI, service worker,
                          deployment headers, Playwright tests
```

## Development

Requirements: Node.js 22+, Python 3.12 or 3.13.

```sh
npm ci
npm run typecheck
npm test                                   # adapter, durability core and PWA unit tests (real Argon2id)

npm run build -w @passkey-local/pwa        # production build in apps/pwa/dist (includes sw.js, _headers)
npx playwright install chromium            # once
npm run e2e -w @passkey-local/pwa          # browser tests against the build, served with the real headers

cd tools/vault-recovery
python -m venv .venv && . .venv/bin/activate
pip install --require-hashes -r requirements.lock -r requirements-dev.lock
python -m pytest                           # CLI, interop and security tests
```

Regenerate the synthetic corpus (ciphertexts change on every run, content does not):

```sh
node tests/interop/generate-fixtures.ts
tools/vault-recovery/.venv/bin/python tests/interop/generate_pykeepass_fixture.py
```

## Appearance

Choose **Colorful**, **Light** or **Dark** from the palette button in the header
or from Settings. Themes are available before unlocking and survive reloads.
The optional **System** setting follows your device. The interface uses a
desktop sidebar and mobile bottom navigation. See [design references and
previews](docs/DESIGN.md).

## Face ID / passkey unlock

Unlock with the master password, then open **Settings → Face ID / passkey**,
re-enter the master password and enable the option. The system creates a
platform passkey and verifies you. On an iPhone this may use Face ID; the OS
can also choose Touch ID or the screen-lock code. The app cannot force a
particular biometric method.

Requires a secure origin, a platform authenticator and WebAuthn **PRF** support
in both the browser and passkey provider. Unsupported providers leave password
unlock available. For local development use `localhost`, not a raw IP address:
WebAuthn credentials are bound to the domain. The passkey unlocks an AES-GCM
encrypted master-password wrapper in this browser's IndexedDB; the PRF secret
and plaintext password are never persisted. KDBX files and Python recovery
remain password-based and unchanged. A synced passkey alone does not carry
the vault or this browser's wrapper to another device.

After password rotation or vault restoration, enable passkey unlock again.
Disabling it removes the local unlock wrapper, but does not delete a passkey
from your OS/keychain; remove that separately in device settings if desired.
If the passkey or site data is lost, use the master password and your encrypted
backups. Physical-iPhone/Safari validation is still pending.

## Documents

- [Specification](docs/spec/README.md) (the development handoff this project implements)
- [Release evidence and gate status](docs/RELEASE_EVIDENCE.md)
- [Dependencies, versions and integration patches](docs/DEPENDENCIES.md)
- [Deployment](docs/DEPLOYMENT.md) (hosting, headers, updates, origin changes)
- [Cloudflare Pages upload ZIPs](deploy/cloudflare-pages/) (ready-to-upload production builds)
- [Disaster-recovery guide](docs/RECOVERY_GUIDE.md) (printable, for users)
- [Recovery tool README](tools/vault-recovery/README.md)

All data in this repository is synthetic. Never use real credentials in
development or tests.

## Licence

GNU General Public License v3.0 only (`GPL-3.0-only`); see [LICENSE](LICENSE).

## Windows desktop (experimental)

The same frontend and KDBX engine now have a Tauri 2 target in `apps/desktop`, with native encrypted file storage and backups. See [Windows instructions and acceptance limits](docs/windows/IMPLEMENTATION.md) and [test installer downloads](deploy/windows-desktop/). Windows Hello is unavailable until the physical TPM/Kensington protection proof succeeds. Existing PWA and independent Python recovery remain separate usable targets.
