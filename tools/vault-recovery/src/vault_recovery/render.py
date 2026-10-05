"""Terminal-safe rendering of untrusted vault strings."""

from __future__ import annotations

import json
import unicodedata

MASK = "********"


def safe_text(s: str) -> str:
    """Escape control and format characters so imported text cannot drive the terminal.

    ANSI escape sequences, carriage returns, bidi overrides and other C0/C1/Cf
    characters are shown as \\uXXXX escapes. Printable text is unchanged.
    """
    out = []
    for ch in s:
        cat = unicodedata.category(ch)
        if ch == "\\":
            out.append("\\\\")
        elif cat in ("Cc", "Cf", "Cs", "Co", "Cn", "Zl", "Zp"):
            code = ord(ch)
            out.append(f"\\u{code:04x}" if code <= 0xFFFF else f"\\U{code:08x}")
        else:
            out.append(ch)
    return "".join(out)


def secret_json(s: str) -> str:
    """Revealed secrets are printed as escaped JSON strings (ASCII-only, inert)."""
    return json.dumps(s, ensure_ascii=True)
