import 'dotenv/config';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildTestDatabaseUrl, TEST_SCHEMA } from './global-setup.js';

// Point this worker at the test schema before the Prisma client is constructed.
process.env.DATABASE_URL = buildTestDatabaseUrl();
process.env.NODE_ENV = 'test';

const { prisma } = await import('../src/lib/prisma.js');

function qualify(table: string): string {
  return `"${TEST_SCHEMA}"."${table}"`;
}

export async function resetTestDatabase(): Promise<void> {
  // Schema-qualify every table. Unqualified TRUNCATE follows search_path and can
  // miss `test` (or hit `public`) when two Prisma clients disagree on the path.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      ${qualify('payouts')},
      ${qualify('wallet_ledger')},
      ${qualify('withdrawal_requests')},
      ${qualify('consultation_requests')},
      ${qualify('legal_intakes')},
      ${qualify('subscription_payments')},
      ${qualify('lawyer_practice_areas')},
      ${qualify('lawyer_profiles')},
      ${qualify('subscription_packages')},
      ${qualify('legal_categories')},
      ${qualify('email_tokens')},
      ${qualify('users')}
    RESTART IDENTITY CASCADE
  `);
}

beforeAll(resetTestDatabase);
beforeEach(resetTestDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
