import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// Use Chromium's actual file-document CSP and sandbox enforcement, not a DOM emulator.
const require = createRequire(import.meta.url);
const execute = promisify(execFile);
const fixture = await mkdtemp(join(tmpdir(), "openbot-plugin-sandbox-"));
const renderer = new URL("../dist/renderer/", import.meta.url);
let networkRequests = 0;
const network = createServer((_request, response) => {
  networkRequests++;
  response.writeHead(200, { "Access-Control-Allow-Origin": "*" }).end("probe");
});
try {
  await new Promise((resolve, reject) => {
    network.once("error", reject);
    network.listen(0, "127.0.0.1", resolve);
  });
  const address = network.address();
  assert(address && typeof address === "object");
  const endpoint = `http://127.0.0.1:${address.port}/isolation-probe`;
  const index = await readFile(new URL("index.html", renderer), "utf8");
  const csp = index.match(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/u)?.[0];
  assert(csp, "Built renderer CSP is required");
  assert(csp.includes("script-src 'self'"), "Do not loosen the host's script policy");
  await copyFile(new URL("plugin-sandbox.html", renderer), join(fixture, "plugin-sandbox.html"));
  await writeFile(
    join(fixture, "index.html"),
    `<!doctype html><html><head>${csp}</head><body><p id="result">pending</p><iframe id="proxy" src="./plugin-sandbox.html" sandbox="allow-scripts"></iframe><script src="./probe.js"></script></body></html>`,
  );
  const hostileView = `<script>
    const result = {};
    try { void window.top.document.body; result.dom = false; } catch { result.dom = true; }
    try { void document.cookie; result.cookies = false; } catch { result.cookies = true; }
    try { void window.parent.document.body; result.proxy = false; } catch { result.proxy = true; }
    fetch(${JSON.stringify(endpoint)}).then(
      () => { result.network = false; send(); },
      () => { result.network = true; send(); },
    );
    function send() { parent.postMessage({jsonrpc:'2.0',id:'boundary',result}, '*'); }
  </script>`;
  await writeFile(
    join(fixture, "probe.js"),
    `const frame = document.getElementById('proxy');
    const html = ${JSON.stringify(hostileView)};
    window.addEventListener('message', event => {
      if (event.source !== frame.contentWindow) return;
      if (event.data.method === 'ui/notifications/sandbox-proxy-ready') {
        frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/sandbox-resource-ready',params:{html}}, '*');
      }
      if (event.data.id === 'boundary') document.getElementById('result').textContent = JSON.stringify(event.data.result);
    });`,
  );
  await writeFile(
    join(fixture, "main.cjs"),
    `const {app, BrowserWindow} = require('electron');
    const path = require('node:path');
    app.setPath('userData', path.join(__dirname, 'profile'));
    app.whenReady().then(async () => {
      const window = new BrowserWindow({show:false, webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
      try {
        await window.loadFile(path.join(__dirname, 'index.html'));
        let result = 'pending';
        for (let i = 0; i < 100 && result === 'pending'; i++) {
          result = await window.webContents.executeJavaScript('document.getElementById("result").textContent');
          if (result === 'pending') await new Promise(resolve => setTimeout(resolve, 100));
        }
        const value = JSON.parse(result);
        if (!value.dom || !value.proxy || !value.cookies || !value.network) throw new Error('Sandbox boundary failed');
        console.log('OPENBOT_PLUGIN_SANDBOX_PASS');
        app.exit(0);
      } catch (error) { console.error(error.message); app.exit(1); }
    });`,
  );
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const { stdout } = await execute(require("electron"), [join(fixture, "main.cjs")], {
    env: environment,
    timeout: 30_000,
    maxBuffer: 64 * 1024,
    windowsHide: true,
  });
  assert(stdout.includes("OPENBOT_PLUGIN_SANDBOX_PASS"), "Native browser evidence is required");
  assert.equal(networkRequests, 0, "A blocked fetch must never reach the listening test server");
  console.info(
    "Native plugin sandbox passed: strict host CSP, initialized proxy, isolated DOM and cookies, no direct network.",
  );
} finally {
  network.closeAllConnections();
  await new Promise((resolve) => network.close(resolve));
  await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
