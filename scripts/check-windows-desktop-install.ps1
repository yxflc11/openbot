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

$ColdStartRounds = 10
$expectedFinalChecks = 'postgresql,migrations,dpapi,owner-login,retained-data,stop,restart,cleanup,cold-start-10'
$target = Join-Path $env:RUNNER_TEMP ('OpenBotWindowsInstall-' + [Guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $target) { throw 'Test installation destination already exists.' }
$harness = Join-Path $env:RUNNER_TEMP ('OpenBotWindowsColdStart-' + [Guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $harness) { throw 'Cold-start harness destination already exists.' }
New-Item -ItemType Directory -Path $harness | Out-Null
$receipt = "$harness.final.result.json"
$stdout = "$harness.stdout.log"
$stderr = "$harness.stderr.log"
$statePath = Join-Path $harness 'cold-start-state.json'
$failureSummary = $null

function Write-SafeSummary([string]$Message) {
  Write-Host $Message
  $script:failureSummary = $Message
}

function Stop-RecordedHarnessProcesses {
  if (!(Test-Path -LiteralPath $statePath)) { return }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  } catch {
    return
  }
  foreach ($name in @('electronPid', 'postgresPid', 'serverPid')) {
    $pidValue = $state.$name
    if ($null -eq $pidValue) { continue }
    try {
      $proc = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
      if ($null -ne $proc) {
        Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped leftover harness process $name=$pidValue"
      }
    } catch {
      # Best-effort cleanup only.
    }
  }
}

function Invoke-NativeSmoke([string]$Mode, [string]$RoundReceipt, [int]$TimeoutMs) {
  if (Test-Path -LiteralPath $RoundReceipt) { throw "Smoke result path must be fresh: $RoundReceipt" }
  foreach ($log in @($stdout, $stderr)) {
    if (Test-Path -LiteralPath $log) { Remove-Item -LiteralPath $log -Force }
  }
  $arguments = "`"$SmokeScript`" `"$runtime`" `"$RoundReceipt`" $Mode `"$harness`""
  $smoke = Start-Process -FilePath $Electron -ArgumentList $arguments -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if (!$smoke.WaitForExit($TimeoutMs)) {
    try { $smoke.Kill($true) } catch { }
    $smoke.WaitForExit()
    Stop-RecordedHarnessProcesses
    foreach ($log in @($stdout, $stderr)) {
      if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 40 | Write-Host }
    }
    throw "Native smoke mode=$Mode exceeded $($TimeoutMs / 1000) seconds."
  }
  $smoke.WaitForExit()
  if ($smoke.ExitCode -ne 0 -or !(Test-Path -LiteralPath $RoundReceipt)) {
    Stop-RecordedHarnessProcesses
    foreach ($log in @($stdout, $stderr)) {
      if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 40 | Write-Host }
    }
    throw "Native smoke mode=$Mode did not complete its assertions (exit=$($smoke.ExitCode))."
  }
  return (Get-Content -LiteralPath $RoundReceipt -Raw | ConvertFrom-Json)
}

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

  $bootstrapReceiptPath = Join-Path $harness 'bootstrap.result.json'
  $bootstrap = Invoke-NativeSmoke -Mode 'bootstrap' -RoundReceipt $bootstrapReceiptPath -TimeoutMs 120000
  $expectedBootstrap = 'postgresql,migrations,dpapi,owner-login,retained-data,stop,restart,cleanup'
  if ($bootstrap.schemaVersion -ne 1 -or $bootstrap.platform -ne 'win32' -or $bootstrap.arch -ne 'x64' -or ($bootstrap.checks -join ',') -ne $expectedBootstrap) {
    throw 'Bootstrap native smoke result is incomplete.'
  }
  Write-Host "PASS: bootstrap smoke receipt verified ($expectedBootstrap)."

  $final = $null
  for ($round = 1; $round -le $ColdStartRounds; $round++) {
    $roundReceiptPath = Join-Path $harness ("cold-start-$round.result.json")
    # Each lifetime is an independent Electron process; 120s bound matches the historical gate.
    $final = Invoke-NativeSmoke -Mode 'cold-start' -RoundReceipt $roundReceiptPath -TimeoutMs 120000
    if ($round -lt $ColdStartRounds) {
      if ($final.coldStartsCompleted -ne $round) {
        throw "Cold-start progress mismatch: expected $round, got $($final.coldStartsCompleted)."
      }
      Write-Host "PASS: cold-start $round/$ColdStartRounds (pid=$($final.electronPid))."
    }
  }

  if ($final.schemaVersion -ne 1 -or $final.platform -ne 'win32' -or $final.arch -ne 'x64' -or $final.coldStarts -ne $ColdStartRounds -or ($final.checks -join ',') -ne $expectedFinalChecks) {
    throw 'Installed native runtime cold-start result is incomplete.'
  }
  Set-Content -LiteralPath $receipt -Value (($final | ConvertTo-Json -Compress)) -Encoding utf8
  Write-Host "PASS: native smoke receipt verified ($expectedFinalChecks)."
} catch {
  Stop-RecordedHarnessProcesses
  Write-SafeSummary ("FAIL: " + $_.Exception.Message)
  throw
} finally {
  Stop-RecordedHarnessProcesses
  $uninstaller = Join-Path $target 'Uninstall OpenBot.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) {
      Write-SafeSummary 'FAIL: NSIS uninstall failed after smoke.'
      throw 'NSIS uninstall failed.'
    }
  }
  # NSIS copies its uninstaller before exiting; wait for the installed program to disappear.
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ((Test-Path -LiteralPath (Join-Path $target 'openbot.exe')) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (Test-Path -LiteralPath (Join-Path $target 'openbot.exe')) {
    Write-SafeSummary 'FAIL: Uninstall left the executable installed.'
    throw 'Uninstall left the executable installed.'
  }
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  if (Test-Path -LiteralPath $harness) { Remove-Item -LiteralPath $harness -Recurse -Force }
  foreach ($file in @($receipt, $stdout, $stderr)) {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
  if ($null -ne $failureSummary) {
    Write-Host "Safe summary: $failureSummary"
  }
}
Write-Host 'Windows per-user NSIS install, installed native runtime cold-start (10 Electron lifetimes) and uninstall checks passed.'
