import 'dotenv/config';
import { afterAll, beforeEach } from 'vitest';
import { buildTestDatabaseUrl } from './global-setup.js';

// Point this worker at the test schema before the Prisma client is constructed.
process.env.DATABASE_URL = buildTestDatabaseUrl();
process.env.NODE_ENV = 'test';

const { prisma } = await import('../src/lib/prisma.js');

beforeEach(async () => {
  // Order matters: children before parents. TRUNCATE ... CASCADE handles the
  // rest, but listing them keeps the intent explicit.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "payouts",
      "wallet_ledger",
      "withdrawal_requests",
      "consultation_requests",
      "legal_intakes",
      "subscription_payments",
      "lawyer_practice_areas",
      "lawyer_profiles",
      "subscription_packages",
      "legal_categories",
      "email_tokens",
      "users"
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
