import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { pluginProxyDocument } from "./src/plugin-app-sandbox";

function pluginSandboxDocument(): Plugin {
  return {
    name: "openbot-plugin-sandbox-document",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "plugin-sandbox.html",
        source: pluginProxyDocument(),
      });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/plugin-sandbox.html") return next();
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(pluginProxyDocument());
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const desktopRenderer = mode === "desktop";

  return {
    ...(desktopRenderer
      ? {
          base: "./",
          build: {
            emptyOutDir: true,
            outDir: "../desktop/dist/renderer",
          },
        }
      : {}),
    plugins: [react(), pluginSandboxDocument()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": "http://localhost:3001",
        "/health": "http://localhost:3001",
      },
    },
  };
});
