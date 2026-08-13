import { ConsultationStatus } from '@prisma/client';
import { z } from 'zod';

export const createConsultationSchema = z.object({
  intakeId: z.string().trim().min(1).max(64),
  lawyerProfileId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).max(1000).optional(),
});

// Only the transitions a role is allowed to request. COMPLETED and the accept/decline
// pair belong to the lawyer; CANCELLED belongs to the client. Enforced again in the
// service against the current status, because a valid target is not the same as a
// valid transition.
export const updateConsultationSchema = z.object({
  status: z.nativeEnum(ConsultationStatus),
});

export const consultationIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export const listConsultationsQuerySchema = z.object({
  status: z.nativeEnum(ConsultationStatus).optional(),
});

export const verifyPaymentSchema = z.object({
  reference: z.string().trim().min(8).max(120),
});

const momoPhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+233|0)\d{9}$/, 'Enter a valid Ghana phone number, e.g. 0244123456');

export const startPaymentSchema = z
  .object({
    phone: momoPhoneSchema.optional(),
    network: z.enum(['MTN', 'AT', 'TELECEL']).optional(),
  })
  .default({});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type StartPaymentInput = z.infer<typeof startPaymentSchema>;
