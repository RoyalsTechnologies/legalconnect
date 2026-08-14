/** JWT `exp` as a unix-ms timestamp, or null when the token is not a JWT with `exp`. */
export function tokenExpiresAtMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    if (typeof json.exp !== 'number' || !Number.isFinite(json.exp)) return null;
    return json.exp * 1000;
  } catch {
    return null;
  }
}

function decodeBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

/**
 * 401 messages that mean the stored session is no longer usable.
 * Credential failures ("Invalid email or password", "Current password is incorrect")
 * are deliberately excluded so a wrong password does not sign the user out.
 */
export function isSessionEndedMessage(message: string): boolean {
  return (
    message === 'Session expired' ||
    message === 'Invalid token' ||
    message === 'Malformed token' ||
    message === 'Account no longer exists' ||
    message === 'Authentication required'
  );
}
