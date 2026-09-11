import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

export function macosSigningOptions(env, platform, preview = false) {
  const identity = env.OPENBOT_DESKTOP_MACOS_SIGNING_IDENTITY;
  const profile = env.OPENBOT_DESKTOP_MACOS_NOTARY_PROFILE;
  if (!identity && !profile) return undefined;
  if (
    platform !== "darwin" ||
    preview ||
    !identity?.startsWith("Developer ID Application: ") ||
    !profile ||
    /[\r\n\0]/u.test(identity + profile)
  )
    throw new Error(
      "Signed Desktop packaging requires macOS, the canonical app, a Developer ID Application identity and a notarytool Keychain profile.",
    );
  return {
    osxSign: {
      identity,
      continueOnError: false,
      optionsForFile: () => ({
        hardenedRuntime: true,
        entitlements: fileURLToPath(
          new URL("../resources/desktop-entitlements.plist", import.meta.url),
        ),
      }),
    },
    osxNotarize: { keychainProfile: profile },
  };
}

export async function verifyNotarizedDesktop(appPath) {
  const run = promisify(execFile);
  await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath], { timeout: 60_000 });
  const { stderr } = await run("/usr/bin/codesign", ["--display", "--verbose=4", appPath]);
  if (
    !/^Authority=Developer ID Application:/mu.test(stderr) ||
    !/^TeamIdentifier=[A-Z0-9]{10}$/mu.test(stderr)
  )
    throw new Error("The application does not have a Developer ID signature.");
  await run("/usr/bin/xcrun", ["stapler", "validate", appPath], { timeout: 60_000 });
  await run("/usr/sbin/spctl", ["--assess", "--type", "execute", appPath], { timeout: 60_000 });
}
