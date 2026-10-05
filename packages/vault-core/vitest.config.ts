import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Real Argon2id (64 MiB, 3 passes) runs in every vault test; keep timeouts generous.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks'
  }
});
