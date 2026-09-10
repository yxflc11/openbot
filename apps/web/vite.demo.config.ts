import { renameSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "demo-index",
      apply: "build",
      closeBundle() {
        renameSync(
          resolve(import.meta.dirname, "dist-demo/demo.html"),
          resolve(import.meta.dirname, "dist-demo/index.html"),
        );
      },
    },
  ],
  build: {
    outDir: "dist-demo",
    target: "es2022",
    rolldownOptions: { input: resolve(import.meta.dirname, "demo.html") },
  },
  server: {
    host: "127.0.0.1",
    port: 5178,
    hmr: false,
    headers: { "Permissions-Policy": "microphone=(), camera=(), geolocation=()" },
  },
  preview: {
    host: "127.0.0.1",
    port: 5178,
    headers: { "Permissions-Policy": "microphone=(), camera=(), geolocation=()" },
  },
});
