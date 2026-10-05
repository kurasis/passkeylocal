# PassKey Local: disaster-recovery guide

Print this page and keep it with your backups.

## What you need

1. A backup file named like `vault-backup-20261004T033000Z-r42.kdbx`, saved
   **outside the phone** (a computer, a USB stick, or a cloud folder you chose).
2. The **master password** that was in use when that backup was made. Backups
   made before a password change still need the old password.
3. The **offline recovery kit** (`vault-recovery-offline-kit-...`), or any
   computer with Python 3.12/3.13 and internet access to install it.

Without the master password nobody can open a backup: there is no reset and no
bypass. Without any backup file, data lost from the phone cannot be recovered.

## Keep good backups

- Export after important changes and keep several dated files.
- Keep at least one copy on a different device than the phone.
- After exporting, use **Verify saved backup** in the app: pick the saved file
  again and enter the password. Only a verified file counts.
- Old backups contain old passwords and deleted entries. Store them as
  carefully as the vault itself.

## Recover on a computer (Windows example)

1. Copy the kit folder and your `.kdbx` backup to the computer. You may
   disconnect from the internet.
2. Open PowerShell in the kit folder and run:

   ```powershell
   python -m venv kit-venv
   kit-venv\Scripts\python -m pip install --no-index --find-links wheelhouse --require-hashes -r requirements.lock
   $env:PYTHONPATH = "src"
   kit-venv\Scripts\python -m vault_recovery verify C:\path\to\backup.kdbx
   ```

   Type the master password when asked (nothing is shown while typing).
   `Verification PASSED` means the file is intact. It tells you the revision;
   it cannot know whether a newer backup exists elsewhere.
3. Find an entry and show it:

   ```powershell
   kit-venv\Scripts\python -m vault_recovery list C:\path\to\backup.kdbx
   kit-venv\Scripts\python -m vault_recovery show C:\path\to\backup.kdbx --uuid <UUID from list> --reveal --history
   ```

4. Only if you must extract everything (for example to move to another
   password manager), create an unencrypted export in a private folder and
   delete it as soon as you are done:

   ```powershell
   kit-venv\Scripts\python -m vault_recovery export-json C:\path\to\backup.kdbx --output C:\Users\me\Private\recovered.json --allow-plaintext
   ```

You can also open the backup with KeePassXC (tested: 2.7.6) or another KeePass
reader listed in the release notes.

## Exit codes

0 success · 2 wrong usage · 3 wrong password or damaged file · 4 unsupported
file · 5 file/permission problem · 6 malformed or truncated file · 130 cancelled.

## If the website is gone

Nothing above needs the website. You can also host the app again at a new
address and import the backup file there; the new address does not see the
old browser storage.
