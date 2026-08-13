import { ConsultationStatus } from '@prisma/client';
import { z } from 'zod';
import { isGoogleMeetUrl } from '../../lib/google-calendar.js';

const MIN_LEAD_MS = 5 * 60 * 1000;
const MAX_LEAD_MS = 90 * 24 * 60 * 60 * 1000;

export const createConsultationSchema = z.object({
  intakeId: z.string().trim().min(1).max(64),
  lawyerProfileId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).max(1000).optional(),
  scheduledAt: z.coerce.date().superRefine((value, ctx) => {
    const t = value.getTime();
    if (Number.isNaN(t)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a valid date and time' });
      return;
    }
    if (t < Date.now() + MIN_LEAD_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a time at least a few minutes from now',
      });
    }
    if (t > Date.now() + MAX_LEAD_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose a time within the next 90 days',
      });
    }
  }),
});

// Only the transitions a role is allowed to request. Accept/decline belong to the
// lawyer; CANCELLED belongs to the client. Completing is a separate confirm endpoint
// (FR-021), not a PATCH status. Enforced again in the service against the current status.
export const updateConsultationSchema = z
  .object({
    status: z.nativeEnum(ConsultationStatus),
    meetUrl: z.string().trim().url('Enter a valid Google Meet link').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status !== ConsultationStatus.ACCEPTED) return;
    if (!data.meetUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meetUrl'],
        message: 'Paste a Google Meet link so the client can join the video call',
      });
      return;
    }
    if (!isGoogleMeetUrl(data.meetUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meetUrl'],
        message: 'Use a Google Meet link (https://meet.google.com/…), not a new-meeting page',
      });
    }
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
