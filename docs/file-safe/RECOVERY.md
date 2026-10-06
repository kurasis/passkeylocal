# Independent file-safe recovery

Requires CPython 3.12/3.13 and the hash-locked dependencies in `tools/vault-recovery/requirements.lock`. The new CLI does not require Windows, TPM, Hello, Tauri, JavaScript or an installed application. Existing `python -m vault_recovery` KDBX commands are unchanged.

```sh
python -m pip install --require-hashes -r tools/vault-recovery/requirements.lock
export PYTHONPATH=tools/vault-recovery/src
python -m vault_recovery.file_safe.cli inspect /private/backup-package
python -m vault_recovery.file_safe.cli verify /private/backup-package
python -m vault_recovery.file_safe.cli list /private/backup-package
python -m vault_recovery.file_safe.cli extract /private/backup-package \
  --output /private/new-recovery-directory --acknowledge-plaintext \
  --include-history --include-trash
```

Verify/list/extract ask for a hidden password. Passwords are exact UTF-8, including surrounding spaces; no password command-line or environment option exists. `--password-stdin` accepts exact protected pipe bytes for synthetic automation. A trailing newline becomes part of the password. The maximum is 1,024 UTF-8 bytes.

`inspect` is structural and explicitly unauthenticated; it does not run a KDF. `verify` authenticates every retained version, including trash, and reports counts without filenames. `list` intentionally reveals authenticated metadata and explicitly does not claim content verification. Extraction defaults to current live versions; `--file-id` and `--version-id` select a particular version. `--quota-bytes` defaults to 64 GiB; free space is checked before creating output.

Extraction creates a new private directory and never adopts or overwrites an existing target. Names are normalized and sanitized; every component includes its full opaque ID so case/Unicode/device-name collisions cannot overwrite another file. `recovery-report.json` maps original logical names to the actual recovered paths. POSIX uses descriptor-relative no-follow traversal; Windows pins directory handles and rejects reparse/hardlink inputs. Each file is published only after its final tag, byte length and SHA-256 pass. A corrupt file yields nonzero status and a PARTIAL report; verified earlier files remain. Temporary plaintext is cleaned up best-effort. A crash, disk failure or hostile OS can leave plaintext remnants; inspect the private output directory.

The portable package contains `HEAD.json`, one matching `.key`, one `.cat`, and all referenced `.obj` files. Keep the entire package together. Do not use an incomplete staging directory. Older packages can require older passwords after rotation. Never treat a copy-readback hash as an independent master-password recovery drill.

Windows offline kit: `tools/vault-recovery/scripts/build-offline-kit.ps1` collects all locked wheels, this reader and synthetic Rust sample. Install with `--no-index --find-links wheelhouse --require-hashes -r requirements.lock`, then use the copied `src` as PYTHONPATH. Linux offline reproduction uses `pip download --only-binary=:all: --require-hashes` and the same no-index installation. Check the acceptance ledger for actually executed platforms.
