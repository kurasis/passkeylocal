"""G0-04: files written by the browser adapter open in an independent, maintained KeePass reader.

Uses `keepassxc-cli` (KeePassXC). The file is unlocked and exported to XML by
KeePassXC; groups, every field value (including passwords and protected custom
fields), Unicode, tags, recycle-bin placement and full entry history must match
the browser-side model. Skipped when keepassxc-cli is not installed
(CI installs it from the Ubuntu archive).
"""

from __future__ import annotations

import json
import shutil
import subprocess

import pytest
from lxml import etree

from recovery_testlib import INTEROP, manifest
from vault_recovery.export import build_model

KPXC = shutil.which("keepassxc-cli")
pytestmark = pytest.mark.skipif(KPXC is None, reason="keepassxc-cli not installed")
FIXTURES = [f for f in manifest(INTEROP) if "\n" not in f["password"]]


def keepassxc_version() -> str:
    return subprocess.run([KPXC, "--version"], capture_output=True, text=True, check=True).stdout.strip()


def export_with_keepassxc(path, password: str) -> bytes:
    r = subprocess.run([KPXC, "export", "-q", "-f", "xml", str(path)], input=(password + "\n").encode("utf-8"),
                       capture_output=True, timeout=300)
    assert r.returncode == 0, r.stderr.decode(errors="replace")
    return r.stdout


def _norm(value: str) -> str:
    # KeePassXC's XML *export* writes CR raw, which XML end-of-line handling turns into LF.
    return value.replace("\r\n", "\n").replace("\r", "\n")


def projection(model: dict) -> dict:
    def state(s: dict) -> dict:
        return {
            "fields": sorted((f["name"], _norm(f["value"]), f["protected"]) for f in s["fields"]),
            "tags": sorted(s["tags"]),
            "expires": s["times"]["expires"],
            "expiry": s["times"]["expiry"] if s["times"]["expires"] else None,
            "product_data": sorted((c["key"], c["value"]) for c in s["custom_data"] if c["key"].startswith("LocalVault.")),
        }

    return {
        "groups": sorted((g["uuid"], g["name"], g["parent_uuid"] or "", g["in_recycle_bin"]) for g in model["groups"]),
        "entries": {
            e["uuid"]: {
                "group_path": e["group_path"],
                "in_recycle_bin": e["in_recycle_bin"],
                **state(e),
                "history": [state(h) for h in e["history"]],
            }
            for e in model["entries"]
        },
        "product_meta": sorted((c["key"], c["value"]) for c in model["metadata"]["custom_data"] if c["key"].startswith("LocalVault.")),
    }


@pytest.mark.parametrize("item", FIXTURES, ids=[f["file"] for f in FIXTURES])
def test_keepassxc_reads_browser_files(item):
    xml = export_with_keepassxc(INTEROP / item["file"], item["password"])
    tree = etree.ElementTree(etree.fromstring(xml, etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False)))
    for v in tree.iter("Value"):  # XML export marks protection with ProtectInMemory
        if v.attrib.pop("ProtectInMemory", None) == "True":
            v.set("Protected", "True")
    got = build_model(tree, "4.1")
    expected = json.loads((INTEROP / item["file"].replace(".kdbx", ".expected.json")).read_text(encoding="utf-8"))
    assert projection(got) == projection(expected), keepassxc_version()


def test_keepassxc_rejects_wrong_password():
    item = next(f for f in FIXTURES if f["file"] == "full.kdbx")
    r = subprocess.run([KPXC, "ls", "-q", str(INTEROP / item["file"])], input=b"wrong password\n", capture_output=True)
    assert r.returncode != 0
