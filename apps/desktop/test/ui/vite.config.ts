import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify('synthetic-test'), __DESKTOP__: 'true' },
  server: { port: 4181, strictPort: true },
  resolve: {
    alias: [
      { find: '@platform', replacement: fileURLToPath(new URL('./shell-platform.ts', import.meta.url)) },
      { find: /.*vault-client\.ts$/, replacement: fileURLToPath(new URL('./shell-client.ts', import.meta.url)) },
    ],
  },
});
