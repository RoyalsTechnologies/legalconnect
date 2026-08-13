import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { createIntakeSchema, intakeIdParamSchema } from './legal-intake.schema.js';
import * as intakeService from './legal-intake.service.js';

export const legalIntakeRouter = Router();

legalIntakeRouter.use(requireAuth);

// FR-006 — submit a legal concern. Returns 201 on the AI fallback path too: the
// enquiry was accepted and stored, and a degraded classification is not a failed
// request (ADR-002).
legalIntakeRouter.post(
  '/',
  validateBody(createIntakeSchema),
  asyncHandler(async (req, res) => {
    const intake = await intakeService.createIntake(req.user!.id, req.body);
    res.status(201).json(intake);
  }),
);

// FR-006 — the author's own submissions.
legalIntakeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await intakeService.listOwnIntakes(req.user!.id));
  }),
);

legalIntakeRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = intakeIdParamSchema.parse(req.params);
    const intake = await intakeService.getOwnIntake(id, req.user!.id, req.user!.role);
    res.json(intake);
  }),
);
