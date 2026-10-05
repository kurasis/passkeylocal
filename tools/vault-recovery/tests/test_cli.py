"""CLI contract tests (BACKUP_AND_PYTHON_RECOVERY.md sections 7 and 9, ACCEPTANCE_TESTS.md section 7)."""

from __future__ import annotations

import json
import os
import socket
import stat
import sys

import pytest

from recovery_testlib import INTEROP, manifest, run_cli, sha256_file

ITEMS = {f["file"]: f for f in manifest(INTEROP)}
FULL = INTEROP / "full.kdbx"
PW = ITEMS["full.kdbx"]["password"].encode("utf-8")
POSIX = os.name != "nt"


def full_model() -> dict:
    return json.loads((INTEROP / "full.expected.json").read_text(encoding="utf-8"))


# ---- password input -------------------------------------------------------------------------

def test_no_terminal_means_no_prompt_and_no_echo():
    r = run_cli(["verify", str(FULL)])
    assert r.returncode == 2
    assert b"--password-stdin" in r.stderr


def test_password_stdin_is_exact_bytes():
    spaced = ITEMS["password-spaces.kdbx"]
    src = INTEROP / "password-spaces.kdbx"
    assert run_cli(["verify", str(src), "--password-stdin"], stdin=spaced["password"].encode()).returncode == 0
    # A trailing newline is part of the password: nothing is trimmed.
    assert run_cli(["verify", str(src), "--password-stdin"], stdin=spaced["password"].encode() + b"\n").returncode == 3
    assert run_cli(["verify", str(src), "--password-stdin"], stdin=spaced["password"].strip().encode()).returncode == 3


def test_password_stdin_bounds_and_encoding():
    assert run_cli(["verify", str(FULL), "--password-stdin"], stdin=b"x" * 4097).returncode == 4
    assert run_cli(["verify", str(FULL), "--password-stdin"], stdin=b"\xff\xfe").returncode == 2
    assert run_cli(["verify", str(FULL), "--password-stdin"], stdin=b"").returncode == 2


def test_weak_existing_password_is_accepted():
    item = ITEMS["password-weak-existing.kdbx"]
    r = run_cli(["verify", str(INTEROP / item["file"]), "--password-stdin"], stdin=item["password"].encode())
    assert r.returncode == 0


def test_no_password_option_exists():
    r = run_cli(["verify", str(FULL), "--password", "x"])
    assert r.returncode == 2


# ---- read-only commands ----------------------------------------------------------------------

def test_verify_prints_counts_only():
    before = sha256_file(FULL)
    r = run_cli(["verify", str(FULL), "--password-stdin"], stdin=PW)
    assert r.returncode == 0
    out = r.stdout.decode()
    assert "Verification PASSED" in out and "not prove it is your latest revision" in out
    for secret in ("history-v1", "history-v2", "RC-0001-synthetic", "alice@example.test", "Mail"):
        assert secret not in out
    assert sha256_file(FULL) == before


def test_list_shows_titles_not_secrets():
    r = run_cli(["list", str(FULL), "--password-stdin"], stdin=PW)
    assert r.returncode == 0
    out = r.stdout.decode()
    assert "alice@example.test" in out and "[recycle bin]" in out
    assert "history-v2" not in out and "RC-0001" not in out
    r = run_cli(["list", str(FULL), "--password-stdin", "--query", "BOB@"], stdin=PW)
    assert r.stdout.decode().count("\n") == 3  # header, one row, count line


def test_show_masks_by_default_and_reveals_as_json():
    mail = next(e for e in full_model()["entries"] if e["favorite"])
    r = run_cli(["show", str(FULL), "--uuid", mail["uuid"], "--password-stdin"], stdin=PW)
    assert r.returncode == 0
    out = r.stdout.decode()
    assert "Password (protected): ********" in out and "history-v2" not in out and "History: 3 older" in out
    r = run_cli(["show", str(FULL), "--uuid", mail["uuid"], "--reveal", "--history", "--password-stdin"], stdin=PW)
    out = r.stdout.decode()
    assert 'Password (protected): "history-v2"' in out
    assert '"history-v1"' in out and '"history-v3"' in out
    # Notes with CR/LF/TAB are escaped on the terminal, never emitted raw.
    assert "\\u000d\\u000a" in out or "\\r\\n" in out
    r = run_cli(["show", str(FULL), "--uuid", "00000000-0000-4000-8000-000000000000", "--password-stdin"], stdin=PW)
    assert r.returncode == 2


# ---- export-json safety ---------------------------------------------------------------------

def export(out, *extra, stdin=PW, src=FULL):
    return run_cli(["export-json", str(src), "--output", str(out), "--password-stdin", *extra], stdin=stdin)


def test_export_requires_allow_plaintext(private_dir):
    r = export(private_dir / "x.json", "--yes")
    assert r.returncode == 2 and not (private_dir / "x.json").exists()


def test_export_requires_confirmation_without_terminal(private_dir):
    r = export(private_dir / "x.json", "--allow-plaintext")
    assert r.returncode == 2 and b"--yes" in r.stderr
    assert list(private_dir.iterdir()) == []


def test_export_success_permissions_and_warning(private_dir):
    out = private_dir / "recovered.json"
    r = export(out, "--allow-plaintext", "--yes")
    assert r.returncode == 0, r.stderr.decode()
    assert b"UNENCRYPTED" in r.stderr
    assert list(private_dir.iterdir()) == [out]  # no temp files left
    if POSIX:
        assert stat.S_IMODE(out.stat().st_mode) == 0o600
    doc = json.loads(out.read_text(encoding="utf-8"))
    assert doc["format"] == "localvault-recovery-json/1"


def test_export_never_overwrites(private_dir):
    out = private_dir / "exists.json"
    out.write_text("keep me")
    r = export(out, "--allow-plaintext", "--yes")
    assert r.returncode == 5 and out.read_text() == "keep me"


@pytest.mark.skipif(not POSIX, reason="symlink creation needs privileges on Windows")
def test_export_refuses_symlink_target(private_dir, tmp_path):
    target = tmp_path / "elsewhere.json"
    link = private_dir / "link.json"
    link.symlink_to(target)
    r = export(link, "--allow-plaintext", "--yes")
    assert r.returncode == 5 and not target.exists()


def test_export_refuses_input_as_output(private_dir):
    copy = private_dir / "vault.kdbx"
    copy.write_bytes(FULL.read_bytes())
    r = export(copy, "--allow-plaintext", "--yes", src=copy)
    assert r.returncode == 5  # the path exists, so it is refused before anything else
    assert sha256_file(copy) == sha256_file(FULL)


@pytest.mark.skipif(not POSIX, reason="POSIX permission bits")
def test_export_refuses_shared_directory(tmp_path):
    shared = tmp_path / "shared"
    shared.mkdir()
    shared.chmod(0o777)
    r = export(shared / "x.json", "--allow-plaintext", "--yes")
    assert r.returncode == 5 and b"not-private" in r.stderr


def test_export_missing_directory(private_dir):
    r = export(private_dir / "missing" / "x.json", "--allow-plaintext", "--yes")
    assert r.returncode == 5


@pytest.mark.skipif(not POSIX or os.geteuid() == 0, reason="root ignores directory permissions")
def test_export_unwritable_directory(tmp_path):
    ro = tmp_path / "ro"
    ro.mkdir()
    ro.chmod(0o500)
    try:
        r = export(ro / "x.json", "--allow-plaintext", "--yes")
        assert r.returncode == 5
    finally:
        ro.chmod(0o700)


@pytest.mark.skipif(sys.platform != "win32", reason="Windows ACL behaviour")
def test_export_windows_acl_restricted(private_dir):  # pragma: no cover - runs on Windows CI
    import subprocess

    from vault_recovery.output import _file_dacl_sddl, _owner_only_sddl

    out = private_dir / "acl.json"
    assert export(out, "--allow-plaintext", "--yes").returncode == 0
    sddl = _file_dacl_sddl(out)
    acl = subprocess.run(["icacls", str(out)], capture_output=True, text=True).stdout
    # Protected DACL (no inheritance) with exactly one ACE: full access for the current user.
    expected = _owner_only_sddl()
    assert expected.startswith("D:P(A;;FA;;;") and expected.count("(") == 1
    assert sddl == expected, acl


def test_unsupported_content_creates_no_output(private_dir):
    from recovery_testlib import SECURITY

    out = private_dir / "x.json"
    r = export(out, "--allow-plaintext", "--yes", src=SECURITY / "attachment.kdbx")
    assert r.returncode == 4 and not out.exists()


# ---- in-process: no network, no reprs ---------------------------------------------------------

def test_export_runs_with_network_denied(monkeypatch, private_dir, capsys):
    from vault_recovery import cli

    def no_network(*a, **k):
        raise AssertionError("network access attempted")

    monkeypatch.setattr(socket.socket, "connect", no_network)
    monkeypatch.setattr(socket, "create_connection", no_network)
    monkeypatch.setattr(socket, "getaddrinfo", no_network)

    class FakeStdin:
        buffer = __import__("io").BytesIO(PW)

    monkeypatch.setattr(sys, "stdin", FakeStdin())
    out = private_dir / "net.json"
    code = cli.main(["export-json", str(FULL), "--output", str(out), "--allow-plaintext", "--yes", "--password-stdin"])
    assert code == 0 and out.exists()


def test_unexpected_errors_do_not_print_reprs(monkeypatch, capsys):
    from vault_recovery import cli

    def explode(args):
        raise ValueError("secret-title-in-repr")

    monkeypatch.setattr(cli, "cmd_inspect", explode)
    parser = cli.build_parser()
    for action in parser._subparsers._group_actions[0].choices.values():  # rebind default
        if action.prog.endswith("inspect"):
            action.set_defaults(func=explode)
    monkeypatch.setattr(cli, "build_parser", lambda: parser)
    assert cli.main(["inspect", str(FULL)]) == 5
    err = capsys.readouterr().err
    assert "secret-title-in-repr" not in err and "ValueError" in err


def test_safe_text_escapes_terminal_controls():
    from vault_recovery.render import safe_text, secret_json

    assert safe_text("a\x1b[31mb") == "a\\u001b[31mb"
    assert safe_text("\u009b2J‮\r\n") == "\\u009b2J\\u202e\\u000d\\u000a"
    assert safe_text("Ünïcode 😀") == "Ünïcode 😀"
    assert secret_json("\x1b]0;x\x07") == '"\\u001b]0;x\\u0007"'


def test_exit_codes_for_input_errors(tmp_path):
    assert run_cli(["inspect", str(tmp_path / "missing.kdbx")]).returncode == 5
    p = tmp_path / "big.kdbx"
    p.write_bytes(b"\0" * (16 * 1024 * 1024 + 1))
    assert run_cli(["inspect", str(p)]).returncode == 4
    p.write_bytes(b"not a kdbx file at all")
    assert run_cli(["inspect", str(p)]).returncode == 4
    assert run_cli(["frobnicate", str(p)]).returncode == 2
