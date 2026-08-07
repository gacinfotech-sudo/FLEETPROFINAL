// Tests for TASK-ROOT-DASHBOARD-02's PII masking placeholder
// (server/root/services/piiMaskingService.ts). Matches the documented
// contract shapes from the task file: `98765XXXXX` / `ra***@gmail.com`.
//
// No test runner (Jest/Vitest) is configured in this repo — run directly
// via tsx, same convention as server/services/bookingCodeService.test.ts:
//
//   npx tsx --test server/root/services/piiMaskingService.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { maskPhone, maskEmail } from './piiMaskingService';

describe('maskPhone', () => {
  test('masks a bare 10-digit Indian mobile number to the documented shape', () => {
    assert.equal(maskPhone('9876543210'), '98765XXXXX');
  });

  test('strips a +91 country-code prefix and masks the local 10 digits', () => {
    assert.equal(maskPhone('+91 98765 43210'), '98765XXXXX');
  });

  test('strips a normalized "91XXXXXXXXXX" (Customer.primaryMobile) prefix identically', () => {
    assert.equal(maskPhone('919876543210'), '98765XXXXX');
  });

  test('never returns the full original number embedded verbatim', () => {
    const masked = maskPhone('9876543210');
    assert.notEqual(masked, '9876543210');
    assert.ok(!masked.includes('43210'), 'last 5 digits must not be visible');
  });

  test('empty/null/undefined input returns empty string, not a throw', () => {
    assert.equal(maskPhone(''), '');
    assert.equal(maskPhone(null), '');
    assert.equal(maskPhone(undefined), '');
  });

  test('short/malformed numbers are masked, never returned raw', () => {
    const masked = maskPhone('12345');
    assert.notEqual(masked, '12345');
  });
});

describe('maskEmail', () => {
  test('matches the documented "ra***@gmail.com" shape', () => {
    assert.equal(maskEmail('rahul@gmail.com'), 'ra***@gmail.com');
  });

  test('preserves the domain unmasked', () => {
    const masked = maskEmail('someone@example.org');
    assert.ok(masked.endsWith('@example.org'));
  });

  test('never returns the full local-part embedded verbatim', () => {
    const masked = maskEmail('sensitive.user@example.com');
    assert.notEqual(masked, 'sensitive.user@example.com');
    assert.ok(!masked.includes('sensitive.user'));
  });

  test('single-character local part does not crash and still masks', () => {
    const masked = maskEmail('a@b.com');
    assert.equal(masked, 'a***@b.com');
  });

  test('empty/null/undefined input returns empty string, not a throw', () => {
    assert.equal(maskEmail(''), '');
    assert.equal(maskEmail(null), '');
    assert.equal(maskEmail(undefined), '');
  });
});
