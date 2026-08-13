import { z } from 'zod';

// Ghanaian numbers, optional at registration. Kept permissive on purpose —
// over-strict phone validation locks real users out for no security gain.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^(\+233|0)\d{9}$/, 'Enter a valid Ghana phone number, e.g. 0244123456')
  .optional();

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

const practiceAreaIds = z
  .array(z.string().trim().min(1).max(64))
  .min(1, 'Select at least one practice area')
  .max(9, 'Select no more than nine practice areas');

// `accountType` is a public choice of citizen vs lawyer. There is still no `role`
// field — ADMIN cannot be self-assigned (SEC-LG-011). Extra lawyer fields are
// ignored unless accountType is lawyer.
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: passwordSchema,
    phone: phoneSchema,
    accountType: z.enum(['citizen', 'lawyer']).default('citizen'),
    displayName: z.string().trim().min(2).max(120).optional(),
    firmName: z.string().trim().min(2).max(120).optional(),
    bio: z.string().trim().max(2000).optional(),
    licenseNumber: z.string().trim().min(2).max(60).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    region: z.string().trim().min(2).max(80).optional(),
    yearsExperience: z.number().int().min(0).max(70).optional(),
    consultationFeeGhs: z
      .number()
      .min(1, 'Consultation fee must be at least GH₵ 1')
      .max(50000, 'Consultation fee must be at most GH₵ 50,000')
      .optional(),
    practiceAreaIds: practiceAreaIds.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType !== 'lawyer') return;

    if (!data.bio || data.bio.trim().length < 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bio'],
        message: 'Write at least a short paragraph so people know what you handle',
      });
    }
    if (!data.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'Enter the city you practise from',
      });
    }
    if (!data.region) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['region'],
        message: 'Enter the region you practise from',
      });
    }
    if (!data.practiceAreaIds || data.practiceAreaIds.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['practiceAreaIds'],
        message: 'Select at least one practice area',
      });
    }
    if (data.consultationFeeGhs === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consultationFeeGhs'],
        message: 'Set the fee a client pays to book a consultation',
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

export const tokenSchema = z.object({
  token: z.string().trim().min(20, 'Invalid or expired link').max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, 'Invalid or expired link').max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'Choose a different password from your current one',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
