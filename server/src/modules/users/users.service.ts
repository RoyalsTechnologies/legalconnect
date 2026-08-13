import { notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { type PublicUser, publicUserFields } from '../auth/auth.service.js';
import type { UpdateProfileInput } from './users.schema.js';

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserFields,
  });
  if (!user) throw notFound('User not found');
  return user;
}

// Scoped by id from the verified token, so a user can only ever update their own
// record — there is no route that takes a target user id.
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.phone !== undefined && { phone: input.phone }),
    },
    select: publicUserFields,
  });
}

/** Keeps the number used to pay on the account so the next booking can reuse it. */
export async function rememberPhone(userId: string, phone: string | null | undefined): Promise<void> {
  if (!phone) return;
  await prisma.user.update({ where: { id: userId }, data: { phone } });
}
