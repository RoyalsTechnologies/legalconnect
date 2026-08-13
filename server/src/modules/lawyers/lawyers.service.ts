import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { FALLBACK_CATEGORY_NAME } from '../../ai/legal-triage.service.js';
import { notifyLawyerApprovalDecision, notifyLawyerWelcome } from '../../email/notifications.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { ghsToPesewas } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { assertAreaCount, hasActiveSubscription, publicLawyerWhere } from './eligibility.js';
import type {
  AdminUpdateLawyerInput,
  CreateLawyerInput,
  UpdateOwnLawyerProfileInput,
} from './lawyers.schema.js';

const BCRYPT_COST = 12;

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

// No passwordHash, and no account email for ordinary callers — a directory listing
// should not hand out contact details before a consultation has been accepted.
const lawyerFields = {
  id: true,
  displayName: true,
  firmName: true,
  bio: true,
  licenseNumber: true,
  city: true,
  region: true,
  isAvailable: true,
  approvalStatus: true,
  yearsExperience: true,
  consultationFeePesewas: true,
  subscriptionPeriodEnd: true,
  createdAt: true,
  subscriptionPackage: { select: packageFields },
  practiceAreas: {
    select: { legalCategory: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.LawyerProfileSelect;

type LawyerRow = Prisma.LawyerProfileGetPayload<{ select: typeof lawyerFields }>;

export type LawyerView = Omit<LawyerRow, 'subscriptionPackage' | 'subscriptionPeriodEnd'> & {
  subscription: {
    active: boolean;
    periodEnd: Date | null;
    package: LawyerRow['subscriptionPackage'];
  };
};

export function presentLawyer(row: LawyerRow): LawyerView {
  const { subscriptionPackage, subscriptionPeriodEnd, ...rest } = row;
  return {
    ...rest,
    subscription: {
      active: hasActiveSubscription({
        subscriptionPackageId: subscriptionPackage?.id ?? null,
        subscriptionPeriodEnd,
      }),
      periodEnd: subscriptionPeriodEnd,
      package: subscriptionPackage,
    },
  };
}

/** `null` is an anonymous visitor, who gets exactly the same view as a citizen. */
function scopeFor(role: Role | null): Prisma.LawyerProfileWhereInput {
  return role === Role.ADMIN ? {} : publicLawyerWhere();
}

/**
 * Creates a lawyer account and its profile in one transaction.
 *
 * Admins can still provision accounts (welcome email with a temporary password).
 * Practitioners can also self-register via POST /auth/register; those profiles
 * always start PENDING until an admin approves them (ADR-006).
 */
export async function createLawyer(input: CreateLawyerInput): Promise<LawyerView> {
  await assertPracticeAreas(input.practiceAreaIds);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const profile = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone ?? null,
          role: Role.LAWYER,
          // Admin-created accounts are trusted; the welcome email carries credentials.
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });

      return tx.lawyerProfile.create({
        data: {
          userId: user.id,
          displayName: input.displayName,
          firmName: input.firmName ?? null,
          bio: input.bio,
          licenseNumber: input.licenseNumber ?? null,
          city: input.city,
          region: input.region,
          yearsExperience: input.yearsExperience ?? null,
          consultationFeePesewas: ghsToPesewas(input.consultationFeeGhs),
          approvalStatus: input.approvalStatus,
          practiceAreas: {
            create: input.practiceAreaIds.map((legalCategoryId) => ({ legalCategoryId })),
          },
        },
        select: lawyerFields,
      });
    });

    notifyLawyerWelcome({
      email: input.email,
      fullName: input.fullName,
      temporaryPassword: input.password,
    });

    return presentLawyer(profile);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('An account with this email already exists');
    }
    throw error;
  }
}

export interface LawyerFilters {
  categoryId?: string;
  region?: string;
  available?: boolean;
  q?: string;
  limit: number;
  offset: number;
}

export interface LawyerPage {
  results: LawyerView[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * FR-012 — the browsable directory.
 *
 * Paginated because an unbounded list is a latency problem waiting to happen
 * (NFR-006). Searching covers display name, firm, and bio, since someone looking for
 * "unpaid salary" is describing a problem rather than naming a person.
 */
export async function listLawyers(role: Role | null, filters: LawyerFilters): Promise<LawyerPage> {
  const where: Prisma.LawyerProfileWhereInput = {
    ...scopeFor(role),
    ...(filters.categoryId
      ? { practiceAreas: { some: { legalCategoryId: filters.categoryId } } }
      : {}),
    ...(filters.region ? { region: { equals: filters.region, mode: 'insensitive' } } : {}),
    ...(filters.available !== undefined ? { isAvailable: filters.available } : {}),
    ...(filters.q
      ? {
          OR: [
            { displayName: { contains: filters.q, mode: 'insensitive' } },
            { firmName: { contains: filters.q, mode: 'insensitive' } },
            { bio: { contains: filters.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [results, total] = await prisma.$transaction([
    prisma.lawyerProfile.findMany({
      where,
      select: lawyerFields,
      // Secondary sort on id so pagination is stable when display names collide.
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: filters.limit,
      skip: filters.offset,
    }),
    prisma.lawyerProfile.count({ where }),
  ]);

  return {
    results: results.map(presentLawyer),
    total,
    limit: filters.limit,
    offset: filters.offset,
  };
}

/**
 * Reads one profile.
 *
 * An unapproved profile returns 404 rather than 403 for non-admins: whether a
 * particular person has a pending application here is not something a stranger
 * should be able to confirm.
 */
export async function getLawyer(id: string, role: Role | null): Promise<LawyerView> {
  const lawyer = await prisma.lawyerProfile.findFirst({
    where: { id, ...scopeFor(role) },
    select: lawyerFields,
  });

  if (!lawyer) throw notFound('Lawyer not found');
  return presentLawyer(lawyer);
}

export async function getOwnProfile(userId: string): Promise<LawyerView> {
  const lawyer = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: lawyerFields,
  });

  if (!lawyer) throw notFound('You do not have a lawyer profile');
  return presentLawyer(lawyer);
}

export async function updateOwnProfile(
  userId: string,
  input: UpdateOwnLawyerProfileInput,
): Promise<LawyerView> {
  const existing = await prisma.lawyerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!existing) throw notFound('You do not have a lawyer profile');

  return applyUpdate(existing.id, input);
}

export async function adminUpdateLawyer(
  id: string,
  input: AdminUpdateLawyerInput,
): Promise<LawyerView> {
  const existing = await prisma.lawyerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      approvalStatus: true,
      displayName: true,
      user: { select: { email: true, fullName: true } },
    },
  });
  if (!existing) throw notFound('Lawyer not found');

  const updated = await applyUpdate(id, input);

  if (input.approvalStatus && input.approvalStatus !== existing.approvalStatus) {
    notifyLawyerApprovalDecision({
      email: existing.user.email,
      fullName: existing.user.fullName,
      approvalStatus: input.approvalStatus,
    });
  }

  return updated;
}

async function applyUpdate(profileId: string, input: AdminUpdateLawyerInput): Promise<LawyerView> {
  if (input.practiceAreaIds) {
    await assertPracticeAreas(input.practiceAreaIds);

    const current = await prisma.lawyerProfile.findUniqueOrThrow({
      where: { id: profileId },
      select: {
        subscriptionPeriodEnd: true,
        subscriptionPackage: { select: { id: true, name: true, maxPracticeAreas: true } },
      },
    });

    // Cap only applies while the plan is live. An unsubscribed lawyer can still
    // prepare their areas; they will be checked again at subscribe time (FR-018).
    if (
      hasActiveSubscription({
        subscriptionPackageId: current.subscriptionPackage?.id ?? null,
        subscriptionPeriodEnd: current.subscriptionPeriodEnd,
      }) &&
      current.subscriptionPackage
    ) {
      assertAreaCount(
        input.practiceAreaIds.length,
        current.subscriptionPackage.maxPracticeAreas,
        current.subscriptionPackage.name,
      );
    }
  }

  const updated = await prisma.lawyerProfile.update({
    where: { id: profileId },
    data: {
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.firmName !== undefined && { firmName: input.firmName }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.licenseNumber !== undefined && { licenseNumber: input.licenseNumber }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.region !== undefined && { region: input.region }),
      ...(input.isAvailable !== undefined && { isAvailable: input.isAvailable }),
      ...(input.yearsExperience !== undefined && { yearsExperience: input.yearsExperience }),
      ...(input.consultationFeeGhs !== undefined && {
        consultationFeePesewas: ghsToPesewas(input.consultationFeeGhs),
      }),
      ...(input.approvalStatus !== undefined && { approvalStatus: input.approvalStatus }),

      // Replace rather than merge: the client sends the full set it wants, which
      // makes removing an area possible without a separate endpoint.
      ...(input.practiceAreaIds && {
        practiceAreas: {
          deleteMany: {},
          create: input.practiceAreaIds.map((legalCategoryId) => ({ legalCategoryId })),
        },
      }),
    },
    select: lawyerFields,
  });

  return presentLawyer(updated);
}

// Checked up front so a bad id produces a clear 400 naming the problem, rather than
// a foreign-key violation surfacing as a 500.
export async function assertPracticeAreas(ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  const found = await prisma.legalCategory.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { name: true },
  });

  if (found.length !== unique.length) {
    throw badRequest('One or more practice areas are not valid active legal categories');
  }

  // "Other / Needs Review" is the holding category the AI fallback assigns, not a
  // field of law. Matching skips it by design (FR-010), so a lawyer who selected it
  // would receive nothing from it — a setting that silently does nothing is worse
  // than one that is refused.
  if (found.some((category) => category.name === FALLBACK_CATEGORY_NAME)) {
    throw badRequest(`"${FALLBACK_CATEGORY_NAME}" cannot be selected as a practice area`);
  }
}
