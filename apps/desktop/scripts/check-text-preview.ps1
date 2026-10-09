$ErrorActionPreference = 'Stop'
node apps/desktop/scripts/prepare-text-preview.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo fmt --manifest-path apps/desktop/text-preview/Cargo.toml --check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo clippy --locked --manifest-path apps/desktop/text-preview/Cargo.toml --all-targets --features proof -- -D warnings
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:PASSKEY_PREVIEW_RELEASE_WORKER = [IO.Path]::GetFullPath('apps/desktop/text-preview/target/x86_64-pc-windows-msvc/release/passkey-text-worker.exe')
cargo test --locked --manifest-path apps/desktop/text-preview/Cargo.toml --features proof -- --nocapture --test-threads=1 | Tee-Object -Variable previewOutput
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$networkInitialization = [regex]::Match(($previewOutput -join "`n"), 'network-init=(\d+)').Groups[1].Value
if ($networkInitialization -notmatch '^(0|10013|10107)$') { throw 'Missing actual network initialization evidence' }
$transportChecks = if ($networkInitialization -eq '0') { 'TCP/UDP/DNS-port/loopback denied' } else { 'not-run: LPAC refused Winsock startup; identical minimal environment unrestricted positive control passed' }
$worker = 'apps/desktop/text-preview/target/x86_64-pc-windows-msvc/release/passkey-text-worker.exe'
$out = 'apps/desktop/artifacts'
New-Item -ItemType Directory -Force $out | Out-Null
@{status='PASS'; sourceCommit=$env:GITHUB_SHA; networkInitialization=$networkInitialization; transportChecks=$transportChecks; scope='hosted Windows actual LPAC text and separate hostile test worker'; workerSha256=(Get-FileHash $worker -Algorithm SHA256).Hash.ToLowerInvariant(); workerBytes=(Get-Item $worker).Length; isolation='registered unique LPAC SID without storage profile; zero capabilities; explicit read-only input and bounded output sections; job at creation; no child process; 256 MiB committed memory'; evidence=@('strict UTF-8/BOM and malformed output tests', 'actual text round trip and unsupported encoding', 'OS denial of file/profile/TEMP/registry/parent memory/clipboard writes and unrelated reads', 'native network stack refusal or TCP/UDP/DNS-port/loopback denial; identical minimal environment unrestricted TCP/UDP positive control', 'nonlisted inheritable canary handle absent; input mapping cannot be writable', 'child launch and 300 MiB allocation denied', 'timeout and cancellation job termination'); limits='standard-user installed hostile probe and exhaustive Windows-service broker/WER tracing remain NOT RUN'} | ConvertTo-Json -Depth 8 | Set-Content "$out/text-preview-sandbox.json" -Encoding utf8
