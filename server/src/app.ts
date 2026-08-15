import express, { Router } from 'express';
import { env } from './config/env.js';
import { cors, helmet } from './lib/cjs-default.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { consultationsRouter } from './modules/consultations/consultations.routes.js';
import { lawyersRouter } from './modules/lawyers/lawyers.routes.js';
import { legalCategoriesRouter } from './modules/legal-categories/legal-categories.routes.js';
import { legalIntakeRouter } from './modules/legal-intake/legal-intake.routes.js';
import { matchingRouter } from './modules/matching/matching.routes.js';
import { packagesRouter } from './modules/subscriptions/subscriptions.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { paymentsCallbackRouter } from './payments/callback.routes.js';

export const API_PREFIX = '/api/v1';

function corsOrigins(): string[] {
  const origins = [env.CLIENT_ORIGIN];
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  return [...new Set(origins)];
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins(), credentials: true }));

  // Raw body must be read before express.json(), or the NaloPay HMAC will not match.
  app.use(`${API_PREFIX}/payments`, paymentsCallbackRouter);

  app.use(express.json({ limit: '100kb' }));

  // Unversioned on purpose. This is an operational probe for the container and the
  // host platform, not part of the product contract — versioning it would mean a
  // future /api/v2 silently breaks every deployment health check.
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
  });

  const v1 = Router();
  v1.use('/auth', authRouter);
  v1.use('/users', usersRouter);
  v1.use('/categories', legalCategoriesRouter);
  v1.use('/packages', packagesRouter);
  v1.use('/lawyers', lawyersRouter);
  v1.use('/intakes', legalIntakeRouter);
  // Recommendations hang off an intake, so they share its path prefix.
  v1.use('/intakes', matchingRouter);
  v1.use('/consultations', consultationsRouter);
  v1.use('/admin', adminRouter);

  app.use(API_PREFIX, v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
