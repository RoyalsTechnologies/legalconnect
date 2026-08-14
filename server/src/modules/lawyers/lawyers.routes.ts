import { Role } from '@prisma/client';
import { type RequestHandler, Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { forbidden } from '../../lib/errors.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  confirmSubscriptionSchema,
  subscribeSchema,
} from '../subscriptions/subscriptions.schema.js';
import * as subscriptionsService from '../subscriptions/subscriptions.service.js';
import { withdrawSchema } from '../wallet/wallet.schema.js';
import * as walletService from '../wallet/wallet.service.js';
import {
  adminUpdateLawyerSchema,
  createLawyerSchema,
  lawyerIdParamSchema,
  listLawyersQuerySchema,
  updateOwnLawyerProfileSchema,
} from './lawyers.schema.js';
import * as lawyersService from './lawyers.service.js';

export const lawyersRouter = Router();

/**
 * Rejects a self-update that tries to set approvalStatus.
 *
 * This is an explicit 403 rather than the silent strip used on `/users/me`, and the
 * difference is deliberate. `role` and `status` are never client-settable by anyone,
 * so dropping them quietly is right. `approvalStatus` *is* settable — just not by
 * the lawyer it describes — so the caller deserves to be told no rather than
 * watching the field vanish (FR-004).
 */
const rejectSelfApproval: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object' && 'approvalStatus' in req.body) {
    return next(forbidden('Only an administrator can change approval status'));
  }
  next();
};

/**
 * FR-004, FR-012 — the directory, filterable and paginated.
 *
 * Readable without an account. Someone deciding whether this platform is worth
 * registering for needs to see that it has lawyers who handle their kind of problem;
 * requiring a sign-up first asks for trust before offering any evidence, and the
 * profiles shown are the public-facing ones a firm would publish anyway.
 *
 * Scope still depends on the caller: the public and citizens see approved lawyers on
 * active accounts, admins see every profile.
 */
lawyersRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const filters = listLawyersQuerySchema.parse(req.query);
    res.json(await lawyersService.listLawyers(req.user?.role ?? null, filters));
  }),
);

// Declared before '/:id' so the literal path is not swallowed by the parameter.
lawyersRouter.get(
  '/me',
  requireAuth,
  requireRole(Role.LAWYER),
  asyncHandler(async (req, res) => {
    res.json(await lawyersService.getOwnProfile(req.user!.id));
  }),
);

// FR-004 — a lawyer edits their own profile and nobody else's. There is no target id
// in the path at all, so editing another profile is not merely blocked, it is
// unexpressible.
lawyersRouter.patch(
  '/me',
  requireAuth,
  requireRole(Role.LAWYER),
  rejectSelfApproval,
  validateBody(updateOwnLawyerProfileSchema),
  asyncHandler(async (req, res) => {
    res.json(await lawyersService.updateOwnProfile(req.user!.id, req.body));
  }),
);

lawyersRouter.post(
  '/me/subscription',
  requireAuth,
  requireRole(Role.LAWYER),
  validateBody(subscribeSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await subscriptionsService.startSubscription(req.user!.id, req.body));
  }),
);

lawyersRouter.post(
  '/me/subscription/confirm',
  requireAuth,
  requireRole(Role.LAWYER),
  validateBody(confirmSubscriptionSchema),
  asyncHandler(async (req, res) => {
    res.json(await subscriptionsService.confirmSubscription(req.user!.id, req.body));
  }),
);

lawyersRouter.get(
  '/me/withdrawals',
  requireAuth,
  requireRole(Role.LAWYER),
  asyncHandler(async (req, res) => {
    res.json(await walletService.listWithdrawalsForUser(req.user!.id));
  }),
);

lawyersRouter.post(
  '/me/withdrawals',
  requireAuth,
  requireRole(Role.LAWYER),
  validateBody(withdrawSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await walletService.requestWithdrawal(req.user!.id, req.body));
  }),
);

// FR-004, FR-015 — admins can still create lawyer accounts. Public self-registration
// is POST /auth/register with accountType=lawyer (ADR-006).
lawyersRouter.post(
  '/',
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(createLawyerSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await lawyersService.createLawyer(req.body));
  }),
);

// Public for the same reason as the directory. An unapproved profile still returns
// 404 to everyone but an admin, so opening this up reveals nothing that the listing
// did not already show.
lawyersRouter.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { id } = lawyerIdParamSchema.parse(req.params);
    res.json(await lawyersService.getLawyer(id, req.user?.role ?? null));
  }),
);

// FR-015 — admin edit, including approval. A LAWYER caller is stopped by the role
// guard with 403 before any of this runs.
lawyersRouter.patch(
  '/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(adminUpdateLawyerSchema),
  asyncHandler(async (req, res) => {
    const { id } = lawyerIdParamSchema.parse(req.params);
    res.json(await lawyersService.adminUpdateLawyer(id, req.body));
  }),
);
