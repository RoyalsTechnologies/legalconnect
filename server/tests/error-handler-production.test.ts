import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    isProduction: true,
  };
});

import { AppError } from '../src/lib/errors.js';
import { errorHandler } from '../src/middleware/error-handler.js';

describe('errorHandler in production', () => {
  function invoke(err: unknown) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    errorHandler(err, {} as Request, { status } as unknown as Response, vi.fn());
    return { status, json };
  }

  it('hides unexpected error messages', () => {
    const { status, json } = invoke(new Error('secret internals'));
    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0]?.[0].error.message).toBe('An unexpected error occurred');
  });

  it('still returns AppError messages', () => {
    const { status, json } = invoke(new AppError(409, 'taken', 'CONFLICT', { field: 'email' }));
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'taken', details: { field: 'email' } },
    });
  });
});
