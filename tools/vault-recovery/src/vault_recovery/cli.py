"""Command-line interface: python -m vault_recovery <command> <file> [options].

No command modifies the input file, and nothing here performs network access.
Passwords are never accepted as arguments or environment variables.
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from . import limits as L
from .errors import (
    EXIT_CANCELLED,
    EXIT_IO,
    EXIT_OK,
    Cancelled,
    LimitError,
    LocalIOError,
    RecoveryError,
    UsageError,
)
from .render import MASK, safe_text, secret_json

PLAINTEXT_WARNING = (
    "WARNING: the export is UNENCRYPTED. It contains every current and historical\n"
    "password in the vault. Keep it only as long as needed, on a private disk, and\n"
    "delete it afterwards (deletion is not guaranteed secure erasure on SSDs or\n"
    "synced folders). The original encrypted file is not modified."
)


def _read_input(path: Path) -> bytes:
    try:
        with open(path, "rb") as fh:
            data = fh.read(L.MAX_FILE_BYTES + 1)
    except FileNotFoundError:
        raise LocalIOError("The input file does not exist.", "input-missing") from None
    except IsADirectoryError:
        raise LocalIOError("The input path is a directory.", "input-directory") from None
    except OSError as exc:
        raise LocalIOError(f"Could not read the input file ({exc.__class__.__name__}).", "input-read") from None
    if len(data) > L.MAX_FILE_BYTES:
        raise LimitError("The file is larger than the supported maximum (16 MiB).", "file-too-large")
    return data


def _read_password(args: argparse.Namespace) -> str:
    if args.password_stdin:
        raw = sys.stdin.buffer.read(L.RECOVERY_PASSWORD_MAX_BYTES + 1)
        if len(raw) > L.RECOVERY_PASSWORD_MAX_BYTES:
            raise LimitError("The password on standard input exceeds 4096 bytes.", "password-too-long")
        if not raw:
            raise UsageError("No password was provided on standard input.", "password-empty")
        try:
            # Exact bytes: nothing is trimmed, including a trailing newline.
            return raw.decode("utf-8", errors="strict")
        except UnicodeDecodeError:
            raise UsageError("The password on standard input is not valid UTF-8.", "password-utf8") from None
    no_prompt = UsageError(
        "No terminal is available for a hidden password prompt. "
        "For automation, pass the password with --password-stdin.",
        "no-safe-prompt",
    )
    if sys.platform == "win32" and not sys.stdin.isatty():
        # Windows getpass reads the console directly and has no echo fallback warning.
        raise no_prompt
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        try:
            pw = getpass.getpass("Master password (input hidden): ")
        except getpass.GetPassWarning:
            raise no_prompt from None
        except (KeyboardInterrupt, EOFError):
            raise Cancelled() from None
    if pw == "":
        raise UsageError("The password must not be empty.", "password-empty")
    return pw


def _confirm_on_terminal(question: str) -> bool:
    """Ask on the controlling terminal (not stdin, which may carry the password)."""
    try:
        if sys.platform == "win32":
            tin, tout = open("CONIN$", "r", encoding="utf-8"), open("CONOUT$", "w", encoding="utf-8")
        else:
            tin = tout = open("/dev/tty", "r+", encoding="utf-8")
    except OSError:
        raise UsageError(
            "Explicit confirmation is required but no terminal is available; re-run with --yes.",
            "confirmation-missing",
        ) from None
    try:
        tout.write(f"{question} Type 'yes' to continue: ")
        tout.flush()
        answer = tin.readline()
    except KeyboardInterrupt:
        raise Cancelled() from None
    finally:
        tin.close()
        if tout is not tin:
            tout.close()
    return answer.strip().lower() == "yes"


def _open(args: argparse.Namespace):
    from .reader import open_vault  # imported lazily so `inspect` works without heavy imports

    data = _read_input(args.file)
    password = _read_password(args)
    try:
        return open_vault(data, password)
    finally:
        del password


def _model(opened) -> dict:
    from .export import build_model

    return build_model(opened.tree, opened.preflight.kdbx_version)


def cmd_inspect(args: argparse.Namespace) -> int:
    from .preflight import preflight
    from .reader import sha256_hex

    data = _read_input(args.file)
    summary = preflight(data)
    info = {**summary.as_dict(), "sha256": sha256_hex(data)}
    if args.json:
        print(json.dumps(info, indent=2))
        return EXIT_OK
    k = info["kdf"]
    print("UNAUTHENTICATED header metadata (no password used; values are not verified):")
    print(f"  File size:     {info['file_size']} bytes")
    print(f"  SHA-256:       {info['sha256']}")
    print(f"  KDBX version:  {info['kdbx_version']}")
    print(f"  Cipher:        {info['cipher']}")
    print(f"  Compression:   {info['compression']}")
    print(f"  KDF:           {k['algorithm']} v0x{k['version']:x}, memory {k['memory_bytes'] // 1024} KiB, "
          f"iterations {k['iterations']}, parallelism {k['parallelism']}, salt {k['salt_length']} bytes")
    print(f"  Payload:       {info['payload_bytes']} bytes in {info['block_count']} blocks")
    return EXIT_OK


def cmd_verify(args: argparse.Namespace) -> int:
    from .export import summarize

    opened = _open(args)
    model = _model(opened)
    src = model["source"]
    result = {
        "result": "passed",
        "sha256": opened.sha256,
        "kdbx_version": opened.preflight.kdbx_version,
        "product_schema": None if src["vault_id"] is None else L.SUPPORTED_SCHEMA_VERSION,
        "vault_id": src["vault_id"],
        "lineage_id": src["lineage_id"],
        "revision": src["revision"],
        "counts": summarize(model),
    }
    if args.json:
        print(json.dumps(result, indent=2))
        return EXIT_OK
    c = result["counts"]
    print("Verification PASSED: the file was authenticated and fully parsed.")
    print(f"  SHA-256:          {result['sha256']}")
    print(f"  KDBX version:     {result['kdbx_version']}")
    if src["revision"] is not None:
        print(f"  Product revision: {safe_text(src['revision'])} (vault {safe_text(src['vault_id'] or '?')})")
    else:
        print("  Product revision: unknown (no PassKey Local metadata)")
    print(f"  Groups: {c['groups']}  Entries: {c['entries']}  In recycle bin: {c['recycled_entries']}  "
          f"History versions: {c['history_versions']}")
    print("  Note: this proves the selected file is intact. It does not prove it is your latest revision.")
    return EXIT_OK


def _field(fields: list[dict], name: str) -> str:
    for f in fields:
        if f["name"] == name:
            return f["value"]
    return ""


def cmd_list(args: argparse.Namespace) -> int:
    opened = _open(args)
    model = _model(opened)
    query = args.query
    needle = query.casefold() if query else None
    rows = 0
    print("UUID                                  GROUP / TITLE / USERNAME")
    for e in model["entries"]:
        title = _field(e["fields"], "Title")
        user = _field(e["fields"], "UserName")
        if needle is not None:
            hay = [title, user, _field(e["fields"], "URL"), " / ".join(e["group_path"])]
            if not any(needle in h.casefold() for h in hay):
                continue
        flag = "  [recycle bin]" if e["in_recycle_bin"] else ""
        path = " / ".join(e["group_path"])
        print(f"{e['uuid']}  {safe_text(path)} / {safe_text(title)} / {safe_text(user)}{flag}")
        rows += 1
    print(f"{rows} entr{'y' if rows == 1 else 'ies'}.")
    return EXIT_OK


def _print_state(state: dict, reveal: bool, indent: str) -> None:
    for f in state["fields"]:
        secret = f["protected"] or f["name"] == "Password"
        if secret:
            value = secret_json(f["value"]) if reveal else MASK
        else:
            value = safe_text(f["value"])
        label = safe_text(f["name"]) + (" (protected)" if f["protected"] else "")
        print(f"{indent}{label}: {value}")
    if state["tags"]:
        print(f"{indent}Tags: {', '.join(safe_text(t) for t in state['tags'])}")
    t = state["times"]
    print(f"{indent}Modified: {t['last_modification'] or '-'}  Created: {t['creation'] or '-'}")
    if t["expires"]:
        print(f"{indent}Expires: {t['expiry'] or '-'}")


def cmd_show(args: argparse.Namespace) -> int:
    opened = _open(args)
    model = _model(opened)
    wanted = args.uuid.strip().lower()
    entry = next((e for e in model["entries"] if e["uuid"] == wanted), None)
    if entry is None:
        raise UsageError("No entry with that UUID.", "uuid-not-found")
    print(f"UUID: {entry['uuid']}")
    print(f"Group: {safe_text(' / '.join(entry['group_path']))}")
    if entry["in_recycle_bin"]:
        print("Location: recycle bin")
    print(f"Favorite: {'yes' if entry['favorite'] else 'no'}")
    _print_state(entry, args.reveal, "  ")
    if not args.reveal:
        print("  (secret values masked; use --reveal to display them as escaped JSON strings)")
    if args.history:
        print(f"History: {len(entry['history'])} older version(s), oldest first")
        for h in entry["history"]:
            print(f"  [{h['history_index']}]")
            _print_state(h, args.reveal, "    ")
    else:
        print(f"History: {len(entry['history'])} older version(s) (use --history to show)")
    return EXIT_OK


def cmd_export_json(args: argparse.Namespace) -> int:
    from .export import build_export
    from .output import write_private_file

    if not args.allow_plaintext:
        raise UsageError(
            "export-json writes an UNENCRYPTED file. Re-run with --allow-plaintext to confirm you understand.",
            "allow-plaintext-missing",
        )
    output = Path(args.output)
    print(PLAINTEXT_WARNING, file=sys.stderr)
    opened = _open(args)
    # Build and validate the complete document before creating any output.
    doc = build_export(opened.tree, opened.preflight.kdbx_version, opened.sha256, datetime.now(timezone.utc))
    data = (json.dumps(doc, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if not args.yes and not _confirm_on_terminal(f"Write plaintext export to {safe_text(str(output))}?"):
        raise Cancelled()
    write_private_file(output, args.file, data)
    print(f"Wrote plaintext export ({len(data)} bytes) to {safe_text(str(output))}.", file=sys.stderr)
    return EXIT_OK


class _Parser(argparse.ArgumentParser):
    def error(self, message: str):  # argparse exits with status 2, as the contract requires
        self.print_usage(sys.stderr)
        self.exit(2, f"{self.prog}: error: {message}\n")


def build_parser() -> argparse.ArgumentParser:
    p = _Parser(
        prog="python -m vault_recovery",
        description="Offline recovery for PassKey Local .kdbx backups. Never modifies the input file.",
    )
    p.add_argument("--version", action="version", version=f"vault-recovery {__version__}")
    sub = p.add_subparsers(dest="command", required=True, parser_class=_Parser)

    def add(name: str, help_text: str, needs_password: bool = True) -> argparse.ArgumentParser:
        sp = sub.add_parser(name, help=help_text, description=help_text)
        sp.add_argument("file", type=Path, help="path to the .kdbx file (read only)")
        if needs_password:
            sp.add_argument(
                "--password-stdin",
                action="store_true",
                help="read the password as exact UTF-8 bytes from standard input (nothing is trimmed, "
                "not even a trailing newline); intended for automation and tests",
            )
        return sp

    sp = add("inspect", "Show unauthenticated header metadata, size and SHA-256 (no password).", needs_password=False)
    sp.add_argument("--json", action="store_true", help="machine-readable output")
    sp.set_defaults(func=cmd_inspect)

    sp = add("verify", "Authenticate and fully parse the file; print counts only.")
    sp.add_argument("--json", action="store_true", help="machine-readable output")
    sp.set_defaults(func=cmd_verify)

    sp = add("list", "List entries: UUID, group path, title, username (no secrets).")
    sp.add_argument("--query", help="literal, case-insensitive filter. Visible in shell history: never type a password here.")
    sp.set_defaults(func=cmd_list)

    sp = add("show", "Show one entry; secrets masked unless --reveal.")
    sp.add_argument("--uuid", required=True, help="exact entry UUID (see `list`)")
    sp.add_argument("--reveal", action="store_true", help="display secret values as escaped JSON strings")
    sp.add_argument("--history", action="store_true", help="include older versions")
    sp.set_defaults(func=cmd_show)

    sp = add("export-json", "Export the complete vault, including history and recycle bin, as UNENCRYPTED JSON.")
    sp.add_argument("--output", required=True, help="new file to create (never overwritten)")
    sp.add_argument("--allow-plaintext", action="store_true", help="required: acknowledge the output is unencrypted")
    sp.add_argument("--yes", action="store_true", help="skip the interactive confirmation")
    sp.set_defaults(func=cmd_export_json)
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except RecoveryError as exc:
        suffix = f" [{exc.detail}]" if exc.detail else ""
        print(f"Error: {exc.message}{suffix}", file=sys.stderr)
        return exc.exit_code
    except KeyboardInterrupt:
        print("Cancelled.", file=sys.stderr)
        return EXIT_CANCELLED
    except Exception as exc:  # never print repr() of library objects: they may contain record data
        print(f"Error: unexpected internal failure ({exc.__class__.__name__}).", file=sys.stderr)
        return EXIT_IO
