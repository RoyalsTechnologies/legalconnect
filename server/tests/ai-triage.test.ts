import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiClient } from '../src/ai/ai-client.js';
import {
  FALLBACK_CATEGORY_NAME,
  LOW_CONFIDENCE_THRESHOLD,
  triageLegalIssue,
} from '../src/ai/legal-triage.service.js';
import { buildTriageUserPrompt, TRIAGE_SYSTEM_PROMPT } from '../src/ai/prompts.js';

// Unit tests: no database, no network. The provider is a stub so every failure
// mode can be produced on demand — a live provider could not be made to time out
// or return broken JSON reliably.
const CATEGORIES = [
  { name: 'Employment & Labour', description: 'Dismissal, unpaid salary, contracts.' },
  { name: 'Property & Tenancy', description: 'Landlord and tenant disputes, land.' },
  { name: FALLBACK_CATEGORY_NAME, description: 'Anything that needs a person to review it.' },
];

const DESCRIPTION =
  'My employer dismissed me last month and has not paid my final salary despite several reminders.';

function stubClient(behaviour: () => Promise<string>): AiClient {
  return { complete: behaviour };
}

function respondingWith(payload: unknown): AiClient {
  return stubClient(async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)));
}

const validResponse = {
  category: 'Employment & Labour',
  summary: 'The person states they were dismissed and have not received their final salary.',
  urgency: 'IMPORTANT',
  keywords: ['dismissal', 'unpaid salary'],
  confidence: 0.9,
};

beforeEach(() => {
  // The service warns on every fallback by design; silence it so failure-path
  // tests do not fill the run with expected noise.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('AI-TC-001 successful classification', () => {
  it('uses the model output when it satisfies the contract', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith(validResponse),
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.categoryName).toBe('Employment & Labour');
    expect(result.urgency).toBe('IMPORTANT');
    expect(result.keywords).toEqual(['dismissal', 'unpaid salary']);
    expect(result.confidence).toBe(0.9);
    expect(result.needsHumanReview).toBe(false);
    expect(result.note).toBeNull();
  });

  it('AI-TC-011: accepts a JSON object wrapped in a markdown fence', async () => {
    const fenced = `\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``;

    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith(fenced),
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.categoryName).toBe('Employment & Labour');
  });

  it('passes the allowed category list and the enquiry to the model', async () => {
    const complete = vi.fn(async () => JSON.stringify(validResponse));

    await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      stubClient(complete),
    );

    const [{ system, user }] = complete.mock.calls[0] as [{ system: string; user: string }];
    expect(system).toBe(TRIAGE_SYSTEM_PROMPT);
    for (const category of CATEGORIES) expect(user).toContain(category.name);
    expect(user).toContain(DESCRIPTION);
  });
});

describe('AI-TC-006 malformed AI response', () => {
  it('falls back when the response is not JSON at all', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith('I am afraid I cannot help with that.'),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.categoryName).toBe(FALLBACK_CATEGORY_NAME);
    expect(result.needsHumanReview).toBe(true);
    expect(result.note).toContain('not valid JSON');
  });

  it('falls back when the response is JSON but the wrong shape', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith({ verdict: 'employer is liable' }),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toContain('schema validation');
  });

  it('falls back when the response is empty', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith('   '),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
  });
});

describe('AI-TC-012 missing and out-of-range fields', () => {
  it('rejects a response with no urgency', async () => {
    const { urgency: _omitted, ...withoutUrgency } = validResponse;

    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith(withoutUrgency),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toContain('urgency');
  });

  it('rejects a response with no summary', async () => {
    const { summary: _omitted, ...withoutSummary } = validResponse;

    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith(withoutSummary),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toContain('summary');
  });

  it('rejects an urgency outside the enum', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith({ ...validResponse, urgency: 'CATASTROPHIC' }),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toContain('urgency');
  });

  it('rejects a confidence outside 0..1', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith({ ...validResponse, confidence: 4.2 }),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toContain('confidence');
  });

  it('defaults keywords to an empty list when the model omits them', async () => {
    const { keywords: _omitted, ...withoutKeywords } = validResponse;

    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith(withoutKeywords),
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.keywords).toEqual([]);
  });
});

describe('AI-TC-008 unknown category', () => {
  it('keeps the usable output but routes an invented category to review', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith({ ...validResponse, category: 'Maritime Piracy Law' }),
    );

    // The model answered validly, so summary and urgency survive — only the
    // category is replaced, which is the difference between this and a fallback.
    expect(result.status).toBe('COMPLETED');
    expect(result.categoryName).toBe(FALLBACK_CATEGORY_NAME);
    expect(result.summary).toBe(validResponse.summary);
    expect(result.urgency).toBe('IMPORTANT');
    expect(result.needsHumanReview).toBe(true);
    expect(result.note).toContain('not one of the configured options');
  });

  it('matches a configured category case-insensitively', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith({ ...validResponse, category: 'employment & labour' }),
    );

    expect(result.categoryName).toBe('Employment & Labour');
    expect(result.needsHumanReview).toBe(false);
  });
});

describe('AI-TC-003 low confidence', () => {
  it('flags a below-threshold classification for review without discarding it', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith({ ...validResponse, confidence: LOW_CONFIDENCE_THRESHOLD - 0.01 }),
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.categoryName).toBe('Employment & Labour');
    expect(result.needsHumanReview).toBe(true);
    expect(result.note).toContain('confidence was low');
  });

  it('SEC-LG-013: a model claiming no review is needed cannot override the threshold', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      respondingWith({ ...validResponse, confidence: 0.1, needsHumanReview: false }),
    );

    expect(result.needsHumanReview).toBe(true);
  });
});

describe('AI-TC-005 provider failure', () => {
  it('falls back when the provider throws', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      stubClient(async () => {
        throw new Error('provider request timed out');
      }),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toBe('provider request timed out');
  });

  it('falls back when no provider is configured', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      null,
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toContain('not configured');
  });

  it('falls back when no categories are configured', async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: [] },
      respondingWith(validResponse),
    );

    expect(result.status).toBe('FAILED_FALLBACK');
    expect(result.note).toContain('no active legal categories');
  });

  it('never rejects, whatever the provider does', async () => {
    const explode = stubClient(() => Promise.reject(new Error('kaboom')));

    await expect(
      triageLegalIssue({ description: DESCRIPTION, categories: CATEGORIES }, explode),
    ).resolves.toMatchObject({ status: 'FAILED_FALLBACK' });
  });
});

describe('FR-010 fallback content', () => {
  it("substitutes the user's own words rather than an invented summary", async () => {
    const result = await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      null,
    );

    expect(result.summary).toBe(DESCRIPTION);
    expect(result.confidence).toBeNull();
    expect(result.urgency).toBe('NORMAL');
    expect(result.keywords).toEqual([]);
  });

  it('truncates a very long description instead of storing it twice in full', async () => {
    const long = 'a'.repeat(2000);

    const result = await triageLegalIssue({ description: long, categories: CATEGORIES }, null);

    expect(result.summary.length).toBeLessThan(long.length);
    expect(result.summary.endsWith('…')).toBe(true);
  });
});

describe('NFR-002 safe logging', () => {
  it('AI-TC-013: never writes the enquiry text to the log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await triageLegalIssue(
      { description: DESCRIPTION, categories: CATEGORIES },
      stubClient(async () => {
        throw new Error('provider returned HTTP 500');
      }),
    );

    expect(warn).toHaveBeenCalled();
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain(DESCRIPTION);
    expect(logged).not.toContain('dismissed me last month');
    expect(logged).toContain('descriptionChars');
  });
});

describe('CON-003 prompt boundaries', () => {
  it('AI-TC-007: instructs the model against advice, blame, and fabrication', () => {
    const prompt = `${TRIAGE_SYSTEM_PROMPT}\n${buildTriageUserPrompt(CATEGORIES, DESCRIPTION)}`;

    for (const phrase of ['never', 'legal advice', 'liable', 'predict', 'invent']) {
      expect(prompt.toLowerCase()).toContain(phrase);
    }
  });

  it('tells the model to treat the enquiry as data, not as instructions', () => {
    expect(TRIAGE_SYSTEM_PROMPT.toLowerCase()).toContain('ignore them');
  });
});
