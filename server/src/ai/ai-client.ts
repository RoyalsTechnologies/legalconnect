import { env } from '../config/env.js';

export interface AiCompletionRequest {
  system: string;
  user: string;
}

// The whole provider surface the rest of the application is allowed to see. Keeping
// it this narrow is what makes NFR-005 checkable: no provider detail, no SDK type,
// and no HTTP concept crosses this boundary.
export interface AiClient {
  complete(request: AiCompletionRequest): Promise<string>;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

// Deliberately plain fetch rather than a provider SDK. The request is one POST and
// the response is one string, so an SDK would add a dependency and a supply-chain
// surface without removing any real work. Node 22 supplies fetch and AbortSignal.
function createHttpAiClient(apiKey: string): AiClient {
  return {
    async complete({ system, user }) {
      let response: Response;

      try {
        response = await fetch(`${env.AI_PROVIDER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
            // OpenRouter uses these for app attribution; other OpenAI-compatible
            // gateways ignore them.
            'HTTP-Referer': env.CLIENT_ORIGIN,
            'X-Title': 'LegalConnect Ghana',
          },
          body: JSON.stringify({
            model: env.AI_PROVIDER_MODEL,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
          signal: AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        // Timeout and network faults look identical to callers on purpose — both
        // mean "no usable answer", and both take the same fallback path.
        const reason =
          error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'network error';
        throw new AiProviderError(`provider request ${reason}`);
      }

      if (!response.ok) {
        // Status only. A provider error body can echo the request back, which would
        // put the user's legal issue into the logs (NFR-002).
        throw new AiProviderError(`provider returned HTTP ${response.status}`);
      }

      let body: ChatCompletionResponse;
      try {
        body = (await response.json()) as ChatCompletionResponse;
      } catch {
        throw new AiProviderError('provider returned a non-JSON envelope');
      }

      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new AiProviderError('provider returned an empty completion');
      }

      return content;
    },
  };
}

let cached: AiClient | null | undefined;

/** Clears the cached client so tests can change the configured key. */
export function resetAiClientCache(): void {
  cached = undefined;
}

// Returns null when no key is configured. Null is a supported state, not an error:
// callers treat it exactly like an unreachable provider.
export function getAiClient(): AiClient | null {
  if (cached === undefined) {
    const apiKey = env.AI_PROVIDER_API_KEY?.trim();
    cached = apiKey ? createHttpAiClient(apiKey) : null;
  }
  return cached;
}

export function isAiConfigured(): boolean {
  return getAiClient() !== null;
}
