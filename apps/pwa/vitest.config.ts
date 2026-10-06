import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DESKTOP__: 'false' },
  resolve: { alias: {
    '@platform': fileURLToPath(new URL('./src/platform.ts', import.meta.url)),
    '@platform-storage': fileURLToPath(new URL('./src/worker/platform-storage.ts', import.meta.url))
  } },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    pool: 'forks'
  }
});
