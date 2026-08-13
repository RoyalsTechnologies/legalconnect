import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(async () => {
      throw new Error('db down');
    }),
  },
}));

import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health when the database is down', () => {
  it('reports degraded rather than throwing', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', database: 'unavailable' });
  });
});
