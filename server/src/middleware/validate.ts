import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

// Validation happens at the trusted boundary and the parsed result replaces the
// raw input, so handlers never see unvalidated data. ZodError is translated into
// a field-level 400 by the error handler.
export const validateBody =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };

export const validateParams =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(result.error);
    Object.assign(req.params, result.data);
    next();
  };

export const validateQuery =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    Object.assign(req.query, result.data);
    next();
  };
