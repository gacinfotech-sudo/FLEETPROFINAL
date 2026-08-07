// TASK-ROOT-SECURITY-05 — Break-glass access: real, testable auto-expiry.
//
// Acceptance criterion: "expires automatically — proven by a test using a
// short duration and confirming access is denied after expiry, not just
// that a timestamp field exists." This test uses a real ~1-second duration
// and a real wall-clock wait (no mocked/fake timers), then re-fetches the
// event from the database before checking it — proving the enforcement
// reads live state, not a cached in-memory copy.

import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import {
  createBreakGlassEvent,
  isBreakGlassEventActive,
  requireActiveBreakGlassEvent,
  revokeBreakGlassEvent,
  BreakGlassValidationError,
} from '../../server/root/services/breakGlassService';
import { PlatformAuditEventModel } from '../../server/root/models/auditLog';
import { BreakGlassEvent } from '../../server/root/models/breakGlassEvent';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for this verification.');
  return process.env.MONGODB_URI;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe('Break-glass access — auto-expiry (TASK-ROOT-SECURITY-05)', () => {
  test.setTimeout(30_000);

  test('a break-glass grant with a short duration is active immediately and denied after it really elapses', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const actorUserId = `break-glass-tester-${Date.now()}`;
      // 3 real seconds — short enough to keep the test fast, long enough to
      // be unambiguous against normal Mongo round-trip / connection latency
      // (the "immediately active" assertion below needs real headroom).
      const durationMinutes = 3 / 60;

      const event = await createBreakGlassEvent({
        actorUserId,
        actorPlatformRole: 'PLATFORM_SECURITY_ADMIN',
        reason: 'Investigating a production incident',
        ticketReference: 'INC-9001',
        scope: 'platform',
        durationMinutes,
      });

      // Immediately active.
      const fresh = await BreakGlassEvent.findById(event.id);
      expect(fresh).toBeTruthy();
      expect(isBreakGlassEventActive(fresh!)).toBe(true);
      await expect(requireActiveBreakGlassEvent(event.id)).resolves.toBeTruthy();

      // Real wait past the real expiry — not a mocked clock.
      await wait(3_500);

      const afterExpiry = await BreakGlassEvent.findById(event.id);
      expect(afterExpiry).toBeTruthy();
      expect(isBreakGlassEventActive(afterExpiry!)).toBe(false);
      await expect(requireActiveBreakGlassEvent(event.id)).rejects.toThrow(/expired|revoked/i);

      // The expiresAt timestamp itself never moved — expiry is enforced by
      // comparing against wall-clock time on every check, not by mutating
      // the record when time passes.
      expect(afterExpiry!.expiresAt.getTime()).toBe(fresh!.expiresAt.getTime());
    } finally {
      await mongoose.disconnect();
    }
  });

  test('revoking a break-glass grant makes it inactive immediately, before its natural expiry', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const actorUserId = `break-glass-revoke-tester-${Date.now()}`;
      const event = await createBreakGlassEvent({
        actorUserId,
        reason: 'Testing manual revocation',
        ticketReference: 'INC-9002',
        scope: 'platform',
        durationMinutes: 30, // long duration — revocation, not expiry, must be what ends access
      });

      expect(isBreakGlassEventActive(await BreakGlassEvent.findById(event.id) as any)).toBe(true);

      await revokeBreakGlassEvent(event.id, 'revoker-1', 'PLATFORM_ROOT');

      const revoked = await BreakGlassEvent.findById(event.id);
      expect(revoked!.revokedAt).toBeTruthy();
      expect(isBreakGlassEventActive(revoked!)).toBe(false);
      await expect(requireActiveBreakGlassEvent(event.id)).rejects.toThrow(/expired|revoked/i);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('create + revoke each produce their own audit event, with no raw secrets involved', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const actorUserId = `break-glass-audit-tester-${Date.now()}`;
      const event = await createBreakGlassEvent({
        actorUserId,
        reason: 'Auditing break-glass audit trail itself',
        ticketReference: 'INC-9003',
        scope: 'platform',
        durationMinutes: 5,
      });

      await revokeBreakGlassEvent(event.id, actorUserId);

      const events = await PlatformAuditEventModel.find({ userId: actorUserId }).sort({ createdAt: 1 }).lean();
      expect(events.length).toBe(2);
      expect(events[0].action).toBe('break_glass.create');
      expect(events[0].targetEntity).toBe(`BreakGlassEvent:${event.id}`);
      expect(events[1].action).toBe('break_glass.revoke');
      expect(events[1].targetEntity).toBe(`BreakGlassEvent:${event.id}`);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('validation: reason, ticketReference, scope, tenantId-for-tenant-scope, and duration bounds are all enforced', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const base = {
        actorUserId: 'validation-tester',
        reason: 'valid reason',
        ticketReference: 'INC-1',
        scope: 'platform' as const,
        durationMinutes: 5,
      };

      await expect(createBreakGlassEvent({ ...base, reason: '' })).rejects.toThrow(BreakGlassValidationError);
      await expect(createBreakGlassEvent({ ...base, ticketReference: '' })).rejects.toThrow(BreakGlassValidationError);
      await expect(createBreakGlassEvent({ ...base, scope: 'bogus' as any })).rejects.toThrow(BreakGlassValidationError);
      await expect(createBreakGlassEvent({ ...base, scope: 'tenant', tenantId: undefined })).rejects.toThrow(BreakGlassValidationError);
      await expect(createBreakGlassEvent({ ...base, durationMinutes: 0 })).rejects.toThrow(BreakGlassValidationError);
      await expect(createBreakGlassEvent({ ...base, durationMinutes: 481 })).rejects.toThrow(BreakGlassValidationError);

      // A valid tenant-scoped grant with a real tenantId succeeds.
      const tenantScoped = await createBreakGlassEvent({
        ...base,
        scope: 'tenant',
        tenantId: new mongoose.Types.ObjectId().toString(),
      });
      expect(tenantScoped.scope).toBe('tenant');
    } finally {
      await mongoose.disconnect();
    }
  });
});
