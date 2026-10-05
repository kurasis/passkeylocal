"""Safe creation of the plaintext export file.

Rules (BACKUP_AND_PYTHON_RECOVERY.md section 9):
  - never overwrite: the final path must not exist (symlinks included);
  - refuse the input path, symlink/reparse targets and non-private directories;
  - write an exclusively created, owner-only temporary file in the destination
    directory, flush and fsync it, then link it into place without overwriting;
  - remove partial output on failure or interruption where possible.
"""

from __future__ import annotations

import os
import secrets
import stat
import sys
from pathlib import Path

from .errors import Cancelled, LocalIOError, UsageError

IS_WINDOWS = sys.platform == "win32"
_DACL_SECURITY_INFORMATION = 0x00000004


def _same_file(a: Path, b: Path) -> bool:
    try:
        return os.path.samefile(a, b)
    except OSError:
        return False


def _check_destination(output: Path, source: Path) -> Path:
    if os.path.lexists(output):
        raise LocalIOError("The output path already exists; choose a new file name.", "output-exists")
    parent = output.parent if str(output.parent) != "" else Path(".")
    if not parent.is_dir():
        raise LocalIOError("The output directory does not exist.", "output-directory-missing")
    if parent.is_symlink():
        raise LocalIOError("The output directory must not be a symbolic link.", "output-directory-symlink")
    if output.resolve(strict=False) == source.resolve(strict=False) or _same_file(output, source):
        raise UsageError("The output path must differ from the input file.", "output-is-input")
    if not IS_WINDOWS:
        mode = parent.stat().st_mode
        if mode & (stat.S_IWGRP | stat.S_IWOTH):
            raise LocalIOError(
                "The output directory is writable by other users. Choose a private directory "
                "(for example a folder only you can access).",
                "output-directory-not-private",
            )
    return parent


def _win32():  # pragma: no cover - Windows only
    """advapi32/kernel32 with explicit prototypes (64-bit safe)."""
    import ctypes
    from ctypes import wintypes

    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    P, D, B = ctypes.c_void_p, wintypes.DWORD, wintypes.BOOL
    PD = ctypes.POINTER(D)
    kernel32.GetCurrentProcess.argtypes = []
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = B
    kernel32.LocalFree.argtypes = [P]
    kernel32.LocalFree.restype = P
    advapi32.OpenProcessToken.argtypes = [wintypes.HANDLE, D, ctypes.POINTER(wintypes.HANDLE)]
    advapi32.OpenProcessToken.restype = B
    advapi32.GetTokenInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, P, D, PD]
    advapi32.GetTokenInformation.restype = B
    advapi32.ConvertSidToStringSidW.argtypes = [P, ctypes.POINTER(P)]
    advapi32.ConvertSidToStringSidW.restype = B
    advapi32.GetFileSecurityW.argtypes = [wintypes.LPCWSTR, D, P, D, PD]
    advapi32.GetFileSecurityW.restype = B
    advapi32.ConvertSecurityDescriptorToStringSecurityDescriptorW.argtypes = [P, D, D, ctypes.POINTER(P), PD]
    advapi32.ConvertSecurityDescriptorToStringSecurityDescriptorW.restype = B
    advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = [wintypes.LPCWSTR, D, ctypes.POINTER(P), PD]
    advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.restype = B
    advapi32.SetFileSecurityW.argtypes = [wintypes.LPCWSTR, D, P]
    advapi32.SetFileSecurityW.restype = B
    return ctypes, advapi32, kernel32


def _take_wstr(ctypes, kernel32, ptr) -> str:  # pragma: no cover - Windows only
    try:
        return ctypes.wstring_at(ptr.value) if ptr.value else ""
    finally:
        if ptr.value:
            kernel32.LocalFree(ptr)


def _current_user_sid() -> str:  # pragma: no cover - Windows only
    """String SID of the user owning this process token."""
    ctypes, advapi32, kernel32 = _win32()
    from ctypes import wintypes

    token = wintypes.HANDLE()
    TOKEN_QUERY = 0x0008
    if not advapi32.OpenProcessToken(kernel32.GetCurrentProcess(), TOKEN_QUERY, ctypes.byref(token)):
        raise OSError(ctypes.get_last_error(), "OpenProcessToken")
    try:
        size = wintypes.DWORD()
        TOKEN_USER_CLASS = 1
        advapi32.GetTokenInformation(token, TOKEN_USER_CLASS, None, 0, ctypes.byref(size))
        buf = ctypes.create_string_buffer(size.value)
        if not advapi32.GetTokenInformation(token, TOKEN_USER_CLASS, buf, size, ctypes.byref(size)):
            raise OSError(ctypes.get_last_error(), "GetTokenInformation")
        # TOKEN_USER starts with SID_AND_ATTRIBUTES, whose first member is the PSID.
        psid = ctypes.cast(buf, ctypes.POINTER(ctypes.c_void_p))[0]
        text = ctypes.c_void_p()
        if not advapi32.ConvertSidToStringSidW(psid, ctypes.byref(text)):
            raise OSError(ctypes.get_last_error(), "ConvertSidToStringSidW")
        return _take_wstr(ctypes, kernel32, text)
    finally:
        kernel32.CloseHandle(token)


def _file_dacl_sddl(path: Path) -> str:  # pragma: no cover - Windows only
    ctypes, advapi32, kernel32 = _win32()
    from ctypes import wintypes

    DACL_SECURITY_INFORMATION = 0x00000004
    size = wintypes.DWORD()
    advapi32.GetFileSecurityW(str(path), DACL_SECURITY_INFORMATION, None, 0, ctypes.byref(size))
    buf = ctypes.create_string_buffer(size.value)
    if not advapi32.GetFileSecurityW(str(path), DACL_SECURITY_INFORMATION, buf, size, ctypes.byref(size)):
        raise OSError(ctypes.get_last_error(), "GetFileSecurityW")
    text = ctypes.c_void_p()
    if not advapi32.ConvertSecurityDescriptorToStringSecurityDescriptorW(
        buf, 1, DACL_SECURITY_INFORMATION, ctypes.byref(text), None
    ):
        raise OSError(ctypes.get_last_error(), "ConvertSecurityDescriptorToStringSecurityDescriptorW")
    return _take_wstr(ctypes, kernel32, text)


def _owner_only_sddl() -> str:  # pragma: no cover - Windows only
    """Canonical SDDL of a protected DACL with one full-control ACE for the current user.

    Canonical means round-tripped through the Win32 converter, so well-known SIDs
    appear as their aliases (for example ``LA`` for the built-in Administrator),
    exactly as a DACL read back from a file is rendered.
    """
    try:
        sid = _current_user_sid()
    except OSError:
        raise LocalIOError("Cannot determine the current Windows user to restrict file access.", "acl-user") from None
    if not sid.startswith("S-1-"):
        raise LocalIOError("Cannot determine the current Windows user to restrict file access.", "acl-user")
    ctypes, advapi32, kernel32 = _win32()
    psd = ctypes.c_void_p()
    if not advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW(
        f"D:P(A;;FA;;;{sid})", 1, ctypes.byref(psd), None
    ):
        raise LocalIOError("Could not restrict access to the output file.", "acl-apply")
    try:
        canon = ctypes.c_void_p()
        if not advapi32.ConvertSecurityDescriptorToStringSecurityDescriptorW(
            psd, 1, _DACL_SECURITY_INFORMATION, ctypes.byref(canon), None
        ):
            raise LocalIOError("Could not restrict access to the output file.", "acl-apply")
        return _take_wstr(ctypes, kernel32, canon)
    finally:
        kernel32.LocalFree(psd)


def _restrict_windows_acl(path: Path) -> None:  # pragma: no cover - Windows only
    """Replace the DACL with a protected one granting full control to the current user only.

    The result is read back and compared; any extra entry (for example SYSTEM or
    Administrators inherited from a private directory) fails closed.
    """
    expected = _owner_only_sddl()
    ctypes, advapi32, kernel32 = _win32()
    psd = ctypes.c_void_p()
    if not advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW(expected, 1, ctypes.byref(psd), None):
        raise LocalIOError("Could not restrict access to the output file.", "acl-apply")
    try:
        PROTECTED_DACL_SECURITY_INFORMATION = 0x80000000
        if not advapi32.SetFileSecurityW(
            str(path), _DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION, psd
        ):
            raise LocalIOError("Could not restrict access to the output file.", "acl-apply")
    finally:
        kernel32.LocalFree(psd)
    try:
        actual = _file_dacl_sddl(path)
    except OSError:
        raise LocalIOError("Could not verify access restrictions on the output file.", "acl-verify") from None
    if actual != expected:
        raise LocalIOError("Could not verify access restrictions on the output file.", "acl-verify")


def write_private_file(output: Path, source: Path, data: bytes) -> None:
    parent = _check_destination(output, source)
    tmp = parent / f".{output.name}.{secrets.token_hex(8)}.partial"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    flags |= getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
    fd = -1
    try:
        try:
            fd = os.open(tmp, flags, 0o600)
        except FileExistsError:
            raise LocalIOError("A temporary file already exists; try again.", "temp-exists") from None
        if IS_WINDOWS:
            _restrict_windows_acl(tmp)
        else:
            os.fchmod(fd, 0o600)
        view = memoryview(data)
        while view:
            n = os.write(fd, view)
            view = view[n:]
        os.fsync(fd)
        os.close(fd)
        fd = -1
        try:
            os.link(tmp, output)  # fails if the target exists: no overwrite, even on a race
        except FileExistsError:
            raise LocalIOError("The output path already exists; choose a new file name.", "output-exists") from None
        except OSError:
            if IS_WINDOWS:
                os.rename(tmp, output)  # Windows rename never replaces an existing file
            else:
                raise
        if not IS_WINDOWS:
            dir_fd = os.open(parent, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
    except KeyboardInterrupt:
        raise Cancelled() from None
    except OSError as exc:
        raise LocalIOError(f"Could not write the output file ({exc.__class__.__name__}).", "write") from None
    finally:
        if fd >= 0:
            os.close(fd)
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        except OSError:
            pass
