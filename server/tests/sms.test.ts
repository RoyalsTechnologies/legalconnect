import { describe, expect, it } from 'vitest';
import { normalizeMsisdn } from '../src/sms/sms-client.js';

describe('normalizeMsisdn', () => {
  it('converts local Ghana numbers to 233…', () => {
    expect(normalizeMsisdn('0244123456')).toBe('233244123456');
    expect(normalizeMsisdn('024 412 3456')).toBe('233244123456');
  });

  it('accepts already-international forms', () => {
    expect(normalizeMsisdn('+233244123456')).toBe('233244123456');
    expect(normalizeMsisdn('233244123456')).toBe('233244123456');
  });

  it('rejects unusable values', () => {
    expect(normalizeMsisdn(null)).toBeNull();
    expect(normalizeMsisdn('')).toBeNull();
    expect(normalizeMsisdn('123')).toBeNull();
  });
});
