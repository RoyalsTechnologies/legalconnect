import {
  ApprovalStatus,
  ConsultationStatus,
  EmailTokenType,
  PayoutStatus,
  PayoutType,
  Role,
  SubscriptionPaymentStatus,
  WalletLedgerType,
  WithdrawalStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { consumeEmailToken, issueEmailToken } from '../src/email/mailer.js';
import * as consultationsService from '../src/modules/consultations/consultations.service.js';
import * as categoriesService from '../src/modules/legal-categories/legal-categories.service.js';
import * as subscriptionsService from '../src/modules/subscriptions/subscriptions.service.js';
import * as usersService from '../src/modules/users/users.service.js';
import * as walletService from '../src/modules/wallet/wallet.service.js';
import { prisma } from './setup.js';
import { grantPlan, packageId, seedPackages } from './subscription-fixtures.js';

async function seedLawyer() {
  const user = await prisma.user.create({
    data: {
      email: 'akua.wallet@example.com',
      passwordHash: await bcrypt.hash('correct-horse-battery', 4),
      fullName: 'Akua Owusu',
      role: Role.LAWYER,
      emailVerifiedAt: new Date(),
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

describe('Service paths that HTTP tests do not reach', () => {
  it('refuses a category or package name that slugifies to empty', async () => {
    await expect(
      categoriesService.createCategory({
        name: '!!',
        description: 'Must contain a letter or number to form a slug.',
      }),
    ).rejects.toThrow(/letter or number/i);

    await expect(
      subscriptionsService.createPackage({
        name: '!!',
        description: 'Must contain a letter or number to form a slug.',
        monthlyFeeGhs: 10,
        maxPracticeAreas: 1,
      }),
    ).rejects.toThrow(/letter or number/i);
  });

  it('returns not-found for a missing profile, wallet, and user', async () => {
    await expect(usersService.getProfile('missing')).rejects.toThrow(/not found/i);
    await expect(walletService.listWithdrawalsForUser('missing')).rejects.toThrow(
      /lawyer profile/i,
    );
    await expect(usersService.rememberPhone('missing', null)).resolves.toBeUndefined();
  });

  it('ignores a consultation payment callback that is unpaid, unmatched, or the wrong amount', async () => {
    const { user, profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.wallet@example.com',
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
        paymentReference: 'lc-fee-ref',
        paymentOrderId: 'lc-fee-ord',
      },
    });

    expect(await consultationsService.capturePaidCallback({ status: 'FAILED' })).toBe(false);
    expect(await consultationsService.capturePaidCallback({ status: 'COMPLETED' })).toBe(false);
    expect(
      await consultationsService.capturePaidCallback({
        status: 'COMPLETED',
        reference: 'unknown',
      }),
    ).toBe(false);
    expect(
      await consultationsService.capturePaidCallback({
        status: 'COMPLETED',
        amount: '1.00',
        order_id: 'lc-fee-ord',
      }),
    ).toBe(true);

    const stillUnpaid = await prisma.consultationRequest.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(stillUnpaid.status).toBe(ConsultationStatus.AWAITING_PAYMENT);

    expect(
      await consultationsService.capturePaidCallback({
        status: 'PAID',
        amount: '200.00',
        reference: 'lc-fee-ref',
      }),
    ).toBe(true);

    const paid = await prisma.consultationRequest.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(paid.status).toBe(ConsultationStatus.PENDING);

    expect(
      await consultationsService.capturePaidCallback({
        status: 'PAID',
        amount: '200.00',
        reference: 'lc-fee-ref',
      }),
    ).toBe(true);

    void user;
  });

  it('captures, mismatches, and ignores subscription payment callbacks', async () => {
    const { profile } = await seedLawyer();
    await seedPackages();
    const pkgId = await packageId('starter');
    const payment = await prisma.subscriptionPayment.create({
      data: {
        lawyerProfileId: profile.id,
        packageId: pkgId,
        feePesewas: 5000,
        periodDays: 30,
        status: SubscriptionPaymentStatus.PENDING,
        paymentReference: 'sub-ref',
        paymentOrderId: 'sub-ord',
      },
    });

    expect(await subscriptionsService.capturePaidCallback({ status: 'FAILED' })).toBe(false);
    expect(await subscriptionsService.capturePaidCallback({ status: 'COMPLETED' })).toBe(false);
    expect(
      await subscriptionsService.capturePaidCallback({
        status: 'COMPLETED',
        reference: 'unknown',
      }),
    ).toBe(false);
    expect(
      await subscriptionsService.capturePaidCallback({
        status: 'COMPLETED',
        amount: '1.00',
        order_id: 'sub-ord',
      }),
    ).toBe(true);

    const stillPending = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(stillPending.status).toBe(SubscriptionPaymentStatus.PENDING);

    expect(
      await subscriptionsService.capturePaidCallback({
        status: 'COMPLETED',
        amount: '50.00',
        reference: 'sub-ref',
      }),
    ).toBe(true);

    const paid = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(paid.status).toBe(SubscriptionPaymentStatus.PAID);
  });

  it('captures payout callbacks for withdrawals and refunds', async () => {
    const { profile } = await seedLawyer();
    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        lawyerProfileId: profile.id,
        amountPesewas: 5000,
        status: WithdrawalStatus.PENDING,
        paymentReference: 'wd-ref',
        paymentOrderId: 'wd-ord',
      },
    });
    const payout = await prisma.payout.create({
      data: {
        type: PayoutType.WITHDRAWAL,
        amountPesewas: 5000,
        destinationPhone: '0244123456',
        destinationNetwork: 'MTN',
        withdrawalId: withdrawal.id,
        paymentReference: 'wd-ref',
        paymentOrderId: 'wd-ord',
        status: PayoutStatus.PENDING,
      },
    });

    expect(await walletService.capturePayoutCallback({})).toBe(false);
    expect(await walletService.capturePayoutCallback({ reference: 'unknown' })).toBe(false);

    expect(
      await walletService.capturePayoutCallback({
        status: 'FAILED',
        amount: '50.00',
        reference: 'wd-ref',
      }),
    ).toBe(true);

    const failed = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(failed.status).toBe(PayoutStatus.FAILED);
    const reversed = await prisma.withdrawalRequest.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });
    expect(reversed.status).toBe(WithdrawalStatus.FAILED);

    const pendingAgain = await prisma.payout.create({
      data: {
        type: PayoutType.WITHDRAWAL,
        amountPesewas: 5000,
        destinationPhone: '0244123456',
        destinationNetwork: 'MTN',
        paymentReference: 'wd-ref-2',
        paymentOrderId: 'wd-ord-2',
        status: PayoutStatus.PENDING,
      },
    });
    const secondWithdrawal = await prisma.withdrawalRequest.create({
      data: {
        lawyerProfileId: profile.id,
        amountPesewas: 5000,
        status: WithdrawalStatus.PENDING,
        paymentReference: 'wd-ref-2',
        paymentOrderId: 'wd-ord-2',
      },
    });
    await prisma.payout.update({
      where: { id: pendingAgain.id },
      data: { withdrawalId: secondWithdrawal.id },
    });

    expect(
      await walletService.capturePayoutCallback({
        status: 'PAID',
        amount: '50.00',
        order_id: 'wd-ord-2',
      }),
    ).toBe(true);

    const paidOut = await prisma.payout.findUniqueOrThrow({ where: { id: pendingAgain.id } });
    expect(paidOut.status).toBe(PayoutStatus.PAID);
    const paidWithdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({
      where: { id: secondWithdrawal.id },
    });
    expect(paidWithdrawal.status).toBe(WithdrawalStatus.PAID);

    expect(
      await walletService.capturePayoutCallback({
        status: 'PAID',
        amount: '50.00',
        reference: 'wd-ref-2',
      }),
    ).toBe(true);
  });

  it('does not credit a consultation that is not in the accepted hold', async () => {
    const { profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.credit@example.com',
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
      },
    });

    await walletService.creditConsultationFee(consultation.id, profile.id, 20000);
    const entries = await prisma.walletLedger.count({
      where: { lawyerProfileId: profile.id },
    });
    expect(entries).toBe(0);
  });

  it('swallows a duplicate wallet credit instead of throwing', async () => {
    const { profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.dupcredit@example.com',
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
        status: ConsultationStatus.ACCEPTED,
      },
    });
    await prisma.walletLedger.create({
      data: {
        lawyerProfileId: profile.id,
        amountPesewas: 20000,
        type: WalletLedgerType.CREDIT,
        consultationId: consultation.id,
      },
    });

    await expect(
      walletService.creditConsultationFee(consultation.id, profile.id, 20000),
    ).resolves.toBeUndefined();
  });

  it('cannot refund a hold that has no paying number', async () => {
    const { profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.refund@example.com',
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
      },
    });

    await expect(walletService.refundHeldFee(consultation.id)).rejects.toThrow(/paying number/i);
  });

  it('returns false when refunding a consultation that is not held', async () => {
    const { profile, category } = await seedLawyer();
    const client = await prisma.user.create({
      data: {
        email: 'kofi.nohold@example.com',
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
        status: ConsultationStatus.DECLINED,
      },
    });

    expect(await walletService.refundHeldFee(consultation.id)).toBe(false);
  });

  it('consumes only a matching unexpired email token', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'token.user@example.com',
        passwordHash: await bcrypt.hash('correct-horse-battery', 4),
        fullName: 'Token User',
        role: Role.USER,
        emailVerifiedAt: new Date(),
      },
    });
    const raw = await issueEmailToken(user.id, EmailTokenType.VERIFY_EMAIL);
    expect(await consumeEmailToken(raw, EmailTokenType.RESET_PASSWORD)).toBeNull();

    await prisma.emailToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumeEmailToken(raw, EmailTokenType.VERIFY_EMAIL)).toBeNull();
  });

  it('refuses an admin confirm and a grant to a missing lawyer', async () => {
    await expect(
      consultationsService.confirmConsultation('missing', 'admin', Role.ADMIN),
    ).rejects.toThrow(/client and the lawyer/i);

    await expect(
      subscriptionsService.grantSubscription('missing', { packageId: 'pkg', periodDays: 30 }),
    ).rejects.toThrow(/Lawyer not found/i);
  });
});
