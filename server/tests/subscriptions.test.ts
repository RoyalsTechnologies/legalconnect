import { ApprovalStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { sessionFor } from './session.js';
import { prisma } from './setup.js';
import { grantPlan, packageId, seedPackages } from './subscription-fixtures.js';

const app = createApp();

let employmentId: string;
let tenancyId: string;

async function adminToken(): Promise<string> {
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('admin-password-123', 4),
      fullName: 'Platform Administrator',
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  return signToken({ sub: admin.id, role: Role.ADMIN });
}

async function userToken(email = 'kofi@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Kofi Boateng', email, password: 'correct-horse-battery' });
  return res.body.token as string;
}

async function createLawyer(
  admin: string,
  practiceAreaIds: string[],
  email = 'akua.lawyer@example.com',
) {
  return request(app).post('/api/v1/lawyers').set('Authorization', `Bearer ${admin}`).send({
    email,
    password: 'correct-horse-battery',
    fullName: 'Akua Owusu',
    displayName: 'Akua Owusu',
    bio: 'I handle employment disputes, unfair dismissal, and unpaid salary claims in Accra.',
    city: 'Accra',
    region: 'Greater Accra',
    consultationFeeGhs: 200,
    practiceAreaIds,
    approvalStatus: ApprovalStatus.APPROVED,
  });
}

async function lawyerToken(email = 'akua.lawyer@example.com'): Promise<string> {
  return sessionFor(email);
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
  await seedPackages();
});

describe('Lawyer subscription packages (FR-018)', () => {
  it('IT-056: lists active packages in order of how many areas they allow', async () => {
    const res = await request(app).get('/api/v1/packages');

    expect(res.status).toBe(200);
    expect(res.body.map((pkg: { slug: string }) => pkg.slug)).toEqual([
      'starter',
      'practice',
      'chambers',
    ]);
    expect(res.body[0].maxPracticeAreas).toBe(1);
  });

  it('IT-057: a lawyer can pay for a plan that fits their practice areas', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: await packageId('starter') });

    expect(res.status).toBe(201);
    expect(res.body.subscription.active).toBe(true);
    expect(res.body.subscription.package.slug).toBe('starter');
    const monthPay = await prisma.subscriptionPayment.findFirst({
      where: { packageId: await packageId('starter') },
      orderBy: { createdAt: 'desc' },
    });
    expect(monthPay?.feePesewas).toBe(5_000);
    expect(monthPay?.periodDays).toBe(30);
  });

  it('confirming an already-captured plan payment returns the active subscription', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();

    const started = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: await packageId('starter'), phone: '0244123456' });

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ reference: started.body.reference });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
  });

  it('confirming an unknown plan payment returns 404', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ reference: 'no-such-payment-reference' });

    expect(res.status).toBe(404);
  });

  it('an admin can create a package and cannot reuse its name', async () => {
    const admin = await adminToken();
    const body = {
      name: 'Solo desk',
      description: 'One practice area for a newly qualified lawyer.',
      monthlyFeeGhs: 40,
      maxPracticeAreas: 1,
    };

    const created = await request(app)
      .post('/api/v1/packages')
      .set('Authorization', `Bearer ${admin}`)
      .send(body);
    const duplicate = await request(app)
      .post('/api/v1/packages')
      .set('Authorization', `Bearer ${admin}`)
      .send(body);

    expect(created.status).toBe(201);
    expect(created.body.slug).toBe('solo-desk');
    expect(duplicate.status).toBe(409);
  });

  it('returns 404 when updating a package that does not exist', async () => {
    const admin = await adminToken();

    const res = await request(app)
      .patch('/api/v1/packages/missing-package')
      .set('Authorization', `Bearer ${admin}`)
      .send({ monthlyFeeGhs: 10 });

    expect(res.status).toBe(404);
  });

  it('rejects renaming a package onto an existing name', async () => {
    const admin = await adminToken();
    const starterId = await packageId('starter');

    const res = await request(app)
      .patch(`/api/v1/packages/${starterId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ name: 'Practice' });

    expect(res.status).toBe(409);
  });

  it('IT-065: a lawyer can pay a yearly equivalent of twelve monthly fees', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();
    const starterId = await packageId('starter');

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: starterId, interval: 'year' });

    expect(res.status).toBe(201);
    expect(res.body.subscription.active).toBe(true);

    const payment = await prisma.subscriptionPayment.findFirst({
      where: { packageId: starterId },
      orderBy: { createdAt: 'desc' },
    });
    expect(payment?.feePesewas).toBe(60_000);
    expect(payment?.periodDays).toBe(365);

    const periodEnd = new Date(res.body.subscription.periodEnd as string).getTime();
    const min = Date.now() + 360 * 24 * 60 * 60 * 1000;
    const max = Date.now() + 366 * 24 * 60 * 60 * 1000;
    expect(periodEnd).toBeGreaterThan(min);
    expect(periodEnd).toBeLessThan(max);
  });

  it('IT-066: interval other than month or year is rejected', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: await packageId('starter'), interval: 'week' });

    expect(res.status).toBe(422);
  });

  it('IT-058: refuses a plan that allows fewer areas than the lawyer currently lists', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId, tenancyId]);
    const token = await lawyerToken();

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: await packageId('starter') });

    expect(res.status).toBe(422);
    expect(res.body.error.details.practiceAreaIds).toMatch(/at most 1/i);
  });

  it('IT-059: an active plan blocks adding more practice areas than it allows', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin, [employmentId]);
    await grantPlan(created.body.id, 'starter');
    const token = await lawyerToken();

    const res = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ practiceAreaIds: [employmentId, tenancyId] });

    expect(res.status).toBe(422);
  });

  it('IT-060: an admin can grant a plan without a payment', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin, [employmentId]);

    const granted = await request(app)
      .post(`/api/v1/admin/lawyers/${created.body.id}/subscription`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ packageId: await packageId('practice'), periodDays: 30 });

    expect(granted.status).toBe(200);
    expect(granted.body.active).toBe(true);
    expect(granted.body.package.slug).toBe('practice');

    const directory = await request(app).get('/api/v1/lawyers');
    expect(directory.body.results).toHaveLength(1);
  });

  it('IT-088: upgrading mid-period keeps the days already paid for', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();
    await grantPlan(created.body.id, 'starter', 25);

    const before = await prisma.lawyerProfile.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { subscriptionPeriodEnd: true },
    });

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: await packageId('chambers') });

    expect(res.status).toBe(201);
    expect(res.body.subscription.package.slug).toBe('chambers');

    const after = new Date(res.body.subscription.periodEnd as string).getTime();
    const remainderKept = before.subscriptionPeriodEnd!.getTime() + 30 * 24 * 60 * 60 * 1000;
    // The 25 unused days survive the upgrade, so this lands ~55 days out, not 30.
    expect(Math.abs(after - remainderKept)).toBeLessThan(60_000);
  });

  it('IT-089: an admin grant sets the period outright so it can still be shortened', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin, [employmentId]);
    await grantPlan(created.body.id, 'practice', 300);

    const granted = await request(app)
      .post(`/api/v1/admin/lawyers/${created.body.id}/subscription`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ packageId: await packageId('practice'), periodDays: 5 });

    expect(granted.status).toBe(200);
    const end = new Date(granted.body.periodEnd as string).getTime();
    const fiveDaysOut = Date.now() + 5 * 24 * 60 * 60 * 1000;
    expect(Math.abs(end - fiveDaysOut)).toBeLessThan(60_000);
  });

  it('SEC-LG-037: a citizen cannot grant a subscription', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin, [employmentId]);
    const citizen = await userToken();

    const res = await request(app)
      .post(`/api/v1/admin/lawyers/${created.body.id}/subscription`)
      .set('Authorization', `Bearer ${citizen}`)
      .send({ packageId: await packageId('starter') });

    expect(res.status).toBe(403);
  });

  it('IT-061: an expired plan drops the lawyer out of the directory', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin, [employmentId]);
    await grantPlan(created.body.id, 'starter', -1);

    const res = await request(app).get('/api/v1/lawyers');
    expect(res.body.results).toHaveLength(0);
  });

  it('IT-062: a citizen cannot book a lawyer who is not subscribed', async () => {
    const admin = await adminToken();
    const created = await createLawyer(admin, [employmentId]);
    const citizen = await userToken();

    const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${citizen}`);
    const intake = await prisma.legalIntake.create({
      data: {
        clientId: me.body.id,
        originalDescription: 'My employer dismissed me without notice and has not paid me.',
        categoryId: employmentId,
      },
    });

    const res = await request(app)
      .post('/api/v1/consultations')
      .set('Authorization', `Bearer ${citizen}`)
      .send({
        intakeId: intake.id,
        lawyerProfileId: created.body.id,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(404);
  });

  it('IT-063: an admin can change a plan fee; the next payment uses the new amount', async () => {
    const admin = await adminToken();
    const starterId = await packageId('starter');

    const updated = await request(app)
      .patch(`/api/v1/packages/${starterId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ monthlyFeeGhs: 80 });

    expect(updated.status).toBe(200);
    expect(updated.body.monthlyFeePesewas).toBe(8000);

    const listed = await request(app).get('/api/v1/packages');
    const starter = listed.body.find((pkg: { slug: string }) => pkg.slug === 'starter');
    expect(starter.monthlyFeePesewas).toBe(8000);
  });

  it('IT-064: a fee change does not rewrite a month already paid', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();
    const starterId = await packageId('starter');

    await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: starterId });

    await request(app)
      .patch(`/api/v1/packages/${starterId}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ monthlyFeeGhs: 80 });

    const payment = await prisma.subscriptionPayment.findFirst({
      where: { packageId: starterId },
      orderBy: { createdAt: 'desc' },
    });
    expect(payment?.feePesewas).toBe(5000);
  });

  it('SEC-LG-038: a lawyer cannot change a plan fee', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();
    const starterId = await packageId('starter');

    const res = await request(app)
      .patch(`/api/v1/packages/${starterId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeGhs: 1 });

    expect(res.status).toBe(403);
    const stored = await prisma.subscriptionPackage.findUniqueOrThrow({ where: { id: starterId } });
    expect(stored.monthlyFeePesewas).toBe(5000);
  });

  it('IT-072: subscribing without a phone uses the saved payment account', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();

    const saved = await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentAccountName: 'Akua Owusu',
        paymentPhone: '0244123456',
        paymentNetwork: 'MTN',
      });
    expect(saved.status).toBe(200);

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: await packageId('starter') });

    expect(res.status).toBe(201);
    expect(res.body.subscription.active).toBe(true);

    const me = await request(app).get('/api/v1/lawyers/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.paymentAccount).toEqual({
      accountName: 'Akua Owusu',
      phone: '0244123456',
      network: 'MTN',
    });
  });

  it('IT-073: paying with a new number persists it onto the payment account', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({
        packageId: await packageId('starter'),
        phone: '0244987654',
        network: 'AT',
      });

    expect(res.status).toBe(201);

    const me = await request(app).get('/api/v1/lawyers/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.paymentAccount).toEqual({
      accountName: 'Akua Owusu',
      phone: '0244987654',
      network: 'AT',
    });
  });

  it('IT-075: a pay-from number without network is stored with the inferred network', async () => {
    const admin = await adminToken();
    await createLawyer(admin, [employmentId]);
    const token = await lawyerToken();

    const res = await request(app)
      .post('/api/v1/lawyers/me/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({
        packageId: await packageId('starter'),
        phone: '0244123456',
      });

    expect(res.status).toBe(201);

    const me = await request(app).get('/api/v1/lawyers/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.paymentAccount).toEqual({
      accountName: 'Akua Owusu',
      phone: '0244123456',
      network: 'MTN',
    });
  });
});
