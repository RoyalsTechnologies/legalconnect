import { type Role, UserStatus } from '@prisma/client';
import type { RequestHandler } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

// Authorization is always enforced server-side (NFR-001). The user is re-read on
// every request so a suspended account loses access immediately rather than when
// its token happens to expire.
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  const token = header.slice('Bearer '.length).trim();
  if (!token) throw unauthorized();

  const payload = verifyToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true },
  });

  if (!user) throw unauthorized('Account no longer exists');
  if (user.status === UserStatus.SUSPENDED) throw forbidden('Account suspended');

  req.user = { id: user.id, role: user.role };
  next();
});

/**
 * Attaches the caller if they present a usable session, and carries on regardless.
 *
 * For routes that anyone may read but whose *contents* depend on who is asking — the
 * lawyer directory returns approved profiles to the public and every profile to an
 * admin. A bad, expired, or suspended session degrades to anonymous rather than
 * failing, because the resource is public either way and refusing it would be a worse
 * answer than the one the visitor is entitled to. Degrading can only ever narrow what
 * is returned: anonymous is the most restrictive scope there is.
 */
export const optionalAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  const token = header.slice('Bearer '.length).trim();
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });

    if (user && user.status !== UserStatus.SUSPENDED) {
      req.user = { id: user.id, role: user.role };
    }
  } catch {
    // Deliberately swallowed. The caller stays anonymous and still gets the public
    // view; protected routes elsewhere continue to reject the same token loudly.
  }

  next();
});

export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.role)) return next(forbidden());
    next();
  };
