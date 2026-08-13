import { type Prisma, Role } from '@prisma/client';
import { FALLBACK_CATEGORY_NAME } from '../../ai/legal-triage.service.js';
import { notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { publicLawyerWhere } from '../lawyers/eligibility.js';

// Weights are plain constants rather than anything learned or inferred. The whole
// point of ADR-001 is that a recommendation can be explained and reproduced, which
// means the arithmetic has to be visible and boring.
const WEIGHT = {
  practiceArea: 100,
  region: 30,
  city: 15,
  available: 20,
} as const;

const MAX_RECOMMENDATIONS = 10;

const candidateFields = {
  id: true,
  displayName: true,
  firmName: true,
  bio: true,
  city: true,
  region: true,
  isAvailable: true,
  yearsExperience: true,
  consultationFeePesewas: true,
  practiceAreas: { select: { legalCategory: { select: { id: true, name: true } } } },
} satisfies Prisma.LawyerProfileSelect;

type Candidate = Prisma.LawyerProfileGetPayload<{ select: typeof candidateFields }>;

export interface Recommendation {
  lawyer: Omit<Candidate, 'practiceAreas'> & { practiceAreas: string[] };
  score: number;
  reason: string;
}

export interface MatchResult {
  intakeId: string;
  category: { id: string; name: string } | null;
  recommendations: Recommendation[];
  /** Present when no match could be attempted, so the UI can explain rather than show nothing. */
  note: string | null;
}

/**
 * Recommends lawyers for an intake.
 *
 * Deterministic by construction: same intake and same lawyer data always produce the
 * same order. No AI is involved in ranking (ADR-001) — the model's only contribution
 * is the category, and that is already validated and stored by the time we get here.
 */
export async function recommendLawyers(
  intakeId: string,
  userId: string,
  role: Role,
): Promise<MatchResult> {
  const intake = await prisma.legalIntake.findFirst({
    where: role === Role.ADMIN ? { id: intakeId } : { id: intakeId, clientId: userId },
    select: {
      id: true,
      city: true,
      region: true,
      category: { select: { id: true, name: true } },
    },
  });

  if (!intake) throw notFound('Intake not found');

  // Two ways an enquiry can be unplaceable, and they must produce the same outcome.
  // A null category happens only if a category was deleted underneath the intake; the
  // real AI-failure path assigns the "Other / Needs Review" holding category instead
  // (FR-010). Matching on that name would find nobody — no lawyer practises "needs
  // review" — and the citizen would be told no lawyer covers their area, which reads
  // as a rejection rather than as work still to do.
  const category = intake.category;

  if (!category || category.name === FALLBACK_CATEGORY_NAME) {
    return {
      intakeId: intake.id,
      category: null,
      recommendations: [],
      note: 'This enquiry has not been categorised yet, so no recommendation can be made. You can still browse the lawyer directory and contact someone directly.',
    };
  }

  const candidates = await prisma.lawyerProfile.findMany({
    where: {
      ...publicLawyerWhere(),
      practiceAreas: { some: { legalCategoryId: category.id } },
    },
    select: candidateFields,
  });

  const scored = candidates
    .map((candidate) => score(candidate, category, intake.region, intake.city))
    .sort(compareRecommendations)
    .slice(0, MAX_RECOMMENDATIONS);

  return {
    intakeId: intake.id,
    category,
    recommendations: scored,
    note:
      scored.length === 0
        ? 'No approved, subscribed lawyer currently lists this practice area.'
        : null,
  };
}

function score(
  candidate: Candidate,
  category: { id: string; name: string },
  intakeRegion: string | null,
  intakeCity: string | null,
): Recommendation {
  const matchesRegion = Boolean(
    intakeRegion && candidate.region.toLowerCase() === intakeRegion.toLowerCase(),
  );
  const matchesCity = Boolean(
    intakeCity && candidate.city.toLowerCase() === intakeCity.toLowerCase(),
  );

  const total =
    WEIGHT.practiceArea +
    (matchesRegion ? WEIGHT.region : 0) +
    (matchesCity ? WEIGHT.city : 0) +
    (candidate.isAvailable ? WEIGHT.available : 0);

  const { practiceAreas, ...rest } = candidate;

  return {
    lawyer: { ...rest, practiceAreas: practiceAreas.map((p) => p.legalCategory.name) },
    score: total,
    reason: buildReason(candidate, category.name, matchesRegion, matchesCity),
  };
}

/**
 * Builds the sentence shown next to a recommendation (NFR-007).
 *
 * Every clause corresponds to a criterion that actually contributed to the score, so
 * the explanation cannot drift from the ranking. It never claims a lawyer is best,
 * most suitable, or likely to win — only what they list and where they are.
 */
function buildReason(
  candidate: Candidate,
  categoryName: string,
  matchesRegion: boolean,
  matchesCity: boolean,
): string {
  const clauses = [`lists ${categoryName} as a practice area`];

  if (matchesCity) clauses.push(`is based in ${candidate.city}`);
  else if (matchesRegion) clauses.push(`practises in ${candidate.region}`);

  clauses.push(
    candidate.isAvailable
      ? 'is currently accepting new enquiries'
      : 'is not accepting new enquiries at the moment',
  );

  const joined =
    clauses.length > 1
      ? `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`
      : clauses[0];

  return `Recommended because ${candidate.displayName} ${joined}.`;
}

/**
 * Total ordering. Every comparison ends in a tiebreak on id, so two lawyers with
 * identical scores and experience still come back in a stable order rather than
 * whatever order the database happened to return.
 */
function compareRecommendations(a: Recommendation, b: Recommendation): number {
  if (b.score !== a.score) return b.score - a.score;

  const experience = (b.lawyer.yearsExperience ?? 0) - (a.lawyer.yearsExperience ?? 0);
  if (experience !== 0) return experience;

  const name = a.lawyer.displayName.localeCompare(b.lawyer.displayName);
  if (name !== 0) return name;

  return a.lawyer.id.localeCompare(b.lawyer.id);
}
