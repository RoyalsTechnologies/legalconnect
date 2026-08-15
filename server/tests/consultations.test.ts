import { ApprovalStatus, ConsultationStatus, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { signToken } from '../src/lib/jwt.js';
import { sessionFor } from './session.js';
import { prisma } from './setup.js';
import { grantPlan } from './subscription-fixtures.js';

const app = createApp();

const LAWYER_PASSWORD = 'correct-horse-battery';

let employmentId: string;

async function userToken(email = 'kofi@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Kofi Boateng', email, password: 'correct-horse-battery' });
  return res.body.token as string;
}

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

async function seedLawyer(email = 'akua@example.com', displayName = 'Akua Owusu') {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(LAWYER_PASSWORD, 4),
      fullName: displayName,
      role: Role.LAWYER,
      emailVerifiedAt: new Date(),
    },
  });

  const profile = await prisma.lawyerProfile.create({
    data: {
      userId: user.id,
      displayName,
      bio: 'Handles employment disputes, unfair dismissal, and unpaid salary claims.',
      city: 'Accra',
      region: 'Greater Accra',
      approvalStatus: ApprovalStatus.APPROVED,
      consultationFeePesewas: 20000,
      practiceAreas: { create: [{ legalCategoryId: employmentId }] },
    },
  });
  await grantPlan(profile.id);

  return {
    profileId: profile.id,
    token: signToken({ sub: user.id, role: Role.LAWYER }),
    userId: user.id,
  };
}

async function seedIntake(token: string): Promise<string> {
  const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

  const intake = await prisma.legalIntake.create({
    data: {
      clientId: me.body.id,
      originalDescription: 'My employer dismissed me without notice and has not paid me.',
      categoryId: employmentId,
      aiSummary: 'Client reports dismissal without notice and unpaid wages.',
      city: 'Accra',
      region: 'Greater Accra',
    },
  });

  return intake.id;
}

function sendRequest(token: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/v1/consultations')
    .set('Authorization', `Bearer ${token}`)
    .send({ scheduledAt: futureSlot(), ...body });
}

function futureSlot() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

const SAMPLE_MEET_URL = 'https://meet.google.com/abc-defg-hij';

function setStatus(
  token: string,
  id: string,
  status: ConsultationStatus,
  extra: Record<string, unknown> = {},
) {
  return request(app)
    .patch(`/api/v1/consultations/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      status,
      ...(status === ConsultationStatus.ACCEPTED ? { meetUrl: SAMPLE_MEET_URL } : {}),
      ...extra,
    });
}

function payRequest(token: string, id: string) {
  return request(app)
    .post(`/api/v1/consultations/${id}/pay`)
    .set('Authorization', `Bearer ${token}`)
    .send({ phone: '0244123456', network: 'MTN' });
}

beforeEach(async () => {
  const employment = await prisma.legalCategory.create({
    data: {
      name: 'Employment & Labour',
      slug: 'employment-labour',
      description: 'Dismissal, unpaid salary, contracts.',
    },
  });
  employmentId = employment.id;
});

describe('Consultation requests (FR-013)', () => {
  it('IT-030: a citizen sends a consultation request against their own intake', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();

    const res = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
      message: 'I would like to discuss this as soon as possible.',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(ConsultationStatus.AWAITING_PAYMENT);
    expect(res.body.feePesewas).toBe(20000);
    expect(res.body.matchReason).toContain('Employment & Labour');
    expect(res.body.scheduledAt).toBeTruthy();
    expect(res.body.googleCalendarUrl).toContain('https://calendar.google.com/calendar/render');
    expect(res.body.meetUrl).toBeNull();
  });

  it('IT-067: booking without a time slot returns 422', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const res = await request(app)
      .post('/api/v1/consultations')
      .set('Authorization', `Bearer ${client}`)
      .send({
        intakeId: await seedIntake(client),
        lawyerProfileId: lawyer.profileId,
      });
    expect(res.status).toBe(422);
  });

  it('IT-031: the same enquiry cannot be sent to the same lawyer twice', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const intakeId = await seedIntake(client);

    await sendRequest(client, { intakeId, lawyerProfileId: lawyer.profileId });
    const duplicate = await sendRequest(client, {
      intakeId,
      lawyerProfileId: lawyer.profileId,
    });

    expect(duplicate.status).toBe(409);
  });

  it('SEC-LG-023: a citizen cannot send a request against another person\u2019s intake', async () => {
    const owner = await userToken('owner@example.com');
    const intruder = await userToken('intruder@example.com');
    const lawyer = await seedLawyer();

    const res = await sendRequest(intruder, {
      intakeId: await seedIntake(owner),
      lawyerProfileId: lawyer.profileId,
    });

    expect(res.status).toBe(404);
  });

  it('SEC-LG-024: a request cannot be sent to an unapproved lawyer', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    await prisma.lawyerProfile.update({
      where: { id: lawyer.profileId },
      data: { approvalStatus: ApprovalStatus.PENDING },
    });

    const res = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    expect(res.status).toBe(404);
  });

  it('SEC-LG-025: a lawyer cannot send consultation requests', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();

    const res = await sendRequest(lawyer.token, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    expect(res.status).toBe(403);
  });
});

describe('Consultation management (FR-014)', () => {
  async function pendingRequest() {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });
    await payRequest(client, created.body.id as string);
    return { client, lawyer, id: created.body.id as string };
  }

  it('IT-032: a lawyer sees requests addressed to them, with the structured intake', async () => {
    const { lawyer } = await pendingRequest();

    const res = await request(app)
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${lawyer.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].intake.aiSummary).toBeTruthy();
    expect(res.body[0].intake.originalDescription).toBeTruthy();
  });

  it('IT-033: a lawyer accepts a pending request', async () => {
    const { lawyer, id } = await pendingRequest();

    const res = await setStatus(lawyer.token, id, ConsultationStatus.ACCEPTED);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(ConsultationStatus.ACCEPTED);
    expect(res.body.meetUrl).toBe(SAMPLE_MEET_URL);
    expect(res.body.googleCalendarUrl).toContain('meet.google.com');
  });

  it('IT-068: accepting without a Google Meet link returns 422', async () => {
    const { lawyer, id } = await pendingRequest();
    const res = await request(app)
      .patch(`/api/v1/consultations/${id}`)
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({ status: ConsultationStatus.ACCEPTED });
    expect(res.status).toBe(422);
  });

  it('IT-034: a lawyer declines a pending request', async () => {
    const { lawyer, id } = await pendingRequest();

    const res = await setStatus(lawyer.token, id, ConsultationStatus.DECLINED);

    expect(res.body.status).toBe(ConsultationStatus.DECLINED);
  });

  it('IT-035: a lawyer cannot mark an accepted request completed alone', async () => {
    const { lawyer, id } = await pendingRequest();
    await setStatus(lawyer.token, id, ConsultationStatus.ACCEPTED);

    const res = await setStatus(lawyer.token, id, ConsultationStatus.COMPLETED);

    expect(res.status).toBe(403);
    const stored = await prisma.consultationRequest.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe(ConsultationStatus.ACCEPTED);
  });

  it('IT-036: a citizen cancels their own pending request', async () => {
    const { client, id } = await pendingRequest();

    const res = await setStatus(client, id, ConsultationStatus.CANCELLED);

    expect(res.body.status).toBe(ConsultationStatus.CANCELLED);
  });

  it('IT-037: a declined request cannot be revived', async () => {
    const { lawyer, id } = await pendingRequest();
    await setStatus(lawyer.token, id, ConsultationStatus.DECLINED);

    const res = await setStatus(lawyer.token, id, ConsultationStatus.ACCEPTED);

    expect(res.status).toBe(400);
  });

  it('SEC-LG-026: a citizen cannot accept a request on the lawyer\u2019s behalf', async () => {
    const { client, id } = await pendingRequest();

    const res = await setStatus(client, id, ConsultationStatus.ACCEPTED);

    expect(res.status).toBe(403);
  });

  it('SEC-LG-027: a lawyer cannot cancel a request sent to them', async () => {
    const { lawyer, id } = await pendingRequest();

    const res = await setStatus(lawyer.token, id, ConsultationStatus.CANCELLED);

    expect(res.status).toBe(403);
  });

  it('SEC-LG-028: an unrelated lawyer cannot see or act on the request', async () => {
    const { id } = await pendingRequest();
    const other = await seedLawyer('other@example.com', 'Other Lawyer');

    const list = await request(app)
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${other.token}`);
    const read = await request(app)
      .get(`/api/v1/consultations/${id}`)
      .set('Authorization', `Bearer ${other.token}`);

    expect(list.body).toHaveLength(0);
    expect(read.status).toBe(404);
  });

  it('SEC-LG-029: an unrelated citizen cannot read the request or its intake', async () => {
    const { id } = await pendingRequest();
    const intruder = await userToken('intruder@example.com');

    const res = await request(app)
      .get(`/api/v1/consultations/${id}`)
      .set('Authorization', `Bearer ${intruder}`);

    expect(res.status).toBe(404);
  });

  it('IT-038: requests can be filtered by status', async () => {
    const { client, lawyer, id } = await pendingRequest();
    await setStatus(lawyer.token, id, ConsultationStatus.ACCEPTED);

    const accepted = await request(app)
      .get('/api/v1/consultations?status=ACCEPTED')
      .set('Authorization', `Bearer ${client}`);
    const pending = await request(app)
      .get('/api/v1/consultations?status=PENDING')
      .set('Authorization', `Bearer ${client}`);

    expect(accepted.body).toHaveLength(1);
    expect(pending.body).toHaveLength(0);
  });

  it('IT-039: an admin can see every request for oversight (FR-015)', async () => {
    await pendingRequest();
    const admin = await adminToken();

    const res = await request(app)
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${admin}`);

    expect(res.body).toHaveLength(1);
  });

  it('SEC-LG-030: a suspended citizen cannot act on their request', async () => {
    const { client, id } = await pendingRequest();
    await prisma.user.update({
      where: { email: 'kofi@example.com' },
      data: { status: UserStatus.SUSPENDED },
    });

    const res = await setStatus(client, id, ConsultationStatus.CANCELLED);

    expect(res.status).toBe(403);
  });
});

describe('Consultation payment (FR-017)', () => {
  it('hides an unpaid booking from the lawyer until the fee is paid', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    expect(created.body.status).toBe(ConsultationStatus.AWAITING_PAYMENT);

    const beforePay = await request(app)
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${lawyer.token}`);
    expect(beforePay.body).toHaveLength(0);

    const paid = await payRequest(client, created.body.id as string);
    expect(paid.status).toBe(200);
    expect(paid.body.consultation.status).toBe(ConsultationStatus.PENDING);

    const afterPay = await request(app)
      .get('/api/v1/consultations')
      .set('Authorization', `Bearer ${lawyer.token}`);
    expect(afterPay.body).toHaveLength(1);
  });

  it('snapshots the lawyer fee at booking time', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    await prisma.lawyerProfile.update({
      where: { id: lawyer.profileId },
      data: { consultationFeePesewas: 35000 },
    });

    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    expect(created.body.feePesewas).toBe(35000);

    await prisma.lawyerProfile.update({
      where: { id: lawyer.profileId },
      data: { consultationFeePesewas: 10000 },
    });

    const paid = await payRequest(client, created.body.id as string);
    expect(paid.body.consultation.feePesewas).toBe(35000);
  });

  it('stores the mobile money number on the account when the client pays', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    const paid = await request(app)
      .post(`/api/v1/consultations/${created.body.id as string}/pay`)
      .set('Authorization', `Bearer ${client}`)
      .send({ phone: '0244123456' });

    expect(paid.status).toBe(200);

    const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${client}`);
    expect(me.body.phone).toBe('0244123456');
  });

  it('treats a second payment confirmation as already paid', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    const paid = await payRequest(client, created.body.id as string);
    const reference = paid.body.consultation.paymentReference as string;

    const first = await request(app)
      .post('/api/v1/consultations/verify-payment')
      .set('Authorization', `Bearer ${client}`)
      .send({ reference });
    const second = await request(app)
      .post('/api/v1/consultations/verify-payment')
      .set('Authorization', `Bearer ${client}`)
      .send({ reference });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.status).toBe(ConsultationStatus.PENDING);
    expect(second.body.status).toBe(ConsultationStatus.PENDING);
  });

  it('lets the client cancel an unpaid booking', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    const res = await setStatus(client, created.body.id as string, ConsultationStatus.CANCELLED);
    expect(res.body.status).toBe(ConsultationStatus.CANCELLED);
    const refund = await prisma.payout.findFirst({
      where: { consultationId: created.body.id as string },
    });
    expect(refund).toBeNull();
  });
});

describe('Consultation fee escrow (FR-021)', () => {
  async function acceptedRequest() {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });
    const id = created.body.id as string;
    await payRequest(client, id);
    await setStatus(lawyer.token, id, ConsultationStatus.ACCEPTED);
    return { client, lawyer, id };
  }

  function confirm(token: string, id: string) {
    return request(app)
      .post(`/api/v1/consultations/${id}/confirm`)
      .set('Authorization', `Bearer ${token}`);
  }

  it('IT-076: both parties confirming credits the lawyer wallet and completes the request', async () => {
    const { client, lawyer, id } = await acceptedRequest();

    const first = await confirm(lawyer.token, id);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe(ConsultationStatus.ACCEPTED);
    expect(first.body.lawyerConfirmedAt).toBeTruthy();

    const meAfterOne = await request(app)
      .get('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`);
    expect(meAfterOne.body.wallet.availablePesewas).toBe(0);

    const second = await confirm(client, id);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe(ConsultationStatus.COMPLETED);

    const me = await request(app)
      .get('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`);
    expect(me.body.wallet.availablePesewas).toBe(20000);
    expect(me.body.wallet.entries).toHaveLength(1);
    expect(me.body.wallet.entries[0].type).toBe('CREDIT');
  });

  it('IT-077: one confirmation does not credit the wallet', async () => {
    const { client, lawyer, id } = await acceptedRequest();
    const res = await confirm(client, id);
    expect(res.body.status).toBe(ConsultationStatus.ACCEPTED);
    expect(res.body.clientConfirmedAt).toBeTruthy();
    expect(res.body.lawyerConfirmedAt).toBeNull();

    const me = await request(app)
      .get('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`);
    expect(me.body.wallet.availablePesewas).toBe(0);
  });

  it('IT-078: cancelling after payment refunds the client and does not credit the lawyer', async () => {
    const { client, lawyer, id } = await acceptedRequest();
    const res = await setStatus(client, id, ConsultationStatus.CANCELLED);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(ConsultationStatus.CANCELLED);

    const refund = await prisma.payout.findFirst({ where: { consultationId: id } });
    expect(refund?.type).toBe('REFUND');
    expect(refund?.status).toBe('PAID');
    expect(refund?.destinationPhone).toBe('0244123456');

    const me = await request(app)
      .get('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`);
    expect(me.body.wallet.availablePesewas).toBe(0);
  });

  it('IT-079: declining after payment refunds the client', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });
    const id = created.body.id as string;
    await payRequest(client, id);

    const res = await setStatus(lawyer.token, id, ConsultationStatus.DECLINED);
    expect(res.body.status).toBe(ConsultationStatus.DECLINED);
    const refund = await prisma.payout.findFirst({ where: { consultationId: id } });
    expect(refund?.type).toBe('REFUND');
    expect(refund?.status).toBe('PAID');
  });

  it('IT-080: confirming twice does not double-credit', async () => {
    const { client, lawyer, id } = await acceptedRequest();
    await confirm(lawyer.token, id);
    await confirm(client, id);
    const again = await confirm(client, id);
    expect(again.status).toBe(200);
    expect(again.body.status).toBe(ConsultationStatus.COMPLETED);

    const credits = await prisma.walletLedger.count({
      where: { consultationId: id, type: 'CREDIT' },
    });
    expect(credits).toBe(1);
  });

  it('refuses cancel after both parties have confirmed', async () => {
    const { client, lawyer, id } = await acceptedRequest();
    await confirm(lawyer.token, id);
    await confirm(client, id);

    const res = await setStatus(client, id, ConsultationStatus.CANCELLED);
    expect(res.status).toBe(400);

    const stored = await prisma.consultationRequest.findUniqueOrThrow({ where: { id } });
    expect(stored.status).toBe(ConsultationStatus.COMPLETED);
    expect(stored.settledAt).toBeTruthy();
  });

  it('IT-081: a lawyer can withdraw available credit to a saved payment account', async () => {
    const { client, lawyer, id } = await acceptedRequest();
    await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({
        paymentAccountName: 'Akua Owusu',
        paymentPhone: '0244123456',
        paymentNetwork: 'MTN',
      });
    await confirm(lawyer.token, id);
    await confirm(client, id);

    const res = await request(app)
      .post('/api/v1/lawyers/me/withdrawals')
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({ amountGhs: 50 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PAID');
    expect(res.body.amountPesewas).toBe(5000);

    const me = await request(app)
      .get('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`);
    expect(me.body.wallet.availablePesewas).toBe(15000);
  });

  it('IT-082: withdrawing more than the balance returns 422', async () => {
    const { client, lawyer, id } = await acceptedRequest();
    await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({
        paymentAccountName: 'Akua Owusu',
        paymentPhone: '0244123456',
        paymentNetwork: 'MTN',
      });
    await confirm(lawyer.token, id);
    await confirm(client, id);

    const res = await request(app)
      .post('/api/v1/lawyers/me/withdrawals')
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({ amountGhs: 500 });

    expect(res.status).toBe(422);
  });

  it('IT-083: withdrawing without a payment account returns 422', async () => {
    const { client, lawyer, id } = await acceptedRequest();
    await confirm(lawyer.token, id);
    await confirm(client, id);

    const res = await request(app)
      .post('/api/v1/lawyers/me/withdrawals')
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({ amountGhs: 50 });

    expect(res.status).toBe(422);
  });
});

describe('Consultation edge paths', () => {
  it('refuses a booking when the lawyer has not set a fee', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    await prisma.lawyerProfile.update({
      where: { id: lawyer.profileId },
      data: { consultationFeePesewas: 50 },
    });

    const res = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/consultation fee/i);
  });

  it('requires a paying number when the account has none', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    const res = await request(app)
      .post(`/api/v1/consultations/${created.body.id as string}/pay`)
      .set('Authorization', `Bearer ${client}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('hides unpaid bookings when a lawyer filters by AWAITING_PAYMENT', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });

    const res = await request(app)
      .get('/api/v1/consultations?status=AWAITING_PAYMENT')
      .set('Authorization', `Bearer ${lawyer.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns a paid booking by id to the citizen', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });
    await payRequest(client, created.body.id as string);

    const res = await request(app)
      .get(`/api/v1/consultations/${created.body.id as string}`)
      .set('Authorization', `Bearer ${client}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(ConsultationStatus.PENDING);
  });

  it('treats a second pay call as already paid', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });
    await payRequest(client, created.body.id as string);

    const again = await payRequest(client, created.body.id as string);
    expect(again.status).toBe(200);
    expect(again.body.consultation.status).toBe(ConsultationStatus.PENDING);
  });

  it('lists withdrawals for the lawyer after a payout', async () => {
    const { client, lawyer, id } = await (async () => {
      const clientToken = await userToken();
      const seeded = await seedLawyer();
      const created = await sendRequest(clientToken, {
        intakeId: await seedIntake(clientToken),
        lawyerProfileId: seeded.profileId,
      });
      const consultationId = created.body.id as string;
      await payRequest(clientToken, consultationId);
      await setStatus(seeded.token, consultationId, ConsultationStatus.ACCEPTED);
      return { client: clientToken, lawyer: seeded, id: consultationId };
    })();

    await request(app)
      .patch('/api/v1/lawyers/me')
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({
        paymentAccountName: 'Akua Owusu',
        paymentPhone: '0244123456',
        paymentNetwork: 'MTN',
      });
    await request(app)
      .post(`/api/v1/consultations/${id}/confirm`)
      .set('Authorization', `Bearer ${lawyer.token}`);
    await request(app)
      .post(`/api/v1/consultations/${id}/confirm`)
      .set('Authorization', `Bearer ${client}`);

    await request(app)
      .post('/api/v1/lawyers/me/withdrawals')
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({ amountGhs: 50 });

    const listed = await request(app)
      .get('/api/v1/lawyers/me/withdrawals')
      .set('Authorization', `Bearer ${lawyer.token}`);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].amountPesewas).toBe(5000);
  });

  it('refuses confirm before the lawyer has accepted', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });
    await payRequest(client, created.body.id as string);

    const res = await request(app)
      .post(`/api/v1/consultations/${created.body.id as string}/confirm`)
      .set('Authorization', `Bearer ${client}`);

    expect(res.status).toBe(400);
  });

  it('rejects an accept with a URL that is not a Google Meet room', async () => {
    const client = await userToken();
    const lawyer = await seedLawyer();
    const created = await sendRequest(client, {
      intakeId: await seedIntake(client),
      lawyerProfileId: lawyer.profileId,
    });
    await payRequest(client, created.body.id as string);

    const res = await request(app)
      .patch(`/api/v1/consultations/${created.body.id as string}`)
      .set('Authorization', `Bearer ${lawyer.token}`)
      .send({ status: ConsultationStatus.ACCEPTED, meetUrl: 'https://zoom.us/j/123' });

    expect(res.status).toBe(422);
  });
});
