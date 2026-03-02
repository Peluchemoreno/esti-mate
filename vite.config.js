import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), sentryVitePlugin({
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: process.env.SENTRY_RELEASE,
  }), sentryVitePlugin({
    org: "esti-mate",
    project: "javascript-react"
  })],
  build: {
    sourcemap: true, // ensure source maps are generated for Sentry
  },
  server: {
    port: 9000,
  },
  resolve: {
    alias: {
      buffer: "buffer", // ensure it resolves
    },
  },
  optimizeDeps: {
    include: ["buffer"], // prebundle
  },
  define: {
    "process.env": {}, // avoid undefined at runtime
  },
});
