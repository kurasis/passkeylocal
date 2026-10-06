$ErrorActionPreference = 'Stop'
$out = 'apps/desktop/artifacts'
New-Item -ItemType Directory -Force $out | Out-Null
$source = Get-ChildItem 'apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe'
if ($source.Count -ne 1) { throw 'Expected exactly one NSIS installer' }
$name = 'PassKey-Local-Windows-x64-0.1.0-unsigned-setup.exe'
Copy-Item $source.FullName "$out/$name"
$hash = (Get-FileHash "$out/$name" -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$out/$name.sha256", "$hash  $name`n", [Text.UTF8Encoding]::new($false))
$signature = Get-AuthenticodeSignature "$out/$name"
if ($signature.Status -ne 'NotSigned') { throw 'Unsigned build signing status changed: review distribution labels' }
$metadata = @{
  product='PassKey Local'; version='0.1.0'; sourceCommit=$env:GITHUB_SHA;
  architecture='x86_64-pc-windows-msvc'; signing='unsigned'; sha256=$hash;
  webview2='Evergreen offline installer bundled; clean-machine runtime test NOT RUN';
  windowsHello='unavailable: physical TPM/provider/Kensington proof BLOCKED';
  node=(& node --version); rust=(& rustc --version);
  npmLock=(Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash.ToLowerInvariant();
  cargoLock=(Get-FileHash 'apps/desktop/src-tauri/Cargo.lock' -Algorithm SHA256).Hash.ToLowerInvariant()
}
$metadata | ConvertTo-Json | Set-Content "$out/build.json" -Encoding utf8
Copy-Item 'docs/windows/ACCEPTANCE.md' "$out/ACCEPTANCE.md"
