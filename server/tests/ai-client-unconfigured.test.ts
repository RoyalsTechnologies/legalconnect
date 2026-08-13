import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      AI_PROVIDER_API_KEY: undefined,
    },
  };
});

import { getAiClient, isAiConfigured, resetAiClientCache } from '../src/ai/ai-client.js';

describe('HTTP AI client when no key is set', () => {
  afterEach(() => {
    resetAiClientCache();
  });

  it('is unconfigured and returns null', () => {
    resetAiClientCache();
    expect(isAiConfigured()).toBe(false);
    expect(getAiClient()).toBeNull();
  });
});
