import { ConsultationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  consultationNewRequestEmail,
  consultationStatusEmail,
  lawyerApprovedEmail,
  lawyerRejectedEmail,
  lawyerWelcomeEmail,
  passwordResetEmail,
  verificationEmail,
} from '../src/email/templates.js';
import { consultationNewRequestSms, consultationStatusSms } from '../src/sms/sms-messages.js';

describe('Email templates', () => {
  it('renders verification, reset, welcome, and review outcomes', () => {
    expect(
      verificationEmail({ to: 'a@b.c', fullName: 'Ama', verifyUrl: 'http://x' }).subject,
    ).toMatch(/Confirm/);
    expect(
      passwordResetEmail({ to: 'a@b.c', fullName: 'Ama', resetUrl: 'http://x' }).subject,
    ).toMatch(/Reset/);
    expect(
      lawyerWelcomeEmail({
        to: 'a@b.c',
        fullName: 'Ama',
        temporaryPassword: 'tmp',
        loginUrl: 'http://x',
      }).text,
    ).toContain('Temporary password');
    expect(
      lawyerApprovedEmail({ to: 'a@b.c', fullName: 'Ama', profileUrl: 'http://x' }).subject,
    ).toMatch(/approved/);
    expect(
      lawyerRejectedEmail({ to: 'a@b.c', fullName: 'Ama', profileUrl: 'http://x' }).subject,
    ).toMatch(/not approved/);
  });

  it('includes Meet and calendar links when a request is accepted', () => {
    const mail = consultationStatusEmail({
      to: 'a@b.c',
      clientName: 'Kofi',
      lawyerName: 'Akua',
      statusLabel: 'Accepted',
      requestUrl: 'http://x',
      when: 'Thu 13 Aug, 14:00',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
    });
    expect(mail.text).toContain('Google Meet');
    expect(mail.text).toContain('Add to Google Calendar');
  });

  it('omits optional extras when they are absent', () => {
    const mail = consultationStatusEmail({
      to: 'a@b.c',
      clientName: 'Kofi',
      lawyerName: 'Akua',
      statusLabel: 'Declined',
      requestUrl: 'http://x',
    });
    expect(mail.text).not.toContain('Google Meet');
  });

  it('mentions the category on a new request when present', () => {
    const withCategory = consultationNewRequestEmail({
      to: 'a@b.c',
      lawyerName: 'Akua',
      clientName: 'Kofi',
      category: 'Employment & Labour',
      when: 'Thu 13 Aug',
      requestUrl: 'http://x',
    });
    const without = consultationNewRequestEmail({
      to: 'a@b.c',
      lawyerName: 'Akua',
      clientName: 'Kofi',
      category: '',
      when: 'Thu 13 Aug',
      requestUrl: 'http://x',
    });
    expect(withCategory.text).toContain('Employment & Labour');
    expect(without.text).not.toContain('about ');
  });
});

describe('SMS templates', () => {
  it('includes a category when one is known', () => {
    expect(
      consultationNewRequestSms({
        lawyerName: 'Akua',
        clientName: 'Kofi',
        category: 'Employment',
      }),
    ).toContain('(Employment)');
    expect(
      consultationNewRequestSms({ lawyerName: 'Akua', clientName: 'Kofi', category: null }),
    ).not.toContain('(');
  });

  it('returns null for statuses that are not texted', () => {
    expect(
      consultationStatusSms({
        clientName: 'Kofi',
        lawyerName: 'Akua',
        status: ConsultationStatus.PENDING,
      }),
    ).toBeNull();
    expect(
      consultationStatusSms({
        clientName: 'Kofi',
        lawyerName: 'Akua',
        status: ConsultationStatus.ACCEPTED,
      }),
    ).toContain('accepted');
    expect(
      consultationStatusSms({
        clientName: 'Kofi',
        lawyerName: 'Akua',
        status: ConsultationStatus.DECLINED,
      }),
    ).toContain('declined');
    expect(
      consultationStatusSms({
        clientName: 'Kofi',
        lawyerName: 'Akua',
        status: ConsultationStatus.CANCELLED,
      }),
    ).toContain('cancelled');
  });
});
