import { Role } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from './legal-categories.schema.js';
import * as categoriesService from './legal-categories.service.js';

export const legalCategoriesRouter = Router();

/**
 * FR-005 — read the taxonomy.
 *
 * Readable without an account, because the public lawyer directory filters by
 * practice area and a visitor cannot use that filter without this list.
 *
 * Retired categories stay hidden from ordinary callers so they cannot be chosen for
 * new work; admins need to see them to bring one back. An anonymous caller is treated
 * as an ordinary one, so `includeInactive` does nothing for them.
 */
legalCategoriesRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const wantsInactive = req.query.includeInactive === 'true';
    const includeInactive = wantsInactive && req.user?.role === Role.ADMIN;
    res.json(await categoriesService.listCategories(includeInactive));
  }),
);

// FR-005, FR-015 — taxonomy management is admin-only.
legalCategoriesRouter.post(
  '/',
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(createCategorySchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await categoriesService.createCategory(req.body));
  }),
);

legalCategoriesRouter.patch(
  '/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    res.json(await categoriesService.updateCategory(id, req.body));
  }),
);

// Retires a category. Not a hard delete — see ADR-008.
legalCategoriesRouter.delete(
  '/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = categoryIdParamSchema.parse(req.params);
    res.json(await categoriesService.deactivateCategory(id));
  }),
);
