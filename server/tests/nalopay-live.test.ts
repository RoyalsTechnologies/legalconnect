import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    isTest: false,
    isProduction: false,
    isNaloPayConfigured: true,
    env: {
      ...actual.env,
      PORT: 4000,
      NALOPAY_MERCHANT_ID: 'MERCH',
      NALOPAY_BASIC_AUTH: 'rawtoken',
      NALOPAY_MERCHANT_SECRET_KEY: 'secret',
      NALOPAY_BASE_URL: 'https://nalopay.test/',
      NALOPAY_CALLBACK_URL: undefined,
    },
  };
});

import {
  computeTransHash,
  FALLBACK_COLLECTION_CALLBACK,
  newPaymentReference,
  newPayoutReference,
  startPayment,
  startPayout,
  transHashMessage,
  verifyCallbackSignature,
  verifyPayment,
  verifyPayout,
} from '../src/payments/nalopay.js';

function jsonOk(data: unknown, success = true, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success, data }),
  };
}

function fetchBody(
  fetchMock: { mock: { calls: unknown[][] } },
  index: number,
): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined;
  if (!init?.body) throw new Error(`fetch call ${index} has no body`);
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe('NaloPay live collection and payout', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mints short alphanumeric payment and payout references', () => {
    expect(newPaymentReference('c1')).toMatch(/^LCP[a-f0-9]{20}$/);
    expect(newPayoutReference('wd', 'w1')).toMatch(/^LCW[a-f0-9]{20}$/);
    expect(newPayoutReference('rf', 'r1')).toMatch(/^LCR[a-f0-9]{20}$/);
  });

  it('rejects a signature header that is not t=,s=', () => {
    expect(verifyCallbackSignature('{}', 'nope', 'secret')).toBe(false);
    expect(verifyCallbackSignature('{}', 't=1,s=zz', 'secret', 1)).toBe(false);
  });

  it('UT-019: collection payload matches the NaloPay contract (FR-017)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockResolvedValueOnce(jsonOk({ order_id: 'ord' }));

    const reference = 'LCP0123456789abcdef0123';
    await startPayment({
      accountName: 'Ama Mensah',
      phone: '+233244123456',
      network: 'MTN',
      amountPesewas: 15000,
      reference,
      description: 'LegalConnect Starter plan (1 month) — Ama',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://nalopay.test/clientapi/generate-payment-token/',
    );
    expect(fetchBody(fetchMock, 0)).toEqual({
      merchant_id: 'MERCH',
    });

    const body = fetchBody(fetchMock, 1);
    expect(body).toEqual({
      merchant_id: 'MERCH',
      service_name: 'MOMO_TRANSACTION',
      trans_hash: computeTransHash(
        transHashMessage({
          merchantId: 'MERCH',
          accountNumber: '0244123456',
          amount: '150.00',
          reference,
        }),
        'secret',
      ),
      account_number: '0244123456',
      account_name: 'Ama Mensah',
      network: 'MTN',
      amount: '150.00',
      reference,
      description: 'LegalConnect Starter plan (1 month) Ama',
      callback: FALLBACK_COLLECTION_CALLBACK,
    });
    expect(String(body.reference)).not.toMatch(/_/);
    expect(body).not.toHaveProperty('extra_data');
  });

  it('collects after generating a token, including an OTP hint', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok_1' }))
      .mockResolvedValueOnce(jsonOk({ order_id: 'ord_1', otp_code: '1234' }));

    const started = await startPayment({
      accountName: 'Ama',
      phone: '0244123456',
      amountPesewas: 5000,
      reference: 'ref-1',
      description: 'fee',
    });

    expect(started.orderId).toBe('ord_1');
    expect(started.captured).toBe(false);
    expect(started.paymentHint).toContain('1234');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/clientapi/generate-payment-token/');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/clientapi/collection/');
  });

  it('uses an explicit network and a payout-specific hint without OTP', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok_1' }))
      .mockResolvedValueOnce(jsonOk({ order_id: 'ord_2', otp_code: 'None' }));

    const started = await startPayout({
      accountName: 'Akua',
      phone: '0274123456',
      network: 'AT',
      amountPesewas: 15000,
      reference: 'ref-2',
      description: 'withdrawal',
    });

    expect(started.orderId).toBe('ord_2');
    expect(started.paymentHint).toMatch(/transfer was sent/i);
  });

  it('rejects an unusable MoMo number before calling the gateway', async () => {
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '12',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/valid Ghana mobile money number/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown network prefix', async () => {
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '233111111111',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/Choose the mobile money network/i);
  });

  it('surfaces a token endpoint failure as 503', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({}, false, 500));
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/Could not start the payment/i);
  });

  it('surfaces a token network fault as 503', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/could not be reached/i);
  });

  it('surfaces a collection failure as 503', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ token: 'tok' })).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ success: false, code: 'FAIL', message: 'no' }),
    });
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/Could not start the payment/i);
  });

  it('surfaces a payout collection failure as 503', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ token: 'tok' })).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ success: false }),
    });
    await expect(
      startPayout({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/Could not send that mobile money payout/i);
  });

  it('surfaces a collection network fault as 503', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockRejectedValueOnce(new Error('timeout'));
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/could not be reached/i);
  });

  it('verifies a matching paid collection', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockResolvedValueOnce(jsonOk({ status: 'PAID', amount: '50.00', reference: 'ref-1' }));

    await expect(
      verifyPayment({ reference: 'ref-1', expectedPesewas: 5000, orderId: 'ord' }),
    ).resolves.toBe(true);
  });

  it('returns false when verification has no order id', async () => {
    await expect(
      verifyPayout({ reference: 'ref', expectedPesewas: 100, orderId: null }),
    ).resolves.toBe(false);
  });

  it('returns false when the token call fails during verify', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(
      verifyPayment({ reference: 'ref', expectedPesewas: 100, orderId: 'ord' }),
    ).resolves.toBe(false);
  });

  it('returns false when status HTTP is not OK', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ token: 'tok' })).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(
      verifyPayment({ reference: 'ref', expectedPesewas: 100, orderId: 'ord' }),
    ).resolves.toBe(false);
  });

  it('returns false when status JSON is unreadable', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ token: 'tok' })).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('nope');
      },
    });
    await expect(
      verifyPayment({ reference: 'ref', expectedPesewas: 100, orderId: 'ord' }),
    ).resolves.toBe(false);
  });

  it('returns false when the paid amount does not match', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockResolvedValueOnce(jsonOk({ status: 'COMPLETED', amount: '1.00', reference: 'ref' }));
    await expect(
      verifyPayment({ reference: 'ref', expectedPesewas: 5000, orderId: 'ord' }),
    ).resolves.toBe(false);
  });

  it('returns false when the status fetch throws', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockRejectedValueOnce(new Error('offline'));
    await expect(
      verifyPayment({ reference: 'ref', expectedPesewas: 100, orderId: 'ord' }),
    ).resolves.toBe(false);
  });

  it('uses TELECEL when that network is supplied', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockResolvedValueOnce(jsonOk({ order_id: 'ord_t' }));

    await startPayment({
      accountName: 'Ama',
      phone: '0204123456',
      network: 'TELECEL',
      amountPesewas: 100,
      reference: 'r',
      description: 'x',
    });

    const init = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(init?.body).toBeTruthy();
    const body = JSON.parse(String(init?.body)) as {
      account_number: string;
      network: string;
      callback?: string;
      extra_data?: unknown;
    };
    expect(body.account_number).toBe('0204123456');
    expect(body.network).toBe('VODAFONE');
    expect(body.callback).toBe(FALLBACK_COLLECTION_CALLBACK);
    expect(body.extra_data).toBeUndefined();
  });

  it('maps AirtelTigo onto AIRTELTIGO and sends a local MSISDN', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockResolvedValueOnce(jsonOk({ order_id: 'ord_at' }));

    await startPayment({
      accountName: 'Ama',
      phone: '0274123456',
      network: 'AT',
      amountPesewas: 100,
      reference: 'r',
      description: 'x',
    });

    const body = fetchBody(fetchMock, 1);
    expect(body.account_number).toBe('0274123456');
    expect(body.network).toBe('AIRTELTIGO');
  });

  it('surfaces a PAY-INVAL collection rejection as 422', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ token: 'tok' })).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        code: 'PAY-INVAL-0060',
        error: { cause: 'reference', description: 'Invalid reference' },
      }),
    });
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/Invalid reference/);
  });

  it('replaces the gateway wording when the refused field is the amount', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ token: 'tok' })).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        code: 'PAY-INVAL-0058',
        error: { cause: 'amount', description: 'Invalid value for amount' },
      }),
    });
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 15000,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/would not accept a charge of GHS 150\.00\. Nothing has been charged\./);
  });

  it('sends Basic auth when the stored token has no prefix', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockResolvedValueOnce(jsonOk({ order_id: 'ord' }));
    await startPayment({
      accountName: 'Ama',
      phone: '0244123456',
      amountPesewas: 100,
      reference: 'r',
      description: 'x',
    });
    const headers = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((headers.headers as Record<string, string>).authorization).toBe('Basic rawtoken');
  });

  it('surfaces a token envelope that cannot be parsed as 503', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('nope');
      },
    });
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/Could not start the payment/i);
  });

  it('returns false when verification JSON has no success payload', async () => {
    fetchMock.mockResolvedValueOnce(jsonOk({ token: 'tok' })).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: false }),
    });
    await expect(
      verifyPayment({ reference: 'ref', expectedPesewas: 100, orderId: 'ord' }),
    ).resolves.toBe(false);
  });

  it('returns false when the verified reference does not match', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ token: 'tok' }))
      .mockResolvedValueOnce(jsonOk({ status: 'PAID', amount: '1.00', reference: 'other' }));
    await expect(
      verifyPayment({ reference: 'ref', expectedPesewas: 100, orderId: 'ord' }),
    ).resolves.toBe(false);
  });

  it('ignores signature header pieces that are not key=value', () => {
    expect(verifyCallbackSignature('{}', 'nope,t=1,s=zz', 'secret')).toBe(false);
  });
});
