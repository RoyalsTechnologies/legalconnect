import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    isTest: false,
    isProduction: true,
    isNaloPayConfigured: false,
    isSmsConfigured: false,
    isEmailConfigured: false,
  };
});

import { sendEmail } from '../src/email/mailer.js';
import { startPayment, startPayout, verifyPayment, verifyPayout } from '../src/payments/nalopay.js';
import { sendSms } from '../src/sms/sms-client.js';

describe('Adapters without live credentials', () => {
  it('refuses collection and payout in production', async () => {
    await expect(
      startPayment({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/not configured/i);
    await expect(
      startPayout({
        accountName: 'Ama',
        phone: '0244123456',
        amountPesewas: 100,
        reference: 'r',
        description: 'x',
      }),
    ).rejects.toThrow(/not configured/i);
  });

  it('does not verify transfers in production without credentials', async () => {
    await expect(
      verifyPayment({ reference: 'r', expectedPesewas: 100, orderId: 'o' }),
    ).resolves.toBe(false);
    await expect(
      verifyPayout({ reference: 'r', expectedPesewas: 100, orderId: 'o' }),
    ).resolves.toBe(false);
  });

  it('logs email and SMS instead of sending', async () => {
    await expect(
      sendEmail({ to: 'a@b.c', subject: 's', text: 't', html: '<p>t</p>' }),
    ).resolves.toBeUndefined();
    await expect(sendSms('0244123456', 'hello')).resolves.toBeUndefined();
    await expect(sendSms(null, 'hello')).resolves.toBeUndefined();
  });
});
