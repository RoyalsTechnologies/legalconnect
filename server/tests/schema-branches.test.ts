import { ConsultationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { parseTriageResponse } from '../src/ai/schemas.js';
import { changePasswordSchema, registerSchema } from '../src/modules/auth/auth.schema.js';
import {
  createConsultationSchema,
  updateConsultationSchema,
} from '../src/modules/consultations/consultations.schema.js';
import { updateOwnLawyerProfileSchema } from '../src/modules/lawyers/lawyers.schema.js';

describe('Registration schema branches', () => {
  const citizen = {
    fullName: 'Ama Mensah',
    email: 'ama@example.com',
    password: 'password123',
  };

  it('accepts a citizen without lawyer fields', () => {
    expect(registerSchema.parse(citizen).accountType).toBe('citizen');
  });

  it('requires lawyer profile fields together', () => {
    const result = registerSchema.safeParse({ ...citizen, accountType: 'lawyer' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['bio', 'city', 'region', 'practiceAreaIds']));
  });

  it('requires a consultation fee on a lawyer application', () => {
    const result = registerSchema.safeParse({
      ...citizen,
      accountType: 'lawyer',
      bio: 'I handle employment disputes, unfair dismissal, and unpaid salary claims in Accra.',
      city: 'Accra',
      region: 'Greater Accra',
      practiceAreaIds: ['cat-1'],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === 'consultationFeeGhs')).toBe(true);
  });

  it('rejects a new password that matches the current one', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'password123',
      newPassword: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('Consultation schema branches', () => {
  it('rejects a scheduled time that cannot be parsed', () => {
    const result = createConsultationSchema.safeParse({
      intakeId: 'i1',
      lawyerProfileId: 'l1',
      scheduledAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a slot that is too soon', () => {
    const result = createConsultationSchema.safeParse({
      intakeId: 'i1',
      lawyerProfileId: 'l1',
      scheduledAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a slot more than 90 days away', () => {
    const result = createConsultationSchema.safeParse({
      intakeId: 'i1',
      lawyerProfileId: 'l1',
      scheduledAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a Meet URL that is not a room link', () => {
    const result = updateConsultationSchema.safeParse({
      status: ConsultationStatus.ACCEPTED,
      meetUrl: 'https://meet.google.com/new',
    });
    expect(result.success).toBe(false);
  });

  it('allows decline without a Meet URL', () => {
    expect(updateConsultationSchema.parse({ status: ConsultationStatus.DECLINED })).toMatchObject({
      status: ConsultationStatus.DECLINED,
    });
  });
});

describe('Payment account schema', () => {
  it('rejects a mixed null and set payment account', () => {
    const result = updateOwnLawyerProfileSchema.safeParse({
      paymentAccountName: 'Akua',
      paymentPhone: null,
      paymentNetwork: 'MTN',
    });
    expect(result.success).toBe(false);
  });
});

describe('AI triage schema', () => {
  it('reports empty, non-JSON, and invalid field paths without echoing values', () => {
    expect(parseTriageResponse('')).toMatchObject({ ok: false, reason: 'empty response' });
    expect(parseTriageResponse('not json')).toMatchObject({
      ok: false,
      reason: 'response was not valid JSON',
    });
    const invalid = parseTriageResponse(JSON.stringify({ category: 'x' }));
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.reason).toContain('response failed schema validation');
  });
});
