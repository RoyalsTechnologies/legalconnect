import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    isNaloPayConfigured: false,
    env: {
      ...actual.env,
      NALOPAY_MERCHANT_SECRET_KEY: undefined,
    },
  };
});

import { createApp } from '../src/app.js';

const app = createApp();

describe('NaloPay callback when credentials are absent', () => {
  it('refuses the webhook rather than accepting an unsigned body', async () => {
    const res = await request(app)
      .post('/api/v1/payments/callback')
      .set('Content-Type', 'application/json')
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/not configured/i);
  });
});
