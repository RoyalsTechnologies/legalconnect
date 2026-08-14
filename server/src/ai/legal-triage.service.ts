import type { Urgency } from '@prisma/client';
import { log } from '../lib/logger.js';
import { type AiClient, getAiClient } from './ai-client.js';
import { buildTriageUserPrompt, type PromptCategory, TRIAGE_SYSTEM_PROMPT } from './prompts.js';
import { parseTriageResponse } from './schemas.js';

// The category every uncertain or unusable result lands on. Seeded in
// prisma/seed.ts; the triage service refuses to run without it rather than
// silently inventing a category that no lawyer has as a practice area.
export const FALLBACK_CATEGORY_NAME = 'Other / Needs Review';

// Below this the classification is treated as a suggestion for a human to confirm
// rather than an answer. Chosen by judgement, not measurement — see TD-011.
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

const FALLBACK_SUMMARY_MAX_CHARS = 400;

export interface TriageInput {
  description: string;
  categories: PromptCategory[];
}

export interface TriageResult {
  /** COMPLETED means the model's output was used. FAILED_FALLBACK means it was not. */
  status: 'COMPLETED' | 'FAILED_FALLBACK';
  categoryName: string;
  summary: string;
  urgency: Urgency;
  keywords: string[];
  confidence: number | null;
  needsHumanReview: boolean;
  /** Safe, non-sensitive reason. Stored on the intake and shown to admins. */
  note: string | null;
}

// The user's own words, trimmed to a sane length, standing in for a summary. Not a
// generated summary and not labelled as one — the intake keeps originalDescription
// either way, so a lawyer always sees the real text.
function excerptOf(description: string): string {
  const collapsed = description.replace(/\s+/g, ' ').trim();
  return collapsed.length <= FALLBACK_SUMMARY_MAX_CHARS
    ? collapsed
    : `${collapsed.slice(0, FALLBACK_SUMMARY_MAX_CHARS - 1)}…`;
}

function fallback(description: string, note: string): TriageResult {
  return {
    status: 'FAILED_FALLBACK',
    categoryName: FALLBACK_CATEGORY_NAME,
    summary: excerptOf(description),
    urgency: 'NORMAL',
    keywords: [],
    confidence: null,
    needsHumanReview: true,
    note,
  };
}

// Never logs the enquiry itself, only why triage failed and how much text was
// involved. That is enough to debug a provider problem without putting someone's
// legal issue in a log aggregator (NFR-002).
function logFailure(note: string, descriptionLength: number): void {
  log.sys.warn('ai-triage falling back', { reason: note, descriptionChars: descriptionLength });
}

/**
 * Classifies an enquiry, or explains why it could not. Resolves for every input —
 * a provider outage, a timeout, a malformed answer, and an invented category all
 * produce a usable TriageResult rather than an exception, because an AI problem
 * must never fail the user's submission (FR-010, NFR-003).
 */
export async function triageLegalIssue(
  { description, categories }: TriageInput,
  client: AiClient | null = getAiClient(),
): Promise<TriageResult> {
  if (!client) return fallbackAndLog(description, 'AI provider is not configured');
  if (categories.length === 0) {
    return fallbackAndLog(description, 'no active legal categories are configured');
  }

  let raw: string;
  try {
    raw = await client.complete({
      system: TRIAGE_SYSTEM_PROMPT,
      user: buildTriageUserPrompt(categories, description),
    });
  } catch (error) {
    // Any throw at all, from any provider implementation, is a fallback. Catching
    // broadly is the point: an unanticipated provider failure mode must not become
    // a 500 on the intake route.
    const reason = error instanceof Error ? error.message : 'unknown provider failure';
    return fallbackAndLog(description, reason);
  }

  const parsed = parseTriageResponse(raw);
  if (!parsed.ok) return fallbackAndLog(description, parsed.reason);

  const { category, summary, urgency, keywords, confidence, needsHumanReview } = parsed.data;

  // Category membership is checked here rather than with a Zod enum so that an
  // invented category costs only the category — the summary, urgency, and keywords
  // are still usable, and the enquiry goes to review instead of to the wrong lawyer.
  const matched = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
  const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

  if (!matched) {
    logFailure('model returned a category outside the configured list', description.length);
  }

  const notes = [
    matched ? null : 'Category was not one of the configured options, so it was sent for review.',
    lowConfidence ? 'Model confidence was low, so it was sent for review.' : null,
  ].filter((n): n is string => n !== null);

  return {
    status: 'COMPLETED',
    categoryName: matched?.name ?? FALLBACK_CATEGORY_NAME,
    summary,
    urgency,
    keywords,
    confidence,
    // Any one of these is enough to require review. The model's own opinion can
    // add review but never remove it.
    needsHumanReview: !matched || lowConfidence || needsHumanReview === true,
    note: notes.length > 0 ? notes.join(' ') : null,
  };
}

function fallbackAndLog(description: string, note: string): TriageResult {
  logFailure(note, description.length);
  return fallback(description, note);
}
