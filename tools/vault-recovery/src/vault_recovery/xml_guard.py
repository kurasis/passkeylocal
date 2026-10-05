"""Pre-parse checks for the authenticated XML payload.

Mirrors packages/vault-adapter/src/xml-guard.ts: no DTD or entity declarations,
no processing instructions other than the XML declaration, no XInclude, no raw
control characters, bounded depth and element count. Linear scan, no DOM.
"""

from __future__ import annotations

import re

from . import limits as L
from .errors import LimitError, MalformedError, UnsupportedError

XINCLUDE_NS = "http://www.w3.org/2001/XInclude"
_FORBIDDEN = re.compile("[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]")
_XML_DECL = re.compile(r"xml[\s?]")


def _malformed(detail: str) -> MalformedError:
    return MalformedError("The file is malformed or truncated.", detail)


def _reject(detail: str) -> UnsupportedError:
    return UnsupportedError("This file uses a format or feature that is not supported.", detail)


def decode_payload(data: bytes) -> str:
    """Strict UTF-8 decoding: invalid sequences are rejected, never replaced."""
    try:
        return data.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        raise _malformed("invalid-utf8") from None


def assert_safe_xml(xml: str, max_depth: int = L.MAX_XML_DEPTH, max_elements: int = L.MAX_XML_ELEMENTS) -> None:
    if _FORBIDDEN.search(xml):
        raise _malformed("xml-forbidden-character")
    if XINCLUDE_NS in xml:
        raise _reject("xml-xinclude")

    depth = 0
    elements = 0
    saw_root = False
    i = 0
    n = len(xml)
    decl_start = 1 if xml.startswith("﻿") else 0
    while i < n:
        lt = xml.find("<", i)
        if lt < 0:
            break
        nxt = xml[lt + 1 : lt + 2]
        if nxt == "!":
            if xml.startswith("<!--", lt):
                end = xml.find("-->", lt + 4)
                if end < 0:
                    raise _malformed("xml-unterminated-comment")
                i = end + 3
                continue
            if xml.startswith("<![CDATA[", lt):
                if depth == 0:
                    raise _malformed("xml-cdata-outside-root")
                end = xml.find("]]>", lt + 9)
                if end < 0:
                    raise _malformed("xml-unterminated-cdata")
                i = end + 3
                continue
            raise _reject("xml-dtd-or-declaration")
        if nxt == "?":
            end = xml.find("?>", lt + 2)
            if end < 0:
                raise _malformed("xml-unterminated-pi")
            if not (lt == decl_start and _XML_DECL.match(xml, lt + 2)):
                raise _reject("xml-processing-instruction")
            i = end + 2
            continue
        j = lt + 1
        quote = ""
        while j < n:
            c = xml[j]
            if quote:
                if c == quote:
                    quote = ""
            elif c in "\"'":
                quote = c
            elif c == ">":
                break
            elif c == "<":
                raise _malformed("xml-unexpected-lt")
            j += 1
        if j >= n:
            raise _malformed("xml-unterminated-tag")
        if nxt == "/":
            depth -= 1
            if depth < 0:
                raise _malformed("xml-unbalanced")
        else:
            if depth == 0:
                if saw_root:
                    raise _malformed("xml-multiple-roots")
                saw_root = True
            elements += 1
            if elements > max_elements:
                raise LimitError("A vault limit would be exceeded.", "xml-too-many-elements")
            if xml[j - 1] != "/":
                depth += 1
                if depth > max_depth:
                    raise LimitError("A vault limit would be exceeded.", "xml-too-deep")
        i = j + 1
    if not saw_root:
        raise _malformed("xml-no-root")
    if depth != 0:
        raise _malformed("xml-unbalanced")
