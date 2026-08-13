import { env, isSmsConfigured, isTest } from '../config/env.js';

/**
 * Normalises a Ghana (or E.164) phone number for the SMS gateway.
 * Returns digits only with country code (e.g. 233241234567), or null if unusable.
 */
export function normalizeMsisdn(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');

  if (digits.startsWith('0') && digits.length === 10) {
    digits = `233${digits.slice(1)}`;
  }

  if (digits.startsWith('233') && digits.length === 12) return digits;
  // Accept other E.164 lengths (10–15) so non-Ghana numbers still attempt delivery.
  if (digits.length >= 10 && digits.length <= 15) return digits;

  return null;
}

/**
 * Sends an SMS via the configured HTTP gateway (Nalo-style query params),
 * or logs when SMS is not configured / in tests. Never throws.
 */
export async function sendSms(to: string | null | undefined, message: string): Promise<void> {
  const destination = normalizeMsisdn(to);
  if (!destination) {
    if (to) console.info(`[sms:skip] unusable phone="${to}"`);
    return;
  }

  if (isTest) {
    console.info(`[sms:test] to=${destination} chars=${message.length}`);
    return;
  }

  if (!isSmsConfigured) {
    console.info(`[sms:log] to=${destination}\n${message}`);
    return;
  }

  const base = env.SMS_ENDPOINT!.replace(/\?+$/, '');
  const url = new URL(base);
  url.searchParams.set('username', env.SMS_USERNAME!);
  url.searchParams.set('password', env.SMS_PASSWORD!);
  url.searchParams.set('source', env.SMS_SENDER_ID!);
  url.searchParams.set('destination', destination);
  url.searchParams.set('message', message);
  url.searchParams.set('type', '0');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    if (!response.ok) {
      console.error(`[sms] gateway HTTP ${response.status}`, body.slice(0, 200));
      return;
    }
    // Nalo-style success often starts with 1701; treat other codes as soft failures.
    if (body.includes('1701') || /success/i.test(body)) {
      console.info(`[sms] sent to=${destination}`);
      return;
    }
    console.error(`[sms] unexpected gateway response`, body.slice(0, 200));
  } catch (error) {
    console.error('[sms] send failed', error);
  }
}
