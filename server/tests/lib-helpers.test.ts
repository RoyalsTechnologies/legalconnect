import { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { env } from '../src/config/env.js';
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
  unauthorized,
  unprocessable,
} from '../src/lib/errors.js';
import { formatAccraSlot, isGoogleMeetUrl } from '../src/lib/google-calendar.js';
import { signToken, verifyToken } from '../src/lib/jwt.js';
import { formatGhs, ghsToPesewas, pesewasToGhs } from '../src/lib/money.js';
import { disconnectPrisma } from '../src/lib/prisma.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { validateBody, validateParams, validateQuery } from '../src/middleware/validate.js';
import {
  assertAreaCount,
  hasActiveSubscription,
  publicLawyerWhere,
} from '../src/modules/lawyers/eligibility.js';

describe('money helpers', () => {
  it('round-trips cedis through pesewas and formats for display', () => {
    expect(ghsToPesewas(50)).toBe(5000);
    expect(pesewasToGhs(5000)).toBe(50);
    expect(formatGhs(20000)).toBe('GH₵ 200.00');
  });
});

describe('errors', () => {
  it('builds the standard AppError helpers', () => {
    expect(serviceUnavailable('try later')).toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(badRequest('no')).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
    expect(unauthorized()).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    expect(forbidden()).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(notFound()).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(conflict('taken')).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(unprocessable('nope', { field: 'x' })).toMatchObject({
      statusCode: 422,
      code: 'UNPROCESSABLE_ENTITY',
      details: { field: 'x' },
    });
  });
});

describe('formatAccraSlot', () => {
  it('formats a UTC instant in Ghana time', () => {
    expect(formatAccraSlot(new Date('2026-08-20T14:00:00.000Z'))).toMatch(/Aug/);
  });
});

describe('JWT', () => {
  it('rejects an expired token as a session expiry', () => {
    const token = jwt.sign(
      { sub: 'u1', role: Role.USER, exp: Math.floor(Date.now() / 1000) - 60 },
      env.JWT_SECRET,
    );
    expect(() => verifyToken(token)).toThrow(/Session expired/);
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'u1', role: Role.USER }, 'not-the-app-secret-at-all-32chars!!');
    expect(() => verifyToken(token)).toThrow(/Invalid token/);
  });

  it('round-trips a well-formed payload', () => {
    const token = signToken({ sub: 'u1', role: Role.LAWYER });
    expect(verifyToken(token)).toEqual({ sub: 'u1', role: Role.LAWYER });
  });
});

describe('Google Meet URL', () => {
  it('rejects a value that is not a URL', () => {
    expect(isGoogleMeetUrl('not a url')).toBe(false);
    expect(isGoogleMeetUrl('http://meet.google.com/abc-defg-hij')).toBe(false);
    expect(isGoogleMeetUrl('https://meet.google.com/landing')).toBe(false);
    expect(isGoogleMeetUrl('https://meet.google.com/')).toBe(false);
    expect(isGoogleMeetUrl('https://meet.google.com/new/')).toBe(false);
  });
});

describe('validateParams and validateQuery', () => {
  const idSchema = z.object({ id: z.string().min(1) });

  it('replaces body with the parsed value', () => {
    const req = { body: { id: 'abc' } } as unknown as Request;
    const next = vi.fn() as NextFunction;
    validateBody(idSchema)(req, {} as Response, next);
    expect(req.body).toEqual({ id: 'abc' });
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a Zod error when the body fails', () => {
    const req = { body: {} } as unknown as Request;
    const next = vi.fn() as NextFunction;
    validateBody(idSchema)(req, {} as Response, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(z.ZodError);
  });

  it('replaces params with the parsed value', () => {
    const req = { params: { id: 'abc' } } as unknown as Request;
    const next = vi.fn() as NextFunction;
    validateParams(idSchema)(req, {} as Response, next);
    expect(req.params).toEqual({ id: 'abc' });
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a Zod error when params fail', () => {
    const req = { params: { id: '' } } as unknown as Request;
    const next = vi.fn() as NextFunction;
    validateParams(idSchema)(req, {} as Response, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(z.ZodError);
  });

  it('replaces query with the parsed value', () => {
    const req = { query: { id: 'abc' } } as unknown as Request;
    const next = vi.fn() as NextFunction;
    validateQuery(idSchema)(req, {} as Response, next);
    expect(req.query).toEqual({ id: 'abc' });
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a Zod error when query fails', () => {
    const req = { query: {} } as unknown as Request;
    const next = vi.fn() as NextFunction;
    validateQuery(idSchema)(req, {} as Response, next);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(z.ZodError);
  });
});

describe('errorHandler', () => {
  function invoke(err: unknown) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as unknown as Response;
    errorHandler(err, {} as Request, res, vi.fn());
    return { status, json };
  }

  it('ignores a body-parser object whose type is not a mapped string', () => {
    const { status, json } = invoke({ type: 12 });
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0]?.[0].error.code).toBe('INTERNAL_ERROR');
  });

  it('maps a ZodError to 422 with field details', () => {
    const parsed = z.object({ id: z.string().min(1) }).safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const { status, json } = invoke(parsed.error);
    expect(status).toHaveBeenCalledWith(422);
    expect(json.mock.calls[0]?.[0].error.code).toBe('VALIDATION_ERROR');
    expect(json.mock.calls[0]?.[0].error.details[0].field).toBe('id');
  });

  it('returns AppError details to the client', () => {
    const { status, json } = invoke(new AppError(400, 'no', 'BAD_REQUEST', { a: 1 }));
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'no', details: { a: 1 } },
    });
  });

  it('treats a duck-typed AppError as 422 instead of 500', () => {
    const { status, json } = invoke({
      statusCode: 422,
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Invalid value for callback URL',
    });
    expect(status).toHaveBeenCalledWith(422);
    expect(json.mock.calls[0]?.[0].error).toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Invalid value for callback URL',
    });
  });

  it('maps an unsupported encoding body-parser error to 415', () => {
    const { status, json } = invoke({ type: 'encoding.unsupported' });
    expect(status).toHaveBeenCalledWith(415);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'UNSUPPORTED_ENCODING',
        message: 'Request body encoding is not supported',
      },
    });
  });

  it('does not promote a duck-typed 500 into a client-visible AppError', () => {
    const { status, json } = invoke({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'db password is hunter2',
    });
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0]?.[0].error.code).toBe('INTERNAL_ERROR');
    expect(json.mock.calls[0]?.[0].error.message).toBe('Unknown error');
  });

  it('hides unexpected errors behind INTERNAL_ERROR', () => {
    const { status, json } = invoke(new Error('boom'));
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0]?.[0].error.code).toBe('INTERNAL_ERROR');
  });

  it('handles a non-Error throw as unknown', () => {
    const { status, json } = invoke('string-throw');
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0]?.[0].error.message).toBe('Unknown error');
  });
});

describe('lawyer eligibility helpers', () => {
  it('treats a missing or expired plan as inactive', () => {
    expect(
      hasActiveSubscription({ subscriptionPackageId: null, subscriptionPeriodEnd: new Date() }),
    ).toBe(false);
    expect(
      hasActiveSubscription({
        subscriptionPackageId: 'pkg',
        subscriptionPeriodEnd: new Date('2000-01-01'),
      }),
    ).toBe(false);
    expect(
      hasActiveSubscription({
        subscriptionPackageId: 'pkg',
        subscriptionPeriodEnd: new Date(Date.now() + 60_000),
      }),
    ).toBe(true);
  });

  it('requires approval, an active account, and a live plan in the public directory', () => {
    const where = publicLawyerWhere(new Date('2026-08-13T00:00:00.000Z'));
    expect(where.approvalStatus).toBe('APPROVED');
    expect(where.subscriptionPackageId).toEqual({ not: null });
  });

  it('uses singular wording when a plan allows one practice area', () => {
    expect(() => assertAreaCount(1, 1, 'Starter')).not.toThrow();
    expect(() => assertAreaCount(2, 1, 'Starter')).toThrow(/1 practice area/);
  });
});

describe('prisma helper', () => {
  it('disconnectPrisma closes the client without throwing', async () => {
    await expect(disconnectPrisma()).resolves.toBeUndefined();
  });
});
