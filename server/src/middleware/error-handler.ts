import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { log } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
};

// Errors raised by express.json() before any handler runs. They carry a `type`
// and a `status`, but they are not AppError instances, so without this mapping a
// client sending bad JSON would get a 500 and the log would fill with noise that
// looks like a server fault rather than a bad request.
const BODY_PARSER_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  'entity.parse.failed': {
    status: 400,
    code: 'MALFORMED_JSON',
    message: 'Request body is not valid JSON',
  },
  'entity.too.large': {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Request body is too large',
  },
  'encoding.unsupported': {
    status: 415,
    code: 'UNSUPPORTED_ENCODING',
    message: 'Request body encoding is not supported',
  },
};

/** Statuses AppError uses. A duck-typed 500 must not bypass the INTERNAL_ERROR hide. */
const APP_ERROR_STATUSES = new Set([400, 401, 403, 404, 409, 422, 503]);

function asAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  if (typeof err !== 'object' || err === null) return undefined;

  const candidate = err as Record<string, unknown>;
  const { statusCode, code, message, details } = candidate;
  if (
    typeof statusCode !== 'number' ||
    typeof code !== 'string' ||
    typeof message !== 'string' ||
    !APP_ERROR_STATUSES.has(statusCode)
  ) {
    return undefined;
  }
  return new AppError(statusCode, message, code, details);
}

function bodyParserFailure(err: unknown) {
  if (typeof err !== 'object' || err === null || !('type' in err)) return undefined;
  const { type } = err as { type?: unknown };
  return typeof type === 'string' ? BODY_PARSER_ERRORS[type] : undefined;
}

// Single consistent error shape for the whole API. Internal detail never crosses
// the boundary in production (NFR-001).
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const parseFailure = bodyParserFailure(err);
  if (parseFailure) {
    res.status(parseFailure.status).json({
      error: { code: parseFailure.code, message: parseFailure.message },
    });
    return;
  }

  // 422, not 400: the request was well-formed and parsed cleanly, it just failed
  // the schema. 400 is reserved for input the server could not parse at all.
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  const appError = asAppError(err);
  if (appError) {
    if (appError.statusCode === 401 || appError.statusCode === 403) {
      log.security.warn(appError.message, {
        method: req.method,
        path: req.path,
        code: appError.code,
        status: appError.statusCode,
      });
    }
    res.status(appError.statusCode).json({
      error: { code: appError.code, message: appError.message, details: appError.details },
    });
    return;
  }

  try {
    log.sys.error('unhandled', err);
  } catch {
    console.error('[sys] unhandled (logger failed)');
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'An unexpected error occurred'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
    },
  });
};
