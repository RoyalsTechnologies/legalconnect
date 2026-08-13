import { Prisma, Role, SubscriptionPaymentStatus } from '@prisma/client';
import { isNaloPayConfigured, isTest } from '../../config/env.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { ghsToPesewas } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import {
  isPaidStatus,
  newPaymentReference,
  pesewasFromAmount,
  startPayment,
  verifyPayment,
} from '../../payments/nalopay.js';
import { assertAreaCount, hasActiveSubscription } from '../lawyers/eligibility.js';
import { rememberPaymentAccount } from '../lawyers/lawyers.service.js';
import { rememberPhone } from '../users/users.service.js';
import type {
  ConfirmSubscriptionInput,
  CreatePackageInput,
  GrantSubscriptionInput,
  SubscribeInput,
  UpdatePackageInput,
} from './subscriptions.schema.js';

/** Prepaid month. Recurring collection is deferred (TD-026). */
export const PERIOD_DAYS = 30;
/** Prepaid year at twelve times the current monthly fee. */
export const YEAR_DAYS = 365;
export const MONTHS_PER_YEAR = 12;

export type BillingInterval = 'month' | 'year';

export function quoteForInterval(
  monthlyFeePesewas: number,
  interval: BillingInterval,
): { feePesewas: number; periodDays: number } {
  if (interval === 'year') {
    return { feePesewas: monthlyFeePesewas * MONTHS_PER_YEAR, periodDays: YEAR_DAYS };
  }
  return { feePesewas: monthlyFeePesewas, periodDays: PERIOD_DAYS };
}

const packageFields = {
  id: true,
  name: true,
  slug: true,
  description: true,
  monthlyFeePesewas: true,
  maxPracticeAreas: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.SubscriptionPackageSelect;

export type PackageView = Prisma.SubscriptionPackageGetPayload<{ select: typeof packageFields }>;

export type SubscriptionView = {
  active: boolean;
  periodEnd: Date | null;
  package: PackageView | null;
};

export type SubscribeStartView = {
  subscription: SubscriptionView;
  authorizationUrl: string | null;
  paymentHint: string | null;
  reference: string | null;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function periodEndFrom(start: Date, days: number): Date {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

export function toSubscriptionView(profile: {
  subscriptionPeriodEnd: Date | null;
  subscriptionPackage: PackageView | null;
}): SubscriptionView {
  const pkg = profile.subscriptionPackage;
  return {
    active: hasActiveSubscription({
      subscriptionPackageId: pkg?.id ?? null,
      subscriptionPeriodEnd: profile.subscriptionPeriodEnd,
    }),
    periodEnd: profile.subscriptionPeriodEnd,
    package: pkg,
  };
}

export async function listPackages(role: Role | null): Promise<PackageView[]> {
  return prisma.subscriptionPackage.findMany({
    where: role === Role.ADMIN ? {} : { isActive: true },
    select: packageFields,
    orderBy: { maxPracticeAreas: 'asc' },
  });
}

export async function createPackage(input: CreatePackageInput): Promise<PackageView> {
  const slug = slugify(input.name);
  if (!slug) throw conflict('Package name must contain at least one letter or number');

  try {
    return await prisma.subscriptionPackage.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        monthlyFeePesewas: ghsToPesewas(input.monthlyFeeGhs),
        maxPracticeAreas: input.maxPracticeAreas,
      },
      select: packageFields,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('A package with this name already exists');
    }
    throw error;
  }
}

export async function updatePackage(id: string, input: UpdatePackageInput): Promise<PackageView> {
  const existing = await prisma.subscriptionPackage.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw notFound('Package not found');

  try {
    return await prisma.subscriptionPackage.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name, slug: slugify(input.name) }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.monthlyFeeGhs !== undefined && {
          monthlyFeePesewas: ghsToPesewas(input.monthlyFeeGhs),
        }),
        ...(input.maxPracticeAreas !== undefined && { maxPracticeAreas: input.maxPracticeAreas }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: packageFields,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('A package with this name already exists');
    }
    throw error;
  }
}

async function loadPackage(id: string, mustBeActive: boolean): Promise<PackageView> {
  const pkg = await prisma.subscriptionPackage.findFirst({
    where: { id, ...(mustBeActive ? { isActive: true } : {}) },
    select: packageFields,
  });
  if (!pkg) throw notFound('Package not found');
  return pkg;
}

async function assertFitsCurrentAreas(lawyerProfileId: string, pkg: PackageView): Promise<void> {
  const count = await prisma.lawyerPracticeArea.count({ where: { lawyerProfileId } });
  assertAreaCount(count, pkg.maxPracticeAreas, pkg.name);
}

async function activatePlan(
  lawyerProfileId: string,
  pkg: PackageView,
  days: number,
): Promise<SubscriptionView> {
  const updated = await prisma.lawyerProfile.update({
    where: { id: lawyerProfileId },
    data: {
      subscriptionPackageId: pkg.id,
      subscriptionPeriodEnd: periodEndFrom(new Date(), days),
    },
    select: {
      subscriptionPeriodEnd: true,
      subscriptionPackage: { select: packageFields },
    },
  });
  return toSubscriptionView(updated);
}

/**
 * Admin grant — no payment. Used for demo accounts and for waiving a month.
 * The lawyer still cannot list more areas than the package allows.
 */
export async function grantSubscription(
  lawyerProfileId: string,
  input: GrantSubscriptionInput,
): Promise<SubscriptionView> {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { id: lawyerProfileId },
    select: { id: true },
  });
  if (!profile) throw notFound('Lawyer not found');

  const pkg = await loadPackage(input.packageId, false);
  await assertFitsCurrentAreas(lawyerProfileId, pkg);
  return activatePlan(lawyerProfileId, pkg, input.periodDays);
}

export async function startSubscription(
  userId: string,
  input: SubscribeInput,
): Promise<SubscribeStartView> {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      paymentAccountName: true,
      paymentPhone: true,
      paymentNetwork: true,
      user: { select: { fullName: true, phone: true } },
    },
  });
  if (!profile) throw notFound('You do not have a lawyer profile');

  const pkg = await loadPackage(input.packageId, true);
  await assertFitsCurrentAreas(profile.id, pkg);

  const quote = quoteForInterval(pkg.monthlyFeePesewas, input.interval);
  const termLabel = input.interval === 'year' ? '1 year' : '1 month';

  const phone = input.phone ?? profile.paymentPhone ?? profile.user.phone;
  const network = input.network ?? profile.paymentNetwork ?? undefined;
  if (!isTest && isNaloPayConfigured && !phone) {
    throw badRequest(
      'Enter the mobile money number you will pay from, or save a payment account in Wallet.',
    );
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      lawyerProfileId: profile.id,
      packageId: pkg.id,
      feePesewas: quote.feePesewas,
      periodDays: quote.periodDays,
    },
    select: { id: true },
  });

  const reference = newPaymentReference(payment.id);
  const started = await startPayment({
    accountName: profile.paymentAccountName ?? profile.user.fullName,
    phone: phone ?? '',
    network,
    amountPesewas: quote.feePesewas,
    reference,
    description: `LegalConnect ${pkg.name} plan (${termLabel}) — ${profile.displayName}`,
  });

  await rememberPhone(userId, input.phone ?? phone);
  if (phone) {
    await rememberPaymentAccount(profile.id, {
      accountName: profile.paymentAccountName ?? profile.user.fullName,
      phone,
      network,
    });
  }

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      paymentReference: started.reference,
      paymentOrderId: started.orderId,
    },
  });

  if (started.captured) {
    const subscription = await markSubscriptionPaid(payment.id);
    return {
      subscription,
      authorizationUrl: null,
      paymentHint: null,
      reference: started.reference,
    };
  }

  const current = await prisma.lawyerProfile.findUniqueOrThrow({
    where: { id: profile.id },
    select: {
      subscriptionPeriodEnd: true,
      subscriptionPackage: { select: packageFields },
    },
  });

  return {
    subscription: toSubscriptionView(current),
    authorizationUrl: started.authorizationUrl,
    paymentHint: started.paymentHint,
    reference: started.reference,
  };
}

export async function confirmSubscription(
  userId: string,
  input: ConfirmSubscriptionInput,
): Promise<SubscriptionView> {
  const profile = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw notFound('You do not have a lawyer profile');

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { paymentReference: input.reference, lawyerProfileId: profile.id },
    select: {
      id: true,
      status: true,
      feePesewas: true,
      paymentReference: true,
      paymentOrderId: true,
    },
  });
  if (!payment) throw notFound('Payment not found');

  if (payment.status === SubscriptionPaymentStatus.PAID) {
    const current = await prisma.lawyerProfile.findUniqueOrThrow({
      where: { id: profile.id },
      select: {
        subscriptionPeriodEnd: true,
        subscriptionPackage: { select: packageFields },
      },
    });
    return toSubscriptionView(current);
  }

  const ok = await verifyPayment({
    reference: input.reference,
    expectedPesewas: payment.feePesewas,
    orderId: payment.paymentOrderId,
  });
  if (!ok) {
    throw badRequest(
      'Payment has not been confirmed yet. Approve the prompt on your phone, then try again.',
    );
  }

  return markSubscriptionPaid(payment.id);
}

export async function capturePaidCallback(payload: {
  order_id?: string;
  status?: string;
  amount?: string | number;
  reference?: string;
}): Promise<boolean> {
  if (!isPaidStatus(payload.status)) return false;

  const reference = payload.reference;
  const orderId = payload.order_id;
  if (!reference && !orderId) return false;

  const payment = await prisma.subscriptionPayment.findFirst({
    where: {
      status: SubscriptionPaymentStatus.PENDING,
      OR: [
        ...(reference ? [{ paymentReference: reference }] : []),
        ...(orderId ? [{ paymentOrderId: orderId }] : []),
      ],
    },
    select: { id: true, feePesewas: true },
  });

  if (!payment) return false;

  const paidPesewas = pesewasFromAmount(payload.amount ?? NaN);
  if (paidPesewas !== payment.feePesewas) {
    console.error('[payments] subscription callback amount mismatch', payment.id);
    return true;
  }

  await markSubscriptionPaid(payment.id);
  return true;
}

async function markSubscriptionPaid(paymentId: string): Promise<SubscriptionView> {
  const payment = await prisma.subscriptionPayment.findUniqueOrThrow({
    where: { id: paymentId },
    select: {
      id: true,
      lawyerProfileId: true,
      periodDays: true,
      package: { select: packageFields },
    },
  });

  const claimed = await prisma.subscriptionPayment.updateMany({
    where: { id: payment.id, status: SubscriptionPaymentStatus.PENDING },
    data: { status: SubscriptionPaymentStatus.PAID },
  });

  if (claimed.count !== 1) {
    const current = await prisma.lawyerProfile.findUniqueOrThrow({
      where: { id: payment.lawyerProfileId },
      select: {
        subscriptionPeriodEnd: true,
        subscriptionPackage: { select: packageFields },
      },
    });
    return toSubscriptionView(current);
  }

  return activatePlan(payment.lawyerProfileId, payment.package, payment.periodDays);
}
