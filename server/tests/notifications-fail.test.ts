import { ConsultationStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  appUrl: (path: string) => `http://localhost${path}`,
  sendEmail: () => Promise.reject(new Error('smtp down')),
}));

vi.mock('../src/sms/sms-client.js', () => ({
  sendSms: () => Promise.reject(new Error('sms down')),
}));

import {
  notifyClientOfStatusChange,
  notifyLawyerOfNewRequest,
} from '../src/email/notifications.js';

describe('Notification failures are swallowed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when email or SMS rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      notifyLawyerOfNewRequest({
        lawyerEmail: 'akua@example.com',
        lawyerPhone: '0244123456',
        lawyerName: 'Akua',
        clientName: 'Kofi',
        category: null,
        consultationId: 'c1',
        scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      }),
    ).not.toThrow();

    expect(() =>
      notifyClientOfStatusChange({
        clientEmail: 'kofi@example.com',
        clientPhone: '0244123456',
        clientName: 'Kofi',
        lawyerName: 'Akua',
        status: ConsultationStatus.ACCEPTED,
        consultationId: 'c1',
      }),
    ).not.toThrow();

    await vi.waitFor(() => {
      expect(error.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
