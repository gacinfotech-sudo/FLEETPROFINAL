import { expect, test, type Browser, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { login } from './helpers';
import { Tenant, User } from '../../server/models';
import { CallSession, TelephonyIdentity } from '../../server/telephony/models';

// TASK-04 concurrency coverage: two genuinely independent browser contexts
// (browser.newContext(), not two tabs sharing one session) acting as two
// different executives at the same time, plus a true-concurrency variant
// of the duplicate-webhook-delivery scenario TASK-02 only covered
// sequentially. Every assertion here is about what happens under a real
// race (Promise.all-ed requests), not about ordering guarantees.
test.describe.configure({ mode: 'serial' });

const PASSWORD = 'ConcurQa#2026!';

async function getCsrf(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  return (await res.json()).csrfToken;
}

let marker: string;
let tenantId: string;
let ownerUserId: string;
let execAUserId: string;
let execBUserId: string;

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for concurrency verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY = process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY || '44'.repeat(32);

  marker = `qaconc_${Date.now()}`;
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const tenant = await Tenant.create({ name: `${marker} Company`, businessName: `${marker} Company Pvt Ltd`, isActive: true });
  tenantId = String(tenant._id);

  ownerUserId = `${marker}_owner`;
  execAUserId = `${marker}_execa`; // lowercase only — see isolation-rbac-tenant.spec.ts comment
  execBUserId = `${marker}_execb`;

  await User.create({
    userId: ownerUserId, password: passwordHash, role: 'client', tenantId: tenant._id,
    isActive: true, hasCompletedOnboarding: true, permissions: [],
  });
  for (const execUserId of [execAUserId, execBUserId]) {
    await User.create({
      userId: execUserId, password: passwordHash, role: 'manager', tenantId: tenant._id,
      isActive: true, hasCompletedOnboarding: true,
      permissions: ['call.view_own', 'call.initiate', 'call.manage'],
    });
    await TelephonyIdentity.create({
      tenantId: tenant._id,
      userId: execUserId,
      providerKey: 'mock',
      registeredNumber: `+9199902${Math.floor(Math.random() * 100000)}`,
      virtualNumber: execUserId === execAUserId ? `${marker}_vnA` : `${marker}_vnB`,
      incomingEnabled: true,
      outgoingEnabled: true,
      createdBy: ownerUserId,
      updatedBy: ownerUserId,
    });
  }
});

test.afterAll(async () => {
  await mongoose.disconnect();
});

// browser.newContext() does NOT inherit playwright.config.ts's use.baseURL
// (only the auto-created `page`/`context` fixtures do) — every manually
// created context in this file needs it passed explicitly or relative
// goto()/request calls fail.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5050';

async function newLoggedInPage(browser: Browser, userId: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await login(page, userId, PASSWORD);
  return page;
}

test('Two executives creating calls at the exact same moment never cross-attribute or collide', async ({ browser }) => {
  const [pageA, pageB] = await Promise.all([
    newLoggedInPage(browser, execAUserId),
    newLoggedInPage(browser, execBUserId),
  ]);

  const [csrfA, csrfB] = await Promise.all([getCsrf(pageA), getCsrf(pageB)]);

  // Truly concurrent: both POSTs fired together, not awaited one after the
  // other, so any shared-state race (e.g. a naive in-memory counter, or a
  // save-without-atomic-guard) would show up as a lost/duplicated/
  // cross-attributed record.
  const [resA, resB] = await Promise.all([
    pageA.request.post('/api/telephony/calls', { headers: { 'X-CSRF-Token': csrfA }, data: { toNumber: '+919812500001' } }),
    pageB.request.post('/api/telephony/calls', { headers: { 'X-CSRF-Token': csrfB }, data: { toNumber: '+919812500002' } }),
  ]);
  const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

  expect(resA.status(), JSON.stringify(bodyA)).toBe(201);
  expect(resB.status(), JSON.stringify(bodyB)).toBe(201);
  // No lost write: both independent calls actually exist as distinct rows.
  expect(bodyA.id).not.toBe(bodyB.id);
  // No cross-attribution: each call belongs to the executive that made it,
  // never the other one racing alongside it.
  expect(bodyA.userId).toBe(execAUserId);
  expect(bodyB.userId).toBe(execBUserId);

  const [listA, listB] = await Promise.all([
    (await pageA.request.get('/api/telephony/calls')).json(),
    (await pageB.request.get('/api/telephony/calls')).json(),
  ]);
  // No data crossover: each executive's own-calls view contains only their
  // own concurrently-created call, never the other's.
  expect(listA.map((c: any) => c.id)).toContain(bodyA.id);
  expect(listA.map((c: any) => c.id)).not.toContain(bodyB.id);
  expect(listB.map((c: any) => c.id)).toContain(bodyB.id);
  expect(listB.map((c: any) => c.id)).not.toContain(bodyA.id);

  await pageA.context().close();
  await pageB.context().close();
});

test('Concurrent notes on the same call from two different sessions both land (no lost update)', async ({ browser }) => {
  // Only executives have a TelephonyIdentity (registered outbound number),
  // so initiateOutboundCall requires the actor to be an executive — the
  // owner/admin role can view and annotate any call in the tenant but
  // cannot itself be the "userId" that placed one. Executive A creates the
  // call; the owner is a legitimate second concurrent writer on it purely
  // via the tenant-wide client/admin bypass in getCallSessionForActor (no
  // reassignment needed to make this a genuine two-writer scenario).
  const execPage = await newLoggedInPage(browser, execAUserId);
  const execHeaders = { 'X-CSRF-Token': await getCsrf(execPage) };
  const createRes = await execPage.request.post('/api/telephony/calls', {
    headers: execHeaders, data: { toNumber: '+919812500003' },
  });
  const created = await createRes.json();
  expect(createRes.status(), JSON.stringify(created)).toBe(201);

  const ownerPage = await newLoggedInPage(browser, ownerUserId);
  const ownerHeaders = { 'X-CSRF-Token': await getCsrf(ownerPage) };

  const [ownerNoteRes, execNoteRes] = await Promise.all([
    ownerPage.request.patch(`/api/telephony/calls/${created.id}`, {
      headers: ownerHeaders, data: { note: 'Owner note added concurrently.' },
    }),
    execPage.request.patch(`/api/telephony/calls/${created.id}`, {
      headers: execHeaders, data: { note: 'Executive note added concurrently.' },
    }),
  ]);
  expect(ownerNoteRes.ok()).toBe(true);
  expect(execNoteRes.ok()).toBe(true);

  const final = await CallSession.findById(created.id);
  // Both concurrent writes must land — the underlying update uses an
  // atomic $push (server/storage-mongodb.ts addCallSessionNote), so a real
  // race here should never lose one note to the other.
  expect(final!.notes).toHaveLength(2);
  const texts = final!.notes.map((n) => n.text).sort();
  expect(texts).toEqual(['Executive note added concurrently.', 'Owner note added concurrently.']);

  await ownerPage.context().close();
  await execPage.context().close();
});

test('Duplicate inbound webhook events delivered at the exact same instant still resolve to one record', async ({ browser }) => {
  // Two unauthenticated request contexts hitting the webhook simultaneously
  // — this is the real race the sequential dedupe test (TASK-02's
  // telephony-isolation.spec.ts) can't exercise, since resolveInboundEvent()
  // does a check-then-act read before writing (server/telephony/services/
  // callService.ts resolveInboundEvent): both concurrent requests can see
  // "no existing record" before either has written one.
  const contextA = await browser.newContext({ baseURL: BASE_URL });
  const contextB = await browser.newContext({ baseURL: BASE_URL });
  const providerCallId = `${marker}_inbound_concurrent`;
  const payload = {
    providerCallId,
    direction: 'inbound' as const,
    fromNumber: '+919812577777',
    toNumber: `${marker}_vnA`,
    virtualNumber: `${marker}_vnA`,
    status: 'ringing',
    occurredAt: new Date().toISOString(),
  };

  const [resA, resB] = await Promise.all([
    contextA.request.post('/api/telephony/webhook', { data: payload }),
    contextB.request.post('/api/telephony/webhook', { data: payload }),
  ]);

  const matches = await CallSession.find({ tenantId, providerCallId });
  // If this fails with matches.length === 2, it is a genuine race-condition
  // bug in resolveInboundEvent()'s check-then-act pattern (not something
  // this test suite fixes — see the TASK-04 report's "Bugs found" section).
  expect(matches.length, `Expected exactly one CallSession for a truly concurrent duplicate delivery, found ${matches.length}. resA=${resA.status()} resB=${resB.status()}`).toBe(1);

  await contextA.close();
  await contextB.close();
});
