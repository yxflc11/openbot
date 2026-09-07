param([Parameter(Mandatory = $true)][string]$ScriptPath, [Parameter(Mandatory = $true)][string]$TestDirectory)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Net.Http
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($ScriptPath, [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw "Bootstrap parse failed." }
$function = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq "Save-OpenBotReleaseDownload" }, $true)
if ($null -eq $function) { throw "Bounded download function missing." }
# Evaluate only the repository-owned helper; the installer body never runs in this test.
Invoke-Expression $function.Extent.Text
$fixtureSource = @'
using System;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
public class OpenBotFixtureHandler : HttpMessageHandler {
  public Queue<HttpResponseMessage> Responses = new Queue<HttpResponseMessage>();
  public List<string> Requests = new List<string>();
  public bool Delay;
  protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
    Requests.Add(request.RequestUri.AbsoluteUri);
    if (Delay) await Task.Delay(Timeout.Infinite, token);
    token.ThrowIfCancellationRequested();
    return Responses.Dequeue();
  }
}
public class OpenBotNonSeekableStream : Stream {
  private MemoryStream inner;
  public OpenBotNonSeekableStream(byte[] bytes) { inner = new MemoryStream(bytes); }
  public override bool CanRead { get { return true; } }
  public override bool CanSeek { get { return false; } }
  public override bool CanWrite { get { return false; } }
  public override long Length { get { throw new NotSupportedException(); } }
  public override long Position { get { throw new NotSupportedException(); } set { throw new NotSupportedException(); } }
  public override int Read(byte[] buffer, int offset, int count) { return inner.Read(buffer, offset, count); }
  public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token) { token.ThrowIfCancellationRequested(); return inner.ReadAsync(buffer, offset, count, token); }
  public override void Flush() { }
  public override long Seek(long offset, SeekOrigin origin) { throw new NotSupportedException(); }
  public override void SetLength(long value) { throw new NotSupportedException(); }
  public override void Write(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }
  protected override void Dispose(bool disposing) { if (disposing) inner.Dispose(); base.Dispose(disposing); }
}
public class OpenBotDelayedStream : OpenBotNonSeekableStream {
  public OpenBotDelayedStream() : base(new byte[0]) { }
  public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token) {
    await Task.Delay(Timeout.Infinite, token);
    return 0;
  }
}
'@
if ($PSEdition -eq 'Desktop') { Add-Type -TypeDefinition $fixtureSource -ReferencedAssemblies System.Net.Http }
else { Add-Type -TypeDefinition $fixtureSource }
function New-Response([int]$Status, [string]$Body = "", [string]$Location = "") {
  $response = New-Object System.Net.Http.HttpResponseMessage([System.Net.HttpStatusCode]$Status)
  $stream = New-Object OpenBotNonSeekableStream(,[Text.Encoding]::UTF8.GetBytes($Body))
  $response.Content = New-Object System.Net.Http.StreamContent($stream)
  if ($Location) { $response.Headers.Location = New-Object Uri($Location, [UriKind]::RelativeOrAbsolute) }
  return $response
}
function Assert-Fails([scriptblock]$Action, [string]$Pattern) {
  $failed = $false
  try { & $Action } catch { $failed = $true; if ($_.Exception.Message -notmatch $Pattern) { throw } }
  if (-not $failed) { throw "Expected a download failure." }
}
$destination = Join-Path $TestDirectory "asset.bin"
$uri = [Uri]"https://github.com/yxflc11/openbot/releases/download/desktop-v0.1.0-alpha.2/asset.bin"
$passed = 0

$handler = New-Object OpenBotFixtureHandler
$client = New-Object System.Net.Http.HttpClient($handler)
try {
  $handler.Responses.Enqueue((New-Response 302 "" "https://release-assets.githubusercontent.com/fixture"))
  $handler.Responses.Enqueue((New-Response 200 "verified"))
  Save-OpenBotReleaseDownload $client $uri $destination 8 5
  if ([IO.File]::ReadAllText($destination) -ne "verified" -or $handler.Requests.Count -ne 2) { throw "Redirected bytes mismatch." }
  $handler.Responses.Enqueue((New-Response 200 "replace"))
  Assert-Fails { Save-OpenBotReleaseDownload $client $uri $destination 8 5 } "."
  if ([IO.File]::ReadAllText($destination) -ne "verified") { throw "Existing file changed." }
  $passed += 2
} finally { $client.Dispose(); Remove-Item -LiteralPath $destination -Force }

foreach ($target in @("http://github.com/fixture", "https://evil.example/fixture", "https://github.com:8443/fixture")) {
  $handler = New-Object OpenBotFixtureHandler
  $client = New-Object System.Net.Http.HttpClient($handler)
  try {
    $handler.Responses.Enqueue((New-Response 302 "" $target))
    Assert-Fails { Save-OpenBotReleaseDownload $client $uri $destination 8 5 } "require HTTPS"
    if ($handler.Requests.Count -ne 1 -or (Test-Path -LiteralPath $destination)) { throw "Redirect boundary was crossed." }
    $passed++
  } finally { $client.Dispose() }
}

$handler = New-Object OpenBotFixtureHandler
$client = New-Object System.Net.Http.HttpClient($handler)
try {
  for ($index = 0; $index -lt 6; $index++) { $handler.Responses.Enqueue((New-Response 302 "" "/loop")) }
  Assert-Fails { Save-OpenBotReleaseDownload $client $uri $destination 8 5 } "redirect limit"
  if ($handler.Requests.Count -ne 6) { throw "Wrong redirect bound." }
  $passed++
} finally { $client.Dispose() }

$handler = New-Object OpenBotFixtureHandler
$client = New-Object System.Net.Http.HttpClient($handler)
try {
  $handler.Responses.Enqueue((New-Response 200 "too large"))
  Assert-Fails { Save-OpenBotReleaseDownload $client $uri $destination 3 5 } "byte limit"
  if (Test-Path -LiteralPath $destination) { throw "Partial download was retained." }
  $handler.Responses.Enqueue((New-Response 200 "ok"))
  Save-OpenBotReleaseDownload $client $uri $destination 3 5
  if ([IO.File]::ReadAllText($destination) -ne "ok") { throw "Retry failed." }
  $passed++
} finally { $client.Dispose(); Remove-Item -LiteralPath $destination -Force }

$handler = New-Object OpenBotFixtureHandler
$client = New-Object System.Net.Http.HttpClient($handler)
try {
  $handler.Delay = $true
  Assert-Fails { Save-OpenBotReleaseDownload $client $uri $destination 3 1 } "cancel"
  if (Test-Path -LiteralPath $destination) { throw "Cancelled download created output." }
  $passed++
} finally { $client.Dispose() }
$handler = New-Object OpenBotFixtureHandler
$client = New-Object System.Net.Http.HttpClient($handler)
try {
  $response = New-Response 200
  $response.Content.Dispose()
  $response.Content = New-Object System.Net.Http.StreamContent((New-Object OpenBotDelayedStream))
  $handler.Responses.Enqueue($response)
  Assert-Fails { Save-OpenBotReleaseDownload $client $uri $destination 3 1 } "cancel"
  if (Test-Path -LiteralPath $destination) { throw "Cancelled body left partial output." }
  $passed++
} finally { $client.Dispose() }
Write-Output (@{ cases = $passed; powershell = $PSVersionTable.PSVersion.ToString(); networkRequests = 0 } | ConvertTo-Json -Compress)
