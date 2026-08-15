import { signToken } from '../src/lib/jwt.js';
import { prisma } from './setup.js';

/**
 * Mints a session for an existing account without posting to `/auth/login`.
 *
 * Fixtures used to sign in over HTTP, which made tests of unrelated endpoints depend on
 * the sign-in endpoint working. On 2026-08-15 that dependency failed twice in five full
 * runs: a sign-in returned no token, the fixture handed on `undefined`, and the test
 * reported a 401 against the endpoint it was actually exercising — once in
 * `subscriptions.test.ts` and once in `lawyers.test.ts`, each time pointing at code that
 * was working correctly. Sign-in itself is covered by `auth.test.ts`, so nothing is lost
 * by keeping it out of everyone else's setup.
 */
export async function sessionFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true },
  });

  return signToken({ sub: user.id, role: user.role });
}
