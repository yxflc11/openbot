param(
  [Parameter(Mandatory = $true)]
  [string]$PublishDirectory
)

$ErrorActionPreference = "Stop"

$publishRoot = (Resolve-Path -LiteralPath $PublishDirectory).Path
$allowedNames = @(
  "OpenBot.WorkerHost.Windows.exe",
  "THIRD_PARTY_NOTICES.md"
)
$entries = @(Get-ChildItem -LiteralPath $publishRoot -Force)

if ($entries.Count -ne $allowedNames.Count) {
  throw "Windows Worker Host publish inventory must contain exactly two entries."
}

foreach ($entry in $entries) {
  if ($entry.PSIsContainer -or (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw "Windows Worker Host publish inventory contains a directory or reparse point."
  }
  if ($allowedNames -cnotcontains $entry.Name) {
    throw "Windows Worker Host publish inventory contains an unexpected file."
  }
}

$actualNames = @($entries.Name | Sort-Object -CaseSensitive)
$expectedNames = @($allowedNames | Sort-Object -CaseSensitive)
if ((Compare-Object -CaseSensitive -ReferenceObject $expectedNames -DifferenceObject $actualNames).Count -ne 0) {
  throw "Windows Worker Host publish inventory does not match the exact allowlist."
}

$executable = Get-Item -LiteralPath (Join-Path $publishRoot "OpenBot.WorkerHost.Windows.exe")
$minimumExecutableBytes = 40MB
$maximumExecutableBytes = 128MB
if ($executable.Length -lt $minimumExecutableBytes -or $executable.Length -gt $maximumExecutableBytes) {
  throw "Windows Worker Host executable size is outside the reviewed bounds."
}

$stream = [IO.File]::OpenRead($executable.FullName)
try {
  if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) {
    throw "Windows Worker Host executable does not have an MZ header."
  }
}
finally {
  $stream.Dispose()
}

$repositoryNotice = Join-Path (Split-Path -Parent $PSScriptRoot) "THIRD_PARTY_NOTICES.md"
$publishedNotice = Join-Path $publishRoot "THIRD_PARTY_NOTICES.md"
$expectedNoticeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $repositoryNotice).Hash
$actualNoticeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $publishedNotice).Hash
if ($actualNoticeHash -cne $expectedNoticeHash) {
  throw "Published third-party notices differ from the reviewed repository copy."
}

$inventory = @($entries | Sort-Object -Property Name | ForEach-Object {
  [ordered]@{
    name = $_.Name
    bytes = $_.Length
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
  }
})
$inventory | ConvertTo-Json -Depth 2
