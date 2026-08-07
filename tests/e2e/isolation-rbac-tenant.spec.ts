import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { login } from './helpers';
import { Tenant, User } from '../../server/models';
import { CallSession, TelephonyIdentity } from '../../server/models';

// TASK-04 cross-cutting RBAC/tenant-isolation coverage. Reuses the exact
// fixture pattern TASK-02 established in telephony-isolation.spec.ts (a
// freshly generated marker-suffixed tenant/owner/two-executives triad per
// run, mapped onto the existing admin|client|manager role enum: client =
// tenant owner, manager = executive) rather than inventing a new fixture
// scheme or hard-coding names. This file's scenarios overlap in spirit
// with telephony-isolation.spec.ts's early tests but exercise a distinct
// generated tenant/dataset end-to-end, plus additional acceptance criteria
// (owner-filter query, cross-tenant-for-owner, note attribution surviving
// a second author, reassignment history, duplicate-webhook de-dupe) in one
// place so cross-cutting QA doesn't depend on TASK-02's file continuing to
// exist unchanged.
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'CrossQaRbac#2026!';

async function getCsrf(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  return (await res.json()).csrfToken;
}

let marker: string;
let tenantAId: string;
let ownerUserId: string;
let execAUserId: string;
let execBUserId: string;
let tenantBCallId: string;
let callAId: string;
let callBId: string;

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for isolation/RBAC verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY = process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY || '44'.repeat(32);

  marker = `qarbac_${Date.now()}`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const tenantA = await Tenant.create({ name: `${marker} Company`, businessName: `${marker} Company Pvt Ltd`, isActive: true });
  tenantAId = String(tenantA._id);
  const tenantB = await Tenant.create({ name: `${marker} Other Co`, businessName: `${marker} Other Co Pvt Ltd`, isActive: true });

  // Lowercase-only: storage-mongodb.ts's getUserByCredentials() always
  // lowercases the login userId before querying (userId is stored
  // lowercase by the app's own createUser()). Since fixtures here are
  // inserted directly via the Mongoose model (bypassing createUser), any
  // uppercase character in these ids would silently 401 every login.
  ownerUserId = `${marker}_owner`;
  execAUserId = `${marker}_execa`;
  execBUserId = `${marker}_execb`;

  await User.create({
    userId: ownerUserId, password: passwordHash, role: 'client', tenantId: tenantA._id,
    isActive: true, hasCompletedOnboarding: true, permissions: [],
  });
  for (const execUserId of [execAUserId, execBUserId]) {
    await User.create({
      userId: execUserId, password: passwordHash, role: 'manager', tenantId: tenantA._id,
      isActive: true, hasCompletedOnboarding: true,
      permissions: ['call.view_own', 'call.initiate', 'call.manage'],
    });
    await TelephonyIdentity.create({
      tenantId: tenantA._id,
      userId: execUserId,
      providerKey: 'mock',
      registeredNumber: `+9199901${Math.floor(Math.random() * 100000)}`,
      virtualNumber: execUserId === execAUserId ? `${marker}_vnA` : `${marker}_vnB`,
      incomingEnabled: true,
      outgoingEnabled: true,
      createdBy: ownerUserId,
      updatedBy: ownerUserId,
    });
  }

  // A CallSession belonging to an entirely different tenant, to prove even
  // tenant A's owner cannot reach it by direct ID.
  const otherTenantCall = await CallSession.create({
    tenantId: tenantB._id,
    direction: 'outbound',
    status: 'completed',
    userId: `${marker}_foreign_exec`,
    assignedUserId: `${marker}_foreign_exec`,
    fromNumber: '+910000000001',
    toNumber: '+919999999998',
    providerKey: 'mock',
    createdBy: { userId: `${marker}_foreign_exec`, role: 'manager' },
    updatedBy: { userId: `${marker}_foreign_exec`, role: 'manager' },
  });
  tenantBCallId = otherTenantCall.id;
});

test.afterAll(async () => {
  await mongoose.disconnect();
});

test('Executive A creates an outbound call under their own identity', async ({ page }) => {
  await login(page, execAUserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.post('/api/telephony/calls', { headers, data: { toNumber: '+919812400001' } });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(201);
  expect(body.userId).toBe(execAUserId);
  callAId = body.id;
});

test('Executive B creates an independent outbound call under their own identity', async ({ page }) => {
  await login(page, execBUserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.post('/api/telephony/calls', { headers, data: { toNumber: '+919812400002' } });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(201);
  expect(body.userId).toBe(execBUserId);
  callBId = body.id;
});

test('Executive A sees only their own calls', async ({ page }) => {
  await login(page, execAUserId, PASSWORD);
  const list = await (await page.request.get('/api/telephony/calls')).json();
  const ids = list.map((c: any) => c.id);
  expect(ids).toContain(callAId);
  expect(ids).not.toContain(callBId);
  expect(list.every((c: any) => c.userId === execAUserId)).toBe(true);
});

test('Executive B cannot PATCH Executive A\'s call (blocked as not found, never leaking its existence)', async ({ page }) => {
  await login(page, execBUserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.patch(`/api/telephony/calls/${callAId}`, { headers, data: { note: 'should not land' } });
  // getCallSessionForActor() returns null for a manager reading another
  // executive's call, and the route turns null into 404 (not 403) so a
  // cross-executive PATCH never distinguishes "exists but forbidden" from
  // "doesn't exist" — see server/telephony/routes/calls.ts:157-158.
  expect(res.status()).toBe(404);
  const callAfter = await CallSession.findById(callAId);
  expect(callAfter!.notes).toHaveLength(0);
});

test('Owner/admin sees the combined tenant-wide pipeline across both executives', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const list = await (await page.request.get('/api/telephony/calls')).json();
  const ids = list.map((c: any) => c.id);
  expect(ids).toContain(callAId);
  expect(ids).toContain(callBId);
});

test('Owner can filter the tenant-wide view to just Executive A', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const list = await (await page.request.get(`/api/telephony/calls?userId=${execAUserId}`)).json();
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((c: any) => c.userId === execAUserId)).toBe(true);
  expect(list.map((c: any) => c.id)).not.toContain(callBId);
});

test('Owner can filter the tenant-wide view to just Executive B', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const list = await (await page.request.get(`/api/telephony/calls?userId=${execBUserId}`)).json();
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((c: any) => c.userId === execBUserId)).toBe(true);
  expect(list.map((c: any) => c.id)).not.toContain(callAId);
});

test('A different tenant\'s call is unreachable by direct ID, even for this tenant\'s owner', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const res = await page.request.get(`/api/telephony/calls/${tenantBCallId}`);
  expect(res.status()).toBe(404);
});

test('Call note attribution survives a second author\'s note (executive, then owner)', async ({ page }) => {
  await login(page, execAUserId, PASSWORD);
  let headers = { 'X-CSRF-Token': await getCsrf(page) };
  const first = await (await page.request.patch(`/api/telephony/calls/${callAId}`, {
    headers, data: { note: 'Customer asked to call back after 6pm.' },
  })).json();
  expect(first.notes).toHaveLength(1);
  expect(first.notes[0].createdBy.userId).toBe(execAUserId);

  await page.context().clearCookies();
  await login(page, ownerUserId, PASSWORD);
  headers = { 'X-CSRF-Token': await getCsrf(page) };
  const second = await (await page.request.patch(`/api/telephony/calls/${callAId}`, {
    headers, data: { note: 'Following up personally.' },
  })).json();
  expect(second.notes).toHaveLength(2);
  // Adding a second note never rewrites the first note's author.
  expect(second.notes[0].createdBy.userId).toBe(execAUserId);
  expect(second.notes[1].createdBy.userId).toBe(ownerUserId);
});

test('Reassignment updates assignedUserId and appends reassignment history without touching original ownership', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.patch(`/api/telephony/calls/${callAId}`, {
    headers, data: { assignedUserId: execBUserId, reassignReason: 'Load balancing.' },
  });
  const body = await res.json();
  expect(res.ok(), JSON.stringify(body)).toBe(true);
  expect(body.assignedUserId).toBe(execBUserId);
  expect(body.userId).toBe(execAUserId); // historical creator untouched
  expect(body.reassignmentHistory).toHaveLength(1);
  expect(body.reassignmentHistory[0]).toMatchObject({
    fromUserId: execAUserId,
    toUserId: execBUserId,
    reason: 'Load balancing.',
  });
});

test('Duplicate webhook delivery for the same provider call de-dupes to a single record', async ({ page }) => {
  const providerCallId = `${marker}_inbound_dupe`;
  const payload = {
    providerCallId,
    direction: 'inbound' as const,
    fromNumber: '+919812488888',
    toNumber: `${marker}_vnA`,
    virtualNumber: `${marker}_vnA`,
    status: 'ringing',
    occurredAt: new Date().toISOString(),
  };
  const first = await page.request.post('/api/telephony/webhook', { data: payload });
  const firstBody = await first.json();
  expect(first.ok(), JSON.stringify(firstBody)).toBe(true);
  expect(firstBody.resolved).toBe(true);
  expect(firstBody.callSession.userId).toBe(execAUserId);

  const second = await page.request.post('/api/telephony/webhook', {
    data: { ...payload, status: 'in_progress' },
  });
  expect(second.ok()).toBe(true);

  const matches = await CallSession.find({ tenantId: tenantAId, providerCallId });
  expect(matches).toHaveLength(1);
  expect(matches[0].status).toBe('in_progress');
});
