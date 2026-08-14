import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  amountForHash,
  collectionCallbackUrl,
  computeTransHash,
  FALLBACK_COLLECTION_CALLBACK,
  inferMomoNetwork,
  isPaidStatus,
  pesewasFromAmount,
  publicCallbackUrl,
  toNaloPayAccountNumber,
  toNaloPayNetwork,
  transHashMessage,
  verifyCallbackSignature,
} from '../src/payments/nalopay.js';

describe('NaloPay hashing and signatures', () => {
  it('concatenates trans_hash fields with no separators, matching the docs example', () => {
    expect(
      transHashMessage({
        merchantId: 'MERCH123',
        accountNumber: '0241234567',
        amount: '50.00',
        reference: 'TXN-123',
      }),
    ).toBe('MERCH123024123456750.00TXN-123');
  });

  it('formats pesewas as two-decimal cedis for the hash', () => {
    expect(amountForHash(20000)).toBe('200.00');
    expect(amountForHash(11)).toBe('0.11');
  });

  it('is deterministic for a known secret', () => {
    const message = transHashMessage({
      merchantId: 'MERCH123',
      accountNumber: '0241234567',
      amount: '50.00',
      reference: 'TXN-123',
    });
    expect(computeTransHash(message, 'test-secret')).toBe(
      createHmac('sha256', 'test-secret').update(message).digest('hex'),
    );
  });

  it('accepts a compact-body webhook signature and rejects a tampered one', () => {
    const secret = 'test-secret';
    const raw =
      '{"amount":"50.00","amount_after_charges":"49.00","charges":"1.00","order_id":"LVFf4MHD2xJ7yJ7uW9ZyMi","reference":"REF_2024_001","status":"COMPLETED"}';
    const t = '1721990400';
    const s = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');

    expect(verifyCallbackSignature(raw, `t=${t},s=${s}`, secret, 1721990400)).toBe(true);
    expect(verifyCallbackSignature(raw, `t=${t},s=${s}`, 'other-secret', 1721990400)).toBe(false);
    expect(
      verifyCallbackSignature(
        raw.replace('COMPLETED', 'FAILED'),
        `t=${t},s=${s}`,
        secret,
        1721990400,
      ),
    ).toBe(false);
  });

  it('rejects a signature whose timestamp is too old', () => {
    const secret = 'test-secret';
    const raw = '{"status":"COMPLETED"}';
    const t = '1000';
    const s = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
    expect(verifyCallbackSignature(raw, `t=${t},s=${s}`, secret, 10_000)).toBe(false);
  });
});

describe('NaloPay helpers', () => {
  it('infers Ghana mobile-money networks from common prefixes', () => {
    expect(inferMomoNetwork('233244123456')).toBe('MTN');
    expect(inferMomoNetwork('0244123456')).toBe('MTN');
    expect(inferMomoNetwork('0274123456')).toBe('AT');
    expect(inferMomoNetwork('0204123456')).toBe('TELECEL');
    expect(inferMomoNetwork('233200000000')).toBe('TELECEL');
    expect(inferMomoNetwork('233111111111')).toBeNull();
  });

  it('converts gateway amounts to pesewas without float drift', () => {
    expect(pesewasFromAmount('50.00')).toBe(5000);
    expect(pesewasFromAmount(0.11)).toBe(11);
    expect(pesewasFromAmount('not-a-number')).toBeNull();
  });

  it('treats COMPLETED as paid', () => {
    expect(isPaidStatus('COMPLETED')).toBe(true);
    expect(isPaidStatus('success')).toBe(true);
    expect(isPaidStatus('PAID')).toBe(true);
    expect(isPaidStatus('FAILED')).toBe(false);
    expect(isPaidStatus(undefined)).toBe(false);
  });

  it('sends a local 0-prefixed MSISDN to NaloPay, matching the hash example', () => {
    expect(toNaloPayAccountNumber('233244123456')).toBe('0244123456');
    expect(toNaloPayAccountNumber('0244123456')).toBe('0244123456');
  });

  it('maps in-app networks onto the NaloPay collection names', () => {
    expect(toNaloPayNetwork('MTN')).toBe('MTN');
    expect(toNaloPayNetwork('AT')).toBe('AIRTELTIGO');
    expect(toNaloPayNetwork('TELECEL')).toBe('VODAFONE');
  });

  it('omits loopback and http callbacks so NaloPay does not reject them', () => {
    expect(publicCallbackUrl('http://localhost:4000/api/v1/payments/callback')).toBeUndefined();
    expect(publicCallbackUrl('https://127.0.0.1/callback')).toBeUndefined();
    expect(publicCallbackUrl('http://example.com/callback')).toBeUndefined();
    expect(publicCallbackUrl('https://pay.example.com/api/v1/payments/callback')).toBe(
      'https://pay.example.com/api/v1/payments/callback',
    );
  });

  it('always supplies an https callback because omitting it is PAY-INVAL-0069', () => {
    expect(collectionCallbackUrl('http://localhost:4000/api/v1/payments/callback')).toBe(
      FALLBACK_COLLECTION_CALLBACK,
    );
    expect(collectionCallbackUrl('https://pay.example.com/api/v1/payments/callback')).toBe(
      'https://pay.example.com/api/v1/payments/callback',
    );
  });
});
