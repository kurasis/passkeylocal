"""SEC-01..07 on the Python side: hostile, tampered and unsupported files fail closed."""

from __future__ import annotations

import hashlib
import json
import struct
import time

import pytest

from recovery_testlib import INTEROP, SECURITY, manifest, run_cli, sha256_file

CORPUS = manifest(SECURITY)
PASSWORD = manifest(INTEROP)[0]["password"]
BASE = (INTEROP / "full.kdbx").read_bytes()


@pytest.mark.parametrize("item", CORPUS, ids=[f["file"] for f in CORPUS])
def test_security_corpus(item, private_dir):
    src = SECURITY / item["file"]
    before = sha256_file(src)
    out = private_dir / "out.json"
    r = run_cli(["export-json", str(src), "--output", str(out), "--allow-plaintext", "--yes", "--password-stdin"],
                stdin=item["password"].encode())
    assert r.returncode == item["expect_exit"], r.stderr.decode()
    if item["expect_exit"] != 0:
        assert not out.exists(), "no output may be created for a rejected file"
        assert list(private_dir.iterdir()) == []
    assert sha256_file(src) == before
    # Rejections never echo record content.
    assert b"canary-secret" not in r.stderr + r.stdout


def test_malicious_strings_render_inert():
    src = SECURITY / "malicious-strings.kdbx"
    r = run_cli(["list", str(src), "--password-stdin"], stdin=PASSWORD.encode())
    assert r.returncode == 0
    out = r.stdout.decode("utf-8")
    assert "\u009b" not in out and "‮" not in out
    assert "\\u009b31mRED" in out and "\\u202eevil" in out


def _header_len(data: bytes) -> int:
    pos = 12
    while True:
        fid = data[pos]
        size = struct.unpack_from("<I", data, pos + 1)[0]
        pos += 5 + size
        if fid == 0:
            return pos


def _master_seed_offset(data: bytes) -> int:
    pos = 12
    while data[pos] != 4:
        pos += 5 + struct.unpack_from("<I", data, pos + 1)[0]
    return pos + 5


def _write(tmp_path, name: str, data: bytes):
    p = tmp_path / name
    p.write_bytes(data)
    return p


def _flip(data: bytes, pos: int) -> bytes:
    b = bytearray(data)
    b[pos] ^= 0x80
    return bytes(b)


@pytest.mark.parametrize(
    "where,expected",
    [("header", 6), ("header_hmac", 3), ("block_hmac", 3), ("ciphertext", 3), ("last_ciphertext", 3)],
)
def test_bit_flips(tmp_path, where, expected):
    h = _header_len(BASE)
    pos = {"header": _master_seed_offset(BASE), "header_hmac": h + 32, "block_hmac": h + 64, "ciphertext": h + 64 + 36,
           "last_ciphertext": len(BASE) - 37}[where]
    p = _write(tmp_path, "flipped.kdbx", _flip(BASE, pos))
    r = run_cli(["verify", str(p), "--password-stdin"], stdin=PASSWORD.encode())
    assert r.returncode == expected, r.stderr.decode()


@pytest.mark.parametrize("cut", [11, 12, 40, -1000, -37, -36, -1])
def test_truncation(tmp_path, cut):
    p = _write(tmp_path, "cut.kdbx", BASE[:cut])
    r = run_cli(["verify", str(p), "--password-stdin"], stdin=PASSWORD.encode())
    assert r.returncode in (4, 6), r.stderr.decode()  # 4 only for < 12 bytes (not a KDBX file)


def test_trailing_bytes(tmp_path):
    p = _write(tmp_path, "trail.kdbx", BASE + b"\x00")
    r = run_cli(["verify", str(p), "--password-stdin"], stdin=PASSWORD.encode())
    assert r.returncode == 6 and b"trailing-bytes" in r.stderr


def _with_kdf(data: bytes, key: str, vtype: int, value: bytes) -> bytes:
    """Replace one KDF dictionary entry and recompute the (unkeyed) header hash."""
    pos = 12
    fields = []
    while True:
        fid = data[pos]
        size = struct.unpack_from("<I", data, pos + 1)[0]
        fields.append([fid, data[pos + 5 : pos + 5 + size]])
        pos += 5 + size
        if fid == 0:
            break
    rest = data[pos + 32 :]
    for f in fields:
        if f[0] == 11:
            vd = f[1]
            items = []
            q = 2
            while vd[q] != 0:
                t = vd[q]
                kl = struct.unpack_from("<i", vd, q + 1)[0]
                k = vd[q + 5 : q + 5 + kl]
                vl = struct.unpack_from("<i", vd, q + 5 + kl)[0]
                v = vd[q + 9 + kl : q + 9 + kl + vl]
                items.append((t, k, v))
                q += 9 + kl + vl
            items = [i for i in items if i[1] != key.encode()] + [(vtype, key.encode(), value)]
            f[1] = b"\x00\x01" + b"".join(
                bytes([t]) + struct.pack("<i", len(k)) + k + struct.pack("<i", len(v)) + v for t, k, v in items
            ) + b"\x00"
    header = data[:12] + b"".join(bytes([fid]) + struct.pack("<I", len(d)) + d for fid, d in fields)
    return header + hashlib.sha256(header).digest() + rest


@pytest.mark.parametrize(
    "key,vtype,value,expected,detail",
    [
        ("M", 0x05, struct.pack("<Q", 1 << 40), 4, b"kdf-memory-too-high"),
        ("M", 0x05, struct.pack("<Q", 2**64 - 1), 4, b"kdf-memory-too-high"),
        ("I", 0x05, struct.pack("<Q", 1 << 62), 4, b"kdf-iterations-too-high"),
        ("P", 0x04, struct.pack("<I", 64), 4, b"kdf-parallelism-too-high"),
        ("V", 0x04, struct.pack("<I", 0x10), 4, b"kdf-argon2-version"),
        ("M", 0x04, struct.pack("<I", 1024), 6, b"kdf-memory"),
    ],
)
def test_kdf_limits_rejected_before_kdf(tmp_path, key, vtype, value, expected, detail):
    p = _write(tmp_path, "kdf.kdbx", _with_kdf(BASE, key, vtype, value))
    t0 = time.monotonic()
    r = run_cli(["verify", str(p), "--password-stdin"], stdin=PASSWORD.encode())
    assert r.returncode == expected, r.stderr.decode()
    assert detail in r.stderr
    assert time.monotonic() - t0 < 30  # a 1 TiB / 2^62-pass KDF would never finish


def test_preflight_runs_before_kdf_in_process(monkeypatch):
    """In-process check that Argon2 is never invoked for an out-of-envelope header."""
    import argon2.low_level

    from vault_recovery.errors import LimitError
    from vault_recovery.reader import open_vault

    def boom(*a, **k):
        raise AssertionError("KDF must not run")

    monkeypatch.setattr(argon2.low_level, "hash_secret_raw", boom)
    with pytest.raises(LimitError):
        open_vault(_with_kdf(BASE, "M", 0x05, struct.pack("<Q", 1 << 40)), PASSWORD)


def test_inspect_does_not_run_kdf_and_is_labelled_unauthenticated(monkeypatch, capsys):
    import argon2.low_level

    from vault_recovery.cli import main

    monkeypatch.setattr(argon2.low_level, "hash_secret_raw", lambda *a, **k: (_ for _ in ()).throw(AssertionError()))
    assert main(["inspect", str(INTEROP / "full.kdbx")]) == 0
    out = capsys.readouterr().out
    assert "UNAUTHENTICATED" in out and "Argon2id" in out and "65536 KiB" in out
    assert main(["inspect", str(INTEROP / "full.kdbx"), "--json"]) == 0
    info = json.loads(capsys.readouterr().out)
    assert info["authenticated"] is False and info["kdbx_version"] == "4.1"
