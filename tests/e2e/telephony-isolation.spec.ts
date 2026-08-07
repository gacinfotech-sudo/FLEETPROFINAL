import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { login } from './helpers';
import { Tenant, User } from '../../server/models';
import { CallSession, TelephonyIdentity } from '../../server/models';

// Acceptance-user roles from the original requirement, generalized per
// TASK-02.md ("Do not hard-code these names"): a tenant owner/manager and
// two independent executives, mapped onto this repo's existing
// admin|manager|client role enum (client = tenant owner, manager =
// executive). Every identifier below is fixture data generated at test
// run time, not a real person's name.
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'TelRbac#2026!';

async function getCsrf(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  return (await res.json()).csrfToken;
}

let marker: string;
let tenantAId: string;
let ownerUserId: string;
let exec1UserId: string; // "Ram"-equivalent
let exec2UserId: string; // "Shyam"-equivalent
let tenantBCallId: string;
let call1Id: string; // exec1's outbound call
let call2Id: string; // exec2's outbound call

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for telephony isolation verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY = process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY || '44'.repeat(32);

  marker = `telrbac_${Date.now()}`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const tenantA = await Tenant.create({ name: `${marker} Company`, businessName: `${marker} Company Pvt Ltd`, isActive: true });
  tenantAId = String(tenantA._id);
  const tenantB = await Tenant.create({ name: `${marker} Other Co`, businessName: `${marker} Other Co Pvt Ltd`, isActive: true });

  ownerUserId = `${marker}_owner`;
  exec1UserId = `${marker}_exec1`;
  exec2UserId = `${marker}_exec2`;

  await User.create({
    userId: ownerUserId, password: passwordHash, role: 'client', tenantId: tenantA._id,
    isActive: true, hasCompletedOnboarding: true, permissions: [],
  });
  for (const execUserId of [exec1UserId, exec2UserId]) {
    await User.create({
      userId: execUserId, password: passwordHash, role: 'manager', tenantId: tenantA._id,
      isActive: true, hasCompletedOnboarding: true,
      permissions: ['call.view_own', 'call.initiate', 'call.manage'],
    });
    await TelephonyIdentity.create({
      tenantId: tenantA._id,
      userId: execUserId,
      providerKey: 'mock',
      registeredNumber: `+9199900${Math.floor(Math.random() * 100000)}`,
      virtualNumber: execUserId === exec1UserId ? `${marker}_vn1` : `${marker}_vn2`,
      incomingEnabled: true,
      outgoingEnabled: true,
      createdBy: ownerUserId,
      updatedBy: ownerUserId,
    });
  }

  // A CallSession that belongs to an entirely different tenant — used to
  // prove direct-ID manipulation across tenants is blocked regardless of
  // caller role within tenant A.
  const otherTenantCall = await CallSession.create({
    tenantId: tenantB._id,
    direction: 'outbound',
    status: 'completed',
    userId: `${marker}_other_exec`,
    assignedUserId: `${marker}_other_exec`,
    fromNumber: '+910000000000',
    toNumber: '+919999999999',
    providerKey: 'mock',
    createdBy: { userId: `${marker}_other_exec`, role: 'manager' },
    updatedBy: { userId: `${marker}_other_exec`, role: 'manager' },
  });
  tenantBCallId = otherTenantCall.id;
});

test.afterAll(async () => {
  await mongoose.disconnect();
});

test('Executive 1 initiates an outbound call using their own telephony identity', async ({ page }) => {
  await login(page, exec1UserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.post('/api/telephony/calls', {
    headers,
    data: { toNumber: '+919812300001' },
  });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(201);
  expect(body.userId).toBe(exec1UserId);
  expect(body.assignedUserId).toBe(exec1UserId);
  call1Id = body.id;
});

test('Executive 2 initiates an independent outbound call using their own telephony identity', async ({ page }) => {
  await login(page, exec2UserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.post('/api/telephony/calls', {
    headers,
    data: { toNumber: '+919812300002' },
  });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(201);
  expect(body.userId).toBe(exec2UserId);
  call2Id = body.id;
});

test('Executive 1 sees only their own calls, never Executive 2\'s', async ({ page }) => {
  await login(page, exec1UserId, PASSWORD);
  const res = await page.request.get('/api/telephony/calls');
  const list = await res.json();
  expect(res.ok(), JSON.stringify(list)).toBe(true);
  const ids = list.map((c: any) => c.id);
  expect(ids).toContain(call1Id);
  expect(ids).not.toContain(call2Id);
  expect(list.every((c: any) => c.userId === exec1UserId)).toBe(true);
});

test('Executive 2 sees only their own calls, never Executive 1\'s', async ({ page }) => {
  await login(page, exec2UserId, PASSWORD);
  const res = await page.request.get('/api/telephony/calls');
  const list = await res.json();
  const ids = list.map((c: any) => c.id);
  expect(ids).toContain(call2Id);
  expect(ids).not.toContain(call1Id);
  expect(list.every((c: any) => c.userId === exec2UserId)).toBe(true);
});

test('Executive 1 cannot read Executive 2\'s call by direct ID manipulation', async ({ page }) => {
  await login(page, exec1UserId, PASSWORD);
  const res = await page.request.get(`/api/telephony/calls/${call2Id}`);
  expect(res.status()).toBe(404);
});

test('Executive 2 cannot control (PATCH/end) Executive 1\'s active call', async ({ page }) => {
  await login(page, exec2UserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.patch(`/api/telephony/calls/${call1Id}`, {
    headers,
    data: { status: 'completed' },
  });
  expect(res.status()).toBe(404);
});

test('A different tenant\'s CallSession is unreachable by direct ID, even for the tenant owner', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const res = await page.request.get(`/api/telephony/calls/${tenantBCallId}`);
  expect(res.status()).toBe(404);

  // Re-navigating to /login while an authenticated session cookie is still
  // present redirects straight to /dashboard (the app's own login-page
  // guard), so the #userId field never appears — clear the session first
  // so this second login is a clean, unauthenticated visit like the first.
  await page.context().clearCookies();
  await login(page, exec1UserId, PASSWORD);
  const res2 = await page.request.get(`/api/telephony/calls/${tenantBCallId}`);
  expect(res2.status()).toBe(404);
});

test('Tenant owner sees the combined pipeline across both executives', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const res = await page.request.get('/api/telephony/calls');
  const list = await res.json();
  const ids = list.map((c: any) => c.id);
  expect(ids).toContain(call1Id);
  expect(ids).toContain(call2Id);
});

test('Tenant owner can filter the combined view by Executive 1 only', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const res = await page.request.get(`/api/telephony/calls?userId=${exec1UserId}`);
  const list = await res.json();
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((c: any) => c.userId === exec1UserId)).toBe(true);
  expect(list.map((c: any) => c.id)).not.toContain(call2Id);
});

test('Tenant owner can filter the combined view by Executive 2 only', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const res = await page.request.get(`/api/telephony/calls?userId=${exec2UserId}`);
  const list = await res.json();
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((c: any) => c.userId === exec2UserId)).toBe(true);
  expect(list.map((c: any) => c.id)).not.toContain(call1Id);
});

test('Call note attribution is preserved per author, including after the owner adds a note', async ({ page }) => {
  await login(page, exec1UserId, PASSWORD);
  let headers = { 'X-CSRF-Token': await getCsrf(page) };
  const execNoteRes = await page.request.patch(`/api/telephony/calls/${call1Id}`, {
    headers,
    data: { note: 'Customer requested a callback tomorrow.' },
  });
  const afterExecNote = await execNoteRes.json();
  expect(execNoteRes.ok(), JSON.stringify(afterExecNote)).toBe(true);
  expect(afterExecNote.notes).toHaveLength(1);
  expect(afterExecNote.notes[0].createdBy.userId).toBe(exec1UserId);

  await page.context().clearCookies();
  await login(page, ownerUserId, PASSWORD);
  headers = { 'X-CSRF-Token': await getCsrf(page) };
  const ownerNoteRes = await page.request.patch(`/api/telephony/calls/${call1Id}`, {
    headers,
    data: { note: 'Reviewed — looks good.' },
  });
  const afterOwnerNote = await ownerNoteRes.json();
  expect(afterOwnerNote.notes).toHaveLength(2);
  // The executive's original note keeps its original author — adding a
  // second note never rewrites the first note's attribution.
  expect(afterOwnerNote.notes[0].createdBy.userId).toBe(exec1UserId);
  expect(afterOwnerNote.notes[1].createdBy.userId).toBe(ownerUserId);
});

test('Reassignment updates follow-up ownership and records history without rewriting the original creator', async ({ page }) => {
  await login(page, ownerUserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.patch(`/api/telephony/calls/${call1Id}`, {
    headers,
    data: { assignedUserId: exec2UserId, reassignReason: 'Executive 1 is on leave.' },
  });
  const body = await res.json();
  expect(res.ok(), JSON.stringify(body)).toBe(true);
  expect(body.assignedUserId).toBe(exec2UserId);
  // Historical ownership (who actually created/took the call, and its
  // existing notes) is untouched by reassignment.
  expect(body.userId).toBe(exec1UserId);
  expect(body.notes.every((n: any) => n.createdBy.userId !== exec2UserId)).toBe(true);
  expect(body.reassignmentHistory).toHaveLength(1);
  expect(body.reassignmentHistory[0]).toMatchObject({
    fromUserId: exec1UserId,
    toUserId: exec2UserId,
    reason: 'Executive 1 is on leave.',
  });
});

test('An executive (non-owner) cannot reassign a call', async ({ page }) => {
  await login(page, exec1UserId, PASSWORD);
  const headers = { 'X-CSRF-Token': await getCsrf(page) };
  const res = await page.request.patch(`/api/telephony/calls/${call1Id}`, {
    headers,
    data: { assignedUserId: exec1UserId },
  });
  expect(res.status()).toBe(403);
});

test('Inbound call resolves to the correct routed executive and screen-pops only that user, not the whole tenant', async ({ page }) => {
  const providerCallId = `${marker}_inbound_1`;
  const webhookRes = await page.request.post('/api/telephony/webhook', {
    data: {
      providerCallId,
      direction: 'inbound',
      fromNumber: '+919812399999',
      toNumber: `${marker}_vn1`,
      virtualNumber: `${marker}_vn1`,
      status: 'ringing',
      occurredAt: new Date().toISOString(),
    },
  });
  const webhookBody = await webhookRes.json();
  expect(webhookRes.ok(), JSON.stringify(webhookBody)).toBe(true);
  expect(webhookBody.resolved).toBe(true);
  expect(webhookBody.callSession.userId).toBe(exec1UserId);
  expect(webhookBody.callSession.direction).toBe('inbound');

  await login(page, exec1UserId, PASSWORD);
  const exec1List = await (await page.request.get('/api/telephony/calls')).json();
  expect(exec1List.some((c: any) => c.providerCallId === providerCallId)).toBe(true);

  // See the comment on the earlier cross-tenant test: clear the session
  // before re-visiting /login for the second identity in this same test.
  await page.context().clearCookies();
  await login(page, exec2UserId, PASSWORD);
  const exec2List = await (await page.request.get('/api/telephony/calls')).json();
  expect(exec2List.some((c: any) => c.providerCallId === providerCallId)).toBe(false);
});

test('Duplicate inbound provider events do not create a second popup/record', async ({ page }) => {
  const providerCallId = `${marker}_inbound_1`; // same id as the previous test
  const secondDelivery = await page.request.post('/api/telephony/webhook', {
    data: {
      providerCallId,
      direction: 'inbound',
      fromNumber: '+919812399999',
      toNumber: `${marker}_vn1`,
      virtualNumber: `${marker}_vn1`,
      status: 'in_progress',
      occurredAt: new Date().toISOString(),
    },
  });
  expect(secondDelivery.ok()).toBe(true);

  const matches = await CallSession.find({ tenantId: tenantAId, providerCallId });
  expect(matches).toHaveLength(1);
  expect(matches[0].status).toBe('in_progress');
});
