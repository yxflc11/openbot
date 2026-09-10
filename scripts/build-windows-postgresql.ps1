# Builds unmodified PostgreSQL with the official Meson backend; see the pinned
# review and licenses/windows-postgresql for the redistribution boundary.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$WorkDirectory = (Join-Path ([IO.Path]::GetTempPath()) ('openbot-pg-build-' + [guid]::NewGuid().ToString('N')))
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $IsWindows -or [Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
  throw 'PostgreSQL source packaging requires native Windows x64 PowerShell 7.'
}
$repository = Split-Path $PSScriptRoot -Parent
$output = [IO.Path]::GetFullPath($OutputDirectory)
$work = [IO.Path]::GetFullPath($WorkDirectory)
if ($output -notmatch '(?i)postgres|pgsql') { throw 'Output path must contain postgres or pgsql to preserve the official relocatable layout.' }
if ((Test-Path $output) -or (Test-Path $work)) { throw 'Output and work directories must be new; existing data is never removed.' }
New-Item -ItemType Directory -Path $output, $work | Out-Null

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}
function Get-Verified([string]$Url, [string]$Destination, [string]$Sha256) {
  Invoke-WebRequest -Uri $Url -OutFile $Destination -MaximumRedirection 5
  $actual = (Get-FileHash $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $Sha256) { throw "SHA-256 mismatch for $Url" }
}
$sourceUrl = 'https://ftp.postgresql.org/pub/source/v17.11/postgresql-17.11.tar.bz2'
$sourceHash = 'dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979'
$archive = Join-Path $work 'postgresql-17.11.tar.bz2'
Get-Verified $sourceUrl $archive $sourceHash
$checksumFile = Join-Path $work 'postgresql-17.11.tar.bz2.sha256'
Invoke-WebRequest -Uri "$sourceUrl.sha256" -OutFile $checksumFile
if (((Get-Content $checksumFile -Raw).Trim() -split '\s+')[0] -ne $sourceHash) { throw 'Official checksum no longer matches the reviewed source pin.' }
Invoke-Checked 'tar.exe' @('-xjf', $archive, '-C', $work)
$source = Join-Path $work 'postgresql-17.11'

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$vsRoot = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if ($LASTEXITCODE -ne 0 -or -not $vsRoot) { throw 'A licensed MSVC x64 C++ build toolchain is required.' }
$vsDevCmd = Join-Path $vsRoot 'Common7/Tools/VsDevCmd.bat'
$environment = & $env:ComSpec /d /s /c "`"$vsDevCmd`" -no_logo -arch=x64 -host_arch=x64 && set"
if ($LASTEXITCODE -ne 0) { throw 'MSVC environment initialization failed.' }
foreach ($line in $environment) {
  if ($line -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
}
$compiler = (Get-Command cl.exe -ErrorAction Stop).Source
$dumpbin = (Get-Command dumpbin.exe -ErrorAction Stop).Source
$perl = (Get-Command perl.exe -ErrorAction Stop).Source
$python = (Get-Command python.exe -ErrorAction Stop).Source

$venv = Join-Path $work 'tools-venv'
Invoke-Checked $python @('-m', 'venv', $venv)
$venvPython = Join-Path $venv 'Scripts/python.exe'
$requirements = Join-Path $work 'requirements.txt'
'meson==1.9.1 --hash=sha256:f824ab770c041a202f532f69e114c971918ed2daff7ea56583d80642564598d0' | Set-Content $requirements -Encoding utf8
Invoke-Checked $venvPython @('-m', 'pip', 'install', '--disable-pip-version-check', '--only-binary=:all:', '--no-deps', '--require-hashes', '-r', $requirements)
$meson = Join-Path $venv 'Scripts/meson.exe'
$ninjaArchive = Join-Path $work 'ninja-win.zip'
Get-Verified 'https://github.com/ninja-build/ninja/releases/download/v1.13.2/ninja-win.zip' $ninjaArchive '07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65'
$ninjaDirectory = Join-Path $work 'ninja'
Expand-Archive $ninjaArchive $ninjaDirectory
$flexArchive = Join-Path $work 'win_flex_bison-2.5.25.zip'
Get-Verified 'https://github.com/lexxmark/winflexbison/releases/download/v2.5.25/win_flex_bison-2.5.25.zip' $flexArchive '8d324b62be33604b2c45ad1dd34ab93d722534448f55a16ca7292de32b6ac135'
$flexDirectory = Join-Path $work 'winflexbison'
Expand-Archive $flexArchive $flexDirectory
$env:PATH = "$ninjaDirectory;$flexDirectory;$venv/Scripts;$env:PATH"
$env:CC = 'cl.exe'
$build = Join-Path $work 'build'
$options = @('--buildtype=release', '--auto-features=disabled', '--wrap-mode=nodownload', '--bindir=bin', '--libdir=lib', '--datadir=share', '-Dssl=none', '-Duuid=none', '-Db_vscrt=mt', '-Db_pch=false', '-Drpath=false')
Invoke-Checked $meson (@('setup', $build, $source, "--prefix=$output", "-DPERL=$perl") + $options)
Invoke-Checked (Join-Path $ninjaDirectory 'ninja.exe') @('-C', $build, 'all', 'testprep')
# The upstream suite validates the selected CRT/linking configuration, including
# dynamic PostgreSQL modules. Desktop's separate harness covers SCRAM/restart.
Invoke-Checked $meson @('test', '-C', $build, '--no-rebuild', '--print-errorlogs', '--suite', 'setup')
Invoke-Checked $meson @('test', '-C', $build, '--no-rebuild', '--print-errorlogs', 'regress/regress')
Invoke-Checked $meson @('install', '-C', $build, '--no-rebuild')

$licenses = Join-Path $output 'licenses'
New-Item -ItemType Directory -Path $licenses | Out-Null
# Rejected EDB archive notices are audit evidence, not part of this distribution.
Get-ChildItem (Join-Path $repository 'licenses/windows-postgresql') -File | ForEach-Object { Copy-Item $_.FullName $licenses }
Copy-Item $archive (Join-Path $licenses 'postgresql-17.11.tar.bz2')
Copy-Item $checksumFile $licenses
Copy-Item $PSCommandPath (Join-Path $licenses 'build-windows-postgresql.ps1')
Copy-Item (Join-Path $build 'meson-info/intro-buildoptions.json') $licenses
Copy-Item (Join-Path $build 'meson-logs/testlog.txt') (Join-Path $licenses 'upstream-regression-testlog.txt')
$generatedParser = Join-Path $build 'src/backend/parser/gram.c'
$parserText = Get-Content $generatedParser -Raw
$parserNotices = [regex]::Matches($parserText, '/\*[\s\S]*?\*/') | Where-Object { $_.Value -match 'special exception|GNU Bison|Free Software Foundation' } | ForEach-Object { $_.Value }
if (($parserNotices -join "`n") -notmatch 'special exception') { throw 'Generated parser is missing the reviewed Bison output exception.' }
$parserNotices -join "`n`n" | Set-Content (Join-Path $licenses 'Generated-parser-notices.txt') -Encoding utf8

$peFiles = @(Get-ChildItem $output -Recurse -File | Where-Object { $_.Extension -in @('.exe', '.dll') })
$ownDlls = @($peFiles | Where-Object Extension -eq '.dll' | ForEach-Object { $_.Name.ToLowerInvariant() })
$systemDlls = @('kernel32.dll', 'advapi32.dll', 'user32.dll', 'ws2_32.dll', 'secur32.dll', 'netapi32.dll', 'shell32.dll', 'shfolder.dll', 'ole32.dll', 'oleaut32.dll', 'ntdll.dll', 'crypt32.dll', 'bcrypt.dll', 'iphlpapi.dll', 'psapi.dll', 'version.dll', 'dbghelp.dll', 'wldap32.dll', 'winmm.dll', 'rpcrt4.dll')
$imports = @()
foreach ($file in $peFiles) {
  $dependencyText = (& $dumpbin /nologo /dependents $file.FullName) -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "Cannot inspect PE dependencies: $($file.Name)" }
  $dependencies = @([regex]::Matches($dependencyText, '(?im)^\s+([a-z0-9_.-]+\.dll)\s*$') | ForEach-Object { $_.Groups[1].Value.ToLowerInvariant() } | Sort-Object -Unique)
  foreach ($dependency in $dependencies) {
    if ($dependency -notin $ownDlls -and $dependency -notin $systemDlls -and $dependency -notmatch '^(api-ms-win-|ext-ms-win-)[a-z0-9_.-]+\.dll$') { throw "Unreviewed DLL import $dependency in $($file.Name)" }
  }
  $imports += @{ path = [IO.Path]::GetRelativePath($output, $file.FullName).Replace([IO.Path]::DirectorySeparatorChar, [char]'/'); dependencies = $dependencies }
}
$files = @(Get-ChildItem $output -Recurse -File | Sort-Object FullName | ForEach-Object {
  @{path = [IO.Path]::GetRelativePath($output, $_.FullName).Replace([IO.Path]::DirectorySeparatorChar, [char]'/'); sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); size = $_.Length}
})
$manifest = [ordered]@{
  schemaVersion = 1; distribution = 'openbot-postgresql-source-build'; postgresqlVersion = '17.11'; platform = 'win32'; arch = 'x64'
  source = @{url = $sourceUrl; sha256 = $sourceHash; modified = $false}
  options = $options
  build = @{compiler = (Get-Item $compiler).VersionInfo.FileVersion; compilerSha256 = (Get-FileHash $compiler -Algorithm SHA256).Hash.ToLowerInvariant(); meson = '1.9.1'; ninja = '1.13.2'; winFlexBison = '2.5.25'; perl = ((& $perl -e 'print $^V') -join ''); python = ((& $python --version) -join ''); runnerImage = $env:ImageVersion; repositoryCommit = $env:GITHUB_SHA; createdAt = [DateTime]::UtcNow.ToString('o')}
  verification = @{upstreamRegression = 'passed'; peDependencies = 'own-postgresql-or-windows-system-only'}
  imports = $imports
  licenses = @($files | Where-Object { $_.path.StartsWith('licenses/') })
  files = $files
}
$manifest | ConvertTo-Json -Depth 12 | Set-Content (Join-Path $output 'openbot-postgresql-build.json') -Encoding utf8
Write-Host "Verified PostgreSQL 17.11 runtime: $output"
