import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite"; // <--- Importante

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Force rebuild on dev server restart to avoid stale chunk references in node_modules/.vite
    // after config changes inside Docker volumes.
    force: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Required for temporary public tunnels (Cloudflare/ngrok) during demos.
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("axios")) return "network";
          if (id.includes("react-day-picker")) return "calendar-ui";
          if (id.includes("recharts")) return "charts";
          if (id.includes("date-fns")) return "date";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-router")) return "router";
          return "vendor";
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: true,
    testTimeout: 15000,
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
