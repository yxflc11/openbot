param([string]$Version = "0.1.0-alpha.2")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($Version -notmatch '^\d+\.\d+\.\d+(-(alpha|beta|rc)\.\d+)?$') { throw "Invalid Desktop version." }
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
  throw "This installer supports Windows x64 only."
}
$asset = "openbot-desktop-$Version-win32-x64.exe"
$base = "https://github.com/yxflc11/openbot/releases/download/desktop-v$Version"
$stage = Join-Path ([IO.Path]::GetTempPath()) ("openbot-install-" + [Guid]::NewGuid().ToString("N"))
[IO.Directory]::CreateDirectory($stage) | Out-Null
try {
  $checksums = Join-Path $stage "SHA256SUMS"
  $installer = Join-Path $stage $asset
  Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS" -OutFile $checksums -TimeoutSec 60
  if ((Get-Item $checksums).Length -gt 16384) { throw "Release checksum list is too large." }
  $matching = @(Get-Content $checksums | Where-Object { $_ -match ('^([a-f0-9]{64})  ' + [Regex]::Escape($asset) + '$') })
  if ($matching.Count -ne 1) { throw "The release does not contain exactly one checksum for this installer." }
  $expected = $matching[0].Substring(0, 64)
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile $installer -TimeoutSec 900
  if ((Get-FileHash -Algorithm SHA256 $installer).Hash.ToLowerInvariant() -ne $expected) {
    throw "Installer checksum mismatch; nothing was installed."
  }
  # Keep the Internet-zone marker. Never unblock the file or bypass Windows trust policy.
  Set-Content -LiteralPath $installer -Stream Zone.Identifier -Value "[ZoneTransfer]`r`nZoneId=3"
  Write-Host "Starting the OpenBot Desktop per-user installer. Windows trust prompts still apply."
  $process = Start-Process -FilePath $installer -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Desktop installer exited with code $($process.ExitCode)." }
  Write-Host "Open OpenBot from the Start menu. Connect a Server and configure your model there."
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force
}
