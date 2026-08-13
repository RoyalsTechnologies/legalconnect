import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not forward rejected promises to the error middleware, so every
// async route handler is wrapped to avoid silent unhandled rejections.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
