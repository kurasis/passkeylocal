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
$smoke = Get-Content "$out/packaged-smoke.json" -Raw | ConvertFrom-Json
if ($smoke.status -ne 'PASS' -or $smoke.sourceCommit -ne $env:GITHUB_SHA) { throw 'Installed-app smoke must pass for this exact source' }
$metadata = @{
  product='PassKey Local'; version='0.1.0'; sourceCommit=$env:GITHUB_SHA;
  architecture='x86_64-pc-windows-msvc'; signing='unsigned'; sha256=$hash;
  webview2='Evergreen offline installer bundled; clean-machine runtime test NOT RUN';
  fileSafe='experimental native streaming storage and independent Python recovery';
  fileSafePreview='unavailable: AppContainer/LPAC isolation proof BLOCKED';
  windowsHello='experimental opt-in PRF/TPM vault unlock; physical application-lifecycle acceptance pending';
  windowsHelloDiagnostics='WinRT availability check, HWND-owned consent test and fixed Windows sign-in settings action';
  packagedSmoke='PASS on elevated hosted Windows runner; see packaged-smoke.json for evidence and limits';
  node=(& node --version); rust=(& rustc --version);
  npmLock=(Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash.ToLowerInvariant();
  cargoLock=(Get-FileHash 'apps/desktop/src-tauri/Cargo.lock' -Algorithm SHA256).Hash.ToLowerInvariant()
}
$metadata | ConvertTo-Json | Set-Content "$out/build.json" -Encoding utf8
Copy-Item 'docs/windows/ACCEPTANCE.md' "$out/ACCEPTANCE.md"
Add-Content "$out/ACCEPTANCE.md" "`n## Artifact-specific hosted evidence`n`nInstalled-app smoke: PASS for source $env:GITHUB_SHA. Workflow: https://github.com/$env:GITHUB_REPOSITORY/actions/runs/$env:GITHUB_RUN_ID. See packaged-smoke.json for the actual runtime and exercised scenarios. This result supersedes pending smoke notes in the source report; the complete physical/standard-user/offline acceptance gates remain open.`n" -Encoding utf8

Copy-Item 'docs/file-safe/ACCEPTANCE.md' "$out/FILE_SAFE_ACCEPTANCE.md"
Copy-Item 'docs/file-safe/DEPENDENCIES.md' "$out/FILE_SAFE_DEPENDENCIES.md"

Copy-Item -Recurse -Force 'docs/file-safe/licenses' "$out/file-safe-licenses"
