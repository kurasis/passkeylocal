$ErrorActionPreference = 'Stop'
node apps/desktop/scripts/prepare-text-preview.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo fmt --manifest-path apps/desktop/text-preview/Cargo.toml --check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
cargo clippy --locked --manifest-path apps/desktop/text-preview/Cargo.toml --all-targets --features proof -- -D warnings
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:PASSKEY_PREVIEW_RELEASE_WORKER = [IO.Path]::GetFullPath('apps/desktop/text-preview/target/x86_64-pc-windows-msvc/release/passkey-text-worker.exe')
cargo test --locked --manifest-path apps/desktop/text-preview/Cargo.toml --features proof -- --nocapture --test-threads=1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$worker = 'apps/desktop/text-preview/target/x86_64-pc-windows-msvc/release/passkey-text-worker.exe'
$out = 'apps/desktop/artifacts'
New-Item -ItemType Directory -Force $out | Out-Null
@{status='PASS'; sourceCommit=$env:GITHUB_SHA; scope='hosted Windows actual LPAC text and separate hostile test worker'; workerSha256=(Get-FileHash $worker -Algorithm SHA256).Hash.ToLowerInvariant(); workerBytes=(Get-Item $worker).Length; isolation='unprofiled unique LPAC SID; zero capabilities; explicit read-only input and bounded output sections; job at creation; no child process; 256 MiB committed memory'; evidence=@('strict UTF-8/BOM and malformed output tests', 'actual text round trip and unsupported encoding', 'OS denial of file/profile/TEMP/registry/parent memory/clipboard writes and unrelated reads', 'TCP/UDP/DNS-port/loopback denial with parent loopback positive controls', 'nonlisted inheritable canary handle absent; input mapping cannot be writable', 'child launch and 300 MiB allocation denied', 'timeout and cancellation job termination'); limits='standard-user installed hostile probe and exhaustive Windows-service broker/WER tracing remain NOT RUN'} | ConvertTo-Json -Depth 8 | Set-Content "$out/text-preview-sandbox.json" -Encoding utf8
