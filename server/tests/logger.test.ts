import { describe, expect, it } from 'vitest';
import {
  formatLogLine,
  lastDigits,
  maskEmail,
  maskPhone,
  maskPiiInText,
  redact,
} from '../src/lib/logger.js';

describe('file logger helpers', () => {
  it('redacts password, token, and secret keys', () => {
    expect(
      redact({
        password: 'correct-horse',
        token: 'jwt-here',
        merchantSecret: 'abc',
        userId: 'u1',
      }),
    ).toEqual({
      password: '[redacted]',
      token: '[redacted]',
      merchantSecret: '[redacted]',
      userId: 'u1',
    });
  });

  it('masks email, phone, name, and intake-text keys (NFR-002)', () => {
    expect(
      redact({
        to: 'ama.mensah@example.com',
        email: 'kofi@legalconnect.local',
        phone: '0244123456',
        fullName: 'Ama Mensah',
        description: 'My employer dismissed me without notice.',
        toLast4: '3456',
      }),
    ).toEqual({
      to: 'a***@e***.com',
      email: 'k***@l***.local',
      phone: '***3456',
      fullName: '[name]',
      description: '[text]',
      toLast4: '3456',
    });
  });

  it('masks emails and Ghana numbers inside Error messages and free text', () => {
    expect(redact(new Error('bounce ama.mensah@example.com 0244123456'))).toEqual({
      name: 'Error',
      message: 'bounce a***@e***.com ***3456',
    });
    expect(maskPiiInText('mail kofi@example.com or +233244123456')).toBe(
      'mail k***@e***.com or ***3456',
    );
    expect(maskPiiInText('amount 10024412345699 pesewas')).toBe('amount 10024412345699 pesewas');
  });

  it('formats a line without extra as ISO level message', () => {
    const line = formatLogLine('info', 'listening');
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z INFO listening\n$/);
  });

  it('masks PII that was interpolated into the log message', () => {
    expect(formatLogLine('info', 'sent to ama.mensah@example.com')).toMatch(
      /INFO sent to a\*\*\*@e\*\*\*\.com\n$/,
    );
  });

  it('lastDigits keeps only the tail of a Ghana number', () => {
    expect(lastDigits('0244123456')).toBe('3456');
    expect(maskPhone('0244123456')).toBe('***3456');
    expect(maskEmail('ama.mensah@example.com')).toBe('a***@e***.com');
  });
});
