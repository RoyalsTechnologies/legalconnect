import { createHash, randomBytes } from 'node:crypto';
import type { EmailTokenType } from '@prisma/client';
import type { Transporter } from 'nodemailer';
import { nodemailer } from '../lib/cjs-default.js';
import { env, isEmailConfigured, isTest } from '../config/env.js';
import { serviceUnavailable } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isEmailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Sends an email, or logs it when SMTP is not configured.
 *
 * @param critical When true, transport failures become 503. Alert emails pass
 * false so a mail outage does not roll back consultation updates.
 */
export async function sendEmail(message: OutboundEmail, critical = true): Promise<void> {
  if (isTest) {
    log.notification.info('email skipped (test)', { to: message.to, subject: message.subject });
    return;
  }

  const transport = getTransporter();
  if (!transport) {
    log.notification.info('email logged (smtp unset)', {
      to: message.to,
      subject: message.subject,
    });
    return;
  }

  try {
    await transport.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    log.notification.info('email sent', { to: message.to, subject: message.subject });
  } catch (error) {
    log.notification.error('email send failed', error);
    if (critical) {
      throw serviceUnavailable(
        'We could not send email right now. Please try again in a few minutes.',
      );
    }
  }
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function createRawToken(): string {
  return randomBytes(32).toString('base64url');
}

const TTL_MS: Record<EmailTokenType, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

/**
 * Issues a one-time token for the user, invalidating unused tokens of the same type.
 * Returns the raw token to embed in the email link (never store it plaintext).
 */
export async function issueEmailToken(userId: string, type: EmailTokenType): Promise<string> {
  const raw = createRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TTL_MS[type]);

  await prisma.$transaction([
    prisma.emailToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailToken.create({
      data: { userId, type, tokenHash, expiresAt },
    }),
  ]);

  return raw;
}

export async function consumeEmailToken(
  rawToken: string,
  type: EmailTokenType,
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(rawToken);
  const row = await prisma.emailToken.findUnique({ where: { tokenHash } });

  if (!row || row.type !== type || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await prisma.emailToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return { userId: row.userId };
}

export function appUrl(path: string): string {
  const base = env.CLIENT_ORIGIN.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
