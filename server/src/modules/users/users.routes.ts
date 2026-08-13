import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { updateProfileSchema } from './users.schema.js';
import * as usersService from './users.service.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// FR-003 — view own profile
usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await usersService.getProfile(req.user!.id));
  }),
);

// FR-003 — update own profile
usersRouter.patch(
  '/me',
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    res.json(await usersService.updateProfile(req.user!.id, req.body));
  }),
);
