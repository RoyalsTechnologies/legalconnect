import { ApprovalStatus, type Prisma, UserStatus } from '@prisma/client';
import { unprocessable } from '../../lib/errors.js';

/**
 * Public directory, matching, and consultation booking share this gate so a
 * lawyer cannot appear in one place and vanish from another (FR-011, FR-012, FR-018).
 *
 * Approval, account status, and an unexpired subscription are all mandatory.
 * Availability stays a ranking factor, not an eligibility rule.
 */
export function publicLawyerWhere(now = new Date()): Prisma.LawyerProfileWhereInput {
  return {
    approvalStatus: ApprovalStatus.APPROVED,
    user: { status: UserStatus.ACTIVE },
    subscriptionPackageId: { not: null },
    subscriptionPeriodEnd: { gt: now },
  };
}

export function hasActiveSubscription(
  profile: { subscriptionPackageId: string | null; subscriptionPeriodEnd: Date | null },
  now = new Date(),
): boolean {
  return Boolean(
    profile.subscriptionPackageId &&
      profile.subscriptionPeriodEnd &&
      profile.subscriptionPeriodEnd > now,
  );
}

export function assertAreaCount(count: number, max: number, packageName: string): void {
  if (count <= max) return;
  const extra = count - max;
  throw unprocessable(
    `The ${packageName} plan allows ${max} practice area${max === 1 ? '' : 's'}. Remove ${extra} before continuing.`,
    { practiceAreaIds: `Select at most ${max}` },
  );
}
