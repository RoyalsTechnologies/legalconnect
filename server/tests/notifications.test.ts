import { ApprovalStatus, ConsultationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  notifyClientOfStatusChange,
  notifyLawyerApprovalDecision,
  notifyLawyerOfNewRequest,
  notifyLawyerWelcome,
} from '../src/email/notifications.js';

describe('Outbound notification helpers', () => {
  it('fires new-request, welcome, and approval emails without throwing', () => {
    expect(() =>
      notifyLawyerOfNewRequest({
        lawyerEmail: 'akua@example.com',
        lawyerPhone: '0244123456',
        lawyerName: 'Akua',
        clientName: 'Kofi',
        category: 'Employment',
        consultationId: 'c1',
        scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      }),
    ).not.toThrow();

    expect(() =>
      notifyLawyerWelcome({
        email: 'akua@example.com',
        fullName: 'Akua Owusu',
        temporaryPassword: 'tmp',
      }),
    ).not.toThrow();

    expect(() =>
      notifyLawyerApprovalDecision({
        email: 'akua@example.com',
        fullName: 'Akua Owusu',
        approvalStatus: ApprovalStatus.APPROVED,
      }),
    ).not.toThrow();

    expect(() =>
      notifyLawyerApprovalDecision({
        email: 'akua@example.com',
        fullName: 'Akua Owusu',
        approvalStatus: ApprovalStatus.REJECTED,
      }),
    ).not.toThrow();

    expect(() =>
      notifyLawyerApprovalDecision({
        email: 'akua@example.com',
        fullName: 'Akua Owusu',
        approvalStatus: ApprovalStatus.PENDING,
      }),
    ).not.toThrow();
  });

  it('skips client alerts for statuses that are not messaged', () => {
    expect(() =>
      notifyClientOfStatusChange({
        clientEmail: 'kofi@example.com',
        clientName: 'Kofi',
        lawyerName: 'Akua',
        status: ConsultationStatus.PENDING,
        consultationId: 'c1',
      }),
    ).not.toThrow();
  });

  it('notifies the client on accept, decline, and cancel', () => {
    const base = {
      clientEmail: 'kofi@example.com',
      clientPhone: '0244123456',
      clientName: 'Kofi',
      lawyerName: 'Akua',
      consultationId: 'c1',
      scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
    };

    expect(() =>
      notifyClientOfStatusChange({ ...base, status: ConsultationStatus.ACCEPTED }),
    ).not.toThrow();
    expect(() =>
      notifyClientOfStatusChange({ ...base, status: ConsultationStatus.DECLINED }),
    ).not.toThrow();
    expect(() =>
      notifyClientOfStatusChange({ ...base, status: ConsultationStatus.CANCELLED }),
    ).not.toThrow();
  });
});
