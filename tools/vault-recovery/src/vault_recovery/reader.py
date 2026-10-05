"""Open and authenticate a KDBX file with PyKeePass, after the bounded preflight.

PyKeePass integration patches (narrow, documented in docs/DEPENDENCIES.md):
  1. The XML adapter decodes UTF-8 strictly, runs the XML guard and parses with
     an lxml parser that never resolves entities, loads DTDs or touches the
     network, and keeps whitespace-only text (PyKeePass removes blank text).
  2. Protected values are decrypted strictly: invalid UTF-8 or characters that
     cannot be represented in XML fail the operation instead of being silently
     stripped or logged.
"""

from __future__ import annotations

import base64
import hashlib
import io
import re
from dataclasses import dataclass

from . import limits as L
from .errors import AuthError, LimitError, MalformedError, RecoveryError, UnsupportedError
from .preflight import PreflightSummary, preflight
from .xml_guard import assert_safe_xml, decode_payload

try:
    from lxml import etree
    from pykeepass import PyKeePass
    from pykeepass.exceptions import CredentialsError, HeaderChecksumError, PayloadChecksumError
    from pykeepass.kdbx_parsing import common as _kp_common
except ImportError as exc:  # pragma: no cover - exercised only without dependencies
    raise RecoveryError(
        "Required dependencies are missing. Install them from the offline kit "
        "(see tools/vault-recovery/README.md); nothing is downloaded automatically.",
        "dependency-missing",
    ) from exc

_XML_INVALID = re.compile("[^\u0009\u000a\u000d -퟿-�\U00010000-\U0010ffff]")
_PATCHED = False


def _hardened_parser() -> "etree.XMLParser":
    return etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        load_dtd=False,
        dtd_validation=False,
        huge_tree=False,
        remove_blank_text=False,
        remove_comments=False,
        recover=False,
        collect_ids=False,
    )


def _xml_decode(self, data, con, path):  # noqa: ARG001 - construct Adapter signature
    assert_safe_xml(decode_payload(data))
    try:
        return etree.parse(io.BytesIO(data), _hardened_parser())
    except etree.XMLSyntaxError:
        raise MalformedError("The file is malformed or truncated.", "xml") from None


def _unprotect_decode(self, tree, con, path):  # noqa: ARG001
    cipher = self.get_cipher(self.protected_stream_key(con))
    for elem in tree.xpath(self.protected_xpath):
        if elem.text is None:
            # Empty protected values still advance nothing in the stream (zero-length).
            continue
        try:
            raw = cipher.decrypt(base64.b64decode(elem.text, validate=True))
        except Exception:
            raise MalformedError("The file is malformed or truncated.", "protected-value") from None
        try:
            text = raw.decode("utf-8", errors="strict")
        except UnicodeDecodeError:
            raise MalformedError("The file is malformed or truncated.", "protected-value-utf8") from None
        if _XML_INVALID.search(text):
            raise UnsupportedError(
                "A protected value contains characters this tool cannot represent.",
                "protected-value-characters",
            )
        elem.text = text
    return tree


def install_patches() -> None:
    global _PATCHED
    if _PATCHED:
        return
    _kp_common.XML._decode = _xml_decode
    _kp_common.UnprotectedStream._decode = _unprotect_decode
    _PATCHED = True


@dataclass
class OpenedVault:
    kp: "PyKeePass"
    tree: "etree._ElementTree"
    preflight: PreflightSummary
    sha256: str


def read_password_limits(password: str) -> None:
    if password == "":
        raise RecoveryError("The password must not be empty.", "password-empty")
    if len(password.encode("utf-8")) > L.RECOVERY_PASSWORD_MAX_BYTES:
        raise LimitError("The password is longer than the supported maximum.", "password-too-long")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def open_vault(data: bytes, password: str) -> OpenedVault:
    """Preflight, then authenticate and parse the complete file. Raises RecoveryError."""
    summary = preflight(data)
    read_password_limits(password)
    install_patches()
    try:
        kp = PyKeePass(io.BytesIO(data), password=password)
    except RecoveryError:
        raise
    except CredentialsError:
        raise AuthError("header-hmac") from None
    except PayloadChecksumError:
        raise AuthError("block-hmac") from None
    except HeaderChecksumError:
        raise MalformedError("The file is malformed or truncated.", "header") from None
    except Exception:
        # Construct/stream errors after a passing preflight: authenticated structure is unusable.
        raise MalformedError("The file is malformed or truncated.", "payload") from None

    inner = kp.kdbx.body.payload.inner_header
    if inner.protected_stream_id.data != "chacha20":
        raise UnsupportedError("This file uses a format or feature that is not supported.", "inner-stream")
    if getattr(inner, "binary", None):
        raise UnsupportedError("This file contains attachments, which are not supported.", "attachments")
    return OpenedVault(kp=kp, tree=kp.tree, preflight=summary, sha256=sha256_hex(data))
