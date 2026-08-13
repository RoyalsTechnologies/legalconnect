import { Role } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  createPackageSchema,
  packageIdParamSchema,
  updatePackageSchema,
} from './subscriptions.schema.js';
import * as subscriptionsService from './subscriptions.service.js';

export const packagesRouter = Router();

/**
 * FR-018 — lawyer plans. Readable without an account so a lawyer considering
 * signup can see how many practice areas each plan allows.
 *
 * Retired plans stay hidden from ordinary callers; admins need them to edit or
 * bring one back.
 */
packagesRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json(await subscriptionsService.listPackages(req.user?.role ?? null));
  }),
);

packagesRouter.post(
  '/',
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(createPackageSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await subscriptionsService.createPackage(req.body));
  }),
);

packagesRouter.patch(
  '/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(updatePackageSchema),
  asyncHandler(async (req, res) => {
    const { id } = packageIdParamSchema.parse(req.params);
    res.json(await subscriptionsService.updatePackage(id, req.body));
  }),
);
