import { randomBytes } from 'node:crypto';
import { ApprovalStatus, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CATEGORIES = [
  [
    'Employment & Labour',
    'employment-labour',
    'Workplace issues such as dismissal, unpaid salary, contracts, and workplace treatment.',
  ],
  [
    'Property & Tenancy',
    'property-tenancy',
    'Renting, landlord and tenant disputes, land, and property ownership.',
  ],
  ['Family', 'family', 'Marriage, divorce, child custody and maintenance, and inheritance.'],
  [
    'Business & Commercial',
    'business-commercial',
    'Company registration, partnerships, and commercial disputes.',
  ],
  ['Contract', 'contract', 'Agreements that were broken, unclear, or unfair.'],
  ['Criminal', 'criminal', 'Arrest, charges, police matters, and bail.'],
  ['Immigration', 'immigration', 'Visas, residence permits, citizenship, and travel documents.'],
  ['Consumer', 'consumer', 'Faulty goods, poor services, and unfair business practices.'],
  [
    'Other / Needs Review',
    'other-needs-review',
    'Issues that do not fit another category or need a person to review them.',
  ],
] as const;

const PACKAGES = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'List one practice area. Suitable for a focused solo practice.',
    monthlyFeePesewas: 5_000,
    maxPracticeAreas: 1,
  },
  {
    name: 'Practice',
    slug: 'practice',
    description: 'List up to three practice areas — the usual small-chambers plan.',
    monthlyFeePesewas: 15_000,
    maxPracticeAreas: 3,
  },
  {
    name: 'Chambers',
    slug: 'chambers',
    description: 'List every practice area on the platform.',
    monthlyFeePesewas: 30_000,
    maxPracticeAreas: 8,
  },
] as const;

// Demo lawyers spread across practice areas and regions so matching has something
// to discriminate on. Fictional people — no real practitioner is named here, and no
// licence number is invented, because a fake licence number implies a verification
// this platform does not perform.
const DEMO_LAWYERS = [
  {
    email: 'akua.owusu@example.com',
    fullName: 'Akua Owusu',
    displayName: 'Akua Owusu',
    firmName: 'Owusu & Partners',
    bio: 'I work with people who have been dismissed unfairly or are owed unpaid wages. Most of my clients come to me without any paperwork, and that is usually fine.',
    city: 'Accra',
    region: 'Greater Accra',
    yearsExperience: 8,
    practiceAreas: ['employment-labour', 'contract'],
    consultationFeeGhs: 250,
  },
  {
    email: 'kwame.asante@example.com',
    fullName: 'Kwame Asante',
    displayName: 'Kwame Asante',
    firmName: 'Asante Legal Chambers',
    bio: 'Landlord and tenant disputes, land documentation, and family property matters. I explain the process in plain terms before anyone commits to anything.',
    city: 'Kumasi',
    region: 'Ashanti',
    yearsExperience: 14,
    practiceAreas: ['property-tenancy', 'family'],
    consultationFeeGhs: 300,
  },
  {
    email: 'efua.danso@example.com',
    fullName: 'Efua Danso',
    displayName: 'Efua Danso',
    firmName: null,
    bio: 'I practise family law — separation, child maintenance, and inheritance — and I take consumer complaints against businesses that will not put things right.',
    city: 'Takoradi',
    region: 'Western',
    yearsExperience: 6,
    practiceAreas: ['family', 'consumer'],
    consultationFeeGhs: 180,
  },
  {
    email: 'yaw.boakye@example.com',
    fullName: 'Yaw Boakye',
    displayName: 'Yaw Boakye',
    firmName: 'Boakye Advocates',
    bio: 'Criminal defence, including bail applications and police matters. If someone has been arrested, the first hours matter, and I take urgent enquiries.',
    city: 'Tamale',
    region: 'Northern',
    yearsExperience: 11,
    practiceAreas: ['criminal'],
    consultationFeeGhs: 400,
  },
  {
    email: 'abena.sarpong@example.com',
    fullName: 'Abena Sarpong',
    displayName: 'Abena Sarpong',
    firmName: 'Sarpong & Co.',
    bio: 'I advise small businesses on registration, partnership agreements, and commercial disputes, and I handle residence permit and visa applications.',
    city: 'Accra',
    region: 'Greater Accra',
    yearsExperience: 9,
    practiceAreas: ['business-commercial', 'contract', 'immigration'],
    consultationFeeGhs: 220,
  },
] as const;

const DEMO_CITIZEN = {
  email: 'ama.mensah@example.com',
  fullName: 'Ama Mensah',
  phone: '0244123456',
};

/**
 * Seeds walkable demo data.
 *
 * Gated behind SEED_DEMO_DATA because these are approved lawyer profiles with known
 * passwords. Creating those in a real deployment would publish fictional
 * practitioners to real people looking for legal help.
 */
async function seedDemoData(password: string) {
  const passwordHash = await bcrypt.hash(password, 12);

  const citizen = await prisma.user.upsert({
    where: { email: DEMO_CITIZEN.email },
    update: { emailVerifiedAt: new Date() },
    create: {
      email: DEMO_CITIZEN.email,
      passwordHash,
      fullName: DEMO_CITIZEN.fullName,
      phone: DEMO_CITIZEN.phone,
      role: Role.USER,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  console.log(`[seed] demo citizen ready: ${DEMO_CITIZEN.email}`);

  for (const lawyer of DEMO_LAWYERS) {
    const categories = await prisma.legalCategory.findMany({
      where: { slug: { in: [...lawyer.practiceAreas] } },
      select: { id: true },
    });

    if (categories.length !== lawyer.practiceAreas.length) {
      throw new Error(`[seed] ${lawyer.email}: could not resolve every practice area slug`);
    }

    const user = await prisma.user.upsert({
      where: { email: lawyer.email },
      update: { emailVerifiedAt: new Date() },
      create: {
        email: lawyer.email,
        passwordHash,
        fullName: lawyer.fullName,
        role: Role.LAWYER,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });

    const profileData = {
      displayName: lawyer.displayName,
      firmName: lawyer.firmName,
      bio: lawyer.bio,
      city: lawyer.city,
      region: lawyer.region,
      yearsExperience: lawyer.yearsExperience,
      consultationFeePesewas: lawyer.consultationFeeGhs * 100,
      isAvailable: true,
      approvalStatus: ApprovalStatus.APPROVED,
    };

    const profile = await prisma.lawyerProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { userId: user.id, ...profileData },
      select: { id: true },
    });

    // Replace rather than add, so re-running the seed cannot duplicate areas.
    await prisma.lawyerPracticeArea.deleteMany({ where: { lawyerProfileId: profile.id } });
    await prisma.lawyerPracticeArea.createMany({
      data: categories.map((c) => ({ lawyerProfileId: profile.id, legalCategoryId: c.id })),
    });

    const slug =
      lawyer.practiceAreas.length <= 1
        ? 'starter'
        : lawyer.practiceAreas.length <= 3
          ? 'practice'
          : 'chambers';
    const pkg = await prisma.subscriptionPackage.findUniqueOrThrow({ where: { slug } });
    const yearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.lawyerProfile.update({
      where: { id: profile.id },
      data: { subscriptionPackageId: pkg.id, subscriptionPeriodEnd: yearFromNow },
    });
  }

  console.log(`[seed] ${DEMO_LAWYERS.length} approved demo lawyers ready`);
  return citizen;
}

async function main() {
  for (const [name, slug, description] of CATEGORIES) {
    await prisma.legalCategory.upsert({
      where: { slug },
      update: { name, description },
      create: { name, slug, description },
    });
  }
  console.log(`[seed] ${CATEGORIES.length} legal categories ready`);

  for (const pkg of PACKAGES) {
    await prisma.subscriptionPackage.upsert({
      where: { slug: pkg.slug },
      update: {
        name: pkg.name,
        description: pkg.description,
        monthlyFeePesewas: pkg.monthlyFeePesewas,
        maxPracticeAreas: pkg.maxPracticeAreas,
        isActive: true,
      },
      create: pkg,
    });
  }
  console.log(`[seed] ${PACKAGES.length} subscription packages ready`);

  await seedAdmin();

  if (process.env.SEED_DEMO_DATA?.trim() === 'true') {
    const demoPassword = process.env.SEED_DEMO_PASSWORD?.trim() || 'demo-password-2026';
    await seedDemoData(demoPassword);
    console.log(`[seed] demo accounts all use the password: ${demoPassword}`);
    console.log('[seed] demo data is for local demonstration only — never seed it in production');
  }
}

async function seedAdmin() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@legalconnect.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existing) {
    if (!existing.emailVerifiedAt) {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { emailVerifiedAt: new Date() },
      });
    }
    console.log(`[seed] admin ${adminEmail} already exists, leaving password unchanged`);
    return;
  }

  // Never hard-code a credential. Use the supplied password or generate one and
  // print it exactly once for the operator to store outside the repository.
  // An unset variable in .env arrives as "", which must count as absent — treating
  // it as supplied would create the admin with an empty password.
  const supplied = process.env.SEED_ADMIN_PASSWORD?.trim() || undefined;
  const password = supplied ?? randomBytes(12).toString('base64url');

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(password, 12),
      fullName: 'Platform Administrator',
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`[seed] admin created: ${adminEmail}`);
  if (!supplied) {
    console.log(`[seed] generated password (shown once, store it securely): ${password}`);
  }
}

main()
  .catch((error) => {
    console.error('[seed] failed', error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
