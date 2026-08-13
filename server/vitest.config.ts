import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Tests share one database schema, so run files sequentially rather than
    // letting parallel workers truncate tables under each other.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
