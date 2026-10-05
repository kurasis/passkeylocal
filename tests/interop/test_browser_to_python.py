"""G0-02: files written by the browser adapter are fully recovered by the Python tool.

Every fixture is verified and exported with the CLI; the export must equal the
logical model the TypeScript side recorded for the same file, field by field,
including history, recycle bin, custom data, protection flags and timestamps.
"""

from __future__ import annotations

import json

import jsonschema
import pytest

from recovery_testlib import INTEROP, SCHEMA, manifest, run_cli, sha256_file

FIXTURES = manifest(INTEROP)


@pytest.mark.parametrize("item", FIXTURES, ids=[f["file"] for f in FIXTURES])
def test_export_matches_browser_model(item, private_dir):
    src = INTEROP / item["file"]
    before = sha256_file(src)
    assert before == item["sha256"]
    out = private_dir / "export.json"
    r = run_cli(["export-json", str(src), "--output", str(out), "--allow-plaintext", "--yes", "--password-stdin"],
                stdin=item["password"].encode("utf-8"))
    assert r.returncode == 0, r.stderr.decode()
    doc = json.loads(out.read_text(encoding="utf-8"))
    jsonschema.validate(doc, json.loads(SCHEMA.read_text(encoding="utf-8")))
    assert doc["source"]["sha256"] == before
    expected = json.loads((INTEROP / item["file"].replace(".kdbx", ".expected.json")).read_text(encoding="utf-8"))
    model = dict(doc)
    model.pop("exported_at")
    model["source"] = {k: v for k, v in doc["source"].items() if k != "sha256"}
    assert model == expected
    assert sha256_file(src) == before  # input never modified


@pytest.mark.parametrize("item", FIXTURES, ids=[f["file"] for f in FIXTURES])
def test_verify_and_wrong_passwords(item):
    src = INTEROP / item["file"]
    r = run_cli(["verify", str(src), "--password-stdin", "--json"], stdin=item["password"].encode("utf-8"))
    assert r.returncode == 0, r.stderr.decode()
    summary = json.loads(r.stdout)
    assert summary["result"] == "passed"
    assert summary["sha256"] == item["sha256"]
    for wrong in item.get("wrong_passwords", []) + [item["password"] + "x"]:
        r = run_cli(["verify", str(src), "--password-stdin"], stdin=wrong.encode("utf-8"))
        assert r.returncode == 3, (wrong, r.stderr.decode())
        assert b"incorrect or the file is damaged" in r.stderr


def test_full_fixture_semantics():
    """Spot-check that the corpus actually exercises what it claims."""
    full = json.loads((INTEROP / "full.expected.json").read_text(encoding="utf-8"))
    mail = next(e for e in full["entries"] if e["favorite"])
    pw = lambda state: next(f["value"] for f in state["fields"] if f["name"] == "Password")  # noqa: E731
    assert [pw(h) for h in mail["history"]] == ["history-v1", "history-v2", "history-v3"]
    assert pw(mail) == "history-v2"
    first = mail["history"][0]
    notes = next(f["value"] for f in first["fields"] if f["name"] == "Notes")
    assert "\r\n" in notes and "\t" in notes and "]]>" in notes
    assert any(f["name"] == "Empty field" and f["value"] == "" for f in first["fields"])
    assert any(f["name"] == "Recovery code" and f["protected"] for f in first["fields"])
    recycled = [e for e in full["entries"] if e["in_recycle_bin"]]
    assert len(recycled) == 1 and recycled[0]["history"] and recycled[0]["deleted_at"]
    assert full["source"]["revision"] == "18446744073709551617"
    assert full["metadata"]["history_max_items"] == -1
    assert sum(1 for e in full["entries"] if pw(e).startswith("  ")) == 1
