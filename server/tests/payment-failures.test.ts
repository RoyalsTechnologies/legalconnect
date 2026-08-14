import {
  ApprovalStatus,
  ConsultationStatus,
  PayoutStatus,
  PayoutType,
  Role,
  SubscriptionPaymentStatus,
  WalletLedgerType,
  WithdrawalStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from './setup.js';
import { grantPlan, packageId, seedPackages } from './subscription-fixtures.js';

const startPayout = vi.hoisted(() => vi.fn());
const verifyPayment = vi.hoisted(() => vi.fn());
const verifyPayout = vi.hoisted(() => vi.fn());

vi.mock('../src/payments/nalopay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/payments/nalopay.js')>();
  return {
    ...actual,
    startPayout: (...args: unknown[]) => startPayout(...args),
    verifyPayment: (...args: unknown[]) => verifyPayment(...args),
    verifyPayout: (...args: unknown[]) => verifyPayout(...args),
  };
});

const { refundHeldFee, requestWithdrawal, capturePayoutCallback } = await import(
  '../src/modules/wallet/wallet.service.js'
);
const { confirmConsultationPayment } = await import(
  '../src/modules/consultations/consultations.service.js'
);
const { confirmSubscription, capturePaidCallback } = await import(
  '../src/modules/subscriptions/subscriptions.service.js'
);

beforeEach(() => {
  startPayout.mockReset();
  verifyPayment.mockReset();
  verifyPayout.mockReset();
});

async function seedLawyer() {
  const user = await prisma.user.create({
    data: {
      email: 'akua.fail@example.com',
      passwordHash: await bcrypt.hash('correct-horse-battery', 4),
      fullName: 'Akua Owusu',
      role: Role.LAWYER,
      emailVerifiedAt: new Date(),
      phone: '0244123456',
    },
  });
  const category = await prisma.legalCategory.create({
    data: {
      name: 'Employment & Labour',
      slug: 'employment-labour',
      description: 'Dismissal, unpaid salary, contracts.',
    },
  });
  const profile = await prisma.lawyerProfile.create({
    data: {
      userId: user.id,
      displayName: 'Akua Owusu',
      bio: 'Employment disputes.',
      city: 'Accra',
      region: 'Greater Accra',
      approvalStatus: ApprovalStatus.APPROVED,
      paymentAccountName: 'Akua Owusu',
      paymentPhone: '0244123456',
      paymentNetwork: 'MTN',
      practiceAreas: { create: [{ legalCategoryId: category.id }] },
    },
  });
  await grantPlan(profile.id);
  return { user, profile, category };
}

describe('Payment adapter failure paths', () => {
  it('rolls back a refund when the payout gateway fails', async () => {
    const { profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.fail@example.com',
        passwordHash: await bcrypt.hash('correct-horse-battery', 4),
        fullName: 'Kofi Boateng',
        role: Role.USER,
        emailVerifiedAt: new Date(),
      },
    });
    const intake = await prisma.legalIntake.create({
      data: {
        clientId: client.id,
        originalDescription: 'Unpaid salary.',
        categoryId: category.id,
      },
    });
    const consultation = await prisma.consultationRequest.create({
      data: {
        intakeId: intake.id,
        clientId: client.id,
        lawyerProfileId: profile.id,
        feePesewas: 20000,
        matchReason: 'Chosen from the directory.',
        scheduledAt: new Date(Date.now() + 86_400_000),
        status: ConsultationStatus.PENDING,
        payerPhone: '0244123456',
        payerNetwork: 'MTN',
      },
    });

    startPayout.mockRejectedValue(new Error('gateway down'));
    await expect(refundHeldFee(consultation.id)).rejects.toThrow(/gateway down/);

    const stored = await prisma.consultationRequest.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(stored.settledAt).toBeNull();
  });

  it('rolls back a withdrawal when the payout gateway fails', async () => {
    const { user, profile } = await seedLawyer();
    await prisma.walletLedger.create({
      data: {
        lawyerProfileId: profile.id,
        amountPesewas: 20000,
        type: WalletLedgerType.CREDIT,
      },
    });

    startPayout.mockRejectedValue(new Error('gateway down'));
    await expect(requestWithdrawal(user.id, { amountGhs: 50 })).rejects.toThrow(/gateway down/);

    const withdrawal = await prisma.withdrawalRequest.findFirstOrThrow({
      where: { lawyerProfileId: profile.id },
    });
    expect(withdrawal.status).toBe(WithdrawalStatus.FAILED);
  });

  it('leaves a consultation unpaid when verification is not yet confirmed', async () => {
    const { profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.verify@example.com',
        passwordHash: await bcrypt.hash('correct-horse-battery', 4),
        fullName: 'Kofi Boateng',
        role: Role.USER,
        emailVerifiedAt: new Date(),
      },
    });
    const intake = await prisma.legalIntake.create({
      data: {
        clientId: client.id,
        originalDescription: 'Unpaid salary.',
        categoryId: category.id,
      },
    });
    const consultation = await prisma.consultationRequest.create({
      data: {
        intakeId: intake.id,
        clientId: client.id,
        lawyerProfileId: profile.id,
        feePesewas: 20000,
        matchReason: 'Chosen from the directory.',
        scheduledAt: new Date(Date.now() + 86_400_000),
        status: ConsultationStatus.AWAITING_PAYMENT,
        paymentReference: 'pay-ref-fail',
        paymentOrderId: 'pay-ord-fail',
      },
    });

    verifyPayment.mockResolvedValue(false);
    await expect(confirmConsultationPayment(client.id, 'pay-ref-fail')).rejects.toThrow(
      /not been confirmed/i,
    );
    const stored = await prisma.consultationRequest.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(stored.status).toBe(ConsultationStatus.AWAITING_PAYMENT);
  });

  it('leaves a plan unpaid when verification is not yet confirmed', async () => {
    const { user, profile } = await seedLawyer();
    await seedPackages();
    await prisma.subscriptionPayment.create({
      data: {
        lawyerProfileId: profile.id,
        packageId: await packageId('starter'),
        feePesewas: 5000,
        periodDays: 30,
        status: SubscriptionPaymentStatus.PENDING,
        paymentReference: 'sub-ref-fail',
        paymentOrderId: 'sub-ord-fail',
      },
    });

    verifyPayment.mockResolvedValue(false);
    await expect(confirmSubscription(user.id, { reference: 'sub-ref-fail' })).rejects.toThrow(
      /not been confirmed/i,
    );
  });

  it('does not mark a payout paid when gateway verification fails', async () => {
    const payout = await prisma.payout.create({
      data: {
        type: PayoutType.REFUND,
        amountPesewas: 5000,
        destinationPhone: '0244123456',
        destinationNetwork: 'MTN',
        paymentReference: 'rf-ref',
        paymentOrderId: 'rf-ord',
        status: PayoutStatus.PENDING,
      },
    });

    verifyPayout.mockResolvedValue(false);
    expect(
      await capturePayoutCallback({
        status: 'PAID',
        amount: '50.00',
        reference: 'rf-ref',
      }),
    ).toBe(true);

    const stored = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(stored.status).toBe(PayoutStatus.PENDING);
  });

  it('records settlement on a refund payout after verification succeeds', async () => {
    const { profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.settle@example.com',
        passwordHash: await bcrypt.hash('correct-horse-battery', 4),
        fullName: 'Kofi Boateng',
        role: Role.USER,
        emailVerifiedAt: new Date(),
      },
    });
    const intake = await prisma.legalIntake.create({
      data: {
        clientId: client.id,
        originalDescription: 'Unpaid salary.',
        categoryId: category.id,
      },
    });
    const consultation = await prisma.consultationRequest.create({
      data: {
        intakeId: intake.id,
        clientId: client.id,
        lawyerProfileId: profile.id,
        feePesewas: 5000,
        matchReason: 'Chosen from the directory.',
        scheduledAt: new Date(Date.now() + 86_400_000),
        status: ConsultationStatus.PENDING,
      },
    });
    await prisma.payout.create({
      data: {
        type: PayoutType.REFUND,
        amountPesewas: 5000,
        destinationPhone: '0244123456',
        destinationNetwork: 'MTN',
        consultationId: consultation.id,
        paymentReference: 'rf-ok',
        paymentOrderId: 'rf-ok-ord',
        status: PayoutStatus.PENDING,
      },
    });

    verifyPayout.mockResolvedValue(true);
    expect(
      await capturePayoutCallback({
        status: 'PAID',
        amount: '50.00',
        reference: 'rf-ok',
      }),
    ).toBe(true);

    const stored = await prisma.consultationRequest.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(stored.settledAt).toBeTruthy();
  });

  it('treats a second subscription callback as already claimed', async () => {
    const { profile } = await seedLawyer();
    await seedPackages();
    await prisma.subscriptionPayment.create({
      data: {
        lawyerProfileId: profile.id,
        packageId: await packageId('starter'),
        feePesewas: 5000,
        periodDays: 30,
        status: SubscriptionPaymentStatus.PENDING,
        paymentReference: 'sub-ref-race',
        paymentOrderId: 'sub-ord-race',
      },
    });

    const payload = { status: 'COMPLETED', amount: '50.00', reference: 'sub-ref-race' };
    await expect(capturePaidCallback(payload)).resolves.toBe(true);
    await expect(capturePaidCallback(payload)).resolves.toBe(false);
  });
});
