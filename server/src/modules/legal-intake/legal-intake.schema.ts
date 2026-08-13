import { z } from 'zod';

// A lower bound of 20 characters is a usability guard, not a security one: below
// that there is rarely enough context to classify, and an enquiry that reaches a
// lawyer with three words wastes everyone's time. The upper bound caps prompt cost
// and stops an oversized enquiry reaching the provider at all (FR-006).
export const createIntakeSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, 'Describe the issue in at least 20 characters so it can be understood')
    .max(5000, 'Please keep the description under 5000 characters'),
  city: z.string().trim().min(2).max(80).optional(),
  region: z.string().trim().min(2).max(80).optional(),
});

export type CreateIntakeInput = z.infer<typeof createIntakeSchema>;

// Express types route params as possibly absent, so parsing here gives the handler
// a checked string rather than a cast. Kept format-agnostic on purpose — asserting
// a cuid shape would break the day the id strategy changes.
export const intakeIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});
