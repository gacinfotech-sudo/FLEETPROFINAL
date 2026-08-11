import { expect, test } from '@playwright/test';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { login } from './helpers';
import {
  decryptTelephonyCredentials,
  encryptTelephonyCredentials,
} from '../../server/telephony/security/credentialEncryption';
import { setTelephonyEventEmitter, type TelephonyEvent } from '../../server/telephony/index';
import { Tenant, User } from '../../server/models';
import { TelephonyIdentity } from '../../server/models';

// Pure unit test — no server/DB required. Mirrors
// tests/e2e/gps-connection-security.spec.ts's encryption round-trip test
// for the GPS module's own credential envelope.
test('Telephony provider credentials use authenticated encryption bound to tenant and identity', () => {
  const previous = process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY;
  process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY = '22'.repeat(32);
  try {
    const encrypted = encryptTelephonyCredentials({ apiKey: 'never-plaintext' }, 'tenant-a', 'user-a');
    expect(encrypted).not.toContain('never-plaintext');
    expect(decryptTelephonyCredentials(encrypted, 'tenant-a', 'user-a')).toEqual({ apiKey: 'never-plaintext' });
    expect(() => decryptTelephonyCredentials(encrypted, 'tenant-b', 'user-a')).toThrow();
    expect(() => decryptTelephonyCredentials(encrypted, 'tenant-a', 'user-b')).toThrow();
  } finally {
    if (previous === undefined) delete process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY = previous;
  }
});

// Pure unit test of the real-time hand-off point described in
// TASK-02-report.md's WebSocket bootstrap + room design: until the
// Integrator wires a real Socket.IO emitter into server/index.ts, calling
// setTelephonyEventEmitter() is how *any* caller (including this test)
// observes exactly which room(s) an event would be routed to. This proves
// the room-targeting design is correct — a per-user event names exactly
// one user, not the whole tenant — independent of whether a transport
// exists yet.
test('Telephony event emitter targets exactly the routed user, not tenant-wide broadcast', async () => {
  const events: TelephonyEvent[] = [];
  setTelephonyEventEmitter((event) => events.push(event));
  try {
    const { resolveInboundEvent } = await import('../../server/telephony/services/callService');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const marker = `telsec_${Date.now()}`;
      const tenant = await Tenant.create({ name: `${marker} tenant`, businessName: `${marker} biz`, isActive: true });
      const identity = await TelephonyIdentity.create({
        tenantId: tenant._id,
        userId: `${marker}_exec`,
        providerKey: 'mock',
        virtualNumber: `+1900${Date.now() % 1000000}`,
        incomingEnabled: true,
        outgoingEnabled: true,
        createdBy: 'test-fixture',
        updatedBy: 'test-fixture',
      });

      const call = await resolveInboundEvent({
        providerCallId: `${marker}_evt1`,
        direction: 'inbound',
        fromNumber: '+911234567890',
        toNumber: identity.virtualNumber!,
        virtualNumber: identity.virtualNumber!,
        status: 'ringing',
        occurredAt: new Date(),
      });

      expect(call).toBeTruthy();
      const ringingEvent = events.find((e) => e.type === 'call.ringing' && e.callSessionId === call!.id);
      expect(ringingEvent).toBeTruthy();
      expect(ringingEvent!.targetUserId).toBe(identity.userId);
      expect(ringingEvent!.tenantId).toBe(String(tenant._id));
    } finally {
      await mongoose.disconnect();
    }
  } finally {
    setTelephonyEventEmitter(() => {});
  }
});

// HTTP-level test that the identity write/read endpoints never leak a
// provider secret into any response body, and that only the owner/admin
// role may write an identity even for an executive's own record.
test('Telephony identity API encrypts credentials, masks them in every response, and restricts writes to owner/admin', async ({ page }) => {
  test.setTimeout(60_000);
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for telephony identity API verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY = process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY || '33'.repeat(32);
  try {
    const marker = `telid_${Date.now()}`;
    const password = 'TelRbac#2026!';
    const passwordHash = await bcrypt.hash(password, 12);
    const tenant = await Tenant.create({ name: `${marker} tenant`, businessName: `${marker} biz`, isActive: true });
    const ownerUserId = `${marker}_owner`;
    const execUserId = `${marker}_exec`;
    await User.create({
      userId: ownerUserId, password: passwordHash, role: 'client', tenantId: tenant._id,
      isActive: true, hasCompletedOnboarding: true, permissions: [],
    });
    await User.create({
      userId: execUserId, password: passwordHash, role: 'manager', tenantId: tenant._id,
      isActive: true, hasCompletedOnboarding: true, permissions: ['call.view_own', 'call.initiate', 'call.manage'],
    });

    const secret = `provider-secret-${marker}`;

    await login(page, ownerUserId, password);
    const csrf = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const headers = { 'X-CSRF-Token': csrf };

    const writeResponse = await page.request.put(`/api/telephony/identities/${execUserId}`, {
      headers,
      data: {
        providerKey: 'mock',
        providerAgentId: 'agent-1',
        registeredNumber: '+919990000001',
        virtualNumber: '+919990000002',
        extension: '101',
        incomingEnabled: true,
        outgoingEnabled: true,
        credentials: { apiKey: secret },
      },
    });
    const written = await writeResponse.json();
    expect(writeResponse.ok(), JSON.stringify(written)).toBe(true);
    expect(JSON.stringify(written)).not.toContain(secret);
    expect(written.hasCredentialsConfigured).toBe(true);

    const stored = await TelephonyIdentity.findOne({ tenantId: tenant._id, userId: execUserId }).select('+encryptedCredentials');
    expect(stored?.encryptedCredentials).toBeTruthy();
    expect(stored?.encryptedCredentials).not.toContain(secret);
    expect(decryptTelephonyCredentials(stored!.encryptedCredentials!, String(tenant._id), execUserId)).toEqual({ apiKey: secret });

    // The executive can read their own identity but never the encrypted
    // credentials, and cannot write it themselves even though it's their
    // own record ("owner/admin only to write"). Clear the owner's session
    // cookie first — re-navigating to /login while still authenticated
    // redirects straight to /dashboard, so the #userId field never appears.
    await page.context().clearCookies();
    await login(page, execUserId, password);
    const selfRead = await page.request.get(`/api/telephony/identities/${execUserId}`);
    const selfBody = await selfRead.text();
    expect(selfRead.ok(), selfBody).toBe(true);
    expect(selfBody).not.toContain(secret);
    expect(selfBody).not.toContain('encryptedCredentials');

    const execCsrf = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const execWriteAttempt = await page.request.put(`/api/telephony/identities/${execUserId}`, {
      headers: { 'X-CSRF-Token': execCsrf },
      data: { extension: '999' },
    });
    expect(execWriteAttempt.status()).toBe(403);
  } finally {
    await mongoose.disconnect();
  }
});
