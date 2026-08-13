import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import * as matchingService from './matching.service.js';

export const matchingRouter = Router();

matchingRouter.use(requireAuth);

const intakeIdParamSchema = z.object({ intakeId: z.string().trim().min(1).max(64) });

// FR-011 — recommendations for one intake. Scoped by ownership inside the service,
// so a predictable id cannot surface another person's recommendations.
matchingRouter.get(
  '/:intakeId/recommendations',
  asyncHandler(async (req, res) => {
    const { intakeId } = intakeIdParamSchema.parse(req.params);
    res.json(await matchingService.recommendLawyers(intakeId, req.user!.id, req.user!.role));
  }),
);
