import { ApprovalStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unprocessable } from '../src/lib/errors.js';
import { verifyToken } from '../src/lib/jwt.js';
import { sessionFor, tokenFrom } from './session.js';
import { prisma } from './setup.js';
import { grantPlan, packageId, seedPackages } from './subscription-fixtures.js';

const startPayment = vi.hoisted(() => vi.fn());
const verifyPayment = vi.hoisted(() => vi.fn());

vi.mock('../src/payments/nalopay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/payments/nalopay.js')>();
  return {
    ...actual,
    startPayment: (...args: unknown[]) => startPayment(...args),
    verifyPayment: (...args: unknown[]) => verifyPayment(...args),
  };
});

const { createApp } = await import('../src/app.js');
const app = createApp();

const LAWYER_PASSWORD = 'correct-horse-battery';

let employmentId: string;

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
  return sessionFor('admin@example.com');
}

async function userToken(email = 'kofi@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Kofi Boateng', email, password: LAWYER_PASSWORD });
  return tokenFrom(res, `registering ${email}`);
}

async function createLawyer(admin: string): Promise<string> {
  await request(app)
    .post('/api/v1/lawyers')
    .set('Authorization', `Bearer ${admin}`)
    .send({
      email: 'akua.lawyer@example.com',
      password: LAWYER_PASSWORD,
      fullName: 'Akua Owusu',
      displayName: 'Akua Owusu',
      bio: 'I handle employment disputes, unfair dismissal, and unpaid salary claims in Accra.',
      city: 'Accra',
      region: 'Greater Accra',
      consultationFeeGhs: 200,
      practiceAreaIds: [employmentId],
      approvalStatus: ApprovalStatus.APPROVED,
    });
  return sessionFor('akua.lawyer@example.com');
}

function pendingStart(input: { reference: string }) {
  return {
    reference: input.reference,
    orderId: 'ord_live_1',
    authorizationUrl: null,
    captured: false,
    paymentHint: 'Approve the mobile money prompt sent to 0244123456.',
  };
}

beforeEach(async () => {
  startPayment.mockReset();
  verifyPayment.mockReset();
  const employment = await prisma.legalCategory.create({
    data: {
      name: 'Employment & Labour',
      slug: 'employment-labour',
      description: 'Dismissal, unpaid salary, contracts.',
    },
  });
  employmentId = employment.id;
  await seedPackages();
});

describe('NaloPay HTTP collection (FR-017, FR-018)', () => {
  it('IT-084: subscribing stores a pending plan payment when the gateway does not capture', async () => {
    startPayment.mockImplementation(async (input: { reference: string }) => pendingStart(input));
    const token = await createLawyer(await adminToken());

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({
        packageId: await packageId('starter'),
        phone: '0244123456',
        network: 'MTN',
      });

    expect(res.status).toBe(201);
    expect(res.body.subscription.active).toBe(false);
    expect(res.body.paymentHint).toMatch(/Approve the mobile money prompt/);
    expect(res.body.reference).toMatch(/^LCP[a-f0-9]{20}$/);
    expect(startPayment).toHaveBeenCalledOnce();
    const started = startPayment.mock.calls[0]?.[0] as {
      phone: string;
      network: string;
      amountPesewas: number;
      reference: string;
    };
    expect(started.phone).toBe('0244123456');
    expect(started.network).toBe('MTN');
    expect(started.amountPesewas).toBe(5_000);
    expect(started.reference).toBe(res.body.reference);
    expect(started.reference).not.toMatch(/_/);

    const stored = await prisma.subscriptionPayment.findFirstOrThrow({
      orderBy: { createdAt: 'desc' },
    });
    expect(stored.paymentReference).toBe(res.body.reference);
    expect(stored.paymentOrderId).toBe('ord_live_1');
    expect(stored.status).toBe('PENDING');
  });

  it('IT-085: a PAY-INVAL rejection from the adapter is 422 on subscribe', async () => {
    startPayment.mockRejectedValue(unprocessable('Invalid reference'));
    const token = await createLawyer(await adminToken());

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({
        packageId: await packageId('starter'),
        phone: '0244123456',
        network: 'MTN',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe('Invalid reference');
  });

  it('IT-086: confirming a pending plan payment asks the adapter then activates the plan', async () => {
    startPayment.mockImplementation(async (input: { reference: string }) => pendingStart(input));
    verifyPayment.mockResolvedValue(true);
    const token = await createLawyer(await adminToken());

    const started = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({
        packageId: await packageId('starter'),
        phone: '0244123456',
        network: 'MTN',
      });

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ reference: started.body.reference });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(verifyPayment).toHaveBeenCalledWith({
      reference: started.body.reference,
      expectedPesewas: 5_000,
      orderId: 'ord_live_1',
    });
  });

  it('IT-087: paying a booking stays AWAITING_PAYMENT until the mocked collection is confirmed', async () => {
    startPayment.mockImplementation(async (input: { reference: string }) => pendingStart(input));
    verifyPayment.mockResolvedValue(true);

    const admin = await adminToken();
    const lawyerToken = await createLawyer(admin);
    const lawyer = await request(app)
      .get('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyerToken}`);
    await grantPlan(lawyer.body.id);

    const client = await userToken();
    const intake = await prisma.legalIntake.create({
      data: {
        clientId: verifyToken(client).sub,
        originalDescription: 'My employer dismissed me without notice and has not paid me.',
        categoryId: employmentId,
        city: 'Accra',
        region: 'Greater Accra',
      },
    });
    const booked = await request(app)
      .post('/api/v1/consultations')
      .set('Authorization', `Bearer ${client}`)
      .send({
        lawyerProfileId: lawyer.body.id,
        intakeId: intake.id,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    const pay = await request(app)
      .post(`/api/v1/consultations/${booked.body.id}/pay`)
      .set('Authorization', `Bearer ${client}`)
      .send({ phone: '0244123456', network: 'MTN' });

    expect(pay.status).toBe(200);
    expect(pay.body.consultation.status).toBe('AWAITING_PAYMENT');
    expect(pay.body.paymentHint).toMatch(/Approve the mobile money prompt/);
    expect(pay.body.consultation.paymentReference).toMatch(/^LCP[a-f0-9]{20}$/);
    expect(startPayment).toHaveBeenCalledOnce();

    const confirm = await request(app)
      .post('/api/v1/consultations/verify-payment')
      .set('Authorization', `Bearer ${client}`)
      .send({ reference: pay.body.consultation.paymentReference });

    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe('PENDING');
    expect(verifyPayment).toHaveBeenCalledOnce();
  });
});
