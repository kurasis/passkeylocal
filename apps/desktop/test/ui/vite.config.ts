import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  server: { port: 4181, strictPort: true },
  resolve: {
    alias: {
      "@platform": fileURLToPath(
        new URL("../../../pwa/src/platform.ts", import.meta.url),
      ),
    },
  },
});
