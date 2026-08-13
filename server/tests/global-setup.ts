import { execSync } from 'node:child_process';
import 'dotenv/config';

// Tests run against a dedicated Postgres schema in the same database, so they can
// truncate freely without touching development data. Using a schema rather than a
// separate database avoids needing CREATE DATABASE privileges.
export const TEST_SCHEMA = 'test';

export function buildTestDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL must be set to run tests');
  const url = new URL(base);
  url.searchParams.set('schema', TEST_SCHEMA);
  return url.toString();
}

export default function setup() {
  const testUrl = buildTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;

  // migrate deploy creates the schema and applies committed migrations.
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
