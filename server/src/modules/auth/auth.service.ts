import { ApprovalStatus, EmailTokenType, Prisma, Role, UserStatus } from '@prisma/client';
import { isTest } from '../../config/env.js';
import { appUrl, consumeEmailToken, issueEmailToken, sendEmail } from '../../email/mailer.js';
import { passwordResetEmail, verificationEmail } from '../../email/templates.js';
import { bcrypt } from '../../lib/cjs-default.js';
import { badRequest, conflict, forbidden, unauthorized } from '../../lib/errors.js';
import { signToken } from '../../lib/jwt.js';
import { log } from '../../lib/logger.js';
import { ghsToPesewas } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { assertPracticeAreas } from '../lawyers/lawyers.service.js';
import type {
  ChangePasswordInput,
  EmailOnlyInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TokenInput,
} from './auth.schema.js';

const BCRYPT_COST = 12;

// Selected explicitly everywhere so passwordHash can never leak into a response.
const publicUserFields = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserFields }>;

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface RegisterResult {
  message: string;
  email: string;
}

async function sendVerification(user: { id: string; email: string; fullName: string }) {
  const raw = await issueEmailToken(user.id, EmailTokenType.VERIFY_EMAIL);
  await sendEmail(
    verificationEmail({
      to: user.email,
      fullName: user.fullName,
      verifyUrl: appUrl(`/verify-email?token=${encodeURIComponent(raw)}`),
    }),
    true,
  );
}

/**
 * Public registration creates a USER (citizen) or a LAWYER with a PENDING profile.
 * ADMIN cannot be chosen here (SEC-LG-011). Approval is never taken from the payload.
 *
 * Outside tests the account starts unverified and no JWT is issued — the person
 * must confirm their email first. In NODE_ENV=test we mark the account verified
 * and return a session so existing API tests keep working without an SMTP round-trip.
 */
export async function register(input: RegisterInput): Promise<RegisterResult | AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const verifiedNow = isTest ? new Date() : null;
  const asLawyer = input.accountType === 'lawyer';

  if (asLawyer) {
    await assertPracticeAreas(input.practiceAreaIds ?? []);
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone ?? null,
          role: asLawyer ? Role.LAWYER : Role.USER,
          emailVerifiedAt: verifiedNow,
        },
        select: publicUserFields,
      });

      if (asLawyer) {
        await tx.lawyerProfile.create({
          data: {
            userId: created.id,
            displayName: input.displayName ?? input.fullName,
            firmName: input.firmName ?? null,
            bio: input.bio ?? '',
            licenseNumber: input.licenseNumber ?? null,
            city: input.city ?? '',
            region: input.region ?? '',
            yearsExperience: input.yearsExperience ?? null,
            consultationFeePesewas: ghsToPesewas(input.consultationFeeGhs ?? 200),
            approvalStatus: ApprovalStatus.PENDING,
            practiceAreas: {
              create: (input.practiceAreaIds ?? []).map((legalCategoryId) => ({
                legalCategoryId,
              })),
            },
          },
        });
      }

      return created;
    });

    if (isTest) {
      return { user, token: signToken({ sub: user.id, role: user.role }) };
    }

    await sendVerification({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    });

    return {
      email: user.email,
      message: asLawyer
        ? 'Account created. Confirm your email, then an administrator will review your profile before it appears in the directory.'
        : 'Account created. Check your email to confirm your address before signing in.',
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('An account with this email already exists');
    }
    throw error;
  }
}

export async function verifyEmail(input: TokenInput): Promise<{ message: string }> {
  const consumed = await consumeEmailToken(input.token, EmailTokenType.VERIFY_EMAIL);
  if (!consumed) throw badRequest('This confirmation link is invalid or has expired');

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return { message: 'Email confirmed. You can sign in now.' };
}

/**
 * Always 204-shaped success from the route. Existence is not revealed.
 */
export async function resendVerification(input: EmailOnlyInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, fullName: true, emailVerifiedAt: true, status: true },
  });

  if (!user || user.emailVerifiedAt || user.status === UserStatus.SUSPENDED) return;

  try {
    await sendVerification(user);
  } catch (error) {
    // Do not leak whether the address exists via a 503 on the resend path either —
    // log and swallow. The user can try again.
    log.security.error('resend verification failed', error);
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // An unknown email and a wrong password must be indistinguishable, otherwise
  // the endpoint becomes an account-enumeration oracle. The dummy comparison
  // keeps timing similar when no user exists.
  if (!user) {
    await bcrypt.compare(
      input.password,
      '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva',
    );
    throw unauthorized('Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) throw unauthorized('Invalid email or password');

  if (user.status === UserStatus.SUSPENDED) throw forbidden('Account suspended');

  if (!user.emailVerifiedAt) {
    throw forbidden(
      'Confirm your email before signing in. Check your inbox, or request a new confirmation link.',
    );
  }

  log.security.info('login succeeded', { userId: user.id, role: user.role });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    },
    token: signToken({ sub: user.id, role: user.role }),
  };
}

/** Always succeeds from the caller's perspective (anti-enumeration). */
export async function forgotPassword(input: EmailOnlyInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, fullName: true, status: true },
  });

  if (!user || user.status === UserStatus.SUSPENDED) return;

  try {
    const raw = await issueEmailToken(user.id, EmailTokenType.RESET_PASSWORD);
    await sendEmail(
      passwordResetEmail({
        to: user.email,
        fullName: user.fullName,
        resetUrl: appUrl(`/reset-password?token=${encodeURIComponent(raw)}`),
      }),
      true,
    );
  } catch (error) {
    log.security.error('forgot-password send failed', error);
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
  const consumed = await consumeEmailToken(input.token, EmailTokenType.RESET_PASSWORD);
  if (!consumed) throw badRequest('This reset link is invalid or has expired');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: consumed.userId },
      data: {
        passwordHash,
        // Completing a reset proves control of the inbox.
        emailVerifiedAt: new Date(),
      },
    }),
    prisma.emailToken.updateMany({
      where: { userId: consumed.userId, type: EmailTokenType.RESET_PASSWORD, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return { message: 'Password updated. You can sign in with your new password.' };
}

/**
 * Signed-in password change (FR-003). Requires the current password so a stolen
 * session alone cannot silently replace credentials. Outstanding reset tokens
 * are consumed so an earlier forgot-password email cannot undo the change.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw unauthorized();

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) throw unauthorized('Current password is incorrect');

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.emailToken.updateMany({
      where: { userId, type: EmailTokenType.RESET_PASSWORD, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return { message: 'Password updated.' };
}

export { publicUserFields };
