import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
    plugins: [react()],
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
