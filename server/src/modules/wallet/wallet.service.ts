import {
  ConsultationStatus,
  PayoutStatus,
  PayoutType,
  Prisma,
  WalletLedgerType,
  WithdrawalStatus,
} from '@prisma/client';
import { badRequest, notFound, unprocessable } from '../../lib/errors.js';
import { ghsToPesewas } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import {
  inferMomoNetwork,
  isPaidStatus,
  newPayoutReference,
  pesewasFromAmount,
  startPayout,
  verifyPayout,
} from '../../payments/nalopay.js';
import type { WithdrawInput } from './wallet.schema.js';

const ledgerSelect = {
  id: true,
  type: true,
  amountPesewas: true,
  consultationId: true,
  withdrawalId: true,
  createdAt: true,
} satisfies Prisma.WalletLedgerSelect;

const withdrawalSelect = {
  id: true,
  amountPesewas: true,
  status: true,
  paymentReference: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WithdrawalRequestSelect;

export type WalletEntryView = Prisma.WalletLedgerGetPayload<{ select: typeof ledgerSelect }>;
export type WithdrawalView = Prisma.WithdrawalRequestGetPayload<{
  select: typeof withdrawalSelect;
}>;

export type WalletView = {
  availablePesewas: number;
  entries: WalletEntryView[];
};

export async function getWallet(lawyerProfileId: string): Promise<WalletView> {
  const entries = await prisma.walletLedger.findMany({
    where: { lawyerProfileId },
    select: ledgerSelect,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const availablePesewas = await availableBalance(lawyerProfileId);
  return { availablePesewas, entries };
}

export async function listWithdrawalsForUser(userId: string): Promise<WithdrawalView[]> {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw notFound('You do not have a lawyer profile');
  return listWithdrawals(profile.id);
}

export async function listWithdrawals(lawyerProfileId: string): Promise<WithdrawalView[]> {
  return prisma.withdrawalRequest.findMany({
    where: { lawyerProfileId },
    select: withdrawalSelect,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function creditConsultationFee(
  consultationId: string,
  lawyerProfileId: string,
  feePesewas: number,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM consultation_requests WHERE id = ${consultationId} FOR UPDATE`;
      const row = await tx.consultationRequest.findUnique({
        where: { id: consultationId },
        select: { settledAt: true, status: true },
      });
      if (!row || row.settledAt || row.status !== ConsultationStatus.ACCEPTED) return;

      await tx.consultationRequest.update({
        where: { id: consultationId },
        data: { status: ConsultationStatus.COMPLETED, settledAt: new Date() },
      });
      await tx.walletLedger.create({
        data: {
          lawyerProfileId,
          amountPesewas: feePesewas,
          type: WalletLedgerType.CREDIT,
          consultationId,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return;
    }
    throw error;
  }
}

/**
 * Returns a held fee to the number that paid. No lawyer credit.
 * Claims `settledAt` before the payout so a concurrent confirm cannot also credit.
 * Returns false when the fee is already settled (caller must not change status).
 */
export async function refundHeldFee(consultationId: string): Promise<boolean> {
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM consultation_requests WHERE id = ${consultationId} FOR UPDATE`;
    const consultation = await tx.consultationRequest.findUnique({
      where: { id: consultationId },
      select: {
        id: true,
        status: true,
        feePesewas: true,
        payerPhone: true,
        payerNetwork: true,
        settledAt: true,
        client: { select: { fullName: true } },
      },
    });
    if (!consultation || consultation.settledAt) return null;
    if (
      consultation.status !== ConsultationStatus.PENDING &&
      consultation.status !== ConsultationStatus.ACCEPTED
    ) {
      return null;
    }

    const phone = consultation.payerPhone;
    if (!phone) {
      throw badRequest(
        'This booking has no paying number on file, so the fee cannot be returned automatically.',
      );
    }

    const network = consultation.payerNetwork ?? inferMomoNetwork(phone);
    await tx.consultationRequest.update({
      where: { id: consultation.id },
      data: { settledAt: new Date() },
    });
    const payout = await tx.payout.create({
      data: {
        type: PayoutType.REFUND,
        amountPesewas: consultation.feePesewas,
        destinationPhone: phone,
        destinationNetwork: network,
        consultationId: consultation.id,
      },
      select: { id: true },
    });

    return {
      consultationId: consultation.id,
      clientName: consultation.client.fullName,
      feePesewas: consultation.feePesewas,
      phone,
      network,
      payoutId: payout.id,
    };
  });

  if (!claimed) return false;

  const reference = newPayoutReference('rf', claimed.payoutId);
  try {
    const started = await startPayout({
      accountName: claimed.clientName,
      phone: claimed.phone,
      network: claimed.network ?? undefined,
      amountPesewas: claimed.feePesewas,
      reference,
      description: `LegalConnect refund for consultation ${claimed.consultationId}`,
    });

    await prisma.payout.update({
      where: { id: claimed.payoutId },
      data: {
        paymentReference: started.reference,
        paymentOrderId: started.orderId,
        status: started.captured ? PayoutStatus.PAID : PayoutStatus.PENDING,
      },
    });
    return true;
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM consultation_requests WHERE id = ${claimed.consultationId} FOR UPDATE`;
      await tx.payout.update({
        where: { id: claimed.payoutId },
        data: { status: PayoutStatus.FAILED },
      });
      await tx.consultationRequest.updateMany({
        where: {
          id: claimed.consultationId,
          status: { in: [ConsultationStatus.PENDING, ConsultationStatus.ACCEPTED] },
        },
        data: { settledAt: null },
      });
    });
    throw error;
  }
}

export async function requestWithdrawal(
  userId: string,
  input: WithdrawInput,
): Promise<WithdrawalView> {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      paymentAccountName: true,
      paymentPhone: true,
      paymentNetwork: true,
    },
  });
  if (!profile) throw notFound('You do not have a lawyer profile');

  if (!profile.paymentAccountName || !profile.paymentPhone || !profile.paymentNetwork) {
    throw unprocessable('Save a payment account in Wallet before withdrawing.');
  }

  const amountPesewas = ghsToPesewas(input.amountGhs);

  const withdrawal = await prisma.$transaction(async (tx) => {
    const available = await availableBalance(profile.id, tx);
    if (amountPesewas > available) {
      throw unprocessable('That is more than your available wallet balance.');
    }

    const created = await tx.withdrawalRequest.create({
      data: {
        lawyerProfileId: profile.id,
        amountPesewas,
        status: WithdrawalStatus.PENDING,
      },
      select: { id: true },
    });

    await tx.walletLedger.create({
      data: {
        lawyerProfileId: profile.id,
        amountPesewas: -amountPesewas,
        type: WalletLedgerType.DEBIT,
        withdrawalId: created.id,
      },
    });

    return created;
  });

  const payout = await prisma.payout.create({
    data: {
      type: PayoutType.WITHDRAWAL,
      amountPesewas,
      destinationPhone: profile.paymentPhone,
      destinationNetwork: profile.paymentNetwork,
      withdrawalId: withdrawal.id,
    },
    select: { id: true },
  });

  const reference = newPayoutReference('wd', payout.id);
  try {
    const started = await startPayout({
      accountName: profile.paymentAccountName,
      phone: profile.paymentPhone,
      network: profile.paymentNetwork,
      amountPesewas,
      reference,
      description: `LegalConnect withdrawal for ${profile.displayName}`,
    });

    await prisma.$transaction([
      prisma.payout.update({
        where: { id: payout.id },
        data: {
          paymentReference: started.reference,
          paymentOrderId: started.orderId,
          status: started.captured ? PayoutStatus.PAID : PayoutStatus.PENDING,
        },
      }),
      prisma.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          paymentReference: started.reference,
          paymentOrderId: started.orderId,
          status: started.captured ? WithdrawalStatus.PAID : WithdrawalStatus.PENDING,
        },
      }),
    ]);
  } catch (error) {
    await failWithdrawal(withdrawal.id, profile.id, amountPesewas);
    throw error;
  }

  return prisma.withdrawalRequest.findFirstOrThrow({
    where: { id: withdrawal.id },
    select: withdrawalSelect,
  });
}

export async function capturePayoutCallback(payload: {
  order_id?: string;
  status?: string;
  amount?: string | number;
  reference?: string;
}): Promise<boolean> {
  if (!payload.reference && !payload.order_id) return false;

  const payout = await prisma.payout.findFirst({
    where: {
      OR: [
        ...(payload.reference ? [{ paymentReference: payload.reference }] : []),
        ...(payload.order_id ? [{ paymentOrderId: payload.order_id }] : []),
      ],
    },
    select: {
      id: true,
      type: true,
      status: true,
      amountPesewas: true,
      paymentReference: true,
      paymentOrderId: true,
      consultationId: true,
      withdrawalId: true,
    },
  });
  if (!payout) return false;
  if (payout.status === PayoutStatus.PAID || payout.status === PayoutStatus.FAILED) return true;

  const paid = isPaidStatus(payload.status);
  const amountOk = pesewasFromAmount(payload.amount ?? NaN) === payout.amountPesewas;
  if (!paid || !amountOk) {
    if (payout.withdrawalId) {
      const withdrawal = await prisma.withdrawalRequest.findUnique({
        where: { id: payout.withdrawalId },
        select: { lawyerProfileId: true, amountPesewas: true },
      });
      if (withdrawal) {
        await failWithdrawal(
          payout.withdrawalId,
          withdrawal.lawyerProfileId,
          withdrawal.amountPesewas,
        );
      }
    }
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.FAILED },
    });
    return true;
  }

  const ok = await verifyPayout({
    reference: payout.paymentReference ?? payload.reference ?? '',
    expectedPesewas: payout.amountPesewas,
    orderId: payout.paymentOrderId,
  });
  if (!ok) return true;

  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: PayoutStatus.PAID },
  });

  if (payout.consultationId) {
    await prisma.consultationRequest.updateMany({
      where: { id: payout.consultationId, settledAt: null },
      data: { settledAt: new Date() },
    });
  }

  if (payout.withdrawalId) {
    await prisma.withdrawalRequest.update({
      where: { id: payout.withdrawalId },
      data: { status: WithdrawalStatus.PAID },
    });
  }

  return true;
}

async function failWithdrawal(
  withdrawalId: string,
  lawyerProfileId: string,
  amountPesewas: number,
): Promise<void> {
  const existing = await prisma.withdrawalRequest.findUnique({
    where: { id: withdrawalId },
    select: { status: true },
  });
  if (!existing || existing.status === WithdrawalStatus.FAILED) return;

  await prisma.$transaction([
    prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: { status: WithdrawalStatus.FAILED },
    }),
    prisma.walletLedger.create({
      data: {
        lawyerProfileId,
        amountPesewas,
        type: WalletLedgerType.CREDIT,
        withdrawalId,
      },
    }),
  ]);
}

async function availableBalance(
  lawyerProfileId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const aggregate = await client.walletLedger.aggregate({
    where: { lawyerProfileId },
    _sum: { amountPesewas: true },
  });
  return aggregate._sum.amountPesewas ?? 0;
}
