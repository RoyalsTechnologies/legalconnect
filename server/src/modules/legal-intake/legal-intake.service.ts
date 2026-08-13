import { type Prisma, Role } from '@prisma/client';
import { FALLBACK_CATEGORY_NAME, triageLegalIssue } from '../../ai/legal-triage.service.js';
import { notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { CreateIntakeInput } from './legal-intake.schema.js';

// The lawyer needs to compare the AI summary against what the person actually
// wrote, so originalDescription is always selected alongside aiSummary.
const intakeFields = {
  id: true,
  originalDescription: true,
  city: true,
  region: true,
  aiSummary: true,
  urgency: true,
  keywords: true,
  confidence: true,
  needsHumanReview: true,
  aiStatus: true,
  aiError: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.LegalIntakeSelect;

export type IntakeView = Prisma.LegalIntakeGetPayload<{ select: typeof intakeFields }>;

/**
 * Creates an intake and enriches it with AI triage.
 *
 * The write happens before the provider is contacted and is never rolled back on
 * an AI failure (ADR-002). Whatever happens next, the enquiry exists and the user
 * can carry on — that is the whole point of the ordering (FR-010, NFR-003).
 */
export async function createIntake(
  clientId: string,
  input: CreateIntakeInput,
): Promise<IntakeView> {
  const intake = await prisma.legalIntake.create({
    data: {
      clientId,
      originalDescription: input.description,
      city: input.city ?? null,
      region: input.region ?? null,
    },
    select: { id: true },
  });

  const categories = await prisma.legalCategory.findMany({
    where: { isActive: true },
    select: { name: true, description: true },
    orderBy: { name: 'asc' },
  });

  const triage = await triageLegalIssue({ description: input.description, categories });

  // Resolved by name because that is what the model was given and what triage
  // validated against. An unresolvable name leaves categoryId null rather than
  // failing the request; the intake is already flagged for review in that case.
  const category = await prisma.legalCategory.findFirst({
    where: { name: triage.categoryName },
    select: { id: true },
  });

  return prisma.legalIntake.update({
    where: { id: intake.id },
    data: {
      categoryId: category?.id ?? null,
      aiSummary: triage.summary,
      urgency: triage.urgency,
      keywords: triage.keywords,
      confidence: triage.confidence,
      needsHumanReview: triage.needsHumanReview || category === null,
      aiStatus: triage.status,
      aiError: triage.note,
    },
    select: intakeFields,
  });
}

export async function listOwnIntakes(clientId: string): Promise<IntakeView[]> {
  return prisma.legalIntake.findMany({
    where: { clientId },
    select: intakeFields,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Reads one intake, scoped by owner.
 *
 * A missing intake and someone else's intake both return 404. Returning 403 for
 * the second case would confirm that the id exists, which is exactly the leak
 * SEC-LG-001 guards against. Admins are exempt because FR-015 gives them
 * oversight of records they are responsible for.
 */
export async function getOwnIntake(
  intakeId: string,
  userId: string,
  role: Role,
): Promise<IntakeView> {
  const intake = await prisma.legalIntake.findFirst({
    where: role === Role.ADMIN ? { id: intakeId } : { id: intakeId, clientId: userId },
    select: intakeFields,
  });

  if (!intake) throw notFound('Intake not found');
  return intake;
}

export { FALLBACK_CATEGORY_NAME };
