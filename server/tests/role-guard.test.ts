import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/lib/errors.js';
import { requireRole } from '../src/middleware/auth.js';

// requireRole is unit-tested here because no role-restricted route exists yet;
// admin and lawyer routes arrive in Phases 3 and 8 and will exercise it end to end.
function invoke(guard: ReturnType<typeof requireRole>, user?: { id: string; role: Role }) {
  const req = { user } as Request;
  const next = vi.fn();
  guard(req, {} as Response, next);
  return next;
}

describe('NFR-001 role guard', () => {
  it('UT-011: allows a caller holding the required role', () => {
    const next = invoke(requireRole(Role.ADMIN), { id: 'u1', role: Role.ADMIN });

    expect(next).toHaveBeenCalledWith();
  });

  it('UT-012: allows a caller holding any one of several accepted roles', () => {
    const next = invoke(requireRole(Role.ADMIN, Role.LAWYER), { id: 'u1', role: Role.LAWYER });

    expect(next).toHaveBeenCalledWith();
  });

  it('SEC-LG-003: rejects a USER with 403 on an admin-only guard', () => {
    const next = invoke(requireRole(Role.ADMIN), { id: 'u1', role: Role.USER });

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it('UT-013: rejects an unauthenticated caller with 401 rather than 403', () => {
    const next = invoke(requireRole(Role.ADMIN));

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.statusCode).toBe(401);
  });
});
