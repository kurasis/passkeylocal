import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DESKTOP__: 'false' },
  resolve: { alias: {
    '@platform': new URL('./src/platform.ts', import.meta.url).pathname,
    '@platform-storage': new URL('./src/worker/platform-storage.ts', import.meta.url).pathname
  } },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
    pool: 'forks'
  }
});
