import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { validateBody } from '../../middleware/validate.js';
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from './auth.schema.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

// FR-001 — account registration (no JWT until email is confirmed)
authRouter.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/verify-email',
  validateBody(tokenSchema),
  asyncHandler(async (req, res) => {
    res.status(200).json(await authService.verifyEmail(req.body));
  }),
);

authRouter.post(
  '/resend-verification',
  validateBody(emailOnlySchema),
  asyncHandler(async (req, res) => {
    await authService.resendVerification(req.body);
    res.status(204).send();
  }),
);

// FR-002 — authentication
authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  }),
);

authRouter.post(
  '/forgot-password',
  validateBody(emailOnlySchema),
  asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body);
    res.status(204).send();
  }),
);

authRouter.post(
  '/reset-password',
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    res.status(200).json(await authService.resetPassword(req.body));
  }),
);

// FR-002 — logout. Tokens are stateless (ADR-003), so the client discards the
// token; this endpoint exists so that behaviour is explicit rather than implied.
// Server-side revocation is TD-003.
authRouter.post('/logout', (_req, res) => {
  res.status(204).send();
});
