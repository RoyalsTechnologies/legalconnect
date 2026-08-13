import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isProduction ? ['error'] : ['error', 'warn'],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
