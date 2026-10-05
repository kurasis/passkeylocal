# vault-recovery

Independent, offline recovery tool for PassKey Local backups. It reads a
standard KDBX 4.1 / 4.0 file with [PyKeePass](https://github.com/libkeepass/pykeepass)
and needs nothing from the PWA: no website, no browser storage, no JavaScript
runtime, no account and no network.

It never modifies the input file and has no option to skip authentication.

## Install

Supported: CPython 3.12 and 3.13 on Windows 11 x64 (primary), Linux and macOS
(see `docs/RELEASE_EVIDENCE.md` for what CI actually ran).

**Online** (development machine):

```sh
python -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements.lock      # Windows: .venv\Scripts\python
```

**Offline** (recovery machine, from the kit built by `scripts/build-offline-kit.ps1`
or `scripts/build-offline-kit.sh`; the CI artifact
`vault-recovery-offline-kit-win-amd64-py312` is such a kit):

```powershell
python -m venv kit-venv
kit-venv\Scripts\python -m pip install --no-index --find-links wheelhouse --require-hashes -r requirements.lock
$env:PYTHONPATH = "src"
kit-venv\Scripts\python -m vault_recovery verify path\to\backup.kdbx
```

The kit contains the source, the hashed lock file, a wheelhouse for one
OS/Python combination, sample files and `SHA256SUMS.txt`. The tool never
downloads anything by itself; if a dependency is missing it stops with exit code 5.

## Commands

```sh
python -m vault_recovery inspect     backup.kdbx            # header only, no password, UNAUTHENTICATED
python -m vault_recovery verify      backup.kdbx            # authenticate + full parse, counts only
python -m vault_recovery list        backup.kdbx [--query TEXT]
python -m vault_recovery show        backup.kdbx --uuid ENTRY_UUID [--reveal] [--history]
python -m vault_recovery export-json backup.kdbx --output recovered.json --allow-plaintext [--yes]
```

- The password is read with a hidden prompt. There is no `--password` option
  and no environment variable. Without a terminal the prompt fails instead of
  echoing.
- `--password-stdin` (automation and tests only) reads up to 4,096 bytes of
  UTF-8 from standard input **exactly**: nothing is trimmed, not even a trailing
  newline. Do not put real passwords in shell literals or history.
- `--query` is visible to other processes and in shell history; never use a
  password as a query.
- `show` masks secret values unless `--reveal`; revealed values are printed as
  escaped JSON strings. All terminal output escapes control and bidi characters.
- `verify` proves the selected file is intact and reports its revision. It does
  not prove that it is the latest revision.

### export-json

Writes the complete vault, including all history and the recycle bin, as
UTF-8 JSON (`localvault-recovery-json/1`, schema in
`src/vault_recovery/schema/`). **The file is unencrypted and contains every
current and old password.**

- Requires `--allow-plaintext`, plus a typed confirmation on the terminal unless `--yes`.
- The whole file is decrypted, authenticated and converted before any output is
  created. Content that cannot be represented losslessly (attachments, unknown
  elements, newer product schema) stops the export with exit code 4.
- The output path must not exist (no overwrite option), must not be a symlink and
  must differ from the input. On POSIX the directory must not be writable by other
  users and the file is created with mode 0600; on Windows inherited ACLs are
  removed and only the current user is granted access (a protected DACL with a single
  full-control entry for the current user SID, read back and verified).
- Output goes through an exclusively created temporary file that is fsynced and
  linked into place without overwriting. Partial files are removed on errors and
  Ctrl+C where possible. Deletion is not secure erasure on SSDs or synced folders.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 2 | Invalid arguments or missing confirmation |
| 3 | Wrong password, or damaged authenticated data (indistinguishable) |
| 4 | Unsupported format/profile/schema, or a resource limit exceeded |
| 5 | Local I/O, output path, permission or dependency problem |
| 6 | Structurally malformed or truncated file (detected without the password) |
| 130 | Cancelled |

## Supported files

KDBX 4.0/4.1 with AES-256-CBC, Argon2id v1.3 (64-256 MiB, 3-10 iterations,
1-4 lanes, 16-64 byte salt), no compression, ChaCha20 inner stream, password-only
credentials, no attachments or custom icons, at most 16 MiB. Anything else is
reported as unsupported (exit 4), never as damaged. Key files are not supported,
and an authentication failure cannot tell a missing key file from a wrong password.

## Integration notes

`reader.py` replaces two PyKeePass internals at runtime (documented in
`docs/DEPENDENCIES.md`): the XML adapter (strict UTF-8, XML guard, an lxml parser
that never resolves entities, loads DTDs or uses the network) and protected-value
decoding (fails instead of silently stripping characters).
