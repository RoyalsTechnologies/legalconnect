import { z } from 'zod';

// Descriptions are shown to people with no legal vocabulary and are also fed to the
// triage prompt as the definition of each category, so a vague one degrades both the
// UI and the classification. Hence the minimum length.
export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Enter a category name').max(80),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the category in plain language a non-lawyer would understand')
    .max(300),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().min(10).max(300).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const categoryIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
