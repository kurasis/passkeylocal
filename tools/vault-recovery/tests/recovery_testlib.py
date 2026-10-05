"""Shared test helpers: run the CLI exactly as a user would (separate process, no network)."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

TOOL_ROOT = Path(__file__).resolve().parents[1]
REPO = TOOL_ROOT.parents[1]
INTEROP = REPO / "tests" / "interop" / "fixtures"
SECURITY = REPO / "tests" / "security" / "fixtures"
SCHEMA = TOOL_ROOT / "src" / "vault_recovery" / "schema" / "localvault-recovery-json-1.schema.json"

if str(TOOL_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(TOOL_ROOT / "src"))


def run_cli(args: list[str], stdin: bytes | None = None, cwd: Path | None = None) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith("PYTHON")}
    env["PYTHONPATH"] = str(TOOL_ROOT / "src")
    env["PYTHONIOENCODING"] = "utf-8"
    # Make any network use fail loudly: the recovery commands must not need it.
    env["http_proxy"] = env["https_proxy"] = env["HTTP_PROXY"] = env["HTTPS_PROXY"] = "http://127.0.0.1:9"
    return subprocess.run(
        [sys.executable, "-m", "vault_recovery", *args],
        input=stdin if stdin is not None else b"",
        capture_output=True,
        cwd=cwd,
        env=env,
        # No controlling terminal / console: prompts must fail, never hang or echo.
        start_new_session=os.name != "nt",
        creationflags=getattr(subprocess, "DETACHED_PROCESS", 0) if os.name == "nt" else 0,
        timeout=300,
    )


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def manifest(directory: Path) -> list[dict]:
    return json.loads((directory / "manifest.json").read_text(encoding="utf-8"))["fixtures"]


@pytest.fixture
def private_dir(tmp_path: Path) -> Path:
    d = tmp_path / "private"
    d.mkdir()
    if os.name != "nt":
        d.chmod(0o700)
    return d
