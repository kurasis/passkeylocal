#!/usr/bin/env sh
# Builds an offline recovery kit for a given target (default: Windows x64, CPython 3.12)
# from any machine with network access. Installing from the kit needs no network.
#   scripts/build-offline-kit.sh [out-dir] [platform] [python-version]
set -eu
TOOL="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$TOOL/../.." && pwd)"
OUT="${1:-dist/vault-recovery-kit}"
PLATFORM="${2:-win_amd64}"
PYVER="${3:-3.12}"
mkdir -p "$OUT/wheelhouse" "$OUT/samples"
python3 -m pip download --only-binary=:all: --platform "$PLATFORM" --python-version "$PYVER" \
  --implementation cp --require-hashes -r "$TOOL/requirements.lock" -d "$OUT/wheelhouse"
cp -R "$TOOL/src" "$OUT/src"
cp "$TOOL/requirements.lock" "$TOOL/README.md" "$TOOL/pyproject.toml" "$REPO/docs/RECOVERY_GUIDE.md" "$OUT/"
cp "$REPO/tests/interop/fixtures/full.kdbx" "$REPO/tests/interop/fixtures/full.expected.json" \
   "$REPO/tests/interop/fixtures/manifest.json" "$OUT/samples/"
(cd "$OUT" && find . -type f ! -name SHA256SUMS.txt -exec sha256sum {} + > SHA256SUMS.txt)
echo "Offline kit written to $OUT"
