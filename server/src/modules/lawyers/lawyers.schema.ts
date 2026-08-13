import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';

const practiceAreaIds = z
  .array(z.string().trim().min(1).max(64))
  .min(1, 'Select at least one practice area')
  .max(9, 'Select no more than nine practice areas');

// Fields a lawyer may edit about themselves. approvalStatus is absent by design —
// it is the platform's judgement about the lawyer, not the lawyer's own claim.
const selfEditableFields = {
  displayName: z.string().trim().min(2).max(120).optional(),
  firmName: z.string().trim().min(2).max(120).nullish(),
  bio: z
    .string()
    .trim()
    .min(30, 'Write at least a short paragraph so people know what you handle')
    .max(2000)
    .optional(),
  licenseNumber: z.string().trim().min(2).max(60).nullish(),
  city: z.string().trim().min(2).max(80).optional(),
  region: z.string().trim().min(2).max(80).optional(),
  isAvailable: z.boolean().optional(),
  yearsExperience: z.number().int().min(0).max(70).nullish(),
  consultationFeeGhs: z
    .number()
    .min(1, 'Consultation fee must be at least GH₵ 1')
    .max(50000, 'Consultation fee must be at most GH₵ 50,000')
    .optional(),
  practiceAreaIds: practiceAreaIds.optional(),
};

// Admin can still create the account and the profile together. Self-registration
// uses POST /auth/register. The password here is for invitation-style onboarding.
export const createLawyerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+233|0)\d{9}$/, 'Enter a valid Ghana phone number, e.g. 0244123456')
    .optional(),

  displayName: z.string().trim().min(2).max(120),
  firmName: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().min(30).max(2000),
  licenseNumber: z.string().trim().min(2).max(60).optional(),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  consultationFeeGhs: z
    .number()
    .min(1, 'Consultation fee must be at least GH₵ 1')
    .max(50000, 'Consultation fee must be at most GH₵ 50,000'),
  practiceAreaIds,

  // An admin may approve at creation time. Defaults to PENDING so that forgetting
  // the field cannot accidentally publish an unvetted profile.
  approvalStatus: z.nativeEnum(ApprovalStatus).default(ApprovalStatus.PENDING),
});

export const updateOwnLawyerProfileSchema = z
  .object(selfEditableFields)
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const adminUpdateLawyerSchema = z
  .object({
    ...selfEditableFields,
    approvalStatus: z.nativeEnum(ApprovalStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const lawyerIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

// FR-012 — directory filters. Query strings arrive as text, so booleans and numbers
// are coerced here rather than in the service. The limit is capped so a caller cannot
// ask for the entire table (NFR-006).
export const listLawyersQuerySchema = z.object({
  categoryId: z.string().trim().min(1).max(64).optional(),
  region: z.string().trim().min(2).max(80).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  available: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateLawyerInput = z.infer<typeof createLawyerSchema>;
export type UpdateOwnLawyerProfileInput = z.infer<typeof updateOwnLawyerProfileSchema>;
export type AdminUpdateLawyerInput = z.infer<typeof adminUpdateLawyerSchema>;
