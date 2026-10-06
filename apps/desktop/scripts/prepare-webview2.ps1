# Download through the Windows TLS stack, then seed Tauri's offline-installer cache.
# Tauri 2.12.1 resolves this GUID with HEAD before checking the cached executable.
$ErrorActionPreference = 'Stop'
$official = 'https://go.microsoft.com/fwlink/?linkid=2124701'
$curl = Join-Path $env:SystemRoot 'System32/curl.exe'
$resolved = & $curl --fail --silent --show-error --head --location --proto '=https' --proto-redir '=https' --retry 4 --retry-all-errors --retry-max-time 240 --connect-timeout 30 --max-time 120 --output NUL --write-out '%{url_effective}' $official
if ($LASTEXITCODE -ne 0) { throw 'Official WebView2 URL resolution failed' }
$uri = [Uri]([string]$resolved)
$pathMatch = [regex]::Match($uri.AbsolutePath, '^/filestreamingservice/files/([0-9a-fA-F-]{36})/MicrosoftEdgeWebView2RuntimeInstallerX64\.exe$')
if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'msedge.sf.dl.delivery.mp.microsoft.com' -or $uri.Query -or $uri.Fragment -or -not $pathMatch.Success) {
  throw 'Unexpected official WebView2 redirect; review before packaging'
}
$guid = $pathMatch.Groups[1].Value
$parsedGuid = [Guid]::Empty
if (-not [Guid]::TryParse($guid, [ref]$parsedGuid)) { throw 'Invalid WebView2 cache GUID' }
$cache = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) "tauri/x64/$guid"
New-Item -ItemType Directory -Force $cache | Out-Null
$target = Join-Path $cache 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
$temporary = Join-Path $cache 'MicrosoftEdgeWebView2RuntimeInstallerX64.download.exe'
try {
  & $curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --retry 4 --retry-all-errors --retry-max-time 300 --connect-timeout 30 --max-time 300 --output $temporary $uri.AbsoluteUri
  if ($LASTEXITCODE -ne 0) { throw 'Official offline WebView2 download failed' }
  $length = (Get-Item $temporary).Length
  if ($length -lt 10MB -or $length -gt 512MB) { throw 'Unexpected WebView2 installer length' }
  $signature = Get-AuthenticodeSignature $temporary
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)') {
    throw 'WebView2 must have a valid trusted Microsoft Authenticode signature'
  }
  $hash = (Get-FileHash $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
  Move-Item -Force $temporary $target
  if ((Get-FileHash $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw 'WebView2 cache publication changed bytes' }
  $out = 'apps/desktop/artifacts'
  New-Item -ItemType Directory -Force $out | Out-Null
  @{
    sourceCommit=$env:GITHUB_SHA; officialUrl=$official; resolvedUrl=$uri.AbsoluteUri;
    sha256=$hash; bytes=$length; signatureStatus='Valid';
    signer=$signature.SignerCertificate.Subject; signerThumbprint=$signature.SignerCertificate.Thumbprint;
    productVersion=(Get-Item $target).VersionInfo.ProductVersion;
    purpose='Official x64 Evergreen offline installer; Tauri cache prefetch; no TLS or signature bypass'
  } | ConvertTo-Json | Set-Content "$out/webview2-download.json" -Encoding utf8
} finally {
  if (Test-Path $temporary) { Remove-Item $temporary }
}
