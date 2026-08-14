import { Role } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  consultationIdParamSchema,
  createConsultationSchema,
  listConsultationsQuerySchema,
  startPaymentSchema,
  updateConsultationSchema,
  verifyPaymentSchema,
} from './consultations.schema.js';
import * as consultationsService from './consultations.service.js';

export const consultationsRouter = Router();

consultationsRouter.use(requireAuth);

// FR-013 — only a citizen sends a consultation request, and only against their own
// intake. Ownership is enforced in the service, not here.
consultationsRouter.post(
  '/',
  requireRole(Role.USER),
  validateBody(createConsultationSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await consultationsService.createConsultation(req.user!.id, req.body));
  }),
);

// FR-014 — one endpoint, scoped by role: a client sees requests they sent, a lawyer
// sees requests addressed to them, an admin sees all.
consultationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status } = listConsultationsQuerySchema.parse(req.query);
    res.json(await consultationsService.listConsultations(req.user!.id, req.user!.role, status));
  }),
);

consultationsRouter.post(
  '/verify-payment',
  requireRole(Role.USER),
  validateBody(verifyPaymentSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await consultationsService.confirmConsultationPayment(req.user!.id, req.body.reference),
    );
  }),
);

consultationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = consultationIdParamSchema.parse(req.params);
    res.json(await consultationsService.getConsultation(id, req.user!.id, req.user!.role));
  }),
);

consultationsRouter.post(
  '/:id/pay',
  requireRole(Role.USER),
  validateBody(startPaymentSchema),
  asyncHandler(async (req, res) => {
    const { id } = consultationIdParamSchema.parse(req.params);
    res.json(await consultationsService.startConsultationPayment(req.user!.id, id, req.body));
  }),
);

consultationsRouter.post(
  '/:id/confirm',
  requireRole(Role.USER, Role.LAWYER),
  asyncHandler(async (req, res) => {
    const { id } = consultationIdParamSchema.parse(req.params);
    res.json(await consultationsService.confirmConsultation(id, req.user!.id, req.user!.role));
  }),
);

// FR-014 — accept, decline, or cancel, depending on who is asking. Completing is POST /:id/confirm.
consultationsRouter.patch(
  '/:id',
  validateBody(updateConsultationSchema),
  asyncHandler(async (req, res) => {
    const { id } = consultationIdParamSchema.parse(req.params);
    res.json(
      await consultationsService.updateConsultationStatus(
        id,
        req.user!.id,
        req.user!.role,
        req.body,
      ),
    );
  }),
);
