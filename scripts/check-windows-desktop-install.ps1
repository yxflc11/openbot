param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [Parameter(Mandatory = $true)][string]$PackagedDirectory,
  [Parameter(Mandatory = $true)][string]$Electron,
  [Parameter(Mandatory = $true)][string]$SmokeScript,
  [string]$EvidenceDirectory
)
$ErrorActionPreference = 'Stop'
if (![OperatingSystem]::IsWindows() -or [Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
  throw 'The Desktop install gate requires Windows x64.'
}

if (!$EvidenceDirectory) {
  $EvidenceDirectory = Join-Path $env:RUNNER_TEMP ('OpenBotWindowsEvidence-' + [Guid]::NewGuid().ToString('N'))
}
if (Test-Path -LiteralPath $EvidenceDirectory) { throw 'Evidence destination must be fresh.' }
New-Item -ItemType Directory -Path $EvidenceDirectory | Out-Null
$script:roundEvidence = @()
$script:cleanupVerified = $true
$stage = 'install'
$passed = $false
$uninstalled = $false
$fixtureRemoved = $false
$ownershipTestsPassed = $false
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
$liveProcessesPath = Join-Path $harness 'harness-live-processes.json'
$failureSummary = $null
# This-round Electron identity from the held Start-Process handle (not JSON alone).
$script:currentRoundElectron = $null

function Write-SafeSummary([string]$Message) {
  Write-Host $Message
  $script:failureSummary = $Message
}

function Test-ProcessIdentityMatch {
  param(
    [Parameter(Mandatory = $true)]$Recorded,
    [Parameter(Mandatory = $true)]$Live
  )
  if ($null -eq $Recorded -or $null -eq $Live) { return $false }
  if ([string]::IsNullOrWhiteSpace([string]$Recorded.startTimeUtc)) { return $false }
  if ([string]::IsNullOrWhiteSpace([string]$Recorded.executablePath)) { return $false }
  if ([int]$Recorded.pid -ne [int]$Live.Id) { return $false }
  $liveStart = $Live.StartTime.ToUniversalTime().ToString('o')
  if ($liveStart -ne [string]$Recorded.startTimeUtc) { return $false }
  $livePath = [string]$Live.Path
  if ([string]::IsNullOrWhiteSpace($livePath)) { return $false }
  if ($livePath.ToLowerInvariant() -ne ([string]$Recorded.executablePath).ToLowerInvariant()) { return $false }
  return $true
}

function Stop-VerifiedHarnessIdentity {
  param([Parameter(Mandatory = $true)]$Recorded, [string]$Label)
  if ($null -eq $Recorded -or $null -eq $Recorded.pid) { return }
  if ([string]::IsNullOrWhiteSpace([string]$Recorded.startTimeUtc) -or [string]::IsNullOrWhiteSpace([string]$Recorded.executablePath)) {
    $script:cleanupVerified = $false
    Write-Host "Skipping stop for $Label pid=$($Recorded.pid): incomplete recorded identity (refusing PID-only kill)."
    return
  }
  $proc = $null
  try {
    $proc = Get-Process -Id ([int]$Recorded.pid) -ErrorAction SilentlyContinue
    if ($null -eq $proc) { return }
    # Pin the OS process object before querying identity; retain it through Kill.
    $null = $proc.Handle
    if ($proc.HasExited) { return }
    if (-not (Test-ProcessIdentityMatch -Recorded $Recorded -Live $proc)) {
      Write-Host "Skipping stop for $Label pid=$($Recorded.pid): live identity does not match recorded harness process."
      return
    }
    $proc.Kill()
    if (!$proc.WaitForExit(10000)) { throw "Verified harness process did not exit." }
    Write-Host "Stopped leftover harness process $Label pid=$($Recorded.pid) after identity verification."
  } catch {
    $script:cleanupVerified = $false
    Write-Host "Unable to verify cleanup for $Label; no PID-only fallback is allowed."
  } finally {
    if ($null -ne $proc) { $proc.Dispose() }
  }
}

function Read-JsonObject([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { return $null }
  try {
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Stop-RecordedHarnessProcesses {
  # Prefer live-process file (this round, including failure-before-state) then durable state.
  $sources = @()
  $live = Read-JsonObject $liveProcessesPath
  if ($null -ne $live) { $sources += $live }
  $state = Read-JsonObject $statePath
  if ($null -ne $state) { $sources += $state }

  foreach ($source in $sources) {
    foreach ($name in @('server', 'postgres', 'electron')) {
      $identity = $source.$name
      if ($null -eq $identity) { continue }
      Stop-VerifiedHarnessIdentity -Recorded $identity -Label $name
    }
  }

  # Held Start-Process handle for this round's Electron — never rely on JSON PID alone.
  if ($null -ne $script:currentRoundElectron -and $null -ne $script:currentRoundElectron.Process) {
    try {
      $held = $script:currentRoundElectron.Process
      if (-not $held.HasExited) {
        $recorded = $script:currentRoundElectron.Identity
        if ($null -ne $recorded -and (Test-ProcessIdentityMatch -Recorded $recorded -Live $held)) {
          $held.Kill($true)
          Write-Host "Stopped this-round Electron via held process handle (pid=$($held.Id))."
        } elseif ($null -eq $recorded) {
          # Handle still refers to the same OS process object we started.
          $held.Kill($true)
          Write-Host "Stopped this-round Electron via held process handle without JSON (pid=$($held.Id))."
        } else {
          Write-Host "Refusing held-handle kill: live Electron identity diverged from recorded spawn identity."
        }
      }
      if (!$held.WaitForExit(10000)) { $script:cleanupVerified = $false }
    } catch {
      $script:cleanupVerified = $false
    }
  }
}

function Assert-SafeRoundReceipt($Round, [string]$ExpectedMode) {
  if ($Round.schemaVersion -ne 1 -or $Round.platform -ne 'win32' -or $Round.arch -ne 'x64') {
    throw 'Smoke receipt platform fields are incomplete.'
  }
  if ($Round.mode -ne $ExpectedMode) {
    throw 'Bootstrap receipt mode mismatch.'
  }
  $expectedLogins = if ($ExpectedMode -eq 'bootstrap') { 2 } else { 1 }
  if ($null -eq $Round.loginCount -or [int]$Round.loginCount -ne $expectedLogins) {
    throw 'Smoke receipt loginCount is missing.'
  }
  if ($Round.ciphertextDigest -notmatch '^[0-9a-f]{64}$') {
    throw 'Smoke receipt ciphertextDigest must be a sha256 hex digest (no raw ciphertext).'
  }
  foreach ($name in @('electron', 'postgres', 'server')) {
    $identity = $Round.$name
    if ($null -eq $identity -or [long]$identity.pid -le 0 -or [long]$identity.pid -gt 2147483647 -or [string]::IsNullOrWhiteSpace([string]$identity.startTimeUtc) -or [string]::IsNullOrWhiteSpace([string]$identity.executablePath)) {
      throw "Smoke receipt missing verified process identity fields for $name."
    }
  }
  if ($script:roundEvidence.Count -gt 0 -and $Round.ciphertextDigest -ne $script:roundEvidence[0].ciphertextDigest) {
    throw 'Bootstrap ciphertext digest changed across independent process lifetimes.'
  }
  # Refuse secrets in the receipt surface we persist/print.
  $raw = $Round | ConvertTo-Json -Depth 6 -Compress
  if ($raw -match 'databasePassword' -or $raw -match '"encryptedBootstrap"' -or $raw -match '"ciphertext"\s*:') {
    throw 'Smoke receipt unexpectedly contains secret material.'
  }
}

function Invoke-NativeSmoke([string]$Mode, [string]$RoundReceipt, [int]$TimeoutMs) {
  if (Test-Path -LiteralPath $RoundReceipt) { throw "Smoke result path must be fresh: $RoundReceipt" }
  foreach ($log in @($stdout, $stderr)) {
    if (Test-Path -LiteralPath $log) { Remove-Item -LiteralPath $log -Force }
  }
  if (Test-Path -LiteralPath $liveProcessesPath) { Remove-Item -LiteralPath $liveProcessesPath -Force }
  $script:currentRoundElectron = $null
  $arguments = "`"$SmokeScript`" `"$runtime`" `"$RoundReceipt`" $Mode `"$harness`""
  $smoke = Start-Process -FilePath $Electron -ArgumentList $arguments -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  # Keep the Start-Process object even if querying its identity fails.
  $script:currentRoundElectron = [pscustomobject]@{ Process = $smoke; Identity = $null }
  $null = $smoke.Handle
  $spawnIdentity = [pscustomobject]@{
    pid = [int]$smoke.Id
    startTimeUtc = $smoke.StartTime.ToUniversalTime().ToString('o')
    executablePath = [string]$smoke.Path
  }
  $script:currentRoundElectron.Identity = $spawnIdentity
  if (!$smoke.WaitForExit($TimeoutMs)) {
    try {
      if (Test-ProcessIdentityMatch -Recorded $spawnIdentity -Live $smoke) {
        $smoke.Kill($true)
      }
    } catch { }
    if (!$smoke.WaitForExit(15000)) { $script:cleanupVerified = $false }
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
  $roundResult = Get-Content -LiteralPath $RoundReceipt -Raw | ConvertFrom-Json
  if ([int]$roundResult.electron.pid -ne $spawnIdentity.pid -or
      $roundResult.electron.startTimeUtc -ne $spawnIdentity.startTimeUtc -or
      $roundResult.electron.executablePath -ine $spawnIdentity.executablePath) {
    throw 'Round receipt does not match the Electron process held by the orchestrator.'
  }
  $smoke.Dispose()
  $script:currentRoundElectron = $null
  return $roundResult
}

function Add-RoundEvidence($Round, [int]$Index) {
  $record = [ordered]@{
    round = $Index
    mode = $Round.mode
    loginCount = [int]$Round.loginCount
    ciphertextDigest = $Round.ciphertextDigest
    checks = @($Round.checks)
  }
  foreach ($name in @('electron', 'postgres', 'server')) {
    $record[$name] = [ordered]@{
      pid = [int]$Round.$name.pid
      startTimeUtc = [string]$Round.$name.startTimeUtc
      executablePath = [string]$Round.$name.executablePath
    }
  }
  $script:roundEvidence += [pscustomobject]$record
}

function Test-HarnessProcessOwnership {
  # Exercise the same cleanup function on an owned real process before installing.
  $probe = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile -NonInteractive -Command "Start-Sleep -Seconds 60"' -PassThru
  try {
    $null = $probe.Handle
    $identity = [pscustomobject]@{
      pid = [int]$probe.Id
      startTimeUtc = $probe.StartTime.ToUniversalTime().ToString('o')
      executablePath = [string]$probe.Path
    }
    $wrongStart = [pscustomobject]@{
      pid = $identity.pid; startTimeUtc = '2000-01-01T00:00:00.0000000Z'; executablePath = $identity.executablePath
    }
    $wrongPath = [pscustomobject]@{
      pid = $identity.pid; startTimeUtc = $identity.startTimeUtc; executablePath = 'C:\not-the-probe.exe'
    }
    Stop-VerifiedHarnessIdentity -Recorded $wrongStart -Label 'negative-start'
    if ($probe.HasExited) { throw 'Cleanup killed a process with a mismatching start time.' }
    Stop-VerifiedHarnessIdentity -Recorded $wrongPath -Label 'negative-path'
    if ($probe.HasExited) { throw 'Cleanup killed a process with a mismatching executable.' }
    Stop-VerifiedHarnessIdentity -Recorded $identity -Label 'owned-probe'
    if (!$probe.WaitForExit(10000)) { throw 'Cleanup did not stop the verified owned process.' }
    if (!$script:cleanupVerified) { throw 'Process identity negative checks failed.' }
  } finally {
    if (!$probe.HasExited) { $probe.Kill(); $null = $probe.WaitForExit(10000) }
    $probe.Dispose()
  }
}

try {
  $stage = 'process-identity-negative-checks'
  Test-HarnessProcessOwnership
  $ownershipTestsPassed = $true
  $stage = 'install'
  # NSIS /D is deliberately last and unquoted, per its documented command-line contract.
  $process = Start-Process -FilePath $Installer -ArgumentList "/S /D=$target" -PassThru
  try {
    if (!$process.WaitForExit(120000)) { $process.Kill(); throw 'NSIS installation timed out.' }
    if ($process.ExitCode -ne 0) { throw 'NSIS installation failed.' }
  } finally { $process.Dispose() }
  $installedAsar = Join-Path $target 'resources/app.asar'
  $packagedAsar = Join-Path $PackagedDirectory 'resources/app.asar'
  if ((Get-FileHash -LiteralPath $installedAsar -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $packagedAsar -Algorithm SHA256).Hash) {
    throw 'Installed application differs from the reviewed package.'
  }
  if (!(Test-Path -LiteralPath (Join-Path $target 'openbot.exe'))) { throw 'Installed executable missing.' }
  $runtime = Join-Path $target 'resources/native-runtime'

  $stage = 'bootstrap'
  $bootstrapReceiptPath = Join-Path $harness 'bootstrap.result.json'
  $bootstrap = Invoke-NativeSmoke -Mode 'bootstrap' -RoundReceipt $bootstrapReceiptPath -TimeoutMs 120000
  $expectedBootstrap = 'postgresql,migrations,dpapi,owner-login,retained-data,stop,restart,cleanup'
  if (($bootstrap.checks -join ',') -ne $expectedBootstrap) {
    throw 'Bootstrap native smoke result is incomplete.'
  }
  Assert-SafeRoundReceipt -Round $bootstrap -ExpectedMode 'bootstrap'
  Add-RoundEvidence -Round $bootstrap -Index 0
  Write-Host "PASS: bootstrap smoke receipt verified ($expectedBootstrap)."

  $final = $null
  for ($round = 1; $round -le $ColdStartRounds; $round++) {
    $stage = "cold-start-$round"
    $roundReceiptPath = Join-Path $harness ("cold-start-$round.result.json")
    # Each lifetime is an independent Electron process; 120s bound matches the historical gate.
    $final = Invoke-NativeSmoke -Mode 'cold-start' -RoundReceipt $roundReceiptPath -TimeoutMs 120000
    Assert-SafeRoundReceipt -Round $final -ExpectedMode 'cold-start'
    if ($final.coldStartsCompleted -ne $round) {
      throw "Cold-start progress mismatch: expected $round."
    }
    $expectedRoundChecks = if ($round -eq $ColdStartRounds) { $expectedFinalChecks } else {
      "postgresql,dpapi,owner-login,retained-data,stop,cleanup,cold-start-$round"
    }
    if (($final.checks -join ',') -ne $expectedRoundChecks) { throw 'Cold-start round assertions incomplete.' }
    Add-RoundEvidence -Round $final -Index $round
    Write-Host "PASS: cold-start $round/$ColdStartRounds (pid=$($final.electron.pid))."
  }

  if ($final.schemaVersion -ne 1 -or $final.platform -ne 'win32' -or $final.arch -ne 'x64' -or $final.coldStarts -ne $ColdStartRounds -or ($final.checks -join ',') -ne $expectedFinalChecks) {
    throw 'Installed native runtime cold-start result is incomplete.'
  }
  $passed = $true
  Write-Host "PASS: native smoke receipt verified ($expectedFinalChecks)."
} catch {
  Stop-RecordedHarnessProcesses
  Write-SafeSummary ("FAIL: " + $_.Exception.Message)
  throw
} finally {
  try {
    Stop-RecordedHarnessProcesses
    if (!$script:cleanupVerified) { throw 'Harness process cleanup could not be verified.' }
    if ($passed) { $stage = 'uninstall' }
    $uninstaller = Join-Path $target 'Uninstall OpenBot.exe'
    if (Test-Path -LiteralPath $uninstaller) {
      $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru
      try {
        if (!$process.WaitForExit(60000)) { $process.Kill(); throw 'NSIS uninstall timed out.' }
        if ($process.ExitCode -ne 0) { throw 'NSIS uninstall failed.' }
      } finally { $process.Dispose() }
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ((Test-Path -LiteralPath (Join-Path $target 'openbot.exe')) -and [DateTime]::UtcNow -lt $deadline) {
      Start-Sleep -Milliseconds 250
    }
    if (Test-Path -LiteralPath (Join-Path $target 'openbot.exe')) { throw 'Uninstall left the executable installed.' }
    $uninstalled = $true
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    if (Test-Path -LiteralPath $harness) { Remove-Item -LiteralPath $harness -Recurse -Force }
    foreach ($file in @($receipt, $stdout, $stderr)) {
      if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
    }
    $fixtureRemoved = $true
  } finally {
    if ($null -ne $script:currentRoundElectron) { $script:currentRoundElectron.Process.Dispose() }
    # This allowlist is the only uploaded evidence. No raw logs, profile, or fixture secrets.
    $summary = [ordered]@{
      schemaVersion = 1
      sourceCommit = $env:GITHUB_SHA
      platform = 'win32'
      arch = 'x64'
      passed = ($passed -and $uninstalled -and $script:cleanupVerified -and $fixtureRemoved -and $ownershipTestsPassed)
      lastStage = $stage
      uninstallPassed = $uninstalled
      fixtureRemoved = $fixtureRemoved
      cleanupVerified = $script:cleanupVerified
      processIdentityNegativeTestsPassed = $ownershipTestsPassed
      coldStartsCompleted = [Math]::Max(0, $script:roundEvidence.Count - 1)
      rounds = @($script:roundEvidence)
    }
    $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'summary.json') -Encoding utf8
    Write-Host "Safe Windows lifecycle evidence: $EvidenceDirectory"
  }
}
Write-Host 'Windows per-user NSIS install, installed native runtime cold-start (10 Electron lifetimes) and uninstall checks passed.'
