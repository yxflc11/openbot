/** The trusted proxy is an opaque-origin data URL, never plugin HTML in the host origin. */
export const PLUGIN_VIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
export const PLUGIN_PROXY_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export function pluginProxyDocument(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PLUGIN_PROXY_CSP}"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style></head><body><script>
  const host = window.parent;
  let view;
  let loaded = false;
  let received = 0;
  function valid(data, max) {
    if (!data || typeof data !== 'object' || data.jsonrpc !== '2.0') return false;
    try { return JSON.stringify(data).length <= max; } catch { return false; }
  }
  const ready = setInterval(() => host.postMessage({jsonrpc:'2.0',method:'ui/notifications/sandbox-proxy-ready',params:{}}, '*'), 100);
  setTimeout(() => clearInterval(ready), 10000);
  window.addEventListener('message', event => {
    if (event.source === host) {
      const data = event.data;
      if (!valid(data, 180000)) return;
      if (data.method === 'ui/notifications/sandbox-resource-ready') {
        if (loaded || typeof data.params?.html !== 'string' || data.params.html.length > 131072) return;
        loaded = true;
        clearInterval(ready);
        view = document.createElement('iframe');
        view.setAttribute('sandbox','allow-scripts');
        view.setAttribute('referrerpolicy','no-referrer');
        view.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-write 'none'");
        view.title = 'Isolated plugin view';
        view.srcdoc = ${JSON.stringify(`<meta http-equiv="Content-Security-Policy" content="${PLUGIN_VIEW_CSP}">`)} + data.params.html;
        document.body.append(view);
      } else if (view && !String(data.method || '').startsWith('ui/notifications/sandbox-')) {
        view.contentWindow.postMessage(data, '*');
      }
    } else if (view && event.source === view.contentWindow) {
      if (++received > 512 || !valid(event.data, 16384) || String(event.data.method || '').startsWith('ui/notifications/sandbox-')) return;
      host.postMessage(event.data, '*');
    }
  });
  </script></body></html>`;
}

export function pluginProxyUrl(): string {
  return `data:text/html;base64,${btoa(pluginProxyDocument())}`;
}

export function isBoundedPluginMessage(value: unknown): boolean {
  let nodes = 0;
  function check(item: unknown, depth: number): boolean {
    if (depth > 12 || ++nodes > 2048) return false;
    if (typeof item === "string") return item.length <= 16384;
    if (!item || typeof item !== "object") return true;
    return Object.values(item).every((child) => check(child, depth + 1));
  }
  try {
    return check(value, 0) && JSON.stringify(value).length <= 16384;
  } catch {
    return false;
  }
}
