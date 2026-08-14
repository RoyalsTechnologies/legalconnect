import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock('../src/config/env.js', () => ({
  env: {
    CLIENT_ORIGIN: 'http://localhost:5173',
    EMAIL_HOST: 'smtp.test',
    EMAIL_PORT: 465,
    EMAIL_SECURE: true,
    EMAIL_USER: 'mailer',
    EMAIL_PASSWORD: 'secret',
    EMAIL_FROM: 'noreply@test.com',
    EMAIL_FROM_NAME: 'LegalConnect Ghana',
    SMS_ENDPOINT: 'https://sms.test/send?',
    SMS_USERNAME: 'user',
    SMS_PASSWORD: 'pass',
    SMS_SENDER_ID: 'LC',
  },
  isTest: false,
  isEmailConfigured: true,
  isSmsConfigured: true,
  isProduction: false,
}));

vi.mock('../src/lib/cjs-default.js', () => ({
  nodemailer: {
    createTransport: () => ({ sendMail }),
  },
}));

import { env } from '../src/config/env.js';
import { appUrl, sendEmail } from '../src/email/mailer.js';
import { sendSms } from '../src/sms/sms-client.js';

const sample = {
  to: 'ama@example.com',
  subject: 'Hello',
  text: 'plain',
  html: '<p>plain</p>',
};

describe('sendEmail when SMTP is configured', () => {
  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue({});
  });

  it('sends through the transporter', async () => {
    await sendEmail(sample);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      to: 'ama@example.com',
      subject: 'Hello',
    });
  });

  it('throws 503 on a critical send failure', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));
    await expect(sendEmail(sample, true)).rejects.toThrow(/could not send email/i);
  });

  it('swallows a non-critical send failure', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));
    await expect(sendEmail(sample, false)).resolves.toBeUndefined();
  });

  it('builds an app URL from CLIENT_ORIGIN', () => {
    expect(appUrl('app/account')).toBe(`${env.CLIENT_ORIGIN.replace(/\/$/, '')}/app/account`);
    expect(appUrl('/app')).toBe(`${env.CLIENT_ORIGIN.replace(/\/$/, '')}/app`);
  });
});

describe('sendSms when the gateway is configured', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips an unusable destination', async () => {
    await sendSms('123', 'hi');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a 1701 body as success', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '1701|ok' });
    await sendSms('0244123456', 'hello');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('treats a success phrase as success', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'SUCCESS queued' });
    await sendSms('+233244123456', 'hello');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('logs a non-OK gateway status without throwing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'down' });
    await expect(sendSms('0244123456', 'hello')).resolves.toBeUndefined();
  });

  it('logs an unexpected success body without throwing', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '1702|rejected' });
    await expect(sendSms('0244123456', 'hello')).resolves.toBeUndefined();
  });

  it('logs a network failure without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(sendSms('0244123456', 'hello')).resolves.toBeUndefined();
  });
});
