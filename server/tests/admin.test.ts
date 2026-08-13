import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from './setup.js';

const app = createApp();

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin-password-123';

async function adminToken(): Promise<string> {
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 4),
      fullName: 'Platform Administrator',
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.body.token as string;
}

async function userToken(email = 'kofi@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: 'Kofi Boateng', email, password: 'correct-horse-battery' });
  return res.body.token as string;
}

async function userIdFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.id;
}

describe('Administration (FR-015)', () => {
  it('IT-040: an admin lists platform users', async () => {
    const admin = await adminToken();
    await userToken();

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('IT-041: the user list can be filtered by role', async () => {
    const admin = await adminToken();
    await userToken();

    const res = await request(app)
      .get('/api/v1/admin/users?role=USER')
      .set('Authorization', `Bearer ${admin}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].role).toBe(Role.USER);
  });

  it('IT-042: an admin suspends an account and the holder loses access immediately', async () => {
    const admin = await adminToken();
    const citizen = await userToken();

    const suspended = await request(app)
      .patch(`/api/v1/admin/users/${await userIdFor('kofi@example.com')}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: UserStatus.SUSPENDED });

    const afterwards = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${citizen}`);

    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe(UserStatus.SUSPENDED);
    // 403 rather than 401: the token is still valid, the account is not permitted.
    // requireAuth re-reads status on every request, so this takes effect at once
    // rather than when the token expires.
    expect(afterwards.status).toBe(403);
  });

  it('IT-043: an admin reactivates a suspended account', async () => {
    const admin = await adminToken();
    await userToken();
    const id = await userIdFor('kofi@example.com');

    await request(app)
      .patch(`/api/v1/admin/users/${id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: UserStatus.SUSPENDED });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: UserStatus.ACTIVE });

    expect(res.body.status).toBe(UserStatus.ACTIVE);
  });

  it('SEC-LG-031: an admin cannot suspend their own account', async () => {
    const admin = await adminToken();

    const res = await request(app)
      .patch(`/api/v1/admin/users/${await userIdFor(ADMIN_EMAIL)}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: UserStatus.SUSPENDED });

    expect(res.status).toBe(400);
  });

  it('SEC-LG-032: a citizen cannot reach any admin endpoint', async () => {
    const citizen = await userToken();

    const list = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${citizen}`);
    const stats = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${citizen}`);

    expect(list.status).toBe(403);
    expect(stats.status).toBe(403);
  });

  it('IT-044: admin endpoints never expose password hashes', async () => {
    const admin = await adminToken();
    await userToken();

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${admin}`);

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('IT-045: platform statistics report the review queue and AI fallback count', async () => {
    const admin = await adminToken();

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    expect(res.body.intakes).toHaveProperty('needsReview');
    expect(res.body.intakes).toHaveProperty('aiFallback');
    expect(res.body.users.total).toBe(1);
  });
});
