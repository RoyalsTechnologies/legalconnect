import type { Response } from 'supertest';
import { signToken } from '../src/lib/jwt.js';
import { prisma } from './setup.js';

/**
 * Reads a token out of a registration or sign-in response, refusing to hand on `undefined`.
 *
 * A fixture that passes a missing token into the next request produces a `401` against
 * whatever that request was testing, which is a report about the wrong endpoint. Failing
 * here instead names the response that actually went wrong — the diagnostic TD-033 has
 * been missing at every occurrence.
 */
export function tokenFrom(response: Response, what: string): string {
  const token: unknown = response.body?.token;

  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(
      `${what} returned no token: status ${response.status}, body ${JSON.stringify(response.body)}`,
    );
  }

  return token;
}

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
