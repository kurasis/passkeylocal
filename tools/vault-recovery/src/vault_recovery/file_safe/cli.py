"""Offline CLI: authenticated recovery is independent of app/TPM/Windows Hello."""

from __future__ import annotations
import argparse
import json
import shutil
import sys
from pathlib import Path
from ..cli import _read_password
from ..errors import RecoveryError
from .format import (
    Snapshot,
    SafeError,
    MAX_CATALOG,
    head,
    password_header,
    read_bounded,
    require,
)
from .paths import OutputRoot, safe_component


def selection(snapshot, args):
    selected = []
    for item in snapshot.catalog["files"]:
        if args.file_id:
            if item["id"] != args.file_id:
                continue
        elif item["deleted"] and not args.include_trash:
            continue
        for version in item["versions"]:
            if args.version_id:
                if version["id"] != args.version_id:
                    continue
            elif (
                not args.include_history and version["id"] != item["current_version_id"]
            ):
                continue
            selected.append((item, version))
    if args.file_id:
        require(selected, "NOT_FOUND")
    return selected


def extract(snapshot, args):
    require(args.acknowledge_plaintext, "PLAINTEXT_ACK_REQUIRED")
    require(not args.version_id or args.file_id, "INVALID_INPUT")
    selected = selection(snapshot, args)
    total = sum(v["plaintext_size"] for _, v in selected)
    require(
        0 < args.quota_bytes <= 2**64 - 1 and total <= args.quota_bytes,
        "LIMIT_EXCEEDED",
    )
    output = Path(args.output).absolute()
    require(shutil.disk_usage(output.parent).free >= total, "SPACE_REQUIRED")
    folders = {f["id"]: f for f in snapshot.catalog["folders"]}
    report = {
        "format": "file-safe-recovery-report/v1",
        "status": "COMPLETE",
        "files": [],
        "expected_bytes": str(total),
    }
    failure = None
    with OutputRoot(output) as root:
        try:
            for item, version in selected:
                originals = []
                components = []
                node = folders[item["folder_id"]]
                while node["parent_id"] is not None:
                    originals.insert(0, node["name"])
                    components.insert(0, safe_component(node["name"], node["id"]))
                    node = folders[node["parent_id"]]
                if item["deleted"]:
                    components.insert(0, "Trash")
                if version["id"] != item["current_version_id"]:
                    components.insert(0, "History")
                suffix = item["id"] + (
                    "-" + version["id"]
                    if version["id"] != item["current_version_id"]
                    else ""
                )
                components.append(safe_component(item["name"], suffix))
                parts = tuple(components)
                with root.temporary(parts) as f:
                    for block in snapshot.chunks(version):
                        f.write(block)
                report["files"].append(
                    {
                        "file_id": item["id"],
                        "version_id": version["id"],
                        "original_parts": [*originals, item["name"]],
                        "output": "/".join(parts),
                        "status": "VERIFIED",
                    }
                )
        except (SafeError, OSError, KeyboardInterrupt) as e:
            failure = e
            report["status"] = "PARTIAL"
            report["failure_code"] = (
                e.code
                if isinstance(e, SafeError)
                else "CANCELLED" if isinstance(e, KeyboardInterrupt) else "IO_FAILED"
            )
        with root.temporary(("recovery-report.json",)) as f:
            f.write(json.dumps(report, ensure_ascii=True, indent=2).encode("utf-8"))
    if failure:
        raise SafeError("PARTIAL")
    return {
        "status": "EXTRACTED_PLAINTEXT",
        "files": len(report["files"]),
        "bytes": str(total),
    }


def parser():
    p = argparse.ArgumentParser(
        prog="file-safe-recover",
        description="Independent offline encrypted file-safe recovery. Extract writes plaintext.",
    )
    sub = p.add_subparsers(dest="command", required=True)
    for command in ["inspect", "verify", "list", "extract"]:
        cmd = sub.add_parser(command)
        cmd.add_argument("backup_dir", type=Path)
        if command != "inspect":
            cmd.add_argument(
                "--password-stdin",
                action="store_true",
                help="Exact UTF-8 bytes from a protected input pipe; no trimming. No password argument/env variable.",
            )
        if command == "extract":
            cmd.add_argument("--output", required=True, type=Path)
            cmd.add_argument(
                "--acknowledge-plaintext",
                action="store_true",
                help="Acknowledge that recovered copies remain unencrypted outside the safe.",
            )
            cmd.add_argument("--file-id")
            cmd.add_argument("--version-id")
            cmd.add_argument("--include-history", action="store_true")
            cmd.add_argument("--include-trash", action="store_true")
            cmd.add_argument(
                "--quota-bytes",
                type=int,
                default=64 * 1024**3,
                help="Maximum planned output bytes; default 64 GiB.",
            )
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if args.command == "inspect":
            h = head(read_bounded(args.backup_dir / "HEAD.json", 1024))
            ops, mem = password_header(
                read_bounded(
                    args.backup_dir / "keys" / (h["key_epoch_id"] + ".key"), 140
                ),
                h,
            )
            result = {
                "status": "UNAUTHENTICATED",
                "format": "file-safe/v1",
                "opslimit": ops,
                "memlimit_bytes": str(mem),
            }
        else:
            pw = _read_password(args).encode("utf-8", errors="strict")
            require(1 <= len(pw) <= 1024, "INVALID_INPUT")
            snapshot = Snapshot(args.backup_dir, pw)
            del pw
            if args.command == "verify":
                result = snapshot.verify()
            elif args.command == "list":
                result = {
                    "status": "AUTHENTICATED_METADATA",
                    "content_verified": False,
                    "files": [
                        {
                            "id": f["id"],
                            "name": f["name"],
                            "folder_id": f["folder_id"],
                            "deleted": f["deleted"],
                            "versions": [
                                {"id": v["id"], "size": str(v["plaintext_size"])}
                                for v in f["versions"]
                            ],
                        }
                        for f in snapshot.catalog["files"]
                    ],
                }
            else:
                result = extract(snapshot, args)
        print(json.dumps(result, ensure_ascii=True))
        return 0
    except SafeError as e:
        messages = {
            "AUTH_FAILED": "Authentication failed: wrong password or damaged encrypted data.",
            "PARTIAL": "Partial recovery. Verified files and original-name mapping are recorded in the output recovery-report.json. Partial temporary files are removed where possible.",
            "PLAINTEXT_ACK_REQUIRED": "Extraction requires --acknowledge-plaintext; recovered files remain outside the safe.",
        }
        print(
            messages.get(e.code, f"File-safe recovery failed ({e.code})."),
            file=sys.stderr,
        )
        return 3 if e.code == "PARTIAL" else 2
    except RecoveryError as e:
        print(e.message, file=sys.stderr)
        return 2
    except (OSError, ValueError, UnicodeError):
        print(
            "File-safe recovery failed (IO_OR_INPUT). Existing encrypted data was not modified. If extraction started, inspect its private output directory for verified files or partial remnants.",
            file=sys.stderr,
        )
        return 2
    except KeyboardInterrupt:
        print(
            "Recovery canceled. Inspect any output directory for partial plaintext remnants.",
            file=sys.stderr,
        )
        return 130
    except Exception:
        print(
            "File-safe recovery failed (INTERNAL). No secret details are logged.",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
