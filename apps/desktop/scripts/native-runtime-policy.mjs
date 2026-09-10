/** Follow the pinned npm package's declared OS/CPU filter, not the build host's directory inventory. */
export function nativeOptionalPackageApplies(entry, platform, arch) {
  if (!entry || typeof entry !== "object") throw new Error("Missing locked native package entry.");
  const accepts = (rules, value) => {
    if (rules === undefined) return true;
    if (!Array.isArray(rules) || !rules.every((rule) => typeof rule === "string"))
      throw new Error("Invalid native platform restriction.");
    if (rules.includes(`!${value}`)) return false;
    const positive = rules.filter((rule) => !rule.startsWith("!"));
    return positive.length === 0 || positive.includes("any") || positive.includes(value);
  };
  return accepts(entry.os, platform) && accepts(entry.cpu, arch);
}
