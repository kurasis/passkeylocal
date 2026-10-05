"""Error types and the CLI exit-code contract (BACKUP_AND_PYTHON_RECOVERY.md section 7)."""

from __future__ import annotations

EXIT_OK = 0
EXIT_USAGE = 2
EXIT_AUTH = 3
EXIT_UNSUPPORTED = 4
EXIT_IO = 5
EXIT_MALFORMED = 6
EXIT_CANCELLED = 130


class RecoveryError(Exception):
    """An expected failure with a safe message (never contains record data)."""

    exit_code = EXIT_IO

    def __init__(self, message: str, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail


class UsageError(RecoveryError):
    exit_code = EXIT_USAGE


class AuthError(RecoveryError):
    exit_code = EXIT_AUTH

    def __init__(self, detail: str | None = None) -> None:
        super().__init__("Unable to unlock: password is incorrect or the file is damaged.", detail)


class UnsupportedError(RecoveryError):
    exit_code = EXIT_UNSUPPORTED


class LimitError(UnsupportedError):
    """A product resource limit was exceeded (same exit code as unsupported)."""


class LocalIOError(RecoveryError):
    exit_code = EXIT_IO


class MalformedError(RecoveryError):
    exit_code = EXIT_MALFORMED


class Cancelled(RecoveryError):
    exit_code = EXIT_CANCELLED

    def __init__(self) -> None:
        super().__init__("Cancelled.")
