"""G0-03: write a KDBX 4.0 fixture with PyKeePass (independent of kdbxweb).

    tools/vault-recovery/.venv/bin/python tests/interop/generate_pykeepass_fixture.py

Starts from PyKeePass's bundled blank database and adjusts the outer header to
the supported reader profile (AES-256, Argon2id 64 MiB / 3 / 2 lanes, no
compression). The expected logical model is produced by this repository's
Python exporter; the TypeScript adapter must read the same content (see
packages/vault-adapter/test/interop.test.ts). All values are synthetic.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools" / "vault-recovery" / "src"))

from pykeepass import PyKeePass  # noqa: E402
from pykeepass.pykeepass import BLANK_DATABASE_LOCATION, BLANK_DATABASE_PASSWORD  # noqa: E402

PASSWORD = "pykeepass-Writer-пароль-synthetic"
OUT = REPO / "tests" / "interop" / "fixtures-python"
ARGON2ID = bytes.fromhex("9e298b1956db4773b23dfc3ec6f0a1e6")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    kp = PyKeePass(BLANK_DATABASE_LOCATION, BLANK_DATABASE_PASSWORD)
    dh = kp.kdbx.header.value.dynamic_header
    dh.compression_flags.data.compression = False
    kdf = dh.kdf_parameters.data.dict
    kdf["$UUID"].value = ARGON2ID
    kdf["M"].value = 64 * 1024 * 1024
    kdf["I"].value = 3
    kdf["P"].value = 2
    del kp.kdbx.header.data  # force the header to be rebuilt from the modified values
    kp.password = PASSWORD

    t = datetime(2026, 3, 29, 0, 59, 59, tzinfo=timezone.utc)
    work = kp.add_group(kp.root_group, "Work Ü")
    e = kp.add_entry(work, "Py entry", "py-user@example.test", "py-pass-v1", url="https://py.example.test",
                     notes="py\nnotes\twith tab", tags=["python", "Тег"])
    e.set_custom_property("Py secret", "py-protected", protect=True)
    e.set_custom_property("Py plain", "", protect=False)
    e.expiry_time = t
    e.expires = True
    e.save_history()
    e.password = "py-pass-v2"
    e.save_history()
    e.password = "py-pass-v3"
    kp.add_entry(kp.root_group, "Duplicate", "same", "pw1")
    kp.add_entry(kp.root_group, "Duplicate", "same", "pw2", force_creation=True)
    trash = kp.add_entry(kp.root_group, "Recycled", "r", "recycled-pw")
    kp.trash_entry(trash)

    fixture = OUT / "pykeepass-written.kdbx"
    if fixture.exists():
        fixture.unlink()
    kp.save(fixture)

    from vault_recovery.export import build_model
    from vault_recovery.reader import open_vault

    data = fixture.read_bytes()
    opened = open_vault(data, PASSWORD)
    model = build_model(opened.tree, opened.preflight.kdbx_version)
    (OUT / "pykeepass-written.expected.json").write_text(json.dumps(model, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest = {
        "provenance": {
            "generator": "tests/interop/generate_pykeepass_fixture.py",
            "python": sys.version.split()[0],
            "pykeepass": version("pykeepass"),
            "argon2-cffi": version("argon2-cffi"),
            "pycryptodomex": version("pycryptodomex"),
            "lxml": version("lxml"),
            "platform": os.name,
        },
        "fixtures": [{
            "file": fixture.name,
            "password": PASSWORD,
            "sha256": hashlib.sha256(data).hexdigest(),
            "description": "Written by PyKeePass: KDBX 4.0, Argon2id 64 MiB/3/p=2, history, custom fields, recycle bin.",
        }],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("wrote", fixture.relative_to(REPO))


if __name__ == "__main__":
    main()
