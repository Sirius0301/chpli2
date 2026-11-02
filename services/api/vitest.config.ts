import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.spec.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    // All spec files share one PostgreSQL database; run them sequentially.
    fileParallelism: false,
  },
});
