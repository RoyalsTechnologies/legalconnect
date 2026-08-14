import type { Role } from '@prisma/client';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { jwt } from './cjs-default.js';
import { unauthorized } from './errors.js';

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  let decoded: string | JwtPayload;

  // Only the signature check belongs in the try. Shape validation is deliberately
  // outside it, because a throw inside would be caught by this same handler and
  // reported as a signature failure.
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw unauthorized('Session expired');
    throw unauthorized('Invalid token');
  }

  if (typeof decoded === 'string' || !decoded.sub || !('role' in decoded)) {
    throw unauthorized('Malformed token');
  }

  return { sub: String(decoded.sub), role: decoded.role as Role };
}
