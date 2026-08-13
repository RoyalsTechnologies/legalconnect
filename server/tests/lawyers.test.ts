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
let tenancyId: string;

const LAWYER_PAYLOAD = {
  email: 'akua.lawyer@example.com',
  password: 'correct-horse-battery',
  fullName: 'Akua Owusu',
  displayName: 'Akua Owusu',
  firmName: 'Owusu & Partners',
  bio: 'I handle employment disputes, unfair dismissal, and unpaid salary claims in Accra.',
  city: 'Accra',
  region: 'Greater Accra',
  yearsExperience: 8,
  consultationFeeGhs: 200,
};

// Admins are created by the seed script, never through the API, so tests build one
// directly. Everything else goes through HTTP.
async function adminToken(): Promise<string> {
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('admin-password-123', 4),
      fullName: 'Platform Administrator',
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@example.com', password: 'admin-password-123' });
  return res.body.token as string;
}

async function userToken(email = 'kofi@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Kofi Boateng', email, password: 'correct-horse-battery' });
  return res.body.token as string;
}

async function createLawyer(token: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/v1/lawyers')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...LAWYER_PAYLOAD, practiceAreaIds: [employmentId], ...overrides });
}

async function lawyerToken(email = LAWYER_PAYLOAD.email): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: LAWYER_PAYLOAD.password });
  return res.body.token as string;
}

beforeEach(async () => {
  const employment = await prisma.legalCategory.create({
    data: {
      name: 'Employment & Labour',
      slug: 'employment-labour',
      description: 'Dismissal, unpaid salary, contracts.',
    },
  });
  const tenancy = await prisma.legalCategory.create({
    data: {
      name: 'Property & Tenancy',
      slug: 'property-tenancy',
      description: 'Landlord and tenant disputes.',
    },
  });
  employmentId = employment.id;
  tenancyId = tenancy.id;
});

describe('FR-005 legal category management', () => {
  it('IT-016: an admin creates a category and its slug is derived from the name', async () => {
    const token = await adminToken();

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Immigration & Travel', description: 'Visas, permits, and travel papers.' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('immigration-and-travel');
    expect(res.body.isActive).toBe(true);
  });

  it('IT-017: rejects a duplicate category name with 409', async () => {
    const token = await adminToken();
    const body = { name: 'Employment & Labour', description: 'Duplicate of the seeded one.' };

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(409);
  });

  it('IT-018: deactivating retires a category instead of deleting it', async () => {
    const token = await adminToken();

    const res = await request(app)
      .delete(`/api/v1/categories/${tenancyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    // Still present, so existing intakes and practice areas keep their reference.
    expect(await prisma.legalCategory.count()).toBe(2);
  });

  it('IT-019: retired categories are hidden from users but visible to admins', async () => {
    const admin = await adminToken();
    await request(app)
      .delete(`/api/v1/categories/${tenancyId}`)
      .set('Authorization', `Bearer ${admin}`);
    const user = await userToken();

    const asUser = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${user}`);
    const asAdmin = await request(app)
      .get('/api/v1/categories?includeInactive=true')
      .set('Authorization', `Bearer ${admin}`);

    expect(asUser.body).toHaveLength(1);
    expect(asAdmin.body).toHaveLength(2);
  });

  it('SEC-LG-014: a user cannot ask for retired categories by passing the flag', async () => {
    const admin = await adminToken();
    await request(app)
      .delete(`/api/v1/categories/${tenancyId}`)
      .set('Authorization', `Bearer ${admin}`);
    const user = await userToken();

    const res = await request(app)
      .get('/api/v1/categories?includeInactive=true')
      .set('Authorization', `Bearer ${user}`);

    expect(res.body).toHaveLength(1);
  });

  it('SEC-LG-003: a USER cannot create or modify categories', async () => {
    const token = await userToken();

    const created = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Made Up', description: 'Should never be created by a user.' });
    const retired = await request(app)
      .delete(`/api/v1/categories/${tenancyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(created.status).toBe(403);
    expect(retired.status).toBe(403);
    expect(await prisma.legalCategory.count()).toBe(2);
  });
});

describe('FR-004 lawyer account creation', () => {
  it('IT-020: an admin creates a lawyer account with a profile and practice areas', async () => {
    const token = await adminToken();

    const res = await createLawyer(token, { practiceAreaIds: [employmentId, tenancyId] });

    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe('Akua Owusu');
    expect(res.body.approvalStatus).toBe(ApprovalStatus.PENDING);
    expect(res.body.practiceAreas).toHaveLength(2);

    const account = await prisma.user.findUnique({ where: { email: LAWYER_PAYLOAD.email } });
    expect(account?.role).toBe(Role.LAWYER);
  });

  it('IT-021: the new lawyer can log in with the credentials the admin set', async () => {
    await createLawyer(await adminToken());

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: LAWYER_PAYLOAD.email, password: LAWYER_PAYLOAD.password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(Role.LAWYER);
  });

  it('IT-022: defaults to PENDING so a profile cannot be published by omission', async () => {
    const res = await createLawyer(await adminToken());
    expect(res.body.approvalStatus).toBe(ApprovalStatus.PENDING);
  });

  it('IT-023: rejects a practice area that is not a real category', async () => {
    const res = await createLawyer(await adminToken(), { practiceAreaIds: ['not-a-category'] });

    expect(res.status).toBe(400);
    expect(await prisma.lawyerProfile.count()).toBe(0);
    // The account must not survive a failed profile — they are one transaction.
    expect(await prisma.user.findUnique({ where: { email: LAWYER_PAYLOAD.email } })).toBeNull();
  });

  it('IT-024: rejects a duplicate email with 409', async () => {
    const token = await adminToken();
    await createLawyer(token);

    const res = await createLawyer(token);

    expect(res.status).toBe(409);
    expect(await prisma.lawyerProfile.count()).toBe(1);
  });

  it('SEC-LG-015: a USER cannot create a lawyer account', async () => {
    const res = await createLawyer(await userToken());

    expect(res.status).toBe(403);
    expect(await prisma.lawyerProfile.count()).toBe(0);
  });

  it('SEC-LG-016: a LAWYER cannot create another lawyer account', async () => {
    await createLawyer(await adminToken());
    const token = await lawyerToken();

    const res = await createLawyer(token, { email: 'second.lawyer@example.com' });

    expect(res.status).toBe(403);
    expect(await prisma.lawyerProfile.count()).toBe(1);
  });
});

describe('FR-004 profile editing and approval', () => {
  it('IT-025: a lawyer edits their own profile', async () => {
    await createLawyer(await adminToken());
    const token = await lawyerToken();

    const res = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Kumasi', isAvailable: false });

    expect(res.status).toBe(200);
    expect(res.body.city).toBe('Kumasi');
    expect(res.body.isAvailable).toBe(false);
  });

  it('IT-026: replacing practice areas removes the ones left out', async () => {
    const admin = await adminToken();
    await createLawyer(admin, { practiceAreaIds: [employmentId, tenancyId] });
    const token = await lawyerToken();

    const res = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ practiceAreaIds: [tenancyId] });

    expect(res.body.practiceAreas).toHaveLength(1);
    expect(res.body.practiceAreas[0].legalCategory.id).toBe(tenancyId);
  });

  it('SEC-LG-017: a lawyer cannot approve themselves', async () => {
    await createLawyer(await adminToken());
    const token = await lawyerToken();

    const res = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ approvalStatus: ApprovalStatus.APPROVED });

    expect(res.status).toBe(403);
    const stored = await prisma.lawyerProfile.findFirst();
    expect(stored?.approvalStatus).toBe(ApprovalStatus.PENDING);
  });

  it('SEC-LG-018: a lawyer cannot edit another lawyer through the admin route', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin);
    await createLawyer(admin, { email: 'second@example.com', displayName: 'Second Lawyer' });
    const token = await lawyerToken('second@example.com');

    const res = await request(app)
      .patch(`/api/v1/lawyers/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Hijacked' });

    expect(res.status).toBe(403);
    const stored = await prisma.lawyerProfile.findUnique({ where: { id: created.body.id } });
    expect(stored?.displayName).toBe('Akua Owusu');
  });

  it('IT-027: an admin approves a lawyer', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin);

    const res = await request(app)
      .patch(`/api/v1/lawyers/${created.body.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ approvalStatus: ApprovalStatus.APPROVED });

    expect(res.status).toBe(200);
    expect(res.body.approvalStatus).toBe(ApprovalStatus.APPROVED);
  });
});

describe('FR-004 directory visibility', () => {
  async function approvedLawyer(admin: string) {
    const created = await createLawyer(admin);
    await request(app)
      .patch(`/api/v1/lawyers/${created.body.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ approvalStatus: ApprovalStatus.APPROVED });
    await grantPlan(created.body.id);
    return created.body.id as string;
  }

  it('IT-028: an approved lawyer appears in the directory', async () => {
    const admin = await adminToken();
    await approvedLawyer(admin);
    const user = await userToken();

    const res = await request(app).get('/api/v1/lawyers').set('Authorization', `Bearer ${user}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('IT-055: an approved lawyer without a live subscription is hidden from the directory', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin);
    await request(app)
      .patch(`/api/v1/lawyers/${created.body.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ approvalStatus: ApprovalStatus.APPROVED });
    const user = await userToken();

    const res = await request(app).get('/api/v1/lawyers').set('Authorization', `Bearer ${user}`);

    expect(res.body.results).toHaveLength(0);
  });

  it('SEC-LG-007: a pending lawyer is hidden from users but visible to an admin', async () => {
    const admin = await adminToken();
    await createLawyer(admin);
    const user = await userToken();

    const asUser = await request(app).get('/api/v1/lawyers').set('Authorization', `Bearer ${user}`);
    const asAdmin = await request(app)
      .get('/api/v1/lawyers')
      .set('Authorization', `Bearer ${admin}`);

    expect(asUser.body.results).toHaveLength(0);
    expect(asAdmin.body.results).toHaveLength(1);
  });

  it('SEC-LG-019: a suspended lawyer drops out of the directory', async () => {
    const admin = await adminToken();
    await approvedLawyer(admin);
    await prisma.user.update({
      where: { email: LAWYER_PAYLOAD.email },
      data: { status: UserStatus.SUSPENDED },
    });
    const user = await userToken();

    const res = await request(app).get('/api/v1/lawyers').set('Authorization', `Bearer ${user}`);

    expect(res.body.results).toHaveLength(0);
  });

  it('SEC-LG-020: a pending profile returns 404, not 403, when fetched directly', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin);
    const user = await userToken();

    const hidden = await request(app)
      .get(`/api/v1/lawyers/${created.body.id}`)
      .set('Authorization', `Bearer ${user}`);
    const missing = await request(app)
      .get('/api/v1/lawyers/no-such-id')
      .set('Authorization', `Bearer ${user}`);

    // Identical responses, so the endpoint cannot confirm who has applied.
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(hidden.body.error.message).toBe(missing.body.error.message);
  });

  it('IT-029: the directory never exposes the account password hash', async () => {
    const admin = await adminToken();
    await approvedLawyer(admin);
    const user = await userToken();

    const res = await request(app).get('/api/v1/lawyers').set('Authorization', `Bearer ${user}`);

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain(LAWYER_PAYLOAD.password);
  });
});

describe('FR-012 lawyer discovery', () => {
  /** Approves on creation so the fixture is visible to an ordinary caller. */
  async function approved(token: string, overrides: Record<string, unknown>): Promise<void> {
    const created = await createLawyer(token, {
      approvalStatus: ApprovalStatus.APPROVED,
      ...overrides,
    });
    await grantPlan(created.body.id);
  }

  it('IT-046: the directory can be filtered by practice area', async () => {
    const admin = await adminToken();
    await approved(admin, { email: 'employment@example.com', practiceAreaIds: [employmentId] });
    await approved(admin, {
      email: 'tenancy@example.com',
      displayName: 'Yaw Mensah',
      practiceAreaIds: [tenancyId],
    });
    const user = await userToken();

    const res = await request(app)
      .get(`/api/v1/lawyers?categoryId=${tenancyId}`)
      .set('Authorization', `Bearer ${user}`);

    expect(res.body.total).toBe(1);
    expect(res.body.results[0].displayName).toBe('Yaw Mensah');
  });

  it('IT-047: the directory can be filtered by region', async () => {
    const admin = await adminToken();
    await approved(admin, { email: 'accra@example.com' });
    await approved(admin, {
      email: 'kumasi@example.com',
      displayName: 'Yaw Mensah',
      city: 'Kumasi',
      region: 'Ashanti',
    });
    const user = await userToken();

    const res = await request(app)
      .get('/api/v1/lawyers?region=ashanti')
      .set('Authorization', `Bearer ${user}`);

    expect(res.body.total).toBe(1);
    expect(res.body.results[0].region).toBe('Ashanti');
  });

  it('IT-048: free-text search matches the bio, not just the name', async () => {
    const admin = await adminToken();
    await approved(admin, { email: 'akua@example.com' });
    await approved(admin, {
      email: 'yaw@example.com',
      displayName: 'Yaw Mensah',
      bio: 'I represent landlords and tenants in rent recovery and eviction matters.',
    });
    const user = await userToken();

    const res = await request(app)
      .get('/api/v1/lawyers?q=eviction')
      .set('Authorization', `Bearer ${user}`);

    expect(res.body.total).toBe(1);
    expect(res.body.results[0].displayName).toBe('Yaw Mensah');
  });

  it('IT-049: results are paginated and the total reflects the full match set', async () => {
    const admin = await adminToken();
    for (const name of ['Ama', 'Esi', 'Kojo']) {
      await approved(admin, { email: `${name.toLowerCase()}@example.com`, displayName: name });
    }
    const user = await userToken();

    const res = await request(app)
      .get('/api/v1/lawyers?limit=2&offset=0')
      .set('Authorization', `Bearer ${user}`);

    expect(res.body.results).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it('IT-051: the AI holding category cannot be selected as a practice area', async () => {
    const admin = await adminToken();
    const holding = await prisma.legalCategory.create({
      data: {
        name: FALLBACK_CATEGORY_NAME,
        slug: 'other-needs-review',
        description: 'Enquiries that could not be categorised automatically.',
      },
    });

    // Matching skips this category by design, so selecting it would be a setting
    // that silently does nothing.
    const res = await createLawyer(admin, {
      approvalStatus: ApprovalStatus.APPROVED,
      practiceAreaIds: [holding.id],
    });

    expect(res.status).toBe(400);
  });

  it('IT-050: an out-of-range limit is rejected rather than silently clamped', async () => {
    const user = await userToken();

    const res = await request(app)
      .get('/api/v1/lawyers?limit=5000')
      .set('Authorization', `Bearer ${user}`);

    expect(res.status).toBe(422);
  });
});

/**
 * FR-012 — the directory is readable without an account.
 *
 * A member of the public deciding whether to register needs to see that lawyers exist
 * for their kind of problem first. These tests pin down both halves of that: the pages
 * are reachable, and opening them widens nothing.
 */
describe('FR-012 public access without an account', () => {
  async function approvedLawyer(admin: string, overrides: Record<string, unknown> = {}) {
    const created = await createLawyer(admin, {
      approvalStatus: ApprovalStatus.APPROVED,
      ...overrides,
    });
    await grantPlan(created.body.id);
    return created.body.id as string;
  }

  it('IT-052: an anonymous visitor can browse the directory', async () => {
    const admin = await adminToken();
    await approvedLawyer(admin);

    const res = await request(app).get('/api/v1/lawyers');

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].displayName).toBe(LAWYER_PAYLOAD.displayName);
  });

  it('IT-053: an anonymous visitor can open an approved profile', async () => {
    const admin = await adminToken();
    const id = await approvedLawyer(admin);

    const res = await request(app).get(`/api/v1/lawyers/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('IT-054: an anonymous visitor can read the categories the directory filters by', async () => {
    const res = await request(app).get('/api/v1/categories');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('SEC-LG-033: an anonymous visitor sees no more than a citizen does', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin); // Left PENDING.

    const list = await request(app).get('/api/v1/lawyers');
    const direct = await request(app).get(`/api/v1/lawyers/${created.body.id}`);

    expect(list.body.results).toHaveLength(0);
    expect(direct.status).toBe(404);
  });

  it('SEC-LG-034: includeInactive is ignored for an anonymous caller', async () => {
    const retired = await prisma.legalCategory.create({
      data: { name: 'Retired Area', slug: 'retired-area', description: 'x', isActive: false },
    });

    const res = await request(app).get('/api/v1/categories?includeInactive=true');

    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: string }) => c.id)).not.toContain(retired.id);
  });

  it('SEC-LG-035: opening reads does not open writes', async () => {
    const create = await request(app).post('/api/v1/lawyers').send(LAWYER_PAYLOAD);
    const category = await request(app)
      .post('/api/v1/categories')
      .send({ name: 'Injected', description: 'Should never be created.' });

    expect(create.status).toBe(401);
    expect(category.status).toBe(401);
    expect(await prisma.legalCategory.findFirst({ where: { name: 'Injected' } })).toBeNull();
  });

  it('SEC-LG-036: a junk or revoked token falls back to the public view, never a wider one', async () => {
    const admin = await adminToken();
    await createLawyer(admin); // PENDING — only an admin may see it.
    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { status: UserStatus.SUSPENDED },
    });

    const junk = await request(app).get('/api/v1/lawyers').set('Authorization', 'Bearer nonsense');
    const revoked = await request(app)
      .get('/api/v1/lawyers')
      .set('Authorization', `Bearer ${admin}`);

    // Both are answered, and both are answered as a stranger would be.
    expect(junk.status).toBe(200);
    expect(junk.body.results).toHaveLength(0);
    expect(revoked.status).toBe(200);
    expect(revoked.body.results).toHaveLength(0);
  });
});

describe('FR-004 lawyer self-registration', () => {
  const SELF_REGISTER = {
    accountType: 'lawyer' as const,
    fullName: 'Akua Owusu',
    email: 'akua.self@example.com',
    password: 'correct-horse-battery',
    bio: LAWYER_PAYLOAD.bio,
    city: 'Accra',
    region: 'Greater Accra',
    consultationFeeGhs: 200,
  };

  it('creates a LAWYER account with a PENDING profile', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...SELF_REGISTER, practiceAreaIds: [employmentId] });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(Role.LAWYER);

    const profile = await prisma.lawyerProfile.findFirst({
      where: { user: { email: SELF_REGISTER.email } },
    });
    expect(profile?.approvalStatus).toBe(ApprovalStatus.PENDING);
    expect(profile?.displayName).toBe(SELF_REGISTER.fullName);
  });

  it('stays hidden from the public directory until an admin approves', async () => {
    const created = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...SELF_REGISTER, practiceAreaIds: [employmentId] });
    const profile = await prisma.lawyerProfile.findFirst({
      where: { userId: created.body.user.id },
    });

    const asPublic = await request(app).get('/api/v1/lawyers');
    expect(asPublic.body.results).toHaveLength(0);

    const admin = await adminToken();
    await request(app)
      .patch(`/api/v1/lawyers/${profile!.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ approvalStatus: ApprovalStatus.APPROVED });

    const afterApprove = await request(app).get('/api/v1/lawyers');
    expect(afterApprove.body.results).toHaveLength(0);

    await grantPlan(profile!.id);

    const after = await request(app).get('/api/v1/lawyers');
    expect(after.body.results).toHaveLength(1);
  });

  it('ignores approvalStatus on the registration payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...SELF_REGISTER,
        practiceAreaIds: [employmentId],
        approvalStatus: ApprovalStatus.APPROVED,
      });

    expect(res.status).toBe(201);
    const profile = await prisma.lawyerProfile.findFirst({
      where: { user: { email: SELF_REGISTER.email } },
    });
    expect(profile?.approvalStatus).toBe(ApprovalStatus.PENDING);
  });

  it('rejects a lawyer application without a practice area', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(SELF_REGISTER);

    expect(res.status).toBe(422);
    expect(await prisma.user.findUnique({ where: { email: SELF_REGISTER.email } })).toBeNull();
  });

  it('does not leave an orphan account when a practice area is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...SELF_REGISTER, practiceAreaIds: ['not-a-category'] });

    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email: SELF_REGISTER.email } })).toBeNull();
  });
});

describe('FR-020 lawyer payment account', () => {
  const ACCOUNT = {
    paymentAccountName: 'Akua Owusu',
    paymentPhone: '0244123456',
    paymentNetwork: 'MTN' as const,
  };

  it('IT-069: a lawyer can save and read back their payment account', async () => {
    await createLawyer(await adminToken());
    const token = await lawyerToken();

    const saved = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send(ACCOUNT);

    expect(saved.status).toBe(200);
    expect(saved.body.paymentAccount).toEqual({
      accountName: 'Akua Owusu',
      phone: '0244123456',
      network: 'MTN',
    });
    expect(saved.body).not.toHaveProperty('paymentPhone');

    const me = await request(app).get('/api/v1/lawyers/me').set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.paymentAccount).toEqual(saved.body.paymentAccount);
  });

  it('IT-070: the public directory does not include payment account fields', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin);
    await request(app)
      .patch(`/api/v1/lawyers/${created.body.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ approvalStatus: ApprovalStatus.APPROVED });
    await grantPlan(created.body.id);

    const token = await lawyerToken();
    await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send(ACCOUNT);

    const user = await userToken();
    const list = await request(app).get('/api/v1/lawyers').set('Authorization', `Bearer ${user}`);
    const detail = await request(app)
      .get(`/api/v1/lawyers/${created.body.id}`)
      .set('Authorization', `Bearer ${user}`);

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('paymentPhone');
    expect(JSON.stringify(detail.body)).not.toContain('paymentPhone');
    expect(JSON.stringify(list.body)).not.toContain('0244123456');
    expect(JSON.stringify(detail.body)).not.toContain('0244123456');
    expect(detail.body.paymentAccount).toBeUndefined();
    expect(list.body.results[0].paymentAccount).toBeUndefined();
    expect(detail.body.wallet).toBeUndefined();
    expect(list.body.results[0].wallet).toBeUndefined();
  });

  it('IT-071: a half-filled payment account is rejected with 422', async () => {
    await createLawyer(await adminToken());
    const token = await lawyerToken();

    const res = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentPhone: '0244123456' });

    expect(res.status).toBe(422);
    const stored = await prisma.lawyerProfile.findFirst();
    expect(stored?.paymentPhone).toBeNull();
  });

  it('IT-074: sending null on all three payment fields clears the account', async () => {
    await createLawyer(await adminToken());
    const token = await lawyerToken();

    const saved = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send(ACCOUNT);
    expect(saved.status).toBe(200);

    const cleared = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentAccountName: null,
        paymentPhone: null,
        paymentNetwork: null,
      });

    expect(cleared.status).toBe(200);
    expect(cleared.body.paymentAccount).toBeNull();
    const stored = await prisma.lawyerProfile.findFirst();
    expect(stored?.paymentPhone).toBeNull();
    expect(stored?.paymentAccountName).toBeNull();
    expect(stored?.paymentNetwork).toBeNull();
  });
});
