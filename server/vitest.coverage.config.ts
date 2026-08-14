import { defineConfig } from 'vitest/config';
import { unitTestFiles } from './vitest.unit.config.ts';

/**
 * Two projects so files that mock `env.js` cannot leak `isTest` into the
 * integration suite. Coverage from both is merged into one report.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', 'text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 88,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: unitTestFiles,
          isolate: true,
          pool: 'forks',
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          globalSetup: ['./tests/global-setup.ts'],
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.ts'],
          exclude: unitTestFiles,
          // Same serial lock as vitest.config.ts — one shared `test` schema (TD-009).
          fileParallelism: false,
          maxWorkers: 1,
          minWorkers: 1,
          maxConcurrency: 1,
          sequence: { concurrent: false },
          testTimeout: 20000,
          isolate: true,
        },
      },
    ],
  },
});
