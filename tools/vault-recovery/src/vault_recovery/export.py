"""Map the authenticated KDBX XML tree to the `localvault-recovery-json/1` document.

Independent of the browser code: it reads the raw XML produced by PyKeePass and
enumerates the whole structure (groups, recycle bin, current entries, every
history state, custom data, timestamps). Any element it does not know how to
represent losslessly makes the export fail before output is created.

Must stay equivalent to packages/vault-adapter/src/recovery-model.ts; the
interop tests compare both on the same files.
"""

from __future__ import annotations

import base64
import binascii
import re
import struct
from datetime import datetime, timedelta, timezone

from . import limits as L
from .errors import LimitError, MalformedError, UnsupportedError

FORMAT = "localvault-recovery-json/1"
_EPOCH = datetime(1, 1, 1, tzinfo=timezone.utc)
_TAG_SPLIT = re.compile(r"\s*[;,:]\s*")

META_CHILDREN = {
    "Generator", "HeaderHash", "SettingsChanged", "DatabaseName", "DatabaseNameChanged",
    "DatabaseDescription", "DatabaseDescriptionChanged", "DefaultUserName",
    "DefaultUserNameChanged", "MaintenanceHistoryDays", "Color", "MasterKeyChanged",
    "MasterKeyChangeRec", "MasterKeyChangeForce", "MasterKeyChangeForceOnce",
    "MemoryProtection", "CustomIcons", "RecycleBinEnabled", "RecycleBinUUID",
    "RecycleBinChanged", "EntryTemplatesGroup", "EntryTemplatesGroupChanged",
    "HistoryMaxItems", "HistoryMaxSize", "LastSelectedGroup", "LastTopVisibleGroup",
    "Binaries", "CustomData",
}
GROUP_CHILDREN = {
    "UUID", "Name", "Notes", "IconID", "CustomIconUUID", "Times", "IsExpanded",
    "DefaultAutoTypeSequence", "EnableAutoType", "EnableSearching", "LastTopVisibleEntry",
    "CustomData", "PreviousParentGroup", "Tags", "Entry", "Group",
}
ENTRY_CHILDREN = {
    "UUID", "IconID", "CustomIconUUID", "ForegroundColor", "BackgroundColor", "OverrideURL",
    "Tags", "Times", "String", "Binary", "AutoType", "History", "CustomData", "QualityCheck",
    "PreviousParentGroup",
}
TIMES_CHILDREN = {
    "CreationTime", "LastModificationTime", "LastAccessTime", "ExpiryTime", "Expires",
    "UsageCount", "LocationChanged",
}
AUTOTYPE_CHILDREN = {"Enabled", "DataTransferObfuscation", "DefaultSequence", "Association"}


def _unsupported(detail: str) -> UnsupportedError:
    return UnsupportedError(
        "The file contains data this tool cannot export losslessly; no output was created.", detail
    )


def _malformed(detail: str) -> MalformedError:
    return MalformedError("The file is malformed or truncated.", detail)


def _limit(detail: str) -> LimitError:
    return LimitError("A vault limit would be exceeded.", detail)


def _elements(node):
    """Child elements only (comments and whitespace text are ignored)."""
    return [c for c in node if isinstance(c.tag, str)]


def _check_children(node, allowed: set[str], where: str) -> None:
    for c in _elements(node):
        if c.tag not in allowed:
            raise _unsupported(f"unknown-element-{where}")


def _child(node, name: str):
    for c in _elements(node):
        if c.tag == name:
            return c
    return None


def _text(node) -> str | None:
    """Element text, or None for a missing element. An empty element is ''."""
    if node is None:
        return None
    if _elements(node):
        raise _malformed("unexpected-child-element")
    return node.text or ""


def _empty_to_none(s: str | None) -> str | None:
    return None if s is None or s == "" else s


def _bool(node, default: bool | None) -> bool | None:
    t = _text(node)
    if t is None:
        return default
    low = t.strip().lower()
    if low == "true":
        return True
    if low == "false":
        return False
    return None


def _int(node, default: int | None) -> int | None:
    t = _text(node)
    if t is None or t.strip() == "":
        return default
    try:
        return int(t.strip())
    except ValueError:
        raise _malformed("integer") from None


def format_time(dt: datetime) -> str:
    dt = dt.astimezone(timezone.utc)
    return f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d}T{dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}Z"


def _time(node) -> str | None:
    t = _text(node)
    if t is None or t == "":
        return None
    t = t.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z", t):
        return format_time(datetime.fromisoformat(t.replace("Z", "+00:00")))
    try:
        raw = base64.b64decode(t, validate=True)
    except binascii.Error:
        raise _malformed("time") from None
    if len(raw) != 8:
        raise _malformed("time")
    seconds = struct.unpack("<q", raw)[0]
    try:
        return format_time(_EPOCH + timedelta(seconds=seconds))
    except OverflowError:
        raise _malformed("time") from None


def uuid_text(node_or_text) -> str | None:
    t = node_or_text if isinstance(node_or_text, str) or node_or_text is None else _text(node_or_text)
    if t is None or t.strip() == "":
        return None
    try:
        raw = base64.b64decode(t.strip(), validate=True)
    except binascii.Error:
        raise _malformed("uuid") from None
    if len(raw) != 16:
        raise _malformed("uuid")
    if raw == bytes(16):
        return None
    h = raw.hex()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _tags(node) -> list[str]:
    t = _text(node)
    if not t:
        return []
    return [s for s in _TAG_SPLIT.split(t) if s]


def _custom_data(node) -> list[dict]:
    if node is None:
        return []
    out = []
    for item in _elements(node):
        if item.tag != "Item":
            raise _unsupported("unknown-element-customdata")
        _check_children(item, {"Key", "Value", "LastModificationTime"}, "customdata-item")
        key = _text(_child(item, "Key"))
        if key is None:
            raise _malformed("customdata-key")
        out.append({
            "key": key,
            "value": _text(_child(item, "Value")) or "",
            "last_modified": _time(_child(item, "LastModificationTime")),
        })
    return out


def _times(node) -> dict:
    if node is not None:
        _check_children(node, TIMES_CHILDREN, "times")
    get = (lambda name: _child(node, name)) if node is not None else (lambda name: None)
    usage = _int(get("UsageCount"), 0)
    return {
        "creation": _time(get("CreationTime")),
        "last_modification": _time(get("LastModificationTime")),
        "last_access": _time(get("LastAccessTime")),
        "expiry": _time(get("ExpiryTime")),
        "expires": _bool(get("Expires"), False) is True,
        "usage_count": str(usage),
        "location_changed": _time(get("LocationChanged")),
    }


def _auto_type(node) -> dict:
    if node is None:
        return {"enabled": True, "obfuscation": 0, "default_sequence": None, "associations": []}
    _check_children(node, AUTOTYPE_CHILDREN, "autotype")
    assoc = []
    for a in _elements(node):
        if a.tag != "Association":
            continue
        _check_children(a, {"Window", "KeystrokeSequence"}, "autotype-association")
        assoc.append({
            "window": _text(_child(a, "Window")) or "",
            "sequence": _text(_child(a, "KeystrokeSequence")) or "",
        })
    return {
        "enabled": _bool(_child(node, "Enabled"), True) is not False,
        "obfuscation": _int(_child(node, "DataTransferObfuscation"), 0) or 0,
        "default_sequence": _empty_to_none(_text(_child(node, "DefaultSequence"))),
        "associations": assoc,
    }


def _scalar_len(s: str) -> int:
    return len(s)  # Python str length counts Unicode scalar values


def _fields(entry) -> list[dict]:
    out = []
    names = set()
    custom = 0
    for s in _elements(entry):
        if s.tag != "String":
            continue
        _check_children(s, {"Key", "Value"}, "string")
        key = _text(_child(s, "Key"))
        value_node = _child(s, "Value")
        if key is None or value_node is None:
            raise _malformed("string-field")
        if key in names:
            raise _unsupported("duplicate-field-name")
        names.add(key)
        value = _text(value_node) or ""
        protected = (value_node.get("Protected") or "").lower() == "true"
        if key not in L.STANDARD_FIELDS:
            custom += 1
            if _scalar_len(key) > L.MAX_SHORT_TEXT:
                raise _limit("custom-field-name-too-long")
            if _scalar_len(value) > L.MAX_MEDIUM_TEXT:
                raise _limit("custom-field-value-too-long")
        elif key == "Title":
            if _scalar_len(value) > L.MAX_SHORT_TEXT:
                raise _limit("title-too-long")
        elif key == "Notes":
            if _scalar_len(value) > L.MAX_NOTES:
                raise _limit("notes-too-long")
        elif _scalar_len(value) > L.MAX_MEDIUM_TEXT:
            raise _limit(f"{key.lower()}-too-long")
        out.append({"name": key, "value": value, "protected": protected})
    if custom > L.MAX_CUSTOM_FIELDS:
        raise _limit("too-many-custom-fields")
    return out


def _entry_state(entry) -> dict:
    _check_children(entry, ENTRY_CHILDREN, "entry")
    if _child(entry, "Binary") is not None:
        raise _unsupported("attachments")
    if uuid_text(_child(entry, "CustomIconUUID")) is not None:
        raise _unsupported("custom-icons")
    tags = _tags(_child(entry, "Tags"))
    if len(tags) > L.MAX_TAGS:
        raise _limit("too-many-tags")
    for t in tags:
        if _scalar_len(t) > L.MAX_SHORT_TEXT:
            raise _limit("tag-too-long")
    custom = _custom_data(_child(entry, "CustomData"))
    cd = {c["key"]: c["value"] for c in custom}
    return {
        "icon_id": _int(_child(entry, "IconID"), 0) or 0,
        "custom_icon_uuid": None,
        "foreground_color": _empty_to_none(_text(_child(entry, "ForegroundColor"))),
        "background_color": _empty_to_none(_text(_child(entry, "BackgroundColor"))),
        "override_url": _empty_to_none(_text(_child(entry, "OverrideURL"))),
        "quality_check": _bool(_child(entry, "QualityCheck"), None),
        "previous_parent_group": uuid_text(_child(entry, "PreviousParentGroup")),
        "fields": _fields(entry),
        "tags": tags,
        "times": _times(_child(entry, "Times")),
        "custom_data": custom,
        "favorite": cd.get(L.ENTRY_FAVORITE) == "true",
        "deleted_at": _empty_to_none(cd.get(L.ENTRY_DELETED_AT)),
        "auto_type": _auto_type(_child(entry, "AutoType")),
    }


class _Counter:
    def __init__(self) -> None:
        self.entries = 0
        self.history = 0
        self.groups = 0


def build_model(tree, kdbx_version: str) -> dict:
    """Return the recovery document without `exported_at` and `source.sha256`."""
    root_el = tree.getroot()
    if root_el.tag != "KeePassFile":
        raise _malformed("root-element")
    _check_children(root_el, {"Meta", "Root"}, "keepassfile")
    meta = _child(root_el, "Meta")
    root = _child(root_el, "Root")
    if meta is None or root is None:
        raise _malformed("missing-meta-or-root")
    _check_children(meta, META_CHILDREN, "meta")
    icons = _child(meta, "CustomIcons")
    if icons is not None and _elements(icons):
        raise _unsupported("custom-icons")
    binaries = _child(meta, "Binaries")
    if binaries is not None and _elements(binaries):
        raise _unsupported("attachments")
    _check_children(root, {"Group", "DeletedObjects"}, "root")

    recycle_bin_uuid = uuid_text(_child(meta, "RecycleBinUUID"))
    meta_custom = _custom_data(_child(meta, "CustomData"))
    meta_cd = {c["key"]: c["value"] for c in meta_custom}
    schema = meta_cd.get(L.META_SCHEMA_VERSION)
    if schema is not None and schema != L.SUPPORTED_SCHEMA_VERSION:
        raise UnsupportedError(
            "This file was written by a newer product version; update the recovery tool.",
            "schema-version-newer",
        )

    groups: list[dict] = []
    entries: list[dict] = []
    count = _Counter()

    def walk(g, parent_uuid: str | None, path: list[str], in_bin: bool, depth: int) -> None:
        _check_children(g, GROUP_CHILDREN, "group")
        count.groups += 1
        if count.groups > L.MAX_GROUPS:
            raise _limit("too-many-groups")
        if depth > L.MAX_GROUP_DEPTH:
            raise _limit("groups-too-deep")
        if uuid_text(_child(g, "CustomIconUUID")) is not None:
            raise _unsupported("custom-icons")
        uuid = uuid_text(_child(g, "UUID"))
        if uuid is None:
            raise _malformed("group-uuid")
        name = _text(_child(g, "Name")) or ""
        notes = _text(_child(g, "Notes"))
        if _scalar_len(name) > L.MAX_SHORT_TEXT:
            raise _limit("group-name-too-long")
        if notes is not None and _scalar_len(notes) > L.MAX_NOTES:
            raise _limit("group-notes-too-long")
        here = [*path, name]
        bin_here = in_bin or (recycle_bin_uuid is not None and uuid == recycle_bin_uuid)
        groups.append({
            "uuid": uuid,
            "parent_uuid": parent_uuid,
            "name": name,
            "notes": _empty_to_none(notes),
            "icon_id": _int(_child(g, "IconID"), 0) or 0,
            "custom_icon_uuid": None,
            "times": _times(_child(g, "Times")),
            "is_expanded": _bool(_child(g, "IsExpanded"), True) is not False,
            "default_auto_type_sequence": _empty_to_none(_text(_child(g, "DefaultAutoTypeSequence"))),
            "enable_auto_type": _bool(_child(g, "EnableAutoType"), None),
            "enable_searching": _bool(_child(g, "EnableSearching"), None),
            "last_top_visible_entry": uuid_text(_child(g, "LastTopVisibleEntry")),
            "previous_parent_group": uuid_text(_child(g, "PreviousParentGroup")),
            "tags": _tags(_child(g, "Tags")),
            "custom_data": _custom_data(_child(g, "CustomData")),
            "in_recycle_bin": bin_here,
        })
        for e in _elements(g):
            if e.tag != "Entry":
                continue
            count.entries += 1
            if count.entries > L.MAX_ENTRIES:
                raise _limit("too-many-entries")
            e_uuid = uuid_text(_child(e, "UUID"))
            if e_uuid is None:
                raise _malformed("entry-uuid")
            history = []
            hist_el = _child(e, "History")
            if hist_el is not None:
                for i, h in enumerate(_elements(hist_el)):
                    if h.tag != "Entry":
                        raise _unsupported("unknown-element-history")
                    if _child(h, "History") is not None:
                        raise _unsupported("nested-history")
                    count.history += 1
                    if count.history > L.MAX_HISTORY_VERSIONS:
                        raise _limit("too-many-history-versions")
                    history.append({"history_index": i, **_entry_state(h)})
            entries.append({
                "uuid": e_uuid,
                "group_uuid": uuid,
                "group_path": here,
                "in_recycle_bin": bin_here,
                **_entry_state(e),
                "history": history,
            })
        for sub in _elements(g):
            if sub.tag == "Group":
                walk(sub, uuid, here, bin_here, depth + 1)

    for g in _elements(root):
        if g.tag == "Group":
            walk(g, None, [], False, 1)

    deleted = []
    dobj = _child(root, "DeletedObjects")
    if dobj is not None:
        for d in _elements(dobj):
            if d.tag != "DeletedObject":
                raise _unsupported("unknown-element-deletedobjects")
            _check_children(d, {"UUID", "DeletionTime"}, "deletedobject")
            d_uuid = uuid_text(_child(d, "UUID"))
            if d_uuid is None:
                raise _malformed("deleted-object-uuid")
            deleted.append({"uuid": d_uuid, "deletion_time": _time(_child(d, "DeletionTime"))})

    return {
        "format": FORMAT,
        "source": {
            "kdbx_version": kdbx_version,
            "vault_id": meta_cd.get(L.META_VAULT_ID),
            "lineage_id": meta_cd.get(L.META_LINEAGE_ID),
            "revision": meta_cd.get(L.META_REVISION),
        },
        "metadata": {
            "name": _empty_to_none(_text(_child(meta, "DatabaseName"))),
            "description": _empty_to_none(_text(_child(meta, "DatabaseDescription"))),
            "default_username": _empty_to_none(_text(_child(meta, "DefaultUserName"))),
            "recycle_bin_enabled": _bool(_child(meta, "RecycleBinEnabled"), False) is True,
            "recycle_bin_uuid": recycle_bin_uuid,
            "history_max_items": _int(_child(meta, "HistoryMaxItems"), None),
            "history_max_size": _int(_child(meta, "HistoryMaxSize"), None),
            "custom_data": meta_custom,
        },
        "groups": groups,
        "entries": entries,
        "deleted_objects": deleted,
    }


def build_export(tree, kdbx_version: str, sha256: str, exported_at: datetime) -> dict:
    """Complete recovery document in the documented key order."""
    model = build_model(tree, kdbx_version)
    return {
        "format": model["format"],
        "source": {"sha256": sha256, **model["source"]},
        "exported_at": format_time(exported_at),
        "metadata": model["metadata"],
        "groups": model["groups"],
        "entries": model["entries"],
        "deleted_objects": model["deleted_objects"],
    }


def summarize(model: dict) -> dict:
    """Counts only; safe to print."""
    return {
        "groups": len(model["groups"]),
        "entries": sum(1 for e in model["entries"] if not e["in_recycle_bin"]),
        "recycled_entries": sum(1 for e in model["entries"] if e["in_recycle_bin"]),
        "history_versions": sum(len(e["history"]) for e in model["entries"]),
        "deleted_objects": len(model["deleted_objects"]),
    }
