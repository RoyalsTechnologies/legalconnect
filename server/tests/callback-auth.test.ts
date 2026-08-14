import { createHmac } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    isNaloPayConfigured: true,
    env: {
      ...actual.env,
      NALOPAY_MERCHANT_SECRET_KEY: 'callback-secret',
    },
  };
});

vi.mock('../src/modules/consultations/consultations.service.js', () => ({
  capturePaidCallback: vi.fn(async () => false),
}));
vi.mock('../src/modules/subscriptions/subscriptions.service.js', () => ({
  capturePaidCallback: vi.fn(async () => false),
}));
vi.mock('../src/modules/wallet/wallet.service.js', () => ({
  capturePayoutCallback: vi.fn(async () => false),
}));

import { createApp } from '../src/app.js';

const app = createApp();
const SECRET = 'callback-secret';

function sign(raw: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const s = createHmac('sha256', SECRET).update(`${nowSeconds}.${raw}`).digest('hex');
  return `t=${nowSeconds},s=${s}`;
}

describe('NaloPay callback HMAC (FR-017)', () => {
  it('rejects a missing or invalid signature', async () => {
    const res = await request(app)
      .post('/api/v1/payments/callback')
      .set('Content-Type', 'application/json')
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/signature/i);
  });

  it('rejects a signed body that is not JSON', async () => {
    const raw = 'not-json';
    const res = await request(app)
      .post('/api/v1/payments/callback')
      .set('Content-Type', 'application/json')
      .set('nalopay-signature', sign(raw))
      .send(raw);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not valid JSON/i);
  });

  it('acknowledges a signed callback for an unknown order', async () => {
    const raw = JSON.stringify({
      status: 'COMPLETED',
      amount: '50.00',
      reference: 'unknown-ref-zzzz',
      order_id: 'unknown-order',
    });
    const res = await request(app)
      .post('/api/v1/payments/callback')
      .set('Content-Type', 'application/json')
      .set('nalopay-signature', sign(raw))
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
