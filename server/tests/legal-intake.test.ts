import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from './setup.js';

// The provider adapter is replaced at the module boundary, so these tests exercise
// the real route, service, persistence, and triage logic while controlling only
// what the model returns. The suite never contacts a live provider.
const { completeMock } = vi.hoisted(() => ({ completeMock: vi.fn() }));

vi.mock('../src/ai/ai-client.js', () => ({
  getAiClient: () => ({ complete: completeMock }),
  isAiConfigured: () => true,
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

const DESCRIPTION =
  'My landlord has locked me out of the room I rent in Accra and is keeping my belongings.';

const MODEL_ANSWER = {
  category: 'Property & Tenancy',
  summary:
    'The person states they were locked out of rented accommodation and their belongings are being withheld.',
  urgency: 'URGENT',
  keywords: ['tenancy', 'lockout'],
  confidence: 0.88,
};

async function seedCategories() {
  await prisma.legalCategory.createMany({
    data: [
      {
        name: 'Property & Tenancy',
        slug: 'property-tenancy',
        description: 'Renting, landlord and tenant disputes.',
      },
      {
        name: 'Employment & Labour',
        slug: 'employment-labour',
        description: 'Dismissal, unpaid salary, contracts.',
      },
      {
        name: 'Other / Needs Review',
        slug: 'other-needs-review',
        description: 'Issues that need a person to review them.',
      },
    ],
  });
}

async function registerUser(email = 'kofi@example.com') {
  const res = await request(app).post('/api/v1/auth/register').send({
    fullName: 'Kofi Boateng',
    email,
    password: 'correct-horse-battery',
  });
  return res.body.token as string;
}

function submit(token: string, body: Record<string, unknown> = { description: DESCRIPTION }) {
  return request(app).post('/api/v1/intakes').set('Authorization', `Bearer ${token}`).send(body);
}

beforeEach(async () => {
  completeMock.mockReset();
  completeMock.mockResolvedValue(JSON.stringify(MODEL_ANSWER));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await seedCategories();
});

describe('FR-006 legal issue submission', () => {
  it('IT-011: stores the enquiry and returns the triaged intake', async () => {
    const token = await registerUser();

    const res = await submit(token);

    expect(res.status).toBe(201);
    expect(res.body.originalDescription).toBe(DESCRIPTION);
    expect(res.body.category.name).toBe('Property & Tenancy');
    expect(res.body.aiSummary).toBe(MODEL_ANSWER.summary);
    expect(res.body.urgency).toBe('URGENT');
    expect(res.body.keywords).toEqual(['tenancy', 'lockout']);
    expect(res.body.aiStatus).toBe('COMPLETED');
    expect(res.body.needsHumanReview).toBe(false);
  });

  it('IT-012: attributes the intake to the authenticated caller', async () => {
    const token = await registerUser();

    const res = await submit(token);

    const stored = await prisma.legalIntake.findUnique({
      where: { id: res.body.id },
      include: { client: { select: { email: true } } },
    });
    expect(stored?.client.email).toBe('kofi@example.com');
  });

  it('IT-013: rejects an unauthenticated submission', async () => {
    const res = await request(app).post('/api/v1/intakes').send({ description: DESCRIPTION });
    expect(res.status).toBe(401);
  });

  it('AI-TC-004: rejects an empty description before calling the AI', async () => {
    const token = await registerUser();

    const res = await submit(token, { description: '' });

    expect(res.status).toBe(422);
    expect(completeMock).not.toHaveBeenCalled();
    expect(await prisma.legalIntake.count()).toBe(0);
  });

  it('AI-TC-014: rejects an over-length description before calling the AI', async () => {
    const token = await registerUser();

    const res = await submit(token, { description: 'a'.repeat(5001) });

    expect(res.status).toBe(422);
    expect(completeMock).not.toHaveBeenCalled();
    expect(await prisma.legalIntake.count()).toBe(0);
  });
});

describe('FR-010 the enquiry survives AI failure', () => {
  it('AI-TC-005: returns 201 and keeps the submission when the provider fails', async () => {
    completeMock.mockRejectedValue(new Error('provider request timed out'));
    const token = await registerUser();

    const res = await submit(token);

    // A 5xx here would be the failure NFR-003 exists to prevent.
    expect(res.status).toBe(201);
    expect(res.body.originalDescription).toBe(DESCRIPTION);
    expect(res.body.aiStatus).toBe('FAILED_FALLBACK');
    expect(res.body.needsHumanReview).toBe(true);
    expect(res.body.category.name).toBe('Other / Needs Review');
  });

  it('AI-TC-006: takes the same path when the provider returns unusable output', async () => {
    completeMock.mockResolvedValue('sorry, I cannot do that');
    const token = await registerUser();

    const res = await submit(token);

    expect(res.status).toBe(201);
    expect(res.body.aiStatus).toBe('FAILED_FALLBACK');
    expect(res.body.needsHumanReview).toBe(true);
  });

  it('AI-TC-015: the original text is persisted and never overwritten by fallback text', async () => {
    completeMock.mockRejectedValue(new Error('network error'));
    const token = await registerUser();

    const res = await submit(token);

    const stored = await prisma.legalIntake.findUnique({ where: { id: res.body.id } });
    expect(stored?.originalDescription).toBe(DESCRIPTION);
    expect(stored?.aiStatus).toBe('FAILED_FALLBACK');
  });

  it('AI-TC-008: an invented category is stored as the review category', async () => {
    completeMock.mockResolvedValue(
      JSON.stringify({ ...MODEL_ANSWER, category: 'Interplanetary Law' }),
    );
    const token = await registerUser();

    const res = await submit(token);

    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe('Other / Needs Review');
    expect(res.body.needsHumanReview).toBe(true);
    // The rest of the answer was valid, so it is kept.
    expect(res.body.aiSummary).toBe(MODEL_ANSWER.summary);
    expect(res.body.aiStatus).toBe('COMPLETED');
  });

  it('AI-TC-016: a low-confidence classification is kept but flagged', async () => {
    completeMock.mockResolvedValue(JSON.stringify({ ...MODEL_ANSWER, confidence: 0.2 }));
    const token = await registerUser();

    const res = await submit(token);

    expect(res.body.category.name).toBe('Property & Tenancy');
    expect(res.body.needsHumanReview).toBe(true);
    expect(res.body.confidence).toBe(0.2);
  });
});

describe('NFR-002 intake visibility', () => {
  it('IT-014: the author can read their own intake', async () => {
    const token = await registerUser();
    const created = await submit(token);

    const res = await request(app)
      .get(`/api/v1/intakes/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('SEC-LG-001: another user cannot read it, and cannot tell that it exists', async () => {
    const ownerToken = await registerUser('owner@example.com');
    const created = await submit(ownerToken);
    const otherToken = await registerUser('other@example.com');

    const found = await request(app)
      .get(`/api/v1/intakes/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    const missing = await request(app)
      .get('/api/v1/intakes/does-not-exist')
      .set('Authorization', `Bearer ${otherToken}`);

    // 404 for both, so the response cannot be used to probe which ids are real.
    expect(found.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(found.body.error.message).toBe(missing.body.error.message);
  });

  it('an admin can read any intake for oversight', async () => {
    const ownerToken = await registerUser('owner@example.com');
    const created = await submit(ownerToken);

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

    const res = await request(app)
      .get(`/api/v1/intakes/${created.body.id}`)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('IT-015: the list endpoint returns only the caller own intakes', async () => {
    const ownerToken = await registerUser('owner@example.com');
    await submit(ownerToken);
    const otherToken = await registerUser('other@example.com');
    await submit(otherToken, { description: `${DESCRIPTION} Second person, different issue.` });

    const res = await request(app)
      .get('/api/v1/intakes')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].originalDescription).toContain('Second person');
  });
});
