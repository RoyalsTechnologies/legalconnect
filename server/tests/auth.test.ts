import { EmailTokenType, Role, UserStatus } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { hashToken, issueEmailToken } from '../src/email/mailer.js';
import { prisma } from './setup.js';

const app = createApp();

const validUser = {
  fullName: 'Ama Mensah',
  email: 'ama@example.com',
  password: 'correct-horse-battery',
  phone: '0244123456',
};

async function registerUser(overrides: Partial<typeof validUser> = {}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...validUser, ...overrides });
}

describe('FR-001 registration', () => {
  it('UT-001: creates a USER account and returns a token (test env auto-verifies)', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: validUser.email,
      fullName: validUser.fullName,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    });
    expect(typeof res.body.token).toBe('string');

    const stored = await prisma.user.findUnique({ where: { email: validUser.email } });
    expect(stored?.emailVerifiedAt).not.toBeNull();
  });

  it('UT-002: never returns the password hash', async () => {
    const res = await registerUser();

    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain(validUser.password);
  });

  it('SEC-LG-005: stores a bcrypt hash, not the plaintext password', async () => {
    await registerUser();

    const stored = await prisma.user.findUnique({ where: { email: validUser.email } });
    expect(stored?.passwordHash).toBeDefined();
    expect(stored?.passwordHash).not.toBe(validUser.password);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('UT-003: rejects a duplicate email with 409', async () => {
    await registerUser();
    const res = await registerUser({ fullName: 'Someone Else' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('UT-004: normalises email case so duplicates cannot slip through', async () => {
    await registerUser();
    const res = await registerUser({ email: 'AMA@Example.COM' });

    expect(res.status).toBe(409);
  });

  it('UT-005: rejects a short password with field-level detail', async () => {
    const res = await registerUser({ password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ field: 'password' }));
  });

  it('UT-006: rejects a malformed email', async () => {
    const res = await registerUser({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ field: 'email' }));
  });

  it('SEC-LG-011: cannot self-assign ADMIN via the registration payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, role: Role.ADMIN });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(Role.USER);

    const stored = await prisma.user.findUnique({ where: { email: validUser.email } });
    expect(stored?.role).toBe(Role.USER);
  });

  it('SEC-LG-011b: accountType cannot create an admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, accountType: 'admin' });

    expect(res.status).toBe(422);
  });
});

describe('FR-002 authentication', () => {
  it('UT-007: logs in with valid credentials', async () => {
    await registerUser();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
    expect(typeof res.body.token).toBe('string');
  });

  it('UT-008: rejects a wrong password with 401', async () => {
    await registerUser();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('SEC-LG-009: gives an identical response for unknown email and wrong password', async () => {
    await registerUser();

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'wrong-password' });

    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    // Identical status and message, so the endpoint cannot be used to discover
    // which emails have accounts.
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('UT-009: refuses login for a suspended account', async () => {
    await registerUser();
    await prisma.user.update({
      where: { email: validUser.email },
      data: { status: UserStatus.SUSPENDED },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(403);
  });

  it('UT-010: logout responds 204', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });

  it('UT-011: refuses login until email is verified', async () => {
    await registerUser();
    await prisma.user.update({
      where: { email: validUser.email },
      data: { emailVerifiedAt: null },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Confirm your email/i);
  });
});

describe('email verification and password reset', () => {
  it('UT-012: verify-email marks the account verified', async () => {
    await registerUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: validUser.email } });
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: null },
    });

    const raw = await issueEmailToken(user.id, EmailTokenType.VERIFY_EMAIL);
    const res = await request(app).post('/api/v1/auth/verify-email').send({ token: raw });

    expect(res.status).toBe(200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.emailVerifiedAt).not.toBeNull();

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(login.status).toBe(200);
  });

  it('UT-013: forgot-password always returns 204', async () => {
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@example.com' });
    expect(known.status).toBe(204);

    await registerUser();
    const existing = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: validUser.email });
    expect(existing.status).toBe(204);
  });

  it('UT-014: reset-password updates the hash via a valid token', async () => {
    await registerUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: validUser.email } });
    const raw = await issueEmailToken(user.id, EmailTokenType.RESET_PASSWORD);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: 'new-correct-horse' });

    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'new-correct-horse' });
    expect(newLogin.status).toBe(200);

    // Consumed token cannot be reused.
    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: raw, password: 'another-password' });
    expect(reuse.status).toBe(400);
    expect(
      await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(raw) } }),
    ).toMatchObject({ usedAt: expect.any(Date) });
  });

  it('UT-016: a signed-in citizen can change their password', async () => {
    const registered = await registerUser();
    const token = registered.body.token as string;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: validUser.password, newPassword: 'new-correct-horse' });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('passwordHash');

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: 'new-correct-horse' });
    expect(newLogin.status).toBe(200);
  });

  it('UT-017: change-password rejects a wrong current password', async () => {
    const registered = await registerUser();
    const token = registered.body.token as string;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'new-correct-horse' });

    expect(res.status).toBe(401);

    const stillOld = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(stillOld.status).toBe(200);
  });

  it('UT-018: change-password requires a session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: validUser.password, newPassword: 'new-correct-horse' });
    expect(res.status).toBe(401);
  });

  it('UT-015: resend-verification always returns 204', async () => {
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'unknown@example.com' });
    expect(res.status).toBe(204);
  });
});

describe('FR-003 profile, NFR-001 access control', () => {
  async function authenticatedToken() {
    const res = await registerUser();
    return res.body.token as string;
  }

  it('IT-001: returns the caller profile with a valid token', async () => {
    const token = await authenticatedToken();

    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validUser.email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('IT-002: rejects a request with no token', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });

  it('IT-003: rejects a malformed token', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });

  it('IT-004: rejects a token whose user has been deleted', async () => {
    const token = await authenticatedToken();
    await prisma.user.deleteMany({ where: { email: validUser.email } });

    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('IT-005: rejects a still-valid token once the account is suspended', async () => {
    const token = await authenticatedToken();
    await prisma.user.update({
      where: { email: validUser.email },
      data: { status: UserStatus.SUSPENDED },
    });

    const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('IT-006: updates own profile', async () => {
    const token = await authenticatedToken();

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ama K. Mensah' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Ama K. Mensah');
  });

  it('SEC-LG-010: cannot escalate role or change status through the profile endpoint', async () => {
    const token = await authenticatedToken();

    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ama K. Mensah', role: Role.ADMIN, status: UserStatus.SUSPENDED });

    const stored = await prisma.user.findUnique({ where: { email: validUser.email } });
    expect(stored?.role).toBe(Role.USER);
    expect(stored?.status).toBe(UserStatus.ACTIVE);
  });

  it('IT-007: rejects an empty update payload', async () => {
    const token = await authenticatedToken();

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });
});
