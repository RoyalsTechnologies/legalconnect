import { Prisma } from '@prisma/client';
import { conflict, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './legal-categories.schema.js';

const categoryFields = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
} satisfies Prisma.LegalCategorySelect;

export type CategoryView = Prisma.LegalCategoryGetPayload<{ select: typeof categoryFields }>;

// Derived rather than asked for. A slug is a URL detail, not a decision an admin
// should have to make, and generating it keeps it consistent with the name.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listCategories(includeInactive: boolean): Promise<CategoryView[]> {
  return prisma.legalCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    select: categoryFields,
    orderBy: { name: 'asc' },
  });
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryView> {
  const slug = slugify(input.name);
  if (!slug) throw conflict('Category name must contain at least one letter or number');

  try {
    return await prisma.legalCategory.create({
      data: { name: input.name, slug, description: input.description },
      select: categoryFields,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('A category with this name already exists');
    }
    throw error;
  }
}

/**
 * Updates a category.
 *
 * The slug is regenerated when the name changes, which would break any external
 * link using the old slug. Nothing links by slug yet, so this is currently free —
 * noted in TD-015 in case that changes.
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryView> {
  await requireCategory(id);

  try {
    return await prisma.legalCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name, slug: slugify(input.name) }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: categoryFields,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('A category with this name already exists');
    }
    throw error;
  }
}

/**
 * Deactivates a category rather than deleting it.
 *
 * Categories are referenced by past intakes and by lawyers' practice areas. A hard
 * delete would either fail on the foreign key or silently rewrite history, so the
 * taxonomy is append-and-retire (ADR-008).
 */
export async function deactivateCategory(id: string): Promise<CategoryView> {
  await requireCategory(id);

  return prisma.legalCategory.update({
    where: { id },
    data: { isActive: false },
    select: categoryFields,
  });
}

async function requireCategory(id: string): Promise<void> {
  const existing = await prisma.legalCategory.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Category not found');
}
