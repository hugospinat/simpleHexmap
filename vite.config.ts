import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  server: {
    proxy: {
      "/maps": "http://localhost:3001",
      "/ws": {
        target: "ws://localhost:3001",
        ws: true
      }
    }
  },
  test: {
    environment: "node"
  }
});
