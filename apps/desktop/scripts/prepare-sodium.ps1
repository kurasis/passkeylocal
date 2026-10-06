# Build-time only. Preserve the crate's independent minisign verification.
$ErrorActionPreference = 'Stop'
cargo fetch --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
if ($LASTEXITCODE -ne 0) { throw 'Locked dependency fetch failed' }
$registry = Join-Path $env:USERPROFILE '.cargo/registry/src'
$source = @(Get-ChildItem $registry -Directory | ForEach-Object { Get-Item (Join-Path $_.FullName "libsodium-sys-stable-1.24.0") -ErrorAction SilentlyContinue })
if ($source.Count -ne 1) { throw 'Expected the locked libsodium-sys-stable source' }
$dest = Join-Path $env:RUNNER_TEMP 'passkey-local-sodium-1.0.22'
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item "$($source[0].FullName)/LATEST.tar.gz", "$($source[0].FullName)/LATEST.tar.gz.minisig" $dest
$name = 'libsodium-1.0.22-stable-msvc.zip'
Invoke-WebRequest "https://download.libsodium.org/libsodium/releases/$name" -OutFile "$dest/$name"
if ((Get-FileHash "$dest/$name" -Algorithm SHA256).Hash.ToLowerInvariant() -ne '4b310d0602b6217d68b3000df19af595841ba101910af8d335096f9c45c9f36a') { throw 'Pinned libsodium MSVC archive hash changed' }
Invoke-WebRequest "https://download.libsodium.org/libsodium/releases/$name.minisig" -OutFile "$dest/$name.minisig"
"SODIUM_DIST_DIR=$dest" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
Write-Host 'Pinned HTTPS archive ready; libsodium-sys-stable still verifies the upstream minisign signature before use.'
