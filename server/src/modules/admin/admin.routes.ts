import { Role, UserStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { grantSubscriptionSchema } from '../subscriptions/subscriptions.schema.js';
import * as subscriptionsService from '../subscriptions/subscriptions.service.js';
import * as adminService from './admin.service.js';

export const adminRouter = Router();

// FR-015 — every route below is admin-only. Applied at the router so a new endpoint
// cannot be added here without inheriting the guard.
adminRouter.use(requireAuth, requireRole(Role.ADMIN));

const listUsersQuerySchema = z.object({
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

const userIdParamSchema = z.object({ id: z.string().trim().min(1).max(64) });

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    res.json(await adminService.listUsers(listUsersQuerySchema.parse(req.query)));
  }),
);

// Suspension is the lever an admin actually has. It takes effect on the next request
// because requireAuth re-reads the account every time, so there is no window where a
// suspended user keeps working until their token expires.
adminRouter.patch(
  '/users/:id/status',
  validateBody(updateUserStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = userIdParamSchema.parse(req.params);
    res.json(await adminService.setUserStatus(id, req.user!.id, req.body.status));
  }),
);

// Counts for the admin dashboard, including the review queue that AI fallbacks feed.
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(await adminService.getPlatformStats());
  }),
);

adminRouter.post(
  '/lawyers/:id/subscription',
  validateBody(grantSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const { id } = userIdParamSchema.parse(req.params);
    res.json(await subscriptionsService.grantSubscription(id, req.body));
  }),
);
