import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { global: "globalThis" },
  resolve: { alias: { buffer: "buffer/" } },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
