import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react()],
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
