"""Independent reader security/CLI checks against both fixed producer corpora."""

import copy, hashlib, json, os, shutil, struct, subprocess, sys
from pathlib import Path
import pytest
from vault_recovery.file_safe.format import (
    Snapshot,
    SafeError,
    head,
    password_header,
    strict_json,
    validate,
)
from vault_recovery.file_safe.paths import OutputRoot, open_input, safe_component

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "tests" / "file-safe" / "fixtures"
PW = "  пароль🔐é  ".encode()


def cli(command, path, *args, password=PW):
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "vault_recovery.file_safe.cli",
            command,
            str(path),
            *args,
            *([] if command == "inspect" else ["--password-stdin"]),
        ],
        input=password,
        capture_output=True,
        env={**os.environ, "PYTHONPATH": str(ROOT / "tools/vault-recovery/src")},
    )


@pytest.mark.parametrize("producer", ["rust", "python"])
def test_independent_fixture_verify_and_extraction(producer, tmp_path):
    snapshot = Snapshot(FIXTURES / producer, PW)
    expected = json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))["files"]
    for actual, wanted in zip(snapshot.catalog["files"], expected, strict=True):
        assert (
            actual["name"] == wanted["name"] and actual["deleted"] == wanted["deleted"]
        )
        for version in actual["versions"]:
            assert (
                version["sha256"] == wanted["sha256"]
                and str(version["plaintext_size"]) == wanted["size"]
            )
    out = snapshot.verify()
    assert out["files"] == 6
    assert out["versions"] == (7 if producer == "rust" else 6)
    assert snapshot.catalog["commit_sequence"] == (
        9007199254740993 if producer == "python" else 10
    )
    r = cli("verify", FIXTURES / producer)
    assert r.returncode == 0, r.stderr
    assert b"CON" not in r.stdout
    r = cli("inspect", FIXTURES / producer, password=b"")
    assert r.returncode == 0
    assert json.loads(r.stdout)["status"] == "UNAUTHENTICATED"
    destination = tmp_path / "extracted"
    r = cli(
        "extract",
        FIXTURES / producer,
        "--output",
        str(destination),
        "--acknowledge-plaintext",
        "--include-history",
        "--include-trash",
    )
    assert r.returncode == 0, r.stderr
    report = json.loads((destination / "recovery-report.json").read_text(encoding="utf-8"))
    assert report["status"] == "COMPLETE"
    assert len(report["files"]) == out["versions"]
    versions = {v["id"]: v for f in snapshot.catalog["files"] for v in f["versions"]}
    for entry in report["files"]:
        path = destination / entry["output"]
        assert path.is_relative_to(destination)
        assert ".." not in path.relative_to(destination).parts
        assert (
            hashlib.sha256(path.read_bytes()).hexdigest()
            == versions[entry["version_id"]]["sha256"]
        )
    assert (
        cli(
            "extract",
            FIXTURES / producer,
            "--output",
            str(destination),
            "--acknowledge-plaintext",
        ).returncode
        != 0
    )
    assert cli("verify", FIXTURES / producer, password=PW.strip()).returncode != 0


@pytest.mark.parametrize("mode", ["flip", "truncate", "append", "oversize"])
def test_corrupt_objects_never_publish_unverified_plaintext(mode, tmp_path):
    package = tmp_path / "package"
    shutil.copytree(FIXTURES / "python", package)
    snapshot = Snapshot(package, PW)
    version = snapshot.catalog["files"][0]["versions"][0]
    p = package / "objects" / (version["object_id"] + ".obj")
    b = bytearray(p.read_bytes())
    if mode == "flip":
        b[-1] ^= 1
    elif mode == "truncate":
        b = b[:-1]
    elif mode == "append":
        b.extend(b"x")
    else:
        b[64:68] = struct.pack("<I", 2**32 - 1)
    p.write_bytes(b)
    assert cli("verify", package).returncode != 0
    output = tmp_path / "out"
    r = cli("extract", package, "--output", str(output), "--acknowledge-plaintext")
    assert r.returncode == 3, r.stderr
    report = json.loads((output / "recovery-report.json").read_text(encoding="utf-8"))
    assert report["status"] == "PARTIAL"
    assert not report["files"]
    assert list(output.iterdir()) == [output / "recovery-report.json"]


@pytest.mark.parametrize(
    "data",
    [b'{"a":1,"a":2}', b'{"a":1.0}', b'{"a":NaN}', b"\xff", b"[" * 300 + b"]" * 300],
)
def test_strict_json_rejects_bad_structure(data):
    # Deep JSON may parse within Python's recursion cap; the catalog validator
    # then rejects its shape before any path or KDF use.
    with pytest.raises(SafeError):
        validate(strict_json(data, 1024), {})


def test_kdf_limits_are_checked_without_deriving(tmp_path, monkeypatch):
    p = FIXTURES / "python"
    locator = head((p / "HEAD.json").read_bytes())
    data = bytearray((p / "keys" / (locator["key_epoch_id"] + ".key")).read_bytes())
    for offset, value in [(40, 2), (40, 11), (44, 1024), (44, 257 * 1048576)]:
        bad = data.copy()
        struct.pack_into("<I" if offset == 40 else "<Q", bad, offset, value)
        with pytest.raises(SafeError):
            password_header(bad, locator)


def test_catalog_graph_keys_and_exact_counters():
    snapshot = Snapshot(FIXTURES / "python", PW)
    for mutate in [
        lambda c: c.update(extra=1),
        lambda c: c.update(commit_sequence=True),
        lambda c: c["folders"][0].update(parent_id=c["folders"][0]["id"]),
        lambda c: c["files"][0]["versions"][0].update(object_key="A" * 44),
        lambda c: c["files"][0].update(name="\ud800"),
    ]:
        c = copy.deepcopy(snapshot.catalog)
        mutate(c)
        with pytest.raises(SafeError):
            validate(c, snapshot.head)


def test_output_names_and_no_overwrite(tmp_path):
    assert safe_component("CON", "a" * 32).startswith("_CON--")
    for name in ["COM¹.txt", "lpt².csv", "COM³", "CONIN$.txt", "conout$.log"]:
        assert safe_component(name, "a" * 32).startswith("_"), name
    assert "/" not in safe_component("../a/b", "a" * 32)
    assert len(safe_component("😀" * 100, "a" * 32).encode()) < 255
    output = tmp_path / "out"
    with OutputRoot(output) as root:
        with root.temporary(("verified",)) as f:
            f.write(b"good")
        with pytest.raises(FileExistsError):
            with root.temporary(("verified",)) as f:
                f.write(b"bad")
    assert (output / "verified").read_bytes() == b"good"
    with pytest.raises(FileExistsError):
        OutputRoot(output)


@pytest.mark.skipif(
    sys.platform == "win32", reason="Windows reparse tests run in native suite"
)
def test_input_ancestry_and_hardlink_rejected(tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    (real / "f").write_bytes(b"x")
    link = tmp_path / "link"
    link.symlink_to(real, target_is_directory=True)
    with pytest.raises(OSError):
        with open_input(link / "f"):
            pass
    os.link(real / "f", real / "hard")
    with pytest.raises(OSError):
        with open_input(real / "f"):
            pass
