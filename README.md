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

## Documents

- [Specification](docs/spec/README.md) (the development handoff this project implements)
- [Release evidence and gate status](docs/RELEASE_EVIDENCE.md)
- [Dependencies, versions and integration patches](docs/DEPENDENCIES.md)
- [Deployment](docs/DEPLOYMENT.md) (hosting, headers, updates, origin changes)
- [Disaster-recovery guide](docs/RECOVERY_GUIDE.md) (printable, for users)
- [Recovery tool README](tools/vault-recovery/README.md)

All data in this repository is synthetic. Never use real credentials in
development or tests.

## Licence

GNU General Public License v3.0 only (`GPL-3.0-only`); see [LICENSE](LICENSE).
