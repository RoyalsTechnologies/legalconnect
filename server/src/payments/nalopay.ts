import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env, isNaloPayConfigured, isProduction, isTest } from '../config/env.js';
import { badRequest, serviceUnavailable } from '../lib/errors.js';
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
  data?: T;
};

const SIGNATURE_SKEW_SECONDS = 600;

export function newPaymentReference(consultationId: string): string {
  return `lc_${consultationId}_${randomBytes(8).toString('hex')}`;
}

export function newPayoutReference(kind: 'rf' | 'wd', entityId: string): string {
  return `lc_${kind}_${entityId}_${randomBytes(8).toString('hex')}`;
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
    console.error('[payments] token failed', response.status, body?.code);
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
    console.info(
      `[${kind}:log] capture reference=${input.reference} amount=${input.amountPesewas} to=${input.phone}`,
    );
    return {
      reference: input.reference,
      orderId: null,
      authorizationUrl: null,
      captured: true,
      paymentHint: null,
    };
  }

  const accountNumber = normalizeMsisdn(input.phone);
  if (!accountNumber) {
    throw badRequest('Enter a valid Ghana mobile money number, e.g. 0244123456');
  }

  const network = input.network ?? inferMomoNetwork(accountNumber);
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
        service_name: 'MOMO_TRANSACTION',
        trans_hash: transHash,
        account_number: accountNumber,
        account_name: input.accountName,
        network,
        amount,
        reference: input.reference,
        callback: callbackUrl(),
        description: input.description,
        extra_data: { reference: input.reference },
      }),
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
    console.error(`[${kind}] ${path} failed`, response.status, body?.code, body?.message);
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
