import { execFile } from "node:child_process";
import { win32 } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

/** Values are transported as environment data, never interpolated into executable PowerShell. */
export const WINDOWS_PRIVATE_DIRECTORY_SCRIPT = `
$ErrorActionPreference = 'Stop'
$path = $env:OPENBOT_PRIVATE_DIRECTORY
$item = Get-Item -LiteralPath $path -Force
if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe directory' }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
if ($env:OPENBOT_PRIVATE_DIRECTORY_NEW -eq '1') {
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetOwner($sid)
  $acl.SetAccessRuleProtection($true, $false)
  $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $path -AclObject $acl
}
$acl = Get-Acl -LiteralPath $path
if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'Unexpected owner' }
$rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
$ownerAccess = $false
foreach ($rule in $rules) {
  if ($rule.AccessControlType -ne 'Allow') { continue }
  if ($rule.IdentityReference.Value -ne $sid.Value) { throw 'Unexpected directory access' }
  if (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $ownerAccess = $true }
}
if (!$ownerAccess) { throw 'Missing owner access' }
`;

export function windowsNativeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const systemRoot = source.SystemRoot ?? source.SYSTEMROOT;
  if (!systemRoot || !/^[A-Za-z]:\\[^\0\r\n]*$/u.test(systemRoot)) {
    throw new Error("Windows system directory is unavailable.");
  }
  const environment: Record<string, string> = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    COMSPEC: win32.join(systemRoot, "System32", "cmd.exe"),
    PATH: win32.join(systemRoot, "System32"),
    LANG: "C",
    LC_ALL: "C",
  };
  for (const name of ["TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) {
    const value = source[name];
    if (value && !/[\0\r\n]/u.test(value)) environment[name] = value;
  }
  return environment;
}

export async function verifyWindowsPrivateDirectory(path: string, created: boolean): Promise<void> {
  if (process.platform !== "win32") throw new Error("Windows ACL checks require Windows.");
  const environment = windowsNativeEnvironment();
  await execute(
    win32.join(
      environment.SystemRoot ?? "",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(WINDOWS_PRIVATE_DIRECTORY_SCRIPT, "utf16le").toString("base64"),
    ],
    {
      env: {
        ...environment,
        OPENBOT_PRIVATE_DIRECTORY: path,
        OPENBOT_PRIVATE_DIRECTORY_NEW: created ? "1" : "0",
      },
      windowsHide: true,
      shell: false,
      timeout: 15_000,
      maxBuffer: 4096,
    },
  );
}
