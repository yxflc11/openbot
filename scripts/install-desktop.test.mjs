import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./install-desktop.sh", import.meta.url));

test("bootstrap defaults match the Desktop version and Windows keeps OS trust policy", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../apps/desktop/package.json", import.meta.url), "utf8"),
  );
  const shell = await readFile(script, "utf8");
  const powershell = await readFile(new URL("./install-desktop.ps1", import.meta.url), "utf8");
  assert.ok(shell.includes(`version="\${1:-${manifest.version}}"`));
  assert.ok(powershell.includes(`[string]$Version = "${manifest.version}"`));
  assert.ok(powershell.includes("Get-FileHash -Algorithm SHA256"));
  assert.ok(powershell.includes("Zone.Identifier"));
  assert.doesNotMatch(powershell, /Unblock-File|ExecutionPolicy\s+Bypass|Verb\s+RunAs/i);
});

test("shell bootstrap rejects malformed release references before invoking curl", {
  skip: process.platform === "win32",
}, () => {
  for (const value of ["../../main", "latest", "1.0.0; touch /tmp/should-not-exist", "1.0.0\n"]) {
    const result = spawnSync("bash", [script, value], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid Desktop version/);
  }
});

test("shell bootstrap refuses altered downloads and cleans staging before any installation", {
  skip: process.platform === "win32",
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "openbot-bootstrap-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const commands = {
    id: "#!/bin/sh\necho 1000\n",
    uname: '#!/bin/sh\nif [ "$1" = "-s" ]; then echo Linux; else echo x86_64; fi\n',
    curl: `#!/bin/bash\nset -eu\nwhile [[ "$#" -gt 0 ]]; do\n if [[ "$1" == "--output" ]]; then out="$2"; shift 2; else shift; fi\ndone\ncase "$out" in\n */SHA256SUMS) printf '%s  %s\\n' '${"a".repeat(64)}' 'openbot-desktop-0.1.0-alpha.2-linux-x64.AppImage' > "$out";;\n *) printf 'altered installer' > "$out";;\nesac\n`,
  };
  for (const [name, body] of Object.entries(commands))
    await writeFile(join(directory, name), body, { mode: 0o755 });
  const result = spawnSync("bash", [script, "0.1.0-alpha.2"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /checksum mismatch; nothing was installed/);
});
