# Dependencies, versions and integration patches

Recorded 2026-10-04. All versions are pinned exactly; npm uses `package-lock.json`
(integrity hashes), Python uses `requirements*.lock` (`--require-hashes`).
Dependency updates must be reviewed by hand and must rerun the full interop and
tamper suites; no automatic deploy of dependency-bot changes.

Windows diagnostics addition (2026-10-06): `windows` 0.62.2 and
`windows-future` 0.3.2 are exact direct dependencies for WinRT
UserConsentVerifier/desktop HWND interop and async completion. They already
existed transitively in the locked desktop graph. These Microsoft maintained
bindings use the OS implementation, introduce no cryptographic primitive or
secret store, and are MIT/Apache-2.0 licensed. Hello consent is a diagnostic
only, never authorization to release a vault key. The web target has no native
dependency or IPC in its compiled output.

## Browser side (`packages/vault-adapter`)

| Package | Version | Role | Notes |
| --- | --- | --- | --- |
| kdbxweb | 2.1.1 | KDBX 4.x read/write, AES-CBC, HMAC blocks, ChaCha20 inner stream | Last release 2022-06. No built-in Argon2. See patches below. |
| hash-wasm | 4.12.0 | Argon2id (bundled WASM, raw bytes output) | Memory parameter in KiB. Needs CSP `'wasm-unsafe-eval'`. |
| @xmldom/xmldom | 0.9.12 | XML parser/serializer where no native DOMParser exists (Node, Web Workers) and for all vault parsing | kdbxweb declares `^0.7.4`; 0.7.x/0.8.x carry open advisories (GHSA-wh4c-j3r5-mjhp and others, all `<= 0.8.14`). Forced to 0.9.12 with an npm `overrides` entry. |
| fflate | 0.7.x (via kdbxweb) | gzip | Unused: compressed files are rejected before decryption. |

Dev only: typescript 7.0.2, vitest 5.0.3, @types/node 26.6.4, fake-indexeddb 6.2.5 (Apache-2.0; IndexedDB for the Node tests of `packages/vault-core`).

`npm audit` (2026-10-04): 0 vulnerabilities with the override in place.

### kdbxweb integration patches (`packages/vault-adapter/src/kdbx.ts`)

All patches are installed once by `kdbx()`; every module obtains kdbxweb through it.

1. **Argon2id** via `CryptoEngine.setArgon2Impl` (hash-wasm). kdbxweb passes the
   header memory divided by 1024, i.e. KiB, which is what hash-wasm expects; the
   adapter performs no further conversion. Tests pin the boundary (65536 KiB for
   the 64 MiB header value; a bytes-as-KiB call is refused).
2. **XML parsing**: `XmlUtils.parse` runs the XML guard (no DTD/entities/PI/XInclude,
   depth <= 64, element ceiling, no raw control characters) and parses with
   xmldom 0.9 configured to fail on any diagnostic. kdbxweb's own parse calls the
   xmldom 0.7 constructor API (rejected by 0.9) and strips raw TAB characters.
3. **XML serialization**: `XmlUtils.serialize` entitizes CR and TAB, so values
   round-trip exactly through standard XML end-of-line handling and through other
   kdbxweb-based readers that strip TAB.
4. **Strict UTF-8**: `ByteUtils.bytesToString` rejects invalid UTF-8 instead of
   substituting U+FFFD.

### kdbxweb behaviours handled in the adapter

- `KdbxEntry.pushHistory()` does not copy entry CustomData, QualityCheck or
  PreviousParentGroup into the history item; `entries.ts` copies them.
- New databases default to `HistoryMaxItems = 10`; the adapter writes `-1`
  (unlimited) so other KeePass clients do not prune history on save.
- Default file version is 4.0; the adapter writes 4.1 (`header.versionMinor = 1`).
- kdbxweb ignores unknown XML elements and drops empty auto-type associations,
  empty-named fields and duplicate field names. `fidelity.ts` compares the
  authenticated XML with the loaded model; any difference opens the vault
  read-only so it can never be re-saved with silent loss.
- Tags are split on `;`, `,` and `:`; the editing API rejects tags containing them.

## Python side (`tools/vault-recovery`)

| Package | Version | Role |
| --- | --- | --- |
| pykeepass | 4.2.0 | KDBX parsing, key derivation and authentication |
| construct | 2.10.70 | binary structure parsing (via pykeepass) |
| argon2-cffi / argon2-cffi-bindings | 25.1.0 / 26.1.0 | Argon2id (reference C implementation) |
| pycryptodomex | 3.23.0 | AES-CBC, ChaCha20 |
| lxml | 6.1.3 | XML (libxml2) |
| cffi / pycparser | 2.1.1 / 3.0 | argon2 bindings |
| importlib-metadata / zipp / pyotp | 9.0.1 / 4.1.1 / 2.10.0 | pykeepass runtime deps (pyotp unused) |

Dev only: pytest 8.4.2, jsonschema 4.25.1 (and their deps, `requirements-dev.lock`).

`pip-audit --require-hashes -r requirements.lock` (2026-10-04): no known vulnerabilities.

### PyKeePass integration patches (`tools/vault-recovery/src/vault_recovery/reader.py`)

1. `kdbx_parsing.common.XML._decode`: strict UTF-8 decode, XML guard, and an lxml
   parser with `resolve_entities=False, no_network=True, load_dtd=False,
   huge_tree=False, remove_blank_text=False`. Upstream uses a default parser with
   `remove_blank_text=True`.
2. `kdbx_parsing.common.UnprotectedStream._decode`: protected values must decode
   as strict UTF-8 and contain only XML-representable characters; upstream strips
   such characters silently and only logs decryption failures.

The Python tool shares no code with the browser side. Both implement the same
bounded preflight and XML guard independently, and the interop tests check that
they agree.

## Independent reader used for G0-04

KeePassXC 2.7.6 (`keepassxc-cli`, Ubuntu 24.04 archive package
`2.7.6+dfsg.1-1build3`).

## PWA (`apps/pwa`)

Runtime: react 19.3.0, react-dom 19.3.0 (MIT). Build/test only: vite 8.3.2,
@vitejs/plugin-react 6.1.1 (MIT), @playwright/test 1.63.0 (Apache-2.0).
The browser bundle aliases Node's `crypto` (referenced by kdbxweb's UMD
wrapper) to a stub that throws: kdbxweb uses WebCrypto whenever
`crypto.subtle` exists, so the stub is only reached if WebCrypto is missing,
and then fails closed. kdbxweb, xmldom and hash-wasm are bundled only into
the vault worker; the main-thread bundle contains UI code and React.

## Licences

This project is licensed under GPL-3.0-only (see `LICENSE`), which is compatible
with every dependency listed below.

kdbxweb (MIT), hash-wasm (MIT), @xmldom/xmldom (MIT), fflate (MIT),
pykeepass (GPL-3.0-only), construct (MIT), argon2-cffi (MIT),
pycryptodomex (BSD/Public Domain), lxml (BSD-3-Clause). PyKeePass's GPL-3.0
licence applies to distributions of the recovery tool that include it; the
offline kit ships it as an unmodified wheel. A full notices file is a release
task (see RELEASE_EVIDENCE.md).
