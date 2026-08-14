import { isSessionEndedMessage } from '../auth/session';

const API_BASE = '/api/v1';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Array<{ path?: (string | number)[]; message: string }> | unknown;
  };
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: ApiErrorBody['error']['details'];

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

/** Auth endpoints that return 401 for credential problems, not a dead session. */
const CREDENTIAL_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/logout',
]);

export function getToken(): string | null {
  return localStorage.getItem('lc_token');
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('lc_token', token);
  else localStorage.removeItem('lc_token');
}

/** Subscribe to a stored JWT that the API has rejected as expired or invalid. */
export function onSessionInvalid(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function notifySessionInvalid(): void {
  setToken(null);
  for (const listener of sessionListeners) listener();
}

function shouldEndSession(
  path: string,
  status: number,
  message: string,
  sentToken: boolean,
): boolean {
  return (
    status === 401 &&
    sentToken &&
    !CREDENTIAL_AUTH_PATHS.has(path) &&
    isSessionEndedMessage(message)
  );
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    const errorBody = body?.error ?? {
      code: 'UNKNOWN',
      message: `Request failed (${response.status})`,
    };
    if (shouldEndSession(path, response.status, errorBody.message, Boolean(token))) {
      notifySessionInvalid();
    }
    throw new ApiError(response.status, errorBody);
  }

  return data as T;
}

export function fieldErrorsFromApi(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return {};
  const fields: Record<string, string> = {};
  for (const issue of error.details) {
    if (!issue || typeof issue !== 'object' || !('message' in issue)) continue;
    const name = fieldNameFromIssue(issue);
    if (name && typeof issue.message === 'string') fields[name] = issue.message;
  }
  return fields;
}

function fieldNameFromIssue(issue: object): string {
  if ('field' in issue && typeof issue.field === 'string') return issue.field;
  if ('path' in issue && Array.isArray(issue.path)) return issue.path.join('.');
  return '';
}
