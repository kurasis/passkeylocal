"""Pinned/no-follow input and exclusive private output paths."""

from __future__ import annotations
import ctypes
import os
import stat
import sys
from contextlib import ExitStack, contextmanager
from pathlib import Path


class _HandleInfo(ctypes.Structure):
    _pack_ = 4
    _fields_ = [
        ("attributes", ctypes.c_uint32),
        ("creation", ctypes.c_uint64),
        ("access", ctypes.c_uint64),
        ("write", ctypes.c_uint64),
        ("volume", ctypes.c_uint32),
        ("size_high", ctypes.c_uint32),
        ("size_low", ctypes.c_uint32),
        ("links", ctypes.c_uint32),
        ("index_high", ctypes.c_uint32),
        ("index_low", ctypes.c_uint32),
    ]


# FILETIME is two DWORDs, so its ABI alignment must be four bytes.


@contextmanager
def anchored_directory(path: Path):
    """Walk from / using pinned descriptors; ancestor replacement cannot redirect I/O."""
    fds = []
    try:
        fd = os.open(path.anchor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        fds.append(fd)
        for part in path.parts[1:]:
            fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            fds.append(fd)
        yield fd
    finally:
        for fd in reversed(fds):
            os.close(fd)


@contextmanager
def pin(path: Path):
    handles = []
    try:
        for p in [*reversed(path.parents), path]:
            info = p.lstat()
            if (
                stat.S_ISLNK(info.st_mode)
                or getattr(info, "st_file_attributes", 0) & 0x400
            ):
                raise OSError("unsafe path")
            if sys.platform == "win32":
                from ctypes import wintypes

                kernel = ctypes.WinDLL("kernel32", use_last_error=True)
                kernel.CreateFileW.argtypes = [
                    wintypes.LPCWSTR,
                    wintypes.DWORD,
                    wintypes.DWORD,
                    ctypes.c_void_p,
                    wintypes.DWORD,
                    wintypes.DWORD,
                    wintypes.HANDLE,
                ]
                kernel.CreateFileW.restype = wintypes.HANDLE
                kernel.CloseHandle.argtypes = [wintypes.HANDLE]
                kernel.CloseHandle.restype = wintypes.BOOL
                h = kernel.CreateFileW(
                    str(p), 0x80, 3, None, 3, 0x02000000 | 0x00200000, None
                )
                if h == ctypes.c_void_p(-1).value:
                    raise OSError("cannot pin directory")
                handles.append((kernel, h))
                kernel.GetFileInformationByHandle.argtypes = [
                    wintypes.HANDLE,
                    ctypes.POINTER(_HandleInfo),
                ]
                kernel.GetFileInformationByHandle.restype = wintypes.BOOL
                opened = _HandleInfo()
                if (
                    not kernel.GetFileInformationByHandle(h, ctypes.byref(opened))
                    or opened.attributes & 0x400
                    or not opened.attributes & 0x10
                ):
                    raise OSError("unsafe opened directory")
        yield
    finally:
        for kernel, h in reversed(handles):
            kernel.CloseHandle(h)


@contextmanager
def open_input(path: Path):
    path = path.absolute()
    with (
        pin(path.parent) if sys.platform == "win32" else anchored_directory(path.parent)
    ) as parent:
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
        if sys.platform == "win32":
            from ctypes import wintypes
            import msvcrt

            kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel.CreateFileW.argtypes = [
                wintypes.LPCWSTR,
                wintypes.DWORD,
                wintypes.DWORD,
                ctypes.c_void_p,
                wintypes.DWORD,
                wintypes.DWORD,
                wintypes.HANDLE,
            ]
            kernel.CreateFileW.restype = wintypes.HANDLE
            h = kernel.CreateFileW(str(path), 0x80000000, 1, None, 3, 0x00200000, None)
            if h == ctypes.c_void_p(-1).value:
                raise OSError("cannot open input")
            kernel.CloseHandle.argtypes = [wintypes.HANDLE]
            kernel.CloseHandle.restype = wintypes.BOOL
            kernel.GetFileInformationByHandle.argtypes = [
                wintypes.HANDLE,
                ctypes.POINTER(_HandleInfo),
            ]
            kernel.GetFileInformationByHandle.restype = wintypes.BOOL
            opened = _HandleInfo()
            try:
                if (
                    not kernel.GetFileInformationByHandle(h, ctypes.byref(opened))
                    or opened.attributes & (0x400 | 0x10)
                    or opened.links != 1
                ):
                    raise OSError("unsafe opened input")
                fd = msvcrt.open_osfhandle(h, flags)
            except BaseException:
                kernel.CloseHandle(h)
                raise
        else:
            fd = os.open(path.name, flags, dir_fd=parent)
        with os.fdopen(fd, "rb") as f:
            info = os.fstat(f.fileno())
            if (
                not stat.S_ISREG(info.st_mode)
                or info.st_nlink != 1
                or getattr(info, "st_file_attributes", 0) & 0x400
            ):
                raise OSError("unsafe input")
            yield f


def safe_component(name: str, opaque: str) -> str:
    import unicodedata

    name = unicodedata.normalize("NFC", name)
    name = "".join(
        "_" if c in '<>:"/\\|?*' or ord(c) < 32 or 127 <= ord(c) <= 159 else c
        for c in name
    ).strip(" .")
    if not name or name in (".", ".."):
        name = "recovered"
    base = name.split(".")[0].upper()
    if base in {
        "CON",
        "PRN",
        "AUX",
        "NUL",
        *(f"COM{i}" for i in range(1, 10)),
        *(f"LPT{i}" for i in range(1, 10)),
    }:
        name = "_" + name
    # Full opaque suffix prevents case/Unicode collisions, including history.
    while len(name.encode("utf-8")) > 120:
        name = name[:-1]
    return name + "--" + opaque


class OutputRoot:
    def __init__(self, path: Path):
        self.path = path.absolute()
        self.stack = ExitStack()
        self.fds = {}
        self.created = []
        try:
            if sys.platform == "win32":
                self.stack.enter_context(pin(self.path.parent))
                self.path.mkdir(mode=0o700)  # Never adopts an existing directory.
            else:
                parent = self.stack.enter_context(anchored_directory(self.path.parent))
                if os.fstat(parent).st_mode & 0o022:
                    raise OSError("output parent must be private")
                os.mkdir(self.path.name, 0o700, dir_fd=parent)
                self.fds[()] = os.open(
                    self.path.name,
                    os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                    dir_fd=parent,
                )
            if sys.platform == "win32":
                from ..output import _restrict_windows_acl

                _restrict_windows_acl(self.path)
                self.stack.enter_context(pin(self.path))
                self.fds[()] = None
        except BaseException:
            self.close()
            raise

    def directory(self, parts: tuple[str, ...]):
        for index in range(1, len(parts) + 1):
            key = parts[:index]
            if key in self.fds:
                continue
            if sys.platform == "win32":
                p = self.path.joinpath(*key)
                if not p.exists():
                    p.mkdir()
                    from ..output import _restrict_windows_acl

                    _restrict_windows_acl(p)
                self.stack.enter_context(pin(p))
                self.fds[key] = None
            else:
                parent = self.fds[key[:-1]]
                try:
                    os.mkdir(key[-1], 0o700, dir_fd=parent)
                except FileExistsError:
                    pass
                self.fds[key] = os.open(
                    key[-1], os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent
                )

    @contextmanager
    def temporary(self, parts: tuple[str, ...]):
        import secrets

        parent = parts[:-1]
        self.directory(parent)
        name = ".file-safe-part-" + secrets.token_hex(16)
        flags = (
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_BINARY", 0)
            | getattr(os, "O_NOFOLLOW", 0)
        )
        path = self.path.joinpath(*parent, name)
        fd = os.open(
            path if sys.platform == "win32" else name,
            flags,
            0o600,
            **({} if sys.platform == "win32" else {"dir_fd": self.fds[parent]}),
        )
        try:
            if sys.platform == "win32":
                from ..output import _restrict_windows_acl

                _restrict_windows_acl(path)
            with os.fdopen(fd, "wb") as f:
                yield f
                f.flush()
                os.fsync(f.fileno())
            if sys.platform == "win32":
                os.link(path, self.path.joinpath(*parts))
            else:
                os.link(
                    name,
                    parts[-1],
                    src_dir_fd=self.fds[parent],
                    dst_dir_fd=self.fds[parent],
                    follow_symlinks=False,
                )
            self.created.append("/".join(parts))
        finally:
            try:
                if sys.platform == "win32":
                    path.unlink()
                else:
                    os.unlink(name, dir_fd=self.fds[parent])
            except FileNotFoundError:
                pass

    def close(self):
        for fd in self.fds.values():
            if fd is not None:
                os.close(fd)
        self.stack.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
