import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env, isNaloPayConfigured, isProduction, isTest } from '../config/env.js';
import { badRequest, serviceUnavailable, unprocessable } from '../lib/errors.js';
import { lastDigits, log } from '../lib/logger.js';
import { pesewasToGhs } from '../lib/money.js';
import { normalizeMsisdn } from '../sms/sms-client.js';

export type MomoNetwork = 'MTN' | 'AT' | 'TELECEL';

export type PaymentStart = {
  reference: string;
  orderId: string | null;
  /** Present when the client must leave the app to finish paying. NaloPay MoMo does not. */
  authorizationUrl: string | null;
  /** True when the adapter already captured the payment (test / log mode). */
  captured: boolean;
  paymentHint: string | null;
};

type NaloPayEnvelope<T> = {
  success?: boolean;
  code?: string;
  message?: string;
  error?: { cause?: string; description?: string };
  data?: T;
};

const SIGNATURE_SKEW_SECONDS = 600;

// NaloPay collection rejects underscores and long values
// (PAY-INVAL-0060, cause: reference, "Invalid reference").
const REFERENCE_HEX_BYTES = 10;

export function newPaymentReference(_entityId?: string): string {
  return `LCP${randomBytes(REFERENCE_HEX_BYTES).toString('hex')}`;
}

export function newPayoutReference(kind: 'rf' | 'wd', _entityId?: string): string {
  return `${kind === 'rf' ? 'LCR' : 'LCW'}${randomBytes(REFERENCE_HEX_BYTES).toString('hex')}`;
}

function gatewayDetail(body: NaloPayEnvelope<unknown> | null): string | undefined {
  return body?.error?.description || body?.message;
}

/**
 * NaloPay answers a refused amount with "Invalid value for amount", which the payer can
 * do nothing about — the figure is the plan or consultation price, not something they
 * typed. Every other cause names a field they do control, so that wording is kept.
 */
function rejectionMessage(body: NaloPayEnvelope<unknown> | null, amount: string): string {
  if (body?.error?.cause === 'amount') {
    return `The payment service would not accept a charge of GHS ${amount}. Nothing has been charged.`;
  }
  return (
    gatewayDetail(body) ||
    'The payment service rejected those details. Check the mobile money number and network.'
  );
}

/** Amount string used in both the request body and trans_hash (two decimal places). */
export function amountForHash(amountPesewas: number): string {
  return pesewasToGhs(amountPesewas).toFixed(2);
}

export function transHashMessage(input: {
  merchantId: string;
  accountNumber: string;
  amount: string;
  reference: string;
}): string {
  return `${input.merchantId}${input.accountNumber}${input.amount}${input.reference}`;
}

export function computeTransHash(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

export function parseNalopaySignatureHeader(header: string): { t: string; s: string } | null {
  const parts: Record<string, string> = {};
  for (const piece of header.split(',')) {
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    const key = piece.slice(0, eq).trim();
    const value = piece.slice(eq + 1).trim();
    if (key && value) parts[key] = value;
  }
  if (!parts.t || !parts.s) return null;
  return { t: parts.t, s: parts.s };
}

export function verifyCallbackSignature(
  rawBody: string,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const parsed = parseNalopaySignatureHeader(header);
  if (!parsed) return false;

  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > SIGNATURE_SKEW_SECONDS) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${parsed.t}.${rawBody}`).digest('hex');

  return hexEqual(expected, parsed.s);
}

function hexEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    if (left.length === 0 || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * Infers MTN / AT / TELECEL from a Ghana MSISDN. Returns null when the prefix
 * is unknown so the caller can require an explicit network.
 */
export function inferMomoNetwork(msisdn: string): MomoNetwork | null {
  const digits = msisdn.replace(/\D/g, '');
  const local =
    digits.startsWith('233') && digits.length >= 5
      ? digits.slice(3, 5)
      : digits.startsWith('0') && digits.length >= 3
        ? digits.slice(1, 3)
        : digits.slice(0, 2);

  if (['24', '25', '53', '54', '55', '59'].includes(local)) return 'MTN';
  if (['26', '27', '56', '57'].includes(local)) return 'AT';
  if (['20', '50'].includes(local)) return 'TELECEL';
  return null;
}

export function pesewasFromAmount(amount: string | number): number | null {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function isPaidStatus(status: string | undefined): boolean {
  return status !== undefined && ['COMPLETED', 'SUCCESS', 'PAID'].includes(status.toUpperCase());
}

function basicAuthHeader(): string {
  const raw = env.NALOPAY_BASIC_AUTH!.trim();
  return /^basic\s/i.test(raw) ? raw : `Basic ${raw}`;
}

function nalopayUrl(path: string): string {
  const base = env.NALOPAY_BASE_URL!.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function callbackUrl(): string {
  return env.NALOPAY_CALLBACK_URL ?? `http://localhost:${env.PORT}/api/v1/payments/callback`;
}

/**
 * NaloPay collection docs hash `account_number` as a local Ghana MSISDN
 * (`0241234567`), not E.164. Sending `233…` is a PAY-INVAL rejection.
 */
export function toNaloPayAccountNumber(msisdn: string): string {
  const digits = msisdn.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith('0') && digits.length === 10) return digits;
  return digits;
}

/** Gateway network names differ from the in-app MTN / AT / TELECEL enum. */
export function toNaloPayNetwork(network: MomoNetwork): 'MTN' | 'VODAFONE' | 'AIRTELTIGO' {
  if (network === 'AT') return 'AIRTELTIGO';
  if (network === 'TELECEL') return 'VODAFONE';
  return 'MTN';
}

/**
 * NaloPay collection requires `callback` and rejects loopback / http
 * (PAY-INVAL-0069). Local work still confirms via collection-status.
 */
export const FALLBACK_COLLECTION_CALLBACK = 'https://example.com/api/v1/payments/callback';

/** Omit loopback / http callbacks — NaloPay rejects them as PAY-INVAL. */
export function publicCallbackUrl(raw = callbackUrl()): string | undefined {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return undefined;
    if (parsed.protocol !== 'https:') return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

/** Always an https URL — omitting the field is also PAY-INVAL-0069. */
export function collectionCallbackUrl(raw = callbackUrl()): string {
  return publicCallbackUrl(raw) ?? FALLBACK_COLLECTION_CALLBACK;
}

function asciiField(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function generatePaymentToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(nalopayUrl('/clientapi/generate-payment-token/'), {
      method: 'POST',
      headers: {
        authorization: basicAuthHeader(),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ merchant_id: env.NALOPAY_MERCHANT_ID }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw serviceUnavailable('The payment service could not be reached. Please try again.');
  }

  const body = await readJson<NaloPayEnvelope<{ token?: string }>>(response);
  const token = body?.data?.token;
  if (!response.ok || !body?.success || !token) {
    log.payment.error('token failed', { status: response.status, code: body?.code });
    throw serviceUnavailable('Could not start the payment. Please try again in a few minutes.');
  }
  return token;
}

/**
 * Starts a mobile-money collection for a consultation fee or plan payment.
 *
 * NaloPay when configured. Tests always capture immediately. Local development
 * without credentials logs and captures, matching the email/SMS adapters.
 * Production without credentials is a 503 — we must not pretend a live booking was paid.
 */
export async function startPayment(input: {
  accountName: string;
  phone: string;
  network?: MomoNetwork;
  amountPesewas: number;
  reference: string;
  description: string;
}): Promise<PaymentStart> {
  return startMomoTransfer('/clientapi/collection/', input);
}

/**
 * Sends MoMo to a number (lawyer withdrawal or client refund).
 *
 * Live path `/clientapi/disbursement/` is not verified against merchant docs (TD-028).
 * Tests and local-without-credentials capture immediately, same as collection.
 * Production without credentials, or a rejected live call, is a 503 — do not pretend money moved.
 */
export async function startPayout(input: {
  accountName: string;
  phone: string;
  network?: MomoNetwork;
  amountPesewas: number;
  reference: string;
  description: string;
}): Promise<PaymentStart> {
  return startMomoTransfer('/clientapi/disbursement/', input);
}

async function startMomoTransfer(
  path: '/clientapi/collection/' | '/clientapi/disbursement/',
  input: {
    accountName: string;
    phone: string;
    network?: MomoNetwork;
    amountPesewas: number;
    reference: string;
    description: string;
  },
): Promise<PaymentStart> {
  const kind = path.includes('disbursement') ? 'payout' : 'payments';

  if (isTest) {
    return {
      reference: input.reference,
      orderId: null,
      authorizationUrl: null,
      captured: true,
      paymentHint: null,
    };
  }

  if (!isNaloPayConfigured) {
    if (isProduction) {
      throw serviceUnavailable(
        'Card and mobile-money payments are not configured yet. Please try again later.',
      );
    }
    log.payment.info(`${kind} captured (credentials unset)`, {
      reference: input.reference,
      amountPesewas: input.amountPesewas,
      toLast4: lastDigits(input.phone),
    });
    return {
      reference: input.reference,
      orderId: null,
      authorizationUrl: null,
      captured: true,
      paymentHint: null,
    };
  }

  const e164 = normalizeMsisdn(input.phone);
  if (!e164) {
    throw badRequest('Enter a valid Ghana mobile money number, e.g. 0244123456');
  }

  const accountNumber = toNaloPayAccountNumber(e164);
  const network = input.network ?? inferMomoNetwork(e164) ?? inferMomoNetwork(accountNumber);
  if (!network) {
    throw badRequest(
      'Choose the mobile money network for that number (MTN, AirtelTigo, or Telecel).',
    );
  }

  const amount = amountForHash(input.amountPesewas);
  const token = await generatePaymentToken();
  const transHash = computeTransHash(
    transHashMessage({
      merchantId: env.NALOPAY_MERCHANT_ID!,
      accountNumber,
      amount,
      reference: input.reference,
    }),
    env.NALOPAY_MERCHANT_SECRET_KEY!,
  );

  const callback = collectionCallbackUrl();
  const payload: Record<string, string> = {
    merchant_id: env.NALOPAY_MERCHANT_ID!,
    service_name: 'MOMO_TRANSACTION',
    trans_hash: transHash,
    account_number: accountNumber,
    account_name: asciiField(input.accountName, 'LegalConnect'),
    network: toNaloPayNetwork(network),
    amount,
    reference: input.reference,
    description: asciiField(input.description, 'LegalConnect payment'),
    callback,
  };

  let response: Response;
  try {
    response = await fetch(nalopayUrl(path), {
      method: 'POST',
      headers: {
        token,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw serviceUnavailable('The payment service could not be reached. Please try again.');
  }

  const body =
    await readJson<NaloPayEnvelope<{ order_id?: string; status?: string; otp_code?: string }>>(
      response,
    );

  const orderId = body?.data?.order_id;
  if (!response.ok || !body?.success || !orderId) {
    log.payment.error(`${kind} ${path} failed`, {
      status: response.status,
      code: body?.code,
      cause: body?.error?.cause,
      message: gatewayDetail(body),
      accountLength: accountNumber.length,
      network: payload.network,
      amount,
      callbackHost: new URL(callback).hostname,
    });
    if (typeof body?.code === 'string' && body.code.startsWith('PAY-INVAL')) {
      throw unprocessable(rejectionMessage(body, amount));
    }
    throw serviceUnavailable(
      kind === 'payout'
        ? 'Could not send that mobile money payout. Please try again in a few minutes.'
        : 'Could not start the payment. Please try again in a few minutes.',
    );
  }

  const otp = body.data?.otp_code && body.data.otp_code !== 'None' ? body.data.otp_code : null;
  const paymentHint = otp
    ? `Approve the mobile money prompt on ${accountNumber}. If asked, use ${otp}.`
    : kind === 'payout'
      ? `A mobile money transfer was sent to ${accountNumber}.`
      : `Approve the mobile money prompt sent to ${accountNumber}.`;

  return {
    reference: input.reference,
    orderId,
    authorizationUrl: null,
    captured: false,
    paymentHint,
  };
}

export async function verifyPayment(input: {
  reference: string;
  expectedPesewas: number;
  orderId: string | null;
}): Promise<boolean> {
  return verifyMomoTransfer('/clientapi/collection-status/', input);
}

export async function verifyPayout(input: {
  reference: string;
  expectedPesewas: number;
  orderId: string | null;
}): Promise<boolean> {
  return verifyMomoTransfer('/clientapi/disbursement-status/', input);
}

async function verifyMomoTransfer(
  path: '/clientapi/collection-status/' | '/clientapi/disbursement-status/',
  input: {
    reference: string;
    expectedPesewas: number;
    orderId: string | null;
  },
): Promise<boolean> {
  if (isTest) return true;

  if (!isNaloPayConfigured) {
    if (isProduction) return false;
    return true;
  }

  if (!input.orderId) return false;

  const token = await generatePaymentToken().catch(() => null);
  if (!token) return false;

  let response: Response;
  try {
    response = await fetch(nalopayUrl(path), {
      method: 'POST',
      headers: {
        token,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: env.NALOPAY_MERCHANT_ID,
        order_id: input.orderId,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return false;
  }

  if (!response.ok) return false;

  const body =
    await readJson<
      NaloPayEnvelope<{
        status?: string;
        amount?: number | string;
        reference?: string;
      }>
    >(response);

  if (!body?.success || !body.data) return false;

  const paidPesewas = pesewasFromAmount(body.data.amount ?? NaN);
  return (
    isPaidStatus(body.data.status) &&
    paidPesewas === input.expectedPesewas &&
    (body.data.reference === undefined || body.data.reference === input.reference)
  );
}
