// TASK-ROOT-SECURITY-05 — the unmask ROUTE end-to-end (not just the service
// function), and the hard security proof: no route this task owns can ever
// return a password/OTP/CVV/token/secret/cookie field, even if a caller
// tries to ask for one.
//
// Acceptance criterion: "Passwords/OTP/tokens/secrets: prove your masking/
// audit code path has no route that could ever return one of these fields,
// even accidentally — a test that attempts to fetch one through your new
// endpoints and confirms it's absent from the response."

import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { Customer } from '../../server/models/index';
import { auditRouter } from '../../server/root/routes/audit';
import { PlatformAuditEventModel } from '../../server/root/models/auditLog';
import { invokeRoute, createFakeSession } from './helpers/root-security-route-harness';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for this verification.');
  return process.env.MONGODB_URI;
}

function platformStaffReq(userId: string) {
  return {
    user: { userId, role: 'admin', platformRole: 'PLATFORM_SUPPORT_ADMIN' },
    userId,
    session: createFakeSession(),
  };
}

async function cleanupCustomer(id: string) {
  await Customer.deleteOne({ _id: id });
}

test.describe('Unmask route + never-retrievable secrets (TASK-ROOT-SECURITY-05)', () => {
  test.setTimeout(30_000);

  test('POST /customers/:id/unmask returns the real phone/email for the allowlisted fields, reason required, exactly one audit event each', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let customerId: string | undefined;
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const rawPhone = '9876543210';
      const rawEmail = 'rahul.customer@example.com';

      const customer = await Customer.create({
        tenantId,
        name: 'Unmask Route Test Customer',
        primaryMobile: rawPhone,
        email: rawEmail,
        createdBy: { userId: 'seed', role: 'admin' },
      });
      customerId = customer.id;

      const actorUserId = `unmask-route-tester-${Date.now()}`;
      const req = platformStaffReq(actorUserId);

      const phoneRes = await invokeRoute(auditRouter, 'post', `/customers/${customerId}/unmask`, {
        ...req,
        body: { field: 'phone', reason: 'Verifying identity for a support call' },
      });
      expect(phoneRes.statusCode).toBe(200);
      expect((phoneRes.body as any).value).toBe(rawPhone);

      const emailRes = await invokeRoute(auditRouter, 'post', `/customers/${customerId}/unmask`, {
        ...req,
        body: { field: 'email', reason: 'Verifying identity for a support call' },
      });
      expect(emailRes.statusCode).toBe(200);
      expect((emailRes.body as any).value).toBe(rawEmail);

      const events = await PlatformAuditEventModel.find({ userId: actorUserId, action: 'pii.unmask' }).lean();
      expect(events.length).toBe(2);
      for (const event of events) {
        expect(event.targetEntity).toBe(`Customer:${customerId}`);
        expect(event.targetTenantId?.toString()).toBe(tenantId);
        expect(JSON.stringify(event)).not.toContain(rawPhone);
        expect(JSON.stringify(event)).not.toContain(rawEmail);
      }

      const noReasonRes = await invokeRoute(auditRouter, 'post', `/customers/${customerId}/unmask`, {
        ...req,
        body: { field: 'phone', reason: '' },
      });
      expect(noReasonRes.statusCode).toBe(400);
    } finally {
      if (customerId) await cleanupCustomer(customerId);
      await mongoose.disconnect();
    }
  });

  test('the unmask route rejects password/otp/cvv/token/secret/cookie field names outright — 400, and none of these ever appear in the response', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let customerId: string | undefined;
    try {
      const customer = await Customer.create({
        tenantId: new mongoose.Types.ObjectId().toString(),
        name: 'Secrets Rejection Test Customer',
        primaryMobile: '9998887770',
        createdBy: { userId: 'seed', role: 'admin' },
      });
      customerId = customer.id;

      const req = platformStaffReq(`secrets-tester-${Date.now()}`);
      const forbiddenFields = ['password', 'otp', 'cvv', 'token', 'accessToken', 'apiKey', 'oauthSecret', 'sessionCookie', 'secret'];

      for (const field of forbiddenFields) {
        const res = await invokeRoute(auditRouter, 'post', `/customers/${customerId}/unmask`, {
          ...req,
          body: { field, reason: 'Attempting to fetch a secret via the unmask endpoint' },
        });
        expect(res.statusCode, `field "${field}" must be rejected`).toBe(400);
        const serialized = JSON.stringify(res.body ?? {});
        expect(serialized).not.toContain('"value"');
      }
    } finally {
      if (customerId) await cleanupCustomer(customerId);
      await mongoose.disconnect();
    }
  });

  test('GET /audit never exposes password/token/secret fields, because PlatformAuditEvent has no such field in its schema and this task never writes one', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const actorUserId = `audit-list-shape-check-${Date.now()}`;
      await PlatformAuditEventModel.create({
        userId: actorUserId,
        action: 'pii.unmask',
        newValue: { field: 'phone' },
        reason: 'schema shape check',
      });

      const req = platformStaffReq(actorUserId);
      const res = await invokeRoute(auditRouter, 'get', '/audit', {
        ...req,
        query: { userId: actorUserId, limit: '10' },
      });
      expect(res.statusCode).toBe(200);
      const serialized = JSON.stringify(res.body);
      for (const forbidden of ['password', 'otp', 'cvv', 'token', 'secret', 'cookie', 'apiKey']) {
        expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    } finally {
      await mongoose.disconnect();
    }
  });
});
