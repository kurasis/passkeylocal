"""Synthetic independent Python writer, intentionally outside the recovery runtime."""

import base64, hashlib, json, secrets, struct, sys
from pathlib import Path
from nacl import bindings as s
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

CHUNK = 1048576
PW = "  пароль🔐é  ".encode()


def ident():
    return secrets.token_hex(16)


def encoded(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":")).encode()


def generate(path, *, large=False):
    path = Path(path)
    path.mkdir(parents=True)
    for n in ["keys", "catalogs", "objects"]:
        (path / n).mkdir()
    vault, epoch, snapshot, folder, root = (
        ident(),
        ident(),
        ident(),
        ident(),
        secrets.token_bytes(32),
    )
    head = {
        "format_version": 1,
        "vault_id": vault,
        "key_epoch_id": epoch,
        "snapshot_id": snapshot,
    }
    catalog = {
        "schema_version": 1,
        "vault_id": vault,
        "key_epoch_id": epoch,
        "snapshot_id": snapshot,
        "commit_sequence": 9007199254740993,
        "prior_snapshot_id": None,
        "folders": [{"id": folder, "parent_id": None, "name": ""}],
        "files": [],
        "policy": {"history_previous_versions": 10},
    }
    for index, size in enumerate([0] * 10000 if large else [0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 2 * CHUNK + 19]):
        data = bytes([(0x40 + index) % 256]) * size
        object_id = ident()
        key = secrets.token_bytes(32)
        state = s.crypto_secretstream_xchacha20poly1305_state()
        h = (
            b"FVOBJ001"
            + bytes.fromhex(vault)
            + bytes.fromhex(object_id)
            + s.crypto_secretstream_xchacha20poly1305_init_push(state, key)
        )
        obj = bytearray(h)
        for frame, start in enumerate(range(0, size + 1, CHUNK)):
            plain = data[start : start + CHUNK]
            final = len(plain) < CHUNK
            length = struct.pack("<I", len(plain) + 17)
            obj.extend(length)
            obj.extend(
                s.crypto_secretstream_xchacha20poly1305_push(
                    state,
                    plain,
                    h + struct.pack("<Q", frame) + length,
                    (
                        s.crypto_secretstream_xchacha20poly1305_TAG_FINAL
                        if final
                        else s.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
                    ),
                )
            )
        (path / "objects" / (object_id + ".obj")).write_bytes(obj)
        vid = ident()
        stamp = "2026-10-06T00:00:00.000Z"
        v = {
            "id": vid,
            "object_id": object_id,
            "object_key": base64.b64encode(key).decode(),
            "plaintext_size": size,
            "sha256": hashlib.sha256(data).hexdigest(),
            "created_at": stamp,
            "media_hint": "",
        }
        catalog["files"].append(
            {
                "id": ident(),
                "folder_id": folder,
                "name": f"Synthetic canary {index:05d}" if large else f"../CON.{index}.txt",
                "tags": [],
                "notes": "",
                "favorite": False,
                "created_at": stamp,
                "modified_at": stamp,
                "deleted": index == 2,
                "current_version_id": vid,
                "versions": [v],
            }
        )
    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(24)
    ad = (
        b"FVKEY001"
        + bytes.fromhex(vault)
        + bytes.fromhex(epoch)
        + struct.pack("<IQ", 3, 64 * CHUNK)
        + salt
        + nonce
    )
    derived = s.crypto_pwhash_alg(
        32, PW, salt, 3, 64 * CHUNK, s.crypto_pwhash_ALG_ARGON2ID13
    )
    (path / "keys" / (epoch + ".key")).write_bytes(
        ad + s.crypto_aead_xchacha20poly1305_ietf_encrypt(root, ad, nonce, derived)
    )
    plain = encoded(catalog)
    nonce = secrets.token_bytes(24)
    ad = (
        b"FVCAT001"
        + bytes.fromhex(vault)
        + bytes.fromhex(epoch)
        + bytes.fromhex(snapshot)
        + nonce
        + struct.pack("<Q", len(plain) + 16)
    )
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=bytes.fromhex(vault),
        info=b"file-safe/catalog/v1",
    ).derive(root)
    (path / "catalogs" / (snapshot + ".cat")).write_bytes(
        ad + s.crypto_aead_xchacha20poly1305_ietf_encrypt(plain, ad, nonce, derived)
    )
    (path / "HEAD.json").write_bytes(encoded(head))
    return catalog


if __name__ == "__main__":
    generate(sys.argv[1])
