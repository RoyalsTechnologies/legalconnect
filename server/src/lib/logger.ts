import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { isTest } from '../config/env.js';

export type LogChannel = 'sys' | 'security' | 'payment' | 'notification';

const SECRET_KEYS = /password|token|authorization|secret|api[_-]?key|basic[_-]?auth|cookie|^jwt/i;
const EMAIL_KEYS = /^(email|e-?mail|to|from|recipient|sender)$/i;
const PHONE_KEYS = /^(phone|telephone|mobile|msisdn|account_number|accountnumber|paymentphone)$/i;
const NAME_KEYS =
  /^(name|fullname|displayname|firstname|lastname|accountname|account_name|clientname|lawyername)$/i;
const TEXT_KEYS = /^(description|originaldescription|intake|bio|html|body|text)$/i;

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Whole Ghana MSISDNs only — do not eat digits out of amounts or ids. */
const PHONE_IN_TEXT = /(?<!\d)(?:\+233|233|0)\d{9}(?!\d)/g;

export const LOG_DIR = path.join(process.cwd(), 'logs');

/** `ama.mensah@example.com` → `a***@e***.com` */
export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at < 1 || at === value.length - 1) return '[email]';
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const dot = domain.indexOf('.');
  const host = dot === -1 ? domain : domain.slice(0, dot);
  const rest = dot === -1 ? '' : domain.slice(dot);
  return `${local[0]}***@${host[0] ?? '*'}***${rest}`;
}

/** Last digits of a phone — enough to debug, not a full number. */
export function lastDigits(value: string, count = 4): string {
  const digits = value.replace(/\D/g, '');
  return digits.slice(-count) || 'none';
}

export function maskPhone(value: string): string {
  const tail = lastDigits(value);
  return tail === 'none' ? '[phone]' : `***${tail}`;
}

/** Mask emails and Ghana MSISDNs that appear inside a free-text log line. */
export function maskPiiInText(value: string): string {
  return value.replace(EMAIL_IN_TEXT, maskEmail).replace(PHONE_IN_TEXT, maskPhone);
}

function redactByKey(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return redact(value);
  if (SECRET_KEYS.test(key)) return '[redacted]';
  if (EMAIL_KEYS.test(key)) return maskEmail(value);
  if (PHONE_KEYS.test(key)) return maskPhone(value);
  if (NAME_KEYS.test(key)) return '[name]';
  if (TEXT_KEYS.test(key)) return '[text]';
  return maskPiiInText(value);
}

export function redact(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: maskPiiInText(value.message) };
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = redactByKey(key, nested);
    }
    return out;
  }
  if (typeof value === 'string') return maskPiiInText(value);
  return value;
}

export function formatLogLine(level: string, message: string, extra?: unknown): string {
  const stamp = new Date().toISOString();
  const safeMessage = maskPiiInText(message);
  if (extra === undefined) return `${stamp} ${level.toUpperCase()} ${safeMessage}\n`;
  return `${stamp} ${level.toUpperCase()} ${safeMessage} ${JSON.stringify(redact(extra))}\n`;
}

function write(
  channel: LogChannel,
  level: 'info' | 'warn' | 'error',
  message: string,
  extra?: unknown,
): void {
  const print = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  const safeMessage = maskPiiInText(message);
  let line: string;
  try {
    line = formatLogLine(level, message, extra);
    if (extra === undefined) print(`[${channel}] ${safeMessage}`);
    else print(`[${channel}] ${safeMessage}`, redact(extra));
  } catch {
    line = formatLogLine(level, message);
    print(`[${channel}] ${safeMessage}`);
  }

  if (isTest) return;

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(path.join(LOG_DIR, `${channel}.log`), line, 'utf8');
  } catch (error) {
    console.error(`[sys] could not write ${channel}.log`, error);
  }
}

function channel(name: LogChannel) {
  return {
    info: (message: string, extra?: unknown) => write(name, 'info', message, extra),
    warn: (message: string, extra?: unknown) => write(name, 'warn', message, extra),
    error: (message: string, extra?: unknown) => write(name, 'error', message, extra),
  };
}

export const log = {
  sys: channel('sys'),
  security: channel('security'),
  payment: channel('payment'),
  notification: channel('notification'),
};
