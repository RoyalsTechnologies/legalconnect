import { z } from 'zod';

const momoPhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+233|0)\d{9}$/, 'Enter a valid Ghana phone number, e.g. 0244123456');

export const createPackageSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z
    .string()
    .trim()
    .min(10, 'Describe what this plan includes in plain language')
    .max(300),
  monthlyFeeGhs: z
    .number()
    .min(1, 'Monthly fee must be at least GH₵ 1')
    .max(50000, 'Monthly fee must be at most GH₵ 50,000'),
  maxPracticeAreas: z
    .number()
    .int()
    .min(1, 'A plan must allow at least one practice area')
    .max(9, 'A plan cannot allow more practice areas than the taxonomy holds'),
});

export const updatePackageSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().min(10).max(300).optional(),
    monthlyFeeGhs: z.number().min(1).max(50000).optional(),
    maxPracticeAreas: z.number().int().min(1).max(9).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const packageIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export const subscribeSchema = z
  .object({
    packageId: z.string().trim().min(1).max(64),
    interval: z.enum(['month', 'year']).default('month'),
    phone: momoPhoneSchema.optional(),
    network: z.enum(['MTN', 'AT', 'TELECEL']).optional(),
  })
  .strict();

export const confirmSubscriptionSchema = z.object({
  reference: z.string().trim().min(8).max(120),
});

export const grantSubscriptionSchema = z.object({
  packageId: z.string().trim().min(1).max(64),
  periodDays: z.number().int().min(1).max(366).default(30),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type ConfirmSubscriptionInput = z.infer<typeof confirmSubscriptionSchema>;
export type GrantSubscriptionInput = z.infer<typeof grantSubscriptionSchema>;
