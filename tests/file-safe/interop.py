"""Run both fresh producers against independent readers; synthetic fixtures only."""

import importlib.util, json, os, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/vault-recovery/src"))
from vault_recovery.file_safe.format import Snapshot

spec = importlib.util.spec_from_file_location(
    "fixture_writer", ROOT / "tests/file-safe/generate_python.py"
)
writer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(writer)
driver = (
    ROOT
    / "apps/desktop/src-tauri/target/debug/examples"
    / (
        "file_safe_fixture_driver.exe"
        if os.name == "nt"
        else "file_safe_fixture_driver"
    )
)
with tempfile.TemporaryDirectory(prefix="file-safe-fresh-interop-") as temp:
    temp = Path(temp)
    r = subprocess.run(
        [str(driver), "write", str(temp / "rust")],
        input=writer.PW,
        capture_output=True,
        check=True,
    )
    package = Path(r.stdout.decode().strip())
    result = Snapshot(package, writer.PW).verify()
    assert result["files"] == 6 and result["versions"] == 7
    r = subprocess.run(
        [
            sys.executable,
            "-m",
            "vault_recovery.file_safe.cli",
            "extract",
            str(package),
            "--password-stdin",
            "--output",
            str(temp / "extracted"),
            "--acknowledge-plaintext",
            "--include-history",
            "--include-trash",
        ],
        input=writer.PW,
        capture_output=True,
        check=True,
    )
    assert json.loads(r.stdout)["files"] == 7
    writer.generate(temp / "python")
    r = subprocess.run(
        [str(driver), "verify", str(temp / "python")],
        input=writer.PW,
        capture_output=True,
        check=True,
    )
    assert json.loads(r.stdout) == {
        "files": 6,
        "versions": 6,
        "plaintext_bytes": "5242900",
    }
    for producer in ["rust", "python"]:
        subprocess.run(
            [str(driver), "verify", str(ROOT / "tests/file-safe/fixtures" / producer)],
            input=writer.PW,
            capture_output=True,
            check=True,
        )
    print(
        "PASS: fresh Rust -> independent Python verification/extraction; fresh Python -> Rust; fixed producers -> Rust."
    )

if "--large" in sys.argv:
    with tempfile.TemporaryDirectory(prefix="file-safe-large-catalog-") as temp:
        path=Path(temp)/"package"
        writer.generate(path,large=True)
        result=subprocess.run([str(driver),"large-page",str(path)],input=writer.PW,capture_output=True,check=True)
        print(result.stdout.decode().strip())
