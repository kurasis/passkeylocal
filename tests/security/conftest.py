import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "vault-recovery" / "tests"))
from recovery_testlib import private_dir  # noqa: E402,F401  (pytest fixture)
