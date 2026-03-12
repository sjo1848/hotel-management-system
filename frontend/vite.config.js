import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite"; // <--- Importante

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
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
          if (id.includes("recharts")) return "charts";
          if (id.includes("date-fns")) return "date";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack/react-query") || id.includes("axios")) {
            return "data";
          }
          if (id.includes("@radix-ui/") || id.includes("react-day-picker")) {
            return "ui-kit";
          }
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
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
