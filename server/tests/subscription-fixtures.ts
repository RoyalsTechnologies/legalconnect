import { prisma } from './setup.js';

const PACKAGES = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'One practice area for a focused practice.',
    monthlyFeePesewas: 5_000,
    maxPracticeAreas: 1,
  },
  {
    name: 'Practice',
    slug: 'practice',
    description: 'Up to three practice areas.',
    monthlyFeePesewas: 15_000,
    maxPracticeAreas: 3,
  },
  {
    name: 'Chambers',
    slug: 'chambers',
    description: 'Every practice area on the platform.',
    monthlyFeePesewas: 30_000,
    maxPracticeAreas: 8,
  },
] as const;

export async function seedPackages(): Promise<void> {
  if ((await prisma.subscriptionPackage.count()) > 0) return;
  await prisma.subscriptionPackage.createMany({ data: [...PACKAGES] });
}

export async function grantPlan(
  lawyerProfileId: string,
  slug = 'starter',
  days = 30,
): Promise<void> {
  await seedPackages();
  const pkg = await prisma.subscriptionPackage.findUniqueOrThrow({ where: { slug } });
  await prisma.lawyerProfile.update({
    where: { id: lawyerProfileId },
    data: {
      subscriptionPackageId: pkg.id,
      subscriptionPeriodEnd: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  });
}

export async function packageId(slug: string): Promise<string> {
  await seedPackages();
  const pkg = await prisma.subscriptionPackage.findUniqueOrThrow({ where: { slug } });
  return pkg.id;
}
