import { defineConfig } from 'vitest/config';
import { unitTestFiles } from './vitest.unit.config.ts';

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: unitTestFiles,
    // Tests share one database schema, so run every integration test serially rather than
    // letting parallel workers/hooks truncate tables under each other.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    maxConcurrency: 1,
    sequence: { concurrent: false },
    testTimeout: 20000,
  },
});
