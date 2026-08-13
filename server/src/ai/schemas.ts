import { z } from 'zod';

// The contract the model must satisfy. Everything the AI returns passes through
// this before any application logic touches it (FR-009). Bounds are deliberately
// generous enough for real answers but tight enough that a runaway response
// cannot be written to the database.
export const triageResponseSchema = z.object({
  category: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1500),
  urgency: z.enum(['NORMAL', 'IMPORTANT', 'URGENT']),
  keywords: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  confidence: z.number().min(0).max(1),

  // Accepted if the model offers it, but never relied on alone — the application
  // sets its own review flag from confidence and category membership, so a model
  // claiming certainty cannot switch off human review.
  needsHumanReview: z.boolean().optional(),
});

export type TriageResponse = z.infer<typeof triageResponseSchema>;

export type TriageParseResult = { ok: true; data: TriageResponse } | { ok: false; reason: string };

// Models are asked for raw JSON but sometimes wrap it in a markdown fence anyway.
// Stripping the fence is a tolerated formatting quirk; anything beyond that is a
// contract violation and goes to the fallback path rather than being repaired.
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
}

export function parseTriageResponse(raw: string): TriageParseResult {
  if (!raw.trim()) return { ok: false, reason: 'empty response' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return { ok: false, reason: 'response was not valid JSON' };
  }

  const result = triageResponseSchema.safeParse(parsed);
  if (!result.success) {
    // Field paths only. The values are model output derived from the user's
    // legal issue and must not reach the logs (NFR-002).
    const fields = result.error.issues.map((issue) => issue.path.join('.') || '(root)').join(', ');
    return { ok: false, reason: `response failed schema validation: ${fields}` };
  }

  return { ok: true, data: result.data };
}
