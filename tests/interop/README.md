# Interoperability corpus

Synthetic files used to prove that what the browser adapter writes is fully
recoverable by independent readers, and vice versa.

| Directory | Writer | Checked by |
| --- | --- | --- |
| `fixtures/` | browser adapter (kdbxweb + hash-wasm), `generate-fixtures.ts` | Python CLI export compared field by field (`test_browser_to_python.py`), KeePassXC CLI export (`test_keepassxc.py`), adapter re-open (`packages/vault-adapter/test/interop.test.ts`) |
| `fixtures-python/` | PyKeePass, `generate_pykeepass_fixture.py` | browser adapter (`interop.test.ts`) |
| `../security/fixtures/` | browser adapter with deliberately hostile XML or unsupported features | both readers must refuse with the documented code (`manifest.json`) |

Each `*.expected.json` is the `localvault-recovery-json/1` document without
`exported_at` and `source.sha256`. `manifest.json` lists the synthetic
passwords, SHA-256 hashes and generating tool versions.

Comparisons are logical, never byte-for-byte: every save uses fresh salts,
seeds and IVs, so regenerating changes every ciphertext but not the content.
CI regenerates the browser corpus on every run (`interop-fresh` job) and runs
all readers against the fresh files as well as the committed ones.
