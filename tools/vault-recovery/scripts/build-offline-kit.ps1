# Builds the offline recovery kit for Windows x64 + CPython 3.12.
# Network access is needed only while running this script (to download wheels);
# installing from the resulting kit uses --no-index --require-hashes.
param(
    [string]$OutDir = "dist/vault-recovery-kit",
    [string]$PythonVersion = "3.12"
)
$ErrorActionPreference = "Stop"
$tool = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent (Split-Path -Parent $tool)

New-Item -ItemType Directory -Force -Path "$OutDir/wheelhouse" | Out-Null
python -m pip download --only-binary=:all: --platform win_amd64 --python-version $PythonVersion `
    --implementation cp --require-hashes -r "$tool/requirements.lock" -d "$OutDir/wheelhouse"
if ($LASTEXITCODE -ne 0) { throw "wheel download failed" }

Copy-Item -Recurse -Force "$tool/src" "$OutDir/src"
Copy-Item -Force "$tool/requirements.lock", "$tool/README.md", "$tool/pyproject.toml" $OutDir
Copy-Item -Force "$repo/docs/RECOVERY_GUIDE.md" $OutDir
New-Item -ItemType Directory -Force -Path "$OutDir/samples" | Out-Null
Copy-Item -Force "$repo/tests/interop/fixtures/full.kdbx", "$repo/tests/interop/fixtures/full.expected.json", "$repo/tests/interop/fixtures/manifest.json" "$OutDir/samples"

Get-ChildItem -Recurse -File $OutDir | Get-FileHash -Algorithm SHA256 |
    ForEach-Object { "{0}  {1}" -f $_.Hash.ToLower(), (Resolve-Path -Relative $_.Path) } |
    Set-Content -Encoding utf8 "$OutDir/SHA256SUMS.txt"
Write-Host "Offline kit written to $OutDir"
