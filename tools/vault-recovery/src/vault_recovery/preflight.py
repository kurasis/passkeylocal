"""Bounded structural preflight for KDBX files (independent implementation).

Runs before any key derivation or large allocation. Everything reported here is
UNAUTHENTICATED. Mirrors packages/vault-adapter/src/preflight.ts.
"""

from __future__ import annotations

import hashlib
import hmac
import struct
from dataclasses import dataclass

from . import limits as L
from .errors import LimitError, MalformedError, UnsupportedError

# Outer header field ids
END, COMMENT, CIPHER_ID, COMPRESSION, MASTER_SEED = 0, 1, 2, 3, 4
TRANSFORM_SEED, TRANSFORM_ROUNDS, ENCRYPTION_IV = 5, 6, 7
PROTECTED_STREAM_KEY, STREAM_START_BYTES, INNER_RANDOM_STREAM_ID = 8, 9, 10
KDF_PARAMETERS, PUBLIC_CUSTOM_DATA = 11, 12
KDBX3_ONLY = {COMMENT, TRANSFORM_SEED, TRANSFORM_ROUNDS, PROTECTED_STREAM_KEY, STREAM_START_BYTES, INNER_RANDOM_STREAM_ID}

# VariantDictionary value types
VD_END, VD_UINT32, VD_UINT64, VD_BOOL, VD_INT32, VD_INT64, VD_STRING, VD_BYTES = (
    0x00, 0x04, 0x05, 0x08, 0x0C, 0x0D, 0x18, 0x42,
)


def _malformed(detail: str) -> MalformedError:
    return MalformedError("The file is malformed or truncated.", detail)


def _unsupported(detail: str) -> UnsupportedError:
    return UnsupportedError("This file uses a format or feature that is not supported.", detail)


def _limit(detail: str) -> LimitError:
    return LimitError("A vault limit would be exceeded.", detail)


@dataclass(frozen=True)
class KdfSummary:
    algorithm: str
    version: int
    memory_bytes: int
    iterations: int
    parallelism: int
    salt_length: int


@dataclass(frozen=True)
class PreflightSummary:
    file_size: int
    version_major: int
    version_minor: int
    cipher: str
    compression: str
    kdf: KdfSummary
    header_length: int
    block_count: int
    payload_bytes: int
    authenticated: bool = False

    @property
    def kdbx_version(self) -> str:
        return f"{self.version_major}.{self.version_minor}"

    def as_dict(self) -> dict:
        return {
            "authenticated": False,
            "file_size": self.file_size,
            "kdbx_version": self.kdbx_version,
            "cipher": self.cipher,
            "compression": self.compression,
            "kdf": {
                "algorithm": self.kdf.algorithm,
                "version": self.kdf.version,
                "memory_bytes": self.kdf.memory_bytes,
                "iterations": self.kdf.iterations,
                "parallelism": self.kdf.parallelism,
                "salt_length": self.kdf.salt_length,
            },
            "header_length": self.header_length,
            "block_count": self.block_count,
            "payload_bytes": self.payload_bytes,
        }


class _Reader:
    def __init__(self, data: bytes, start: int = 0, end: int | None = None) -> None:
        self.data = data
        self.pos = start
        self.end = len(data) if end is None else end

    def remaining(self) -> int:
        return self.end - self.pos

    def need(self, n: int, what: str) -> None:
        if n < 0 or n > self.remaining():
            raise _malformed(f"truncated-{what}")

    def take(self, n: int, what: str) -> bytes:
        self.need(n, what)
        out = self.data[self.pos : self.pos + n]
        self.pos += n
        return out

    def u8(self, what: str) -> int:
        return self.take(1, what)[0]

    def u16(self, what: str) -> int:
        return struct.unpack("<H", self.take(2, what))[0]

    def u32(self, what: str) -> int:
        return struct.unpack("<I", self.take(4, what))[0]

    def i32(self, what: str) -> int:
        return struct.unpack("<i", self.take(4, what))[0]


def _parse_variant_dictionary(data: bytes) -> dict[str, tuple[int, object]]:
    r = _Reader(data)
    version = r.u16("vd-version")
    if version & 0xFF00 != 0x0100:
        raise _unsupported("vd-version")
    out: dict[str, tuple[int, object]] = {}
    while True:
        vtype = r.u8("vd-type")
        if vtype == VD_END:
            break
        key_len = r.i32("vd-key-length")
        if key_len <= 0 or key_len > r.remaining():
            raise _malformed("vd-key-length")
        try:
            key = r.take(key_len, "vd-key").decode("utf-8", errors="strict")
        except UnicodeDecodeError:
            raise _malformed("vd-key-encoding") from None
        val_len = r.i32("vd-value-length")
        if val_len < 0 or val_len > r.remaining():
            raise _malformed("vd-value-length")
        raw = r.take(val_len, "vd-value")
        if key in out:
            raise _malformed("vd-duplicate-key")
        value: object
        if vtype == VD_UINT32:
            if val_len != 4:
                raise _malformed("vd-uint32-length")
            value = struct.unpack("<I", raw)[0]
        elif vtype == VD_INT32:
            if val_len != 4:
                raise _malformed("vd-int32-length")
            value = struct.unpack("<i", raw)[0]
        elif vtype == VD_UINT64:
            if val_len != 8:
                raise _malformed("vd-uint64-length")
            value = struct.unpack("<Q", raw)[0]
        elif vtype == VD_INT64:
            if val_len != 8:
                raise _malformed("vd-int64-length")
            value = struct.unpack("<q", raw)[0]
        elif vtype == VD_BOOL:
            if val_len != 1:
                raise _malformed("vd-bool-length")
            value = raw[0] != 0
        elif vtype == VD_STRING:
            try:
                value = raw.decode("utf-8", errors="strict")
            except UnicodeDecodeError:
                raise _malformed("vd-string-encoding") from None
        elif vtype == VD_BYTES:
            value = raw
        else:
            raise _malformed("vd-unknown-type")
        out[key] = (vtype, value)
    if r.remaining() != 0:
        raise _malformed("vd-trailing-bytes")
    return out


def _check_kdf(params: dict[str, tuple[int, object]]) -> KdfSummary:
    uuid = params.get("$UUID")
    if uuid is None or uuid[0] != VD_BYTES or len(uuid[1]) != 16:  # type: ignore[arg-type]
        raise _malformed("kdf-uuid")
    kdf_id = uuid[1].hex()  # type: ignore[union-attr]
    if kdf_id == L.KDF_ARGON2D_UUID:
        raise _unsupported("kdf-argon2d")
    if kdf_id == L.KDF_AESKDF_UUID:
        raise _unsupported("kdf-aes")
    if kdf_id != L.KDF_ARGON2ID_UUID:
        raise _unsupported("kdf-unknown")
    allowed = {"$UUID", "S", "P", "M", "I", "V"}
    for key in params:
        if key in ("K", "A"):
            raise _unsupported("kdf-secret-or-associated-data")
        if key not in allowed:
            raise _unsupported("kdf-unknown-parameter")

    def typed(key: str, vtype: int, detail: str) -> object:
        item = params.get(key)
        if item is None or item[0] != vtype:
            raise _malformed(detail)
        return item[1]

    salt = typed("S", VD_BYTES, "kdf-salt")
    p = typed("P", VD_UINT32, "kdf-parallelism")
    m = typed("M", VD_UINT64, "kdf-memory")
    i = typed("I", VD_UINT64, "kdf-iterations")
    v = typed("V", VD_UINT32, "kdf-version")
    assert isinstance(salt, bytes) and isinstance(p, int) and isinstance(m, int)
    assert isinstance(i, int) and isinstance(v, int)

    if v != L.ARGON2_VERSION_13:
        raise _unsupported("kdf-argon2-version")
    if not (L.SALT_LENGTH_MIN <= len(salt) <= L.SALT_LENGTH_MAX):
        raise _unsupported("kdf-salt-length")
    if m < L.KDF_MEMORY_MIN:
        raise _unsupported("kdf-memory-too-low")
    if m > L.KDF_MEMORY_MAX:
        raise _limit("kdf-memory-too-high")
    if m % 1024 != 0:
        raise _unsupported("kdf-memory-not-whole-kib")
    if i < L.KDF_ITERATIONS_MIN:
        raise _unsupported("kdf-iterations-too-low")
    if i > L.KDF_ITERATIONS_MAX:
        raise _limit("kdf-iterations-too-high")
    if p < L.KDF_PARALLELISM_MIN:
        raise _unsupported("kdf-parallelism-too-low")
    if p > L.KDF_PARALLELISM_MAX:
        raise _limit("kdf-parallelism-too-high")
    return KdfSummary("Argon2id", v, m, i, p, len(salt))


def preflight(data: bytes) -> PreflightSummary:
    """Validate the structure of a KDBX file without the password."""
    if len(data) > L.MAX_FILE_BYTES:
        raise _limit("file-too-large")
    if len(data) < 12:
        raise _unsupported("not-kdbx")
    r = _Reader(data)
    sig1, sig2 = r.u32("signature"), r.u32("signature")
    if sig1 != L.KDBX_SIGNATURE_1 or sig2 != L.KDBX_SIGNATURE_2:
        raise _unsupported("not-kdbx")
    minor, major = r.u16("version"), r.u16("version")
    if major != L.READER_VERSION_MAJOR:
        raise _unsupported("kdbx-major-version")
    if minor not in L.READER_VERSION_MINORS:
        raise _unsupported("kdbx-minor-version")

    seen: set[int] = set()
    cipher = compression = master_seed = iv = kdf_params = None
    while True:
        fid = r.u8("header-field-id")
        size = r.u32("header-field-size")
        if size > L.MAX_OUTER_HEADER_BYTES:
            raise _limit("header-field-too-large")
        if r.pos + size > L.MAX_OUTER_HEADER_BYTES:
            raise _limit("header-too-large")
        field = r.take(size, "header-field")
        if fid in seen:
            raise _malformed("header-duplicate-field")
        seen.add(fid)
        if fid == END:
            break
        if fid == CIPHER_ID:
            if size != 16:
                raise _malformed("header-cipher-length")
            cipher = field
        elif fid == COMPRESSION:
            if size != 4:
                raise _malformed("header-compression-length")
            compression = struct.unpack("<I", field)[0]
        elif fid == MASTER_SEED:
            if size != 32:
                raise _malformed("header-master-seed-length")
            master_seed = field
        elif fid == ENCRYPTION_IV:
            iv = field
        elif fid == KDF_PARAMETERS:
            kdf_params = _parse_variant_dictionary(field)
        elif fid == PUBLIC_CUSTOM_DATA:
            raise _unsupported("public-custom-data")
        elif fid in KDBX3_ONLY:
            raise _malformed("header-kdbx3-field-in-kdbx4")
        else:
            raise _malformed("header-unknown-field")
    header_length = r.pos

    if cipher is None or compression is None or master_seed is None or iv is None or kdf_params is None:
        raise _malformed("header-missing-field")
    if cipher.hex() != L.CIPHER_AES256_UUID:
        raise _unsupported("cipher")
    if len(iv) != 16:
        raise _malformed("header-iv-length")
    if compression == 1:
        raise _unsupported("compression-gzip")
    if compression != 0:
        raise _unsupported("compression-unknown")
    kdf = _check_kdf(kdf_params)

    stored_hash = r.take(32, "header-hash")
    r.need(32, "header-hmac")
    r.pos += 32
    if not hmac.compare_digest(stored_hash, hashlib.sha256(data[:header_length]).digest()):
        raise _malformed("header-hash-mismatch")

    block_count = 0
    payload = 0
    while True:
        r.need(32, "block-hmac")
        r.pos += 32
        size = r.i32("block-size")
        if size < 0:
            raise _malformed("block-negative-size")
        if size > L.MAX_FILE_BYTES:
            raise _limit("block-too-large")
        r.need(size, "block-data")
        r.pos += size
        block_count += 1
        if size == 0:
            break
        payload += size
    if r.remaining() != 0:
        raise _malformed("trailing-bytes")
    if payload == 0:
        raise _malformed("empty-payload")
    if payload % 16 != 0:
        raise _malformed("payload-not-block-aligned")

    return PreflightSummary(
        file_size=len(data),
        version_major=major,
        version_minor=minor,
        cipher="AES-256-CBC",
        compression="none",
        kdf=kdf,
        header_length=header_length,
        block_count=block_count,
        payload_bytes=payload,
    )
