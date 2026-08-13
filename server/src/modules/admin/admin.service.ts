import {
  AiStatus,
  ApprovalStatus,
  ConsultationStatus,
  type Prisma,
  type Role,
  UserStatus,
} from '@prisma/client';
import { badRequest, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

const adminUserFields = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  lawyerProfile: { select: { id: true, displayName: true, approvalStatus: true } },
} satisfies Prisma.UserSelect;

export type AdminUserView = Prisma.UserGetPayload<{ select: typeof adminUserFields }>;

export interface ListUsersFilters {
  role?: Role;
  status?: UserStatus;
  q?: string;
}

export async function listUsers(filters: ListUsersFilters): Promise<AdminUserView[]> {
  return prisma.user.findMany({
    where: {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { fullName: { contains: filters.q, mode: 'insensitive' } },
              { email: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: adminUserFields,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Suspends or reactivates an account.
 *
 * An admin cannot suspend themselves. Without that check a single administrator could
 * lock the platform's only administrative account and leave no way back in through
 * the API.
 */
export async function setUserStatus(
  targetUserId: string,
  actingAdminId: string,
  status: UserStatus,
): Promise<AdminUserView> {
  if (targetUserId === actingAdminId) {
    throw badRequest('You cannot change the status of your own account');
  }

  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!existing) throw notFound('User not found');

  return prisma.user.update({
    where: { id: targetUserId },
    data: { status },
    select: adminUserFields,
  });
}

export interface PlatformStats {
  users: { total: number; suspended: number };
  lawyers: { total: number; approved: number; pending: number; subscribed: number };
  categories: { active: number };
  intakes: { total: number; needsReview: number; aiFallback: number };
  consultations: { total: number; pending: number };
}

/**
 * Dashboard counters.
 *
 * `aiFallback` is the closest thing the platform has to AI observability — a rising
 * count means the provider is degraded. It is a query rather than a metric because no
 * aggregation exists yet (TD-014).
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const [
    totalUsers,
    suspendedUsers,
    totalLawyers,
    approvedLawyers,
    pendingLawyers,
    subscribedLawyers,
    activeCategories,
    totalIntakes,
    needsReview,
    aiFallback,
    totalConsultations,
    pendingConsultations,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
    prisma.lawyerProfile.count(),
    prisma.lawyerProfile.count({ where: { approvalStatus: ApprovalStatus.APPROVED } }),
    prisma.lawyerProfile.count({ where: { approvalStatus: ApprovalStatus.PENDING } }),
    prisma.lawyerProfile.count({
      where: {
        subscriptionPackageId: { not: null },
        subscriptionPeriodEnd: { gt: new Date() },
      },
    }),
    prisma.legalCategory.count({ where: { isActive: true } }),
    prisma.legalIntake.count(),
    prisma.legalIntake.count({ where: { needsHumanReview: true } }),
    prisma.legalIntake.count({ where: { aiStatus: AiStatus.FAILED_FALLBACK } }),
    prisma.consultationRequest.count(),
    prisma.consultationRequest.count({ where: { status: ConsultationStatus.PENDING } }),
  ]);

  return {
    users: { total: totalUsers, suspended: suspendedUsers },
    lawyers: {
      total: totalLawyers,
      approved: approvedLawyers,
      pending: pendingLawyers,
      subscribed: subscribedLawyers,
    },
    categories: { active: activeCategories },
    intakes: { total: totalIntakes, needsReview, aiFallback },
    consultations: { total: totalConsultations, pending: pendingConsultations },
  };
}
