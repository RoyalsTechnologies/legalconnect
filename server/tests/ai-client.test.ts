import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      AI_PROVIDER_API_KEY: 'sk-test-key',
      AI_PROVIDER_BASE_URL: 'https://ai.test/v1',
      AI_PROVIDER_MODEL: 'test-model',
      AI_REQUEST_TIMEOUT_MS: 5000,
      CLIENT_ORIGIN: 'http://localhost:5173',
    },
  };
});

import { getAiClient, isAiConfigured, resetAiClientCache } from '../src/ai/ai-client.js';

describe('HTTP AI client (NFR-005)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    resetAiClientCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAiClientCache();
  });

  it('is configured when a provider key is present', () => {
    expect(isAiConfigured()).toBe(true);
  });

  it('returns the completion content from a chat envelope', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    });

    const content = await getAiClient()!.complete({ system: 'sys', user: 'user' });
    expect(content).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test-key');
  });

  it('maps a timeout to a provider error', async () => {
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);
    await expect(getAiClient()!.complete({ system: 's', user: 'u' })).rejects.toThrow(
      /provider request timed out/,
    );
  });

  it('maps a network fault to a provider error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(getAiClient()!.complete({ system: 's', user: 'u' })).rejects.toThrow(
      /provider request network error/,
    );
  });

  it('does not log provider error bodies on a non-OK status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'nope' }) });
    await expect(getAiClient()!.complete({ system: 's', user: 'u' })).rejects.toThrow(
      /provider returned HTTP 502/,
    );
  });

  it('rejects a non-JSON envelope', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    });
    await expect(getAiClient()!.complete({ system: 's', user: 'u' })).rejects.toThrow(
      /non-JSON envelope/,
    );
  });

  it('rejects an empty completion', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '   ' } }] }),
    });
    await expect(getAiClient()!.complete({ system: 's', user: 'u' })).rejects.toThrow(
      /empty completion/,
    );
  });

  it('rejects a missing choices array', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    await expect(getAiClient()!.complete({ system: 's', user: 'u' })).rejects.toThrow(
      /empty completion/,
    );
  });
});
