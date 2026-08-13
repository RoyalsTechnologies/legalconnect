import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import './setup.js';

const app = createApp();

// The error handler is the only thing standing between an internal failure and the
// client. These cases cover the failures raised by Express itself rather than by
// application code, which are easy to leave falling through to a generic 500.
describe('NFR-001 error boundary', () => {
  it('IT-008: malformed JSON returns 400, not 500', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": broken');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });

  it('IT-009: an oversized body returns 413, not 500', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ fullName: 'a'.repeat(200_000), email: 'big@example.com', password: 'password123' });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('IT-010: an unknown route returns the standard error shape', async () => {
    const res = await request(app).get('/api/v1/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('reports a connected database on GET /api/health', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('SEC-LG-012: a token missing its role claim is rejected as malformed', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { env } = await import('../src/config/env.js');
    const tokenWithoutRole = jwt.sign({ sub: 'some-user-id' }, env.JWT_SECRET);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenWithoutRole}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Malformed token');
  });
});
