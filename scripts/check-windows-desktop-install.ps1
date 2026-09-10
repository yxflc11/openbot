param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [Parameter(Mandatory = $true)][string]$PackagedDirectory,
  [Parameter(Mandatory = $true)][string]$Electron,
  [Parameter(Mandatory = $true)][string]$SmokeScript
)
$ErrorActionPreference = 'Stop'
if (![OperatingSystem]::IsWindows() -or [Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
  throw 'The Desktop install gate requires Windows x64.'
}
$target = Join-Path $env:RUNNER_TEMP ('OpenBotWindowsInstall-' + [Guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $target) { throw 'Test installation destination already exists.' }
$receipt = "$target.result.json"
$stdout = "$target.stdout.log"
$stderr = "$target.stderr.log"
if (Test-Path -LiteralPath $receipt) { throw 'Native smoke result path must be fresh.' }
try {
  # NSIS /D is deliberately last and unquoted, per its documented command-line contract.
  $process = Start-Process -FilePath $Installer -ArgumentList "/S /D=$target" -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw 'NSIS installation failed.' }
  $installedAsar = Join-Path $target 'resources/app.asar'
  $packagedAsar = Join-Path $PackagedDirectory 'resources/app.asar'
  if ((Get-FileHash -LiteralPath $installedAsar -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $packagedAsar -Algorithm SHA256).Hash) {
    throw 'Installed application differs from the reviewed package.'
  }
  if (!(Test-Path -LiteralPath (Join-Path $target 'openbot.exe'))) { throw 'Installed executable missing.' }
  $runtime = Join-Path $target 'resources/native-runtime'
  $arguments = "`"$SmokeScript`" `"$runtime`" `"$receipt`""
  $smoke = Start-Process -FilePath $Electron -ArgumentList $arguments -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if (!$smoke.WaitForExit(120000)) {
    $smoke.Kill($true)
    throw 'Installed native runtime smoke exceeded 120 seconds.'
  }
  $smoke.WaitForExit()
  if ($smoke.ExitCode -ne 0 -or !(Test-Path -LiteralPath $receipt)) {
    if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Tail 30 | Write-Host }
    throw 'Installed native runtime did not complete its startup/restart assertions.'
  }
  $result = Get-Content -LiteralPath $receipt -Raw | ConvertFrom-Json
  $expectedChecks = 'postgresql,migrations,dpapi,owner-login,retained-data,stop,restart,cleanup'
  if ($result.schemaVersion -ne 1 -or $result.platform -ne 'win32' -or $result.arch -ne 'x64' -or ($result.checks -join ',') -ne $expectedChecks) {
    throw 'Installed native runtime result is incomplete.'
  }
  Write-Host "PASS: native smoke receipt verified ($expectedChecks)."
} finally {
  $uninstaller = Join-Path $target 'Uninstall OpenBot.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw 'NSIS uninstall failed.' }
  }
  # NSIS copies its uninstaller before exiting; wait for the installed program to disappear.
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ((Test-Path -LiteralPath (Join-Path $target 'openbot.exe')) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (Test-Path -LiteralPath (Join-Path $target 'openbot.exe')) { throw 'Uninstall left the executable installed.' }
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  foreach ($file in @($receipt, $stdout, $stderr)) {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
}
Write-Host 'Windows per-user NSIS install, installed native runtime and uninstall checks passed.'
