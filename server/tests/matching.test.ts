import { ApprovalStatus, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FALLBACK_CATEGORY_NAME } from '../src/ai/legal-triage.service.js';
import { createApp } from '../src/app.js';
import { prisma } from './setup.js';
import { grantPlan } from './subscription-fixtures.js';

const app = createApp();

let employmentId: string;
let landId: string;

async function userToken(email = 'kofi@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Kofi Boateng', email, password: 'correct-horse-battery' });
  return res.body.token as string;
}

/**
 * Builds a lawyer directly rather than through the admin API.
 *
 * Matching tests care about the shape of the data, not about how it was created, and
 * going through HTTP for every fixture would make the arrangement of each case hard
 * to read.
 */
async function seedLawyer(options: {
  email: string;
  displayName: string;
  categoryIds: string[];
  city?: string;
  region?: string;
  isAvailable?: boolean;
  yearsExperience?: number;
  approvalStatus?: ApprovalStatus;
  userStatus?: UserStatus;
  subscribed?: boolean;
}) {
  const user = await prisma.user.create({
    data: {
      email: options.email,
      passwordHash: await bcrypt.hash('correct-horse-battery', 4),
      fullName: options.displayName,
      role: Role.LAWYER,
      emailVerifiedAt: new Date(),
      status: options.userStatus ?? UserStatus.ACTIVE,
    },
  });

  return prisma.lawyerProfile
    .create({
      data: {
        userId: user.id,
        displayName: options.displayName,
        bio: 'Handles employment and land matters for individuals and small businesses.',
        city: options.city ?? 'Accra',
        region: options.region ?? 'Greater Accra',
        isAvailable: options.isAvailable ?? true,
        yearsExperience: options.yearsExperience ?? 5,
        approvalStatus: options.approvalStatus ?? ApprovalStatus.APPROVED,
        practiceAreas: {
          create: options.categoryIds.map((legalCategoryId) => ({ legalCategoryId })),
        },
      },
    })
    .then(async (profile) => {
      if (options.subscribed !== false) await grantPlan(profile.id);
      return profile;
    });
}

/** Writes an intake straight to the database so no AI provider is involved. */
async function seedIntake(
  token: string,
  overrides: { categoryId?: string | null; city?: string; region?: string } = {},
) {
  const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

  const intake = await prisma.legalIntake.create({
    data: {
      clientId: me.body.id,
      originalDescription: 'My employer dismissed me without notice and has not paid me.',
      categoryId: overrides.categoryId === undefined ? employmentId : overrides.categoryId,
      city: overrides.city ?? 'Accra',
      region: overrides.region ?? 'Greater Accra',
    },
  });

  return intake.id;
}

function recommendations(token: string, intakeId: string) {
  return request(app)
    .get(`/api/v1/intakes/${intakeId}/recommendations`)
    .set('Authorization', `Bearer ${token}`);
}

beforeEach(async () => {
  const [employment, land] = await Promise.all([
    prisma.legalCategory.create({
      data: {
        name: 'Employment & Labour',
        slug: 'employment-labour',
        description: 'Dismissal, unpaid salary, contracts.',
      },
    }),
    prisma.legalCategory.create({
      data: {
        name: 'Land & Property',
        slug: 'land-property',
        description: 'Land disputes, title, tenancy.',
      },
    }),
  ]);

  employmentId = employment.id;
  landId = land.id;
});

describe('Lawyer matching (FR-011)', () => {
  it('MT-001: returns only lawyers who practise the intake category', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'employment@example.com',
      displayName: 'Akua Owusu',
      categoryIds: [employmentId],
    });
    await seedLawyer({
      email: 'land@example.com',
      displayName: 'Yaw Mensah',
      categoryIds: [landId],
    });

    const res = await recommendations(token, await seedIntake(token));

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(1);
    expect(res.body.recommendations[0].lawyer.displayName).toBe('Akua Owusu');
  });

  it('MT-002: excludes unapproved and suspended lawyers', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'pending@example.com',
      displayName: 'Pending Lawyer',
      categoryIds: [employmentId],
      approvalStatus: ApprovalStatus.PENDING,
    });
    await seedLawyer({
      email: 'suspended@example.com',
      displayName: 'Suspended Lawyer',
      categoryIds: [employmentId],
      userStatus: UserStatus.SUSPENDED,
    });

    const res = await recommendations(token, await seedIntake(token));

    expect(res.body.recommendations).toHaveLength(0);
  });

  it('MT-010: excludes a lawyer whose subscription has lapsed', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'lapsed@example.com',
      displayName: 'Lapsed Lawyer',
      categoryIds: [employmentId],
      subscribed: false,
    });

    const res = await recommendations(token, await seedIntake(token));

    expect(res.body.recommendations).toHaveLength(0);
  });

  it('MT-003: ranks a location match above a non-match', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'far@example.com',
      displayName: 'Distant Lawyer',
      categoryIds: [employmentId],
      city: 'Tamale',
      region: 'Northern',
    });
    await seedLawyer({
      email: 'near@example.com',
      displayName: 'Local Lawyer',
      categoryIds: [employmentId],
      city: 'Accra',
      region: 'Greater Accra',
    });

    const res = await recommendations(token, await seedIntake(token));

    expect(
      res.body.recommendations.map(
        (r: { lawyer: { displayName: string } }) => r.lawyer.displayName,
      ),
    ).toEqual(['Local Lawyer', 'Distant Lawyer']);
  });

  it('MT-004: ranks an available lawyer above an unavailable one but keeps both', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'busy@example.com',
      displayName: 'Busy Lawyer',
      categoryIds: [employmentId],
      isAvailable: false,
    });
    await seedLawyer({
      email: 'free@example.com',
      displayName: 'Free Lawyer',
      categoryIds: [employmentId],
      isAvailable: true,
    });

    const res = await recommendations(token, await seedIntake(token));

    expect(res.body.recommendations).toHaveLength(2);
    expect(res.body.recommendations[0].lawyer.displayName).toBe('Free Lawyer');
  });

  it('MT-005: is deterministic — the same intake produces the same order twice', async () => {
    const token = await userToken();
    for (const name of ['Ama', 'Kojo', 'Esi', 'Kwesi']) {
      await seedLawyer({
        email: `${name.toLowerCase()}@example.com`,
        displayName: name,
        categoryIds: [employmentId],
        yearsExperience: 5,
      });
    }

    const intakeId = await seedIntake(token);
    const first = await recommendations(token, intakeId);
    const second = await recommendations(token, intakeId);

    expect(first.body.recommendations).toEqual(second.body.recommendations);
  });

  it('breaks remaining ties on profile id so the order stays total', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'one@example.com',
      displayName: 'Same Name',
      categoryIds: [employmentId],
      yearsExperience: 5,
    });
    await seedLawyer({
      email: 'two@example.com',
      displayName: 'Same Name',
      categoryIds: [employmentId],
      yearsExperience: 5,
    });

    const first = await recommendations(token, await seedIntake(token));
    const second = await recommendations(token, await seedIntake(token));

    expect(first.body.recommendations.map((r: { lawyer: { id: string } }) => r.lawyer.id)).toEqual(
      second.body.recommendations.map((r: { lawyer: { id: string } }) => r.lawyer.id),
    );
    expect(first.body.recommendations).toHaveLength(2);
  });

  it('MT-006: every recommendation carries a reason naming the matched criteria (NFR-007)', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'akua@example.com',
      displayName: 'Akua Owusu',
      categoryIds: [employmentId],
      city: 'Accra',
    });

    const res = await recommendations(token, await seedIntake(token));
    const { reason } = res.body.recommendations[0];

    expect(reason).toContain('Akua Owusu');
    expect(reason).toContain('Employment & Labour');
    expect(reason).toContain('Accra');
  });

  it('names the region when the city does not match', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'regional@example.com',
      displayName: 'Regional Lawyer',
      categoryIds: [employmentId],
      city: 'Tema',
      region: 'Greater Accra',
    });

    const res = await recommendations(token, await seedIntake(token));
    expect(res.body.recommendations[0].reason).toContain('Greater Accra');
    expect(res.body.recommendations[0].reason).not.toContain('Tema');
  });

  it('ranks more experienced lawyers above less experienced ones when scores tie', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'junior@example.com',
      displayName: 'Junior Lawyer',
      categoryIds: [employmentId],
      yearsExperience: 2,
    });
    await seedLawyer({
      email: 'senior@example.com',
      displayName: 'Senior Lawyer',
      categoryIds: [employmentId],
      yearsExperience: 20,
    });

    const res = await recommendations(token, await seedIntake(token));
    expect(res.body.recommendations[0].lawyer.displayName).toBe('Senior Lawyer');
  });

  it('MT-007: a reason never claims an outcome or ranks a lawyer as best (CON-003)', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'akua@example.com',
      displayName: 'Akua Owusu',
      categoryIds: [employmentId],
    });

    const res = await recommendations(token, await seedIntake(token));
    const reason = res.body.recommendations[0].reason.toLowerCase();

    for (const forbidden of ['best', 'will win', 'guarantee', 'should sue', 'most likely']) {
      expect(reason).not.toContain(forbidden);
    }
  });

  it('MT-008: an uncategorised intake returns no recommendations and an explanation (FR-010)', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'akua@example.com',
      displayName: 'Akua Owusu',
      categoryIds: [employmentId],
    });

    const res = await recommendations(token, await seedIntake(token, { categoryId: null }));

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(0);
    expect(res.body.note).toMatch(/not been categorised/i);
  });

  it('MT-009: an intake on the AI fallback category is treated as uncategorised (FR-010)', async () => {
    const token = await userToken();
    await seedLawyer({
      email: 'akua@example.com',
      displayName: 'Akua Owusu',
      categoryIds: [employmentId],
    });

    // The AI-failure path assigns this holding category rather than leaving the
    // category null, so matching has to recognise it by name. Matching on it would
    // otherwise report that no lawyer covers the area, which reads as a rejection.
    const holding = await prisma.legalCategory.create({
      data: {
        name: FALLBACK_CATEGORY_NAME,
        slug: 'other-needs-review',
        description: 'Enquiries that could not be categorised automatically.',
      },
    });

    const res = await recommendations(token, await seedIntake(token, { categoryId: holding.id }));

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(0);
    expect(res.body.category).toBeNull();
    expect(res.body.note).toMatch(/not been categorised/i);
  });

  it('SEC-LG-021: another user cannot read recommendations for an intake they do not own', async () => {
    const owner = await userToken('owner@example.com');
    const intruder = await userToken('intruder@example.com');

    const res = await recommendations(intruder, await seedIntake(owner));

    expect(res.status).toBe(404);
  });

  it('SEC-LG-022: recommendations require authentication', async () => {
    const token = await userToken();

    const res = await request(app).get(
      `/api/v1/intakes/${await seedIntake(token)}/recommendations`,
    );

    expect(res.status).toBe(401);
  });

  it('lets an admin read recommendations for any intake', async () => {
    const owner = await userToken();
    await seedLawyer({
      email: 'akua@example.com',
      displayName: 'Akua Owusu',
      categoryIds: [employmentId],
    });
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('admin-password-123', 4),
        fullName: 'Platform Administrator',
        role: Role.ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-password-123' });

    const res = await recommendations(login.body.token as string, await seedIntake(owner));

    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
  });
});
