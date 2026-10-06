$ErrorActionPreference = 'Stop'
$binary = Resolve-Path 'apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/passkey-local-desktop.exe'
$process = Start-Process -FilePath $binary -PassThru
try {
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 1000
    $process.Refresh()
    if ($process.HasExited) { throw 'Packaged application exited before smoke readiness' }
    if ($process.MainWindowHandle -ne 0) { break }
  }
  if ($process.MainWindowHandle -eq 0 -or $process.MainWindowTitle -ne 'PassKey Local') { throw 'Expected generic main window did not appear' }
  Write-Output 'PASS: packaged executable stays running and exposes its generic main window. Unlock/asset/IPC/installer acceptance still requires the detailed matrix.'
} finally {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id }
}
