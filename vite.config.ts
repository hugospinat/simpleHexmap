import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const apiProxyTarget = "http://localhost:8787";
const apiProxyOrigin = new URL(apiProxyTarget).origin;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
        rewriteWsOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", apiProxyOrigin);
          });
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"]
  }
});
