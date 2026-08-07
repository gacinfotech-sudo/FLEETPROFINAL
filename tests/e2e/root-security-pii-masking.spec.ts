// TASK-ROOT-SECURITY-05 — PII masking utility proofs.
//
// Covers the acceptance criteria: "a phone/email round-trips through the
// masking function correctly for realistic Indian phone formats and common
// email shapes — proven by tests with real example inputs, not just one
// hardcoded case" and "the unmask flow requires a reason, produces exactly
// one audit event with actor/tenant/customer/reason/timestamp."

import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { maskPhone, maskEmail, unmaskField, assertFieldIsUnmaskable, PiiUnmaskForbiddenError, UNMASKABLE_FIELDS } from '../../server/root/services/piiMaskingService';
import { PlatformAuditEventModel } from '../../server/root/models/auditLog';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for this verification.');
  return process.env.MONGODB_URI;
}

test.describe('PII masking utility (TASK-ROOT-SECURITY-05)', () => {
  test.setTimeout(30_000);

  test('maskPhone: real Indian mobile formats mask exactly the last 5 digits', () => {
    expect(maskPhone('9876543210')).toBe('98765XXXXX');
    expect(maskPhone('+919876543210')).toBe('+9198765XXXXX');
    expect(maskPhone('+91 98765 43210')).toBe('+91 98765 XXXXX');
    expect(maskPhone('091-9876543210')).toBe('091-98765XXXXX');
    expect(maskPhone('9876543210'.padStart(10, '0'))).toContain('X');
  });

  test('maskPhone: never reveals more than length-5 digits, and never throws on short/malformed input', () => {
    expect(() => maskPhone('123')).not.toThrow();
    expect(maskPhone('123')).toBe('XXX'); // too short to safely reveal anything
    expect(maskPhone('')).toBe('');
    expect(maskPhone('not-a-phone')).toBe('not-a-phone'); // no digits at all: nothing to mask, nothing to leak either
  });

  test('maskEmail: common email shapes mask to the documented `ra***@domain` shape', () => {
    expect(maskEmail('rahul@gmail.com')).toBe('ra***@gmail.com');
    expect(maskEmail('priya.sharma@fleetpro.in')).toBe('pr***@fleetpro.in');
    expect(maskEmail('a@x.com')).toBe('a***@x.com'); // 1-char local part: keep what little there is
    expect(maskEmail('ab@x.com')).toBe('ab***@x.com'); // exactly 2-char local part
  });

  test('maskEmail: malformed input masks conservatively rather than leaking the raw string', () => {
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('')).toBe('');
  });

  test('assertFieldIsUnmaskable: only phone/email pass; every other field name throws, even bypassing TypeScript', () => {
    for (const field of UNMASKABLE_FIELDS) {
      expect(() => assertFieldIsUnmaskable(field)).not.toThrow();
    }
    const forbidden = ['password', 'otp', 'cvv', 'token', 'accessToken', 'refreshToken', 'apiKey', 'oauthSecret', 'secret', 'sessionCookie', 'pin'];
    for (const field of forbidden) {
      expect(() => assertFieldIsUnmaskable(field as any)).toThrow(PiiUnmaskForbiddenError);
    }
  });

  test('unmaskField: rejects a forbidden field before touching the audit log at all', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const before = await PlatformAuditEventModel.countDocuments({});
      await expect(
        unmaskField({
          field: 'password' as any,
          rawValue: 'should-never-be-returned',
          reason: 'testing rejection',
          actorUserId: 'tester-1',
          targetEntity: 'Customer:fake',
        }),
      ).rejects.toThrow(PiiUnmaskForbiddenError);
      const after = await PlatformAuditEventModel.countDocuments({});
      expect(after).toBe(before); // no audit event for a rejected attempt
    } finally {
      await mongoose.disconnect();
    }
  });

  test('unmaskField: requires a non-empty reason', async () => {
    await expect(
      unmaskField({
        field: 'phone',
        rawValue: '9876543210',
        reason: '   ',
        actorUserId: 'tester-1',
        targetEntity: 'Customer:fake',
      }),
    ).rejects.toThrow(/reason is required/i);
  });

  test('unmaskField: produces exactly one audit event with actor/tenant/target/reason/timestamp, and returns the real value', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const targetTenantId = new mongoose.Types.ObjectId().toString();
      const targetEntity = `Customer:${new mongoose.Types.ObjectId().toString()}`;
      const actorUserId = `root-tester-${Date.now()}`;
      const reason = 'Verifying billing dispute — customer called in';
      const rawValue = '9876543210';

      const result = await unmaskField({
        field: 'phone',
        rawValue,
        reason,
        actorUserId,
        actorPlatformRole: 'PLATFORM_SUPPORT_ADMIN',
        targetTenantId,
        targetEntity,
      });

      expect(result.value).toBe(rawValue);

      const events = await PlatformAuditEventModel.find({ userId: actorUserId }).lean();
      expect(events.length).toBe(1);

      const event = events[0];
      expect(event.action).toBe('pii.unmask');
      expect(event.userId).toBe(actorUserId);
      expect(event.targetTenantId?.toString()).toBe(targetTenantId);
      expect(event.targetEntity).toBe(targetEntity);
      expect(event.reason).toBe(reason);
      expect(event.createdAt).toBeTruthy();

      // The audit event itself must never contain the raw unmasked value —
      // only the field name, per the security note in auditLog.ts.
      const serializedEvent = JSON.stringify(event);
      expect(serializedEvent).not.toContain(rawValue);
    } finally {
      await mongoose.disconnect();
    }
  });
});
