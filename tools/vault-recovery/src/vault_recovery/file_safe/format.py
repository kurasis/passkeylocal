"""Independent bounded v1 reader built on PyNaCl/libsodium and cryptography HKDF."""

from __future__ import annotations
import base64
import hashlib
import json
import re
import struct
from datetime import datetime
from pathlib import Path
from typing import BinaryIO
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from nacl import bindings as sodium
from nacl.exceptions import CryptoError
from .paths import open_input

CHUNK = 1_048_576
MAX_CATALOG = 64 * CHUNK
MAX_FILE = 1_099_511_627_776
ID = re.compile(r"[0-9a-f]{32}\Z")
HASH = re.compile(r"[0-9a-f]{64}\Z")
STAMP = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\Z")


class SafeError(Exception):
    """Only fixed, nonsensitive failure codes cross the CLI boundary."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def require(value, code="CORRUPT"):
    if not value:
        raise SafeError(code)


def exact(stream: BinaryIO, count: int) -> bytes:
    data = stream.read(count)
    require(len(data) == count)
    return data


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def _reject_number(_):
    raise SafeError("CORRUPT")


def strict_json(data: bytes, limit: int):
    require(len(data) <= limit)
    try:
        return json.loads(
            data.decode("utf-8", "strict"),
            object_pairs_hook=_pairs,
            parse_float=_reject_number,
            parse_constant=_reject_number,
        )
    except (ValueError, UnicodeError, RecursionError):
        raise SafeError("CORRUPT") from None


def fields(value, keys):
    require(type(value) is dict and set(value) == set(keys.split()))


def ident(value):
    require(type(value) is str and ID.fullmatch(value))


def integer(value, minimum=0, maximum=2**64 - 1):
    require(type(value) is int and minimum <= value <= maximum)


def byte_length(value):
    try:
        return len(value.encode("utf-8", "strict"))
    except UnicodeError:
        raise SafeError("CORRUPT") from None


def text(value, length, empty=False):
    require(
        type(value) is str
        and (empty or value)
        and byte_length(value) <= length
        and not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in value)
    )


def timestamp(value):
    require(type(value) is str and STAMP.fullmatch(value))
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise SafeError("CORRUPT") from None


def head(data: bytes) -> dict:
    value = strict_json(data, 1024)
    fields(value, "format_version vault_id key_epoch_id snapshot_id")
    require(type(value["format_version"]) is int and value["format_version"] == 1)
    for k in ("vault_id", "key_epoch_id", "snapshot_id"):
        ident(value[k])
    return value


def key_bytes(version):
    try:
        key = base64.b64decode(version["object_key"], validate=True)
    except (ValueError, TypeError):
        raise SafeError("CORRUPT") from None
    require(
        len(key) == 32
        and base64.b64encode(key).decode("ascii") == version["object_key"]
    )
    return key


def validate(catalog: dict, locator: dict):
    fields(
        catalog,
        "schema_version vault_id key_epoch_id snapshot_id commit_sequence prior_snapshot_id folders files policy",
    )
    require(type(catalog["schema_version"]) is int and catalog["schema_version"] == 1)
    integer(catalog["commit_sequence"], 1)
    for k in ("vault_id", "key_epoch_id", "snapshot_id"):
        ident(catalog[k])
        require(catalog[k] == locator[k])
    if catalog["prior_snapshot_id"] is not None:
        ident(catalog["prior_snapshot_id"])
        require(catalog["prior_snapshot_id"] != catalog["snapshot_id"])
    fields(catalog["policy"], "history_previous_versions")
    require(
        type(catalog["policy"]["history_previous_versions"]) is int
        and catalog["policy"]["history_previous_versions"] == 10
    )
    require(type(catalog["folders"]) is list and 1 <= len(catalog["folders"]) <= 50000)
    require(type(catalog["files"]) is list and len(catalog["files"]) <= 50000)
    used, objects, folders, roots = set(), set(), {}, 0

    def unique(value):
        ident(value)
        require(value not in used)
        used.add(value)

    for folder in catalog["folders"]:
        fields(folder, "id parent_id name")
        unique(folder["id"])
        text(folder["name"], 255, folder["parent_id"] is None)
        if folder["parent_id"] is None:
            roots += 1
            require(folder["name"] == "")
        else:
            ident(folder["parent_id"])
        folders[folder["id"]] = folder
    require(roots == 1)
    for folder in folders.values():
        visited, node = set(), folder["id"]
        while node is not None:
            require(len(visited) < 64 and node not in visited and node in folders)
            visited.add(node)
            node = folders[node]["parent_id"]
    versions = 0
    for item in catalog["files"]:
        fields(
            item,
            "id folder_id name tags notes favorite created_at modified_at deleted current_version_id versions",
        )
        unique(item["id"])
        ident(item["folder_id"])
        require(item["folder_id"] in folders)
        text(item["name"], 255)
        require(
            type(item["notes"]) is str
            and byte_length(item["notes"]) <= 4096
            and "\0" not in item["notes"]
        )
        require(type(item["tags"]) is list and len(item["tags"]) <= 32)
        for tag in item["tags"]:
            text(tag, 64)
        require(len(set(item["tags"])) == len(item["tags"]))
        require(type(item["favorite"]) is bool and type(item["deleted"]) is bool)
        timestamp(item["created_at"])
        timestamp(item["modified_at"])
        ident(item["current_version_id"])
        require(type(item["versions"]) is list and 1 <= len(item["versions"]) <= 11)
        versions += len(item["versions"])
        require(versions <= 100000)
        found = False
        for version in item["versions"]:
            fields(
                version,
                "id object_id object_key plaintext_size sha256 created_at media_hint",
            )
            unique(version["id"])
            ident(version["object_id"])
            require(version["object_id"] not in objects)
            objects.add(version["object_id"])
            integer(version["plaintext_size"], maximum=MAX_FILE)
            key_bytes(version)
            require(
                type(version["sha256"]) is str and HASH.fullmatch(version["sha256"])
            )
            timestamp(version["created_at"])
            text(version["media_hint"], 128, True)
            found |= version["id"] == item["current_version_id"]
        require(found)
    return catalog


def password_header(data: bytes, locator: dict):
    require(len(data) == 140 and data[:8] == b"FVKEY001")
    require(
        data[8:24] == bytes.fromhex(locator["vault_id"])
        and data[24:40] == bytes.fromhex(locator["key_epoch_id"])
    )
    ops, mem = struct.unpack_from("<IQ", data, 40)
    require(3 <= ops <= 10 and 64 * CHUNK <= mem <= 256 * CHUNK and mem % CHUNK == 0)
    return ops, mem


def unlock_key(data: bytes, locator: dict, password: bytes):
    ops, mem = password_header(data, locator)
    require(1 <= len(password) <= 1024, "INVALID_INPUT")
    try:
        password.decode("utf-8", "strict")
    except UnicodeError:
        raise SafeError("INVALID_INPUT") from None
    derived = sodium.crypto_pwhash_alg(
        32, password, data[52:68], ops, mem, sodium.crypto_pwhash_ALG_ARGON2ID13
    )
    try:
        root = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            data[92:], data[:92], data[68:92], derived
        )
    except CryptoError:
        raise SafeError("AUTH_FAILED") from None
    require(len(root) == 32)
    return root


def decode_catalog(data: bytes, locator: dict, root: bytes):
    require(104 <= len(data) <= MAX_CATALOG + 104 and data[:8] == b"FVCAT001")
    for key, offset in (("vault_id", 8), ("key_epoch_id", 24), ("snapshot_id", 40)):
        require(data[offset : offset + 16] == bytes.fromhex(locator[key]))
    length = struct.unpack_from("<Q", data, 80)[0]
    require(16 <= length <= MAX_CATALOG + 16 and length == len(data) - 88)
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=bytes.fromhex(locator["vault_id"]),
        info=b"file-safe/catalog/v1",
    ).derive(root)
    try:
        clear = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            data[88:], data[:88], data[56:80], derived
        )
    except CryptoError:
        raise SafeError("AUTH_FAILED") from None
    return validate(strict_json(clear, MAX_CATALOG), locator)


def read_bounded(path: Path, limit: int):
    with open_input(path) as f:
        require(__import__("os").fstat(f.fileno()).st_size <= limit)
        data = f.read(limit + 1)
        require(len(data) <= limit)
        return data


class Snapshot:
    def __init__(self, path: Path, password: bytes):
        self.path = path
        self.head = head(read_bounded(path / "HEAD.json", 1024))
        root = unlock_key(
            read_bounded(path / "keys" / (self.head["key_epoch_id"] + ".key"), 140),
            self.head,
            password,
        )
        self.catalog = decode_catalog(
            read_bounded(
                path / "catalogs" / (self.head["snapshot_id"] + ".cat"),
                MAX_CATALOG + 104,
            ),
            self.head,
            root,
        )

    def chunks(self, version):
        with open_input(self.path / "objects" / (version["object_id"] + ".obj")) as f:
            header = exact(f, 64)
            require(
                header[:8] == b"FVOBJ001"
                and header[8:24] == bytes.fromhex(self.head["vault_id"])
                and header[24:40] == bytes.fromhex(version["object_id"])
            )
            state = sodium.crypto_secretstream_xchacha20poly1305_state()
            sodium.crypto_secretstream_xchacha20poly1305_init_pull(
                state, header[40:64], key_bytes(version)
            )
            index, size, digest = 0, 0, hashlib.sha256()
            while True:
                encoded = exact(f, 4)
                count = struct.unpack("<I", encoded)[0]
                require(17 <= count <= CHUNK + 17)
                try:
                    clear, tag = sodium.crypto_secretstream_xchacha20poly1305_pull(
                        state,
                        exact(f, count),
                        header + struct.pack("<Q", index) + encoded,
                    )
                except CryptoError:
                    raise SafeError("AUTH_FAILED") from None
                require(
                    tag == sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
                    or (
                        tag == sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
                        and len(clear) == CHUNK
                    )
                )
                size += len(clear)
                require(size <= version["plaintext_size"])
                digest.update(clear)
                index += 1
                yield clear
                if tag == sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL:
                    require(
                        not f.read(1)
                        and size == version["plaintext_size"]
                        and digest.hexdigest() == version["sha256"]
                    )
                    break

    def verify(self):
        count = size = 0
        for item in self.catalog["files"]:
            for version in item["versions"]:
                for _ in self.chunks(version):
                    pass
                count += 1
                size += version["plaintext_size"]
        return {
            "status": "VERIFIED",
            "files": len(self.catalog["files"]),
            "versions": count,
            "plaintext_bytes": str(size),
        }
