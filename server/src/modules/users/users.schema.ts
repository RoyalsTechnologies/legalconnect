import { z } from 'zod';

// Only self-editable fields. Email, role, and status are deliberately excluded:
// role and status are privilege-bearing and admin-controlled, and changing email
// needs a verification flow that is out of MVP scope.
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(120).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(\+233|0)\d{9}$/, 'Enter a valid Ghana phone number, e.g. 0244123456')
      .nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
