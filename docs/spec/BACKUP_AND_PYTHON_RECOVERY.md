# Backups and Independent Python Recovery

## 1. Recovery invariants

1. An exported `.kdbx` file and its correct master password are sufficient to recover the complete supported vault on another computer.
2. Recovery must not require the original iPhone, PWA, origin, Apple Account, an API key, a cloud account, a Node.js runtime, or a copy of browser storage.
3. History, recycled entries, groups, tags, custom fields, timestamps and encrypted product metadata are part of the backup.
4. An encrypted IndexedDB snapshot is a rollback mechanism, not a separate-device backup.
5. Never replace or delete the only usable vault as a prerequisite for testing recovery.
6. An ordinary byte checksum detects transfer mistakes; keyed KDBX authentication plus successful parsing is what verifies decryption and integrity.
7. A file can be authentic but old. Verification must report which revision was verified without implying it is the latest possible revision.

## 2. Backup layers and retention

| Layer | What it protects against | What it does not protect against |
| --- | --- | --- |
| Current encrypted local head | Normal app restarts | Origin deletion, device loss, forgotten password |
| Up to five older local encrypted snapshots | Recent accidental changes, some failed saves | Whole-origin deletion or lost phone |
| User-exported encrypted file | Loss of app/origin; some recovery mistakes | Loss of the same device if the only copy is on that device |
| Verified copy on a second device/removable medium | Lost phone or hosting disappearance | Lost master password or loss of all copies |

Recommended personal routine: export after important changes, retain several dated versions, and keep at least one verified copy on another device. A user may select an OS cloud-backed Files folder; that is a user-chosen export destination, not an app-operated cloud service. Explain the distinction. Do not require cloud storage.

External retention is user-controlled. The PWA cannot promise to enumerate, delete, or rotate arbitrary files in iOS Files. It must never automatically erase older external backups. Old backups and local snapshots can retain old passwords and deleted records.

## 3. Export workflow

1. Finish or cancel an active edit. If a save is running, wait while visible or cancel safely; never export half a transaction.
2. Capture an immutable committed ciphertext blob and its local generation, authenticated vault identity/lineage/revision, size and SHA-256 hash.
3. Verify the selected blob, then prepare a `File`/Blob with a generic name such as `vault-backup-20261004T033000Z-r42.kdbx`. Do not include a person's name, site name, username or vault title. A user may rename it deliberately.
4. Prepare the file before the final **Save encrypted backup** gesture so that iOS user activation is still available when invoking the native share/download action.
5. Use feature-detected file sharing (`navigator.canShare` where available) and a tested file-download fallback. Use `application/octet-stream` unless a tested registered KDBX MIME type improves actual behavior. Neither MIME type nor file extension is proof of validity.
6. Let the user save in Files or choose another destination. Do not suggest sending the master password with the backup.
7. Record an export attempt and its blob hash; do not infer a durable saved file from a resolved share promise or download click.
8. Offer **Verify saved backup**: the user selects the actual saved file from Files, enters its password again, and the app authenticates/parses it without replacing the active vault.

The verification screen shows entry/history counts, revision, backup age and whether its byte hash matches the exact exported revision. If it is a different valid revision, label it accurately; do not mark the latest revision protected. Verification succeeds without importing anything.

The v1 external backup is exactly a `.kdbx` file, not a ZIP with a proprietary manifest. An optional checksum shown alongside it is advisory and never a password or a decryption key. Neither timestamps nor filenames are trusted to identify the newest vault.

### Backup status model

| Status | Meaning |
| --- | --- |
| Saved locally | Current ciphertext transaction committed on this installation. |
| Export offered | File was prepared and offered to an OS destination. Cancellation/error remains distinguishable. |
| User reported saved | User acknowledged saving; durability has not been independently checked. |
| Verified file | A selected external file was re-opened and authenticated; identify its exact revision/hash. |
| Newer local changes | Current head differs from the latest verified snapshot. |

Operational backup receipts live outside the vault and contain no record data. Verifying an external file must not itself create a new vault revision, which would otherwise make the backup immediately look stale. A local receipt can be lost on origin deletion and is not required to restore a file.

Track preparation, OS handoff and re-open verification separately even if hiding for a picker locks the app. Discard keys and plaintext on hide; only the encrypted file and non-secret receipt state may remain available for completing the handoff. A cancelled verification does not cancel or damage the already-exported file.

Show a persistent, unobtrusive reminder when there are changes since the last verified backup. Owner policy update (2026-10-09): escalate to a visible banner after 10 unbacked commits or 30 days since the last successful backup verification, including unchanged vaults. Rechecking the current backup resets the deadline; exporting alone does not. These are product thresholds. Do not rely on background notifications, background sync, or precise iOS scheduling. During initial onboarding, require one export-and-verify drill before inviting the user to enter real credentials.

## 4. Restore and replacement

Default restore opens a selected file as a candidate for inspection. Preflight limits and all cryptographic checks apply. Existing local data is untouched during this process.

After unlock, show the candidate's authenticated summary, history/recycle-bin inclusion, and any revision/lineage mismatch. If it is an ordinary supported KDBX file without product metadata, state that its product revision is unknown; assign product metadata only when the user deliberately adopts it.

Before replacing an existing vault, offer export of the current committed file and ask the user to choose replacement deliberately. If the old vault cannot be opened, still allow a byte-for-byte encrypted export of its stored blob as potentially damaged data. An explicit “replace without a verified backup” action may proceed after a clear data-loss acknowledgement; never strand someone who needs to restore a functioning backup over a broken database.

Create a fresh local generation and lineage when adopting/restoring a file as the active editing branch; record the source identity/revision inside encrypted metadata if useful. This prevents a restored old revision and a newer divergent revision from being mistaken for a single ordered history. Preserve entry/group IDs, records, history and source metadata. Do not silently merge databases in v1.

Validate the adopted candidate and commit via the same atomic head-switch protocol. Preserve the prior head as rollback material until the replacement is confirmed. A failed import or quota error leaves the previous head in place.

If the current head fails to open at startup, do not automatically pick an older snapshot. Offer recovery choices with dates and warn about lost intervening changes. Authentication is still required. Never initialize an empty vault over an unreadable one.

### When the website is gone

Use the independent Python tool against an external `.kdbx` file. Alternatively use a compatible KeePass reader that was included in the release interoperability check. Rehosting the PWA at a new HTTPS origin is possible, followed by importing the file, but is not required for Python recovery.

If no external file exists and all browser data is gone, the recovery tool cannot reconstruct it. It does not extract inaccessible iPhone browser storage or recover deleted flash blocks.

## 5. Master-password rotation

1. Re-enter and verify the current password. Offer export of the old committed vault first.
2. Accept/confirm the new password using the creation policy and exact-byte rules.
3. Use the KDBX library to serialize a fresh candidate under the new credentials; independently re-open it with the new password. Confirm its complete logical contents, including history.
4. Commit atomically. Until commit completion the old password/current file remain authoritative.
5. Prompt to export and verify a new external backup using the new password.
6. After new-password validation and successful commit, replace local rollback retention with only newly protected revisions, deleting old-password rollback references in a separate cleanup transaction. If cleanup fails, warn that old-password encrypted copies remain. Do not call this secure erasure.

Already exported old files still decrypt with the old password; rotation does not revoke them. Do not imply that changing the vault password fixes a password already stolen from an unlocked vault. Keep a known-good backup throughout the operation, and explain which password each dated backup needs.

## 6. Python tool: purpose and packaging

Deliver a separate application named `vault-recovery`, implemented in Python with a module entry point:

```text
python -m vault_recovery <command> <file> [options]
```

Use PyKeePass and its established cryptographic dependencies to read/authenticate KDBX. Do not call the PWA, invoke a JavaScript subprocess, import shared browser code, or implement AES/Argon2/HMAC yourself. The code may implement bounded metadata preflight and product-schema conversion. A separate implementation is valuable because it detects integration errors in the browser writer.

Primary recovery platform: Windows 11 x64. Also test the source package on Linux; document macOS installation if tested. Pin and report the exact supported Python minor versions and dependency versions. “Python 3.12+” is a development target, not proof of compatibility with every future Python.

Release artifacts must include:

- Source package, readable README, license notices, and hashed dependency lock.
- An offline wheelhouse or equivalent prebuilt dependency bundle for a documented Windows x64/Python-minor combination, plus an offline install command using `--no-index` and `--require-hashes`.
- A clear statement that dependencies must already be installed or included to run offline. A `.py` file that silently downloads packages does not meet this requirement.
- Synthetic sample vaults and expected recovery output; never real credentials.
- A short printable/offline recovery guide: what files to keep, how to verify, and how to extract everything if the PWA disappears.
- An optional packaged executable may supplement, but never replace, the Python source and documented CLI.

Future app releases that change the writer profile must ship a corresponding recovery-tool update, retain reading support for previously shipped profiles, and add migration fixtures. Keep the old recovery kit with its dated backups; do not depend on a website download remaining available indefinitely.

## 7. CLI contract

All examples below are commands the development agent must implement, not commands that already exist in this specification archive.

```bash
python -m vault_recovery inspect vault.kdbx
python -m vault_recovery verify vault.kdbx
python -m vault_recovery list vault.kdbx
python -m vault_recovery show vault.kdbx --uuid ENTRY_UUID
python -m vault_recovery show vault.kdbx --uuid ENTRY_UUID --reveal --history
python -m vault_recovery export-json vault.kdbx --output recovered.json --allow-plaintext
```

| Command | Required result |
| --- | --- |
| `inspect` | Bounded header metadata, version/cipher/KDF, size and SHA-256; no password prompt; label all metadata **unauthenticated**. |
| `verify` | Prompt for password; authenticate/decrypt/parse the complete file; show counts, product schema/revision if present, and pass/fail, with no record values. |
| `list` | After unlock, show UUID, group path, title and username; no passwords or secret custom fields. Clearly identify recycled entries. |
| `show` | One exact UUID; show ordinary fields, mask secrets by default; reveal only with `--reveal`; include old versions only with `--history`. |
| `export-json` | Export the entire supported vault, including history and recycle bin, to explicit output path. Requires `--allow-plaintext` and an additional interactive confirmation unless `--yes` is supplied. |

`list` may support a literal `--query` filter; document that arguments are visible to process inspection and shell history, so never use a password as the query. Do not put passwords in command-line examples, options, environment variables or logs. Do not add `--password PASSWORD`.

Password entry uses `getpass` with no echo. If a safe interactive prompt is unavailable, fail rather than allowing getpass to fall back to echoed input. For explicit automation/testing, `--password-stdin` may consume bounded UTF-8 bytes from standard input **without trimming any byte**, including a trailing newline; document this exact policy and never use it implicitly. Prompt-based confirmation uses the terminal, not the already-consumed password stream. A test process may provide stdin bytes directly; do not teach users to put real passwords in shell literals.

Do not print a Python repr of credential/library objects, because it may contain titles or usernames. Redact exception payloads. `inspect`/`verify` support machine-readable safe summaries if needed; debug mode still must not disclose records. Terminal rendering must escape ANSI/control characters from imported content. `show --reveal` should display secret values as escaped JSON strings so control sequences cannot execute; decoded JSON export preserves the exact value.

### Error and exit behavior

| Exit code | Meaning |
| --- | --- |
| 0 | Requested operation completed successfully. |
| 2 | Invalid command/arguments or explicit confirmation missing. |
| 3 | Password/authentication failure; may also be authenticated-data damage that cannot be distinguished. |
| 4 | Unsupported format/profile/schema or resource limit exceeded. |
| 5 | Local I/O, output permission, existing-target or dependency problem. |
| 6 | Structurally malformed/truncated data detected independently of the password. |
| 130 | User cancelled/interrupted. |

No command modifies the input KDBX. `verify` writes nothing. Hash the source before/after in tests. There is no `--ignore-hmac`, `--force-decrypt` or automatic password cracking.

## 8. Complete plaintext export schema

Default Python export is UTF-8 JSON, not CSV, HTML or XLSX. This avoids losing history/custom fields and avoids spreadsheet formula interpretation. Export values literally; do not expand field references or execute auto-type instructions.

The schema version is `localvault-recovery-json/1`. Define and test a JSON Schema in the implementation. The root contains:

```json
{
  "format": "localvault-recovery-json/1",
  "source": {
    "sha256": "hex digest of the complete source KDBX",
    "kdbx_version": "4.1",
    "vault_id": "uuid-or-null",
    "lineage_id": "uuid-or-null",
    "revision": "decimal-string-or-null"
  },
  "exported_at": "RFC3339 UTC timestamp",
  "metadata": {},
  "groups": [],
  "entries": [],
  "deleted_objects": []
}
```

The example describes structure only; the placeholder strings are not valid sample production values. Each entry object must contain:

- `uuid`, `group_uuid`, and `group_path` as an array of names (never a filesystem path).
- `fields` as an array of `{name, value, protected}` for **all** standard/custom string fields, preserving empty values and Unicode.
- `tags`, favorite/product CustomData, recycle-bin membership, and all entry timestamps with expiry flags.
- `history` as an ordered array of full prior states with their own fields/tags/times/custom data and an explicit history index; no recursive nested histories.
- Any additional supported entry metadata that the adapter preserves, such as icon ID and auto-type configuration as inert data.

Groups include UUID, parent UUID, name, notes, times and preserved custom data. Metadata includes database metadata and namespaced values, without derived keys or the master password. Preserve the distinction between missing fields and empty strings. UUIDs use the canonical textual UUID representation; times are UTC RFC 3339; large counters use decimal strings. Do not assume timestamps provide a globally trustworthy ordering.

The exporter must enumerate the full decoded structure, including recycle-bin descendants and history; a loop over only current `kp.entries` with title/username/password is insufficient. Any unknown element in an otherwise supported file that cannot be represented losslessly must cause a clear non-success result before creating a supposedly complete export. Define the supported mapping in code and test it against fixtures. The original encrypted file is always retained.

Plaintext output is an emergency/manual export. It contains all included current and old passwords. The command must explain this before writing. Do not create plaintext backups in normal PWA workflows.

## 9. Safe output and resource controls

Decrypt/authenticate and validate completely before creating the output. Use a private directory and restrictive permissions. On POSIX, create with mode 0600; on Windows use an ACL-limited user directory and verify/apply appropriate permissions, because chmod(0600) alone does not enforce equivalent ACL protection.

Write through an exclusively created, restricted temporary file in the destination directory, flush/sync, then finalize using a no-overwrite operation. Refuse symlink/reparse-point targets and an already-existing final path; refuse the input path as output. Do not implement an overwrite option in v1. If a suitable private output location cannot be obtained, fail with an actionable message. Clean up partial plaintext on errors/interruption when possible, and document that a crash may leave a restricted partial file and deletion is not guaranteed secure erasure on SSDs or synced folders.

Do not print plaintext exports to stdout by default, write them into log files, or automatically open them in a browser/editor. All paths chosen by the user are treated as paths; embedded group/entry names are never turned into output filenames.

Use the same preflight limits as the PWA before invoking PyKeePass. Treat parser warnings as failures where they imply malformed or dropped data. Never disable authentication checks or XML protections to accommodate a failing fixture. No network call is required or allowed by the recovery commands after dependencies are installed.

## 10. Required disaster-recovery demonstrations

The implementation's release report must document both:

1. **Phone loss simulation:** create synthetic current/history/recycle-bin records, export from the actual iPhone, copy the file to a separate computer, deny network access, verify and export with Python, compare every logical field with expected values.
2. **Origin loss simulation:** retain only the exported `.kdbx`, the correct password and the offline recovery kit; remove the development app/browser profile from the test environment; recover using Python and open the file with the independently tested KeePass reader.

Also restore a backup into a fresh PWA origin/profile. Neither test may rely on a cached transformed key or another installed copy of the old PWA.
