# Exercises a real 17.10 -> 17.11 cluster with synthetic data only. The old EDB
# package is a test input in RUNNER_TEMP and is never copied into a release.
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$RuntimeDirectory)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $IsWindows) { throw 'This compatibility test requires native Windows.' }
$runtime = [IO.Path]::GetFullPath($RuntimeDirectory)
$manifest = Get-Content (Join-Path $runtime 'openbot-postgresql-build.json') -Raw | ConvertFrom-Json
if ($manifest.postgresqlVersion -ne '17.11' -or $manifest.distribution -ne 'openbot-postgresql-source-build') { throw 'Expected the reviewed PostgreSQL 17.11 source build.' }
$work = Join-Path ([IO.Path]::GetTempPath()) ('openbot-pg-upgrade-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $work | Out-Null
$archive = Join-Path $work 'postgresql-17.10-original.zip'
Invoke-WebRequest 'https://get.enterprisedb.com/postgresql/postgresql-17.10-1-windows-x64-binaries.zip' -OutFile $archive
if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'f9aafca58e7026a1ef2caeee711acf761671e57904d430adc85f468374f5a821') { throw 'Old-version test archive checksum mismatch.' }
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
  foreach ($entry in $zip.Entries) {
    if ($entry.FullName -notmatch '^pgsql/(bin|lib|share)/' -or $entry.FullName.EndsWith('/')) { continue }
    $destination = [IO.Path]::GetFullPath((Join-Path $work $entry.FullName))
    if (-not $destination.StartsWith($work + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe archive entry.' }
    [IO.Directory]::CreateDirectory((Split-Path $destination -Parent)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $false)
  }
} finally { $zip.Dispose() }
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}
$oldBin = Join-Path $work 'pgsql/bin'
$newBin = Join-Path $runtime 'bin'
$data = Join-Path $work 'cluster'
$passwordFile = Join-Path $work 'password.txt'
'openbot-minor-upgrade-ci-only' | Set-Content $passwordFile -Encoding utf8
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$previousPassword = $env:PGPASSWORD
$previousEncoding = $env:PGCLIENTENCODING
$env:PGPASSWORD = 'openbot-minor-upgrade-ci-only'
$env:PGCLIENTENCODING = 'UTF8'
$connection = @('-h', '127.0.0.1', '-p', "$port", '-U', 'openbot_upgrade', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X')
$running = $false
try {
  Invoke-Checked (Join-Path $oldBin 'initdb.exe') @('-D', $data, '-U', 'openbot_upgrade', '--encoding=UTF8', '--locale=C', '--locale-provider=libc', '--auth=scram-sha-256', "--pwfile=$passwordFile")
  Invoke-Checked (Join-Path $oldBin 'pg_ctl.exe') @('-D', $data, '-l', (Join-Path $work 'old.log'), '-o', "-h 127.0.0.1 -p $port", '-w', 'start')
  $running = $true
  $seed = Join-Path $work 'seed.sql'
  @'
CREATE TABLE upgrade_fixture (id integer PRIMARY KEY, text_value text, document jsonb);
INSERT INTO upgrade_fixture VALUES (1, U&'\9891\9053\5408\4F5C', '{"retained":true}');
CREATE FUNCTION upgrade_length(value text) RETURNS integer LANGUAGE plpgsql AS $$ BEGIN RETURN length(value); END $$;
CHECKPOINT;
'@ | Set-Content $seed -Encoding utf8
  Invoke-Checked (Join-Path $oldBin 'psql.exe') ($connection + @('-f', $seed))
  Invoke-Checked (Join-Path $oldBin 'pg_ctl.exe') @('-D', $data, '-m', 'fast', '-w', 'stop')
  $running = $false
  Invoke-Checked (Join-Path $newBin 'pg_ctl.exe') @('-D', $data, '-l', (Join-Path $work 'new.log'), '-o', "-h 127.0.0.1 -p $port", '-w', 'start')
  $running = $true
  $verify = Join-Path $work 'verify.sql'
  @'
DO $$ BEGIN
  IF current_setting('server_version_num')::integer <> 170011 THEN RAISE EXCEPTION 'Unexpected server version'; END IF;
  IF NOT EXISTS (SELECT 1 FROM upgrade_fixture WHERE text_value=U&'\9891\9053\5408\4F5C' AND document->>'retained'='true' AND upgrade_length(text_value)=4) THEN RAISE EXCEPTION 'Old data or PLpgSQL was not retained'; END IF;
  IF to_tsvector('english', 'channels working') IS NULL THEN RAISE EXCEPTION 'Snowball dictionary unavailable'; END IF;
END $$;
INSERT INTO upgrade_fixture VALUES (2, 'new-version-write', '{"retained":true}');
'@ | Set-Content $verify -Encoding utf8
  Invoke-Checked (Join-Path $newBin 'psql.exe') ($connection + @('-f', $verify))
  Invoke-Checked (Join-Path $newBin 'pg_ctl.exe') @('-D', $data, '-m', 'fast', '-w', 'stop')
  $running = $false
  Invoke-Checked (Join-Path $newBin 'pg_ctl.exe') @('-D', $data, '-l', (Join-Path $work 'restart.log'), '-o', "-h 127.0.0.1 -p $port", '-w', 'start')
  $running = $true
  $count = (& (Join-Path $newBin 'psql.exe') @connection -t -A -c 'SELECT count(*) FROM upgrade_fixture;') -join ''
  if ($LASTEXITCODE -ne 0 -or $count.Trim() -ne '2') { throw 'Upgraded data did not survive restart.' }
  Write-Host 'PASS: real PostgreSQL 17.10 cluster opened by 17.11, SCRAM, UTF-8, JSON, PLpgSQL, Snowball, write and restart.'
} finally {
  if ($running) { & (Join-Path $newBin 'pg_ctl.exe') '-D' $data '-m' 'fast' '-w' 'stop' | Out-Null }
  $env:PGPASSWORD = $previousPassword
  $env:PGCLIENTENCODING = $previousEncoding
}
