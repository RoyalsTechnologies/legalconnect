import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    isTest: false,
    isProduction: false,
    isNaloPayConfigured: false,
  };
});

import { startPayment, startPayout, verifyPayment, verifyPayout } from '../src/payments/nalopay.js';

describe('NaloPay development log-and-capture path', () => {
  const sample = {
    accountName: 'Ama',
    phone: '0244123456',
    amountPesewas: 100,
    reference: 'dev-ref',
    description: 'x',
  };

  it('captures collection and payout locally when credentials are absent', async () => {
    await expect(startPayment(sample)).resolves.toMatchObject({
      captured: true,
      reference: 'dev-ref',
      orderId: null,
    });
    await expect(startPayout(sample)).resolves.toMatchObject({ captured: true });
  });

  it('treats verification as paid in non-production without credentials', async () => {
    await expect(
      verifyPayment({ reference: 'r', expectedPesewas: 100, orderId: 'o' }),
    ).resolves.toBe(true);
    await expect(
      verifyPayout({ reference: 'r', expectedPesewas: 100, orderId: 'o' }),
    ).resolves.toBe(true);
  });
});
