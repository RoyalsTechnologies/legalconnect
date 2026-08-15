import { execSync } from 'node:child_process';
import 'dotenv/config';

/**
 * Tests run against their own Postgres schema in the same database, so they can
 * truncate freely without touching development data. Using a schema rather than a
 * separate database avoids needing CREATE DATABASE privileges.
 *
 * The name is per run rather than a shared `test`, because two overlapping runs — or
 * anything else that reaches for the same schema — truncated tables under each other
 * and surfaced as unrelated authorization and validation failures (TD-009). The worker
 * processes inherit `LC_TEST_SCHEMA` from this setup, so every one of them agrees with
 * the schema that was migrated here.
 */
export const TEST_SCHEMA = process.env.LC_TEST_SCHEMA ?? `test_${process.pid}`;

export function buildTestDatabaseUrl(schema: string = TEST_SCHEMA): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL must be set to run tests');
  const url = new URL(base);
  url.searchParams.set('schema', schema);
  return url.toString();
}

export default function setup() {
  process.env.LC_TEST_SCHEMA = TEST_SCHEMA;
  const testUrl = buildTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;

  // migrate deploy creates the schema and applies committed migrations.
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  return () => {
    // A crashed run leaves its schema behind; dropping here keeps the common case tidy
    // without letting a teardown failure mask the test result.
    try {
      execSync(`npx prisma db execute --url "${testUrl}" --stdin`, {
        stdio: 'pipe',
        input: `DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE;`,
      });
    } catch {
      console.warn(`[tests] could not drop schema ${TEST_SCHEMA}; drop it by hand if it lingers`);
    }
  };
}
