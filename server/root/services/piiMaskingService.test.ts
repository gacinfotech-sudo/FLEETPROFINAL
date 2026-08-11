// Tests for server/root/services/piiMaskingService.ts.
//
// INTEGRATION NOTE (resolved at merge of integration/root-control-plane-wave1):
// this file originally tested TASK-ROOT-DASHBOARD-02's own placeholder
// implementation, which stripped any country-code prefix before masking
// (`+91 98765 43210` -> `98765XXXXX`). At merge, TASK-ROOT-SECURITY-05's real
// `piiMaskingService.ts` (this task's canonical owner per the manifest)
// replaced that placeholder — its algorithm masks the last 5 *digit
// characters in place* without stripping/normalizing any country-code
// prefix (`+91 98765 43210` -> `+91 98765 XXXXX`). Both algorithms satisfy
// the same security invariant (the last 5 digits are never visible, the raw
// number is never returned verbatim) — only the cosmetic shape differs. The
// three assertions below were updated to match the real algorithm's actual
// output; see tests/e2e/root-security-pii-masking.spec.ts for that
// algorithm's own authoritative test coverage.
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

  test('masks the trailing 5 digits of a +91-prefixed number, prefix retained', () => {
    assert.equal(maskPhone('+91 98765 43210'), '+91 98765 XXXXX');
  });

  test('masks the trailing 5 digits of a normalized "91XXXXXXXXXX" (Customer.primaryMobile) number', () => {
    assert.equal(maskPhone('919876543210'), '9198765XXXXX');
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
