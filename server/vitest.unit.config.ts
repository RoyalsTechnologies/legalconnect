import { defineConfig } from 'vitest/config';

/** Pure unit files: no HTTP server, no Postgres. Keep in sync with vitest.config.ts exclude. */
export const unitTestFiles = [
  'tests/adapters-unconfigured.test.ts',
  'tests/ai-client-unconfigured.test.ts',
  'tests/ai-client.test.ts',
  'tests/ai-triage.test.ts',
  'tests/callback-auth.test.ts',
  'tests/callback-unconfigured.test.ts',
  'tests/error-handler-production.test.ts',
  'tests/google-calendar.test.ts',
  'tests/health-degraded.test.ts',
  'tests/env-invalid.test.ts',
  'tests/lib-helpers.test.ts',
  'tests/logger.test.ts',
  'tests/nalopay-dev.test.ts',
  'tests/nalopay-live.test.ts',
  'tests/nalopay.test.ts',
  'tests/notifications-fail.test.ts',
  'tests/notifications.test.ts',
  'tests/outbound-adapters.test.ts',
  'tests/role-guard.test.ts',
  'tests/schema-branches.test.ts',
  'tests/sms.test.ts',
  'tests/templates.test.ts',
];

export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    include: unitTestFiles,
  },
});
