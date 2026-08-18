import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// @replit/vite-plugin-runtime-error-modal used to run here — it's Replit's
// own dev-error overlay, meant for Replit's webview integration. This
// project runs as a plain local dev server now, not inside Replit, and
// the plugin's overlay blocked the whole UI (unclosable via any normal
// client-side error suppression) on a benign, well-known Chromium
// "ResizeObserver loop" notification that isn't a real error — verified
// across 5 independent error-detection channels (pageerror, console.error,
// unhandledrejection, CDP Runtime.exceptionThrown, and the plugin's own
// detailed message) that nothing is actually thrown when this fires.
export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "https://localhost:5050",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
  },
});
