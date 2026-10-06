# Real native optimized 5 GiB gate with sampled Windows working set.
$ErrorActionPreference = 'Stop'
$messages = & cargo test --locked --release --lib --manifest-path apps/desktop/src-tauri/Cargo.toml five_gib_streaming_gate --no-run --message-format=json
if ($LASTEXITCODE -ne 0) { throw 'Resource-test compilation failed' }
$binary = @($messages | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.reason -eq 'compiler-artifact' -and $_.executable -and $_.profile.test -and $_.target.kind -contains 'lib' })
if ($binary.Count -ne 1) { throw 'Expected one compiled native library test binary' }
$out = 'apps/desktop/artifacts'
New-Item -ItemType Directory -Force $out | Out-Null
$machine = @{
  cpu = @(Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors)
  physicalMemoryBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
  disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, FileSystem, Size, FreeSpace)
  runnerImage = $env:ImageVersion
  tpmAndReader = 'Physical TPM/Kensington authorization NOT TESTED; hosted virtual machine'
}
$clock = [Diagnostics.Stopwatch]::StartNew()
$process = Start-Process -FilePath $binary[0].executable -ArgumentList @('five_gib_streaming_gate','--ignored','--nocapture') -PassThru -RedirectStandardOutput "$out/file-safe-resource.stdout.txt" -RedirectStandardError "$out/file-safe-resource.stderr.txt"
$peak = 0L
while (-not $process.HasExited) { $process.Refresh(); $peak = [Math]::Max($peak,$process.WorkingSet64); Start-Sleep -Milliseconds 100 }
$process.WaitForExit(); $clock.Stop()
if ($process.ExitCode -ne 0) { throw 'Native 5 GiB resource gate failed' }
$records = @(Get-Content "$out/file-safe-resource.stderr.txt" | Where-Object { $_.StartsWith('FILE_SAFE_RESOURCE ') })
if ($records.Count -ne 1) { throw 'Expected one native resource measurement' }
$native = $records[0].Substring('FILE_SAFE_RESOURCE '.Length) | ConvertFrom-Json
if ($native.status -ne 'PASS' -or $native.plaintext_bytes -ne '5368709120') { throw 'Native measured size/status mismatch' }
@{sourceCommit=$env:GITHUB_SHA; os=[Environment]::OSVersion.VersionString; architecture='x64'; fixture='5 GiB synthetic repeated canary'; machine=$machine; native=$native; seconds=$clock.Elapsed.TotalSeconds; sampledPeakWorkingSetBytes=$peak; status='PASS'; limits='Hosted runner; no physical Windows/TPM or stalled-I/O measurement; working set includes executable/runtime, not just crypto buffers'} | ConvertTo-Json -Depth 6 | Set-Content "$out/file-safe-resource.json" -Encoding utf8
Get-Content "$out/file-safe-resource.stdout.txt", "$out/file-safe-resource.stderr.txt"
