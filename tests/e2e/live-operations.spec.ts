import { expect, test, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { login } from './helpers';
import { Tenant, User } from '../../server/models/index';

// LIVE OPERATIONS — Vehicles on Booking + Booking End Reminder engine.
//
// Connected E2E over the real HTTP surface and real DB: self-drive and
// with-driver bookings become live cards, the reminder sweep fires the
// most imminent enabled stage exactly once (idempotent by dedupe key),
// acknowledge/snooze/contact persist server-side, extension moves the end
// time and supersedes stale time-anchored alerts, an availability conflict
// blocks extension with structured 409 data, an overdue self-drive vehicle
// is NEVER auto-freed by the clock, and payment collection through the
// canonical ledger clears the live balance and the payment-due alert.
//
// Reminder acceleration (spec §71): bookings are created with scheduled
// ends minutes away and the sweep is invoked via the idempotent manual
// trigger POST /api/operations/reminders/run — no waiting hours, no fake
// clocks in production code.
//
// Uses a dedicated fresh Tenant + owner User per run (same rationale as
// vehicle-safety-eligibility.spec.ts: single-session-per-user auth plus a
// shared physical MongoDB across worktrees makes the shared 'qaclient'
// fixture flaky under concurrency).

test.describe.configure({ mode: 'serial' });

const RUN = Date.now();
let ownerUserId: string;
const OWNER_PASSWORD = 'LiveOpsQA-1!';

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  const tenant = await Tenant.create({
    name: `LiveOpsQA-${RUN}`, businessName: `LiveOps QA ${RUN}`,
    isActive: true, maxManagers: 5, subscriptionPlan: 'pro',
    limits: { vehicles: 500, drivers: 500, managers: 50 },
  });
  ownerUserId = `liveopsqa${RUN}`;
  const hash = await bcrypt.hash(OWNER_PASSWORD, 12);
  await User.create({
    userId: ownerUserId, password: hash, role: 'client', tenantId: tenant._id,
    isActive: true, mustResetPassword: false, hasCompletedOnboarding: true,
  });
});

test.afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

async function csrf(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  return (await res.json()).csrfToken;
}

async function post(page: Page, token: string, url: string, data: any, okStatuses: number[] = [200, 201]) {
  const res = await page.request.post(url, { headers: { 'X-CSRF-Token': token }, data });
  const body = await res.json().catch(() => null);
  if (!okStatuses.includes(res.status())) {
    throw new Error(`POST ${url} -> ${res.status()}: ${JSON.stringify(body)}`);
  }
  return { status: res.status(), body };
}

async function getJson(page: Page, url: string) {
  const res = await page.request.get(url);
  expect(res.ok(), `GET ${url} -> ${res.status()}`).toBe(true);
  return res.json();
}

// Local date/time parts for a Date — matches how the booking form submits
// pickup/return (date string + separate HH:MM string, tenant-local).
function parts(d: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const minsFromNow = (m: number) => new Date(Date.now() + m * 60000);

let seq = 0;
async function mkVehicle(page: Page, token: string): Promise<string> {
  seq += 1;
  const { body } = await post(page, token, '/api/vehicles', {
    make: `LiveOpsCar${seq}`, vehicleModel: `M${seq}`, licensePlate: `LO${RUN % 100000}${seq}`,
    type: 'economy',
  });
  const id = body?._id || body?.id;
  expect(id, `vehicle create response: ${JSON.stringify(body)}`).toBeTruthy();
  return String(id);
}

async function mkBooking(page: Page, token: string, overrides: Record<string, any>) {
  seq += 1;
  const start = parts(minsFromNow(-180));
  const { body } = await post(page, token, '/api/bookings', {
    customerName: `LiveOps Customer ${seq}`,
    customerPhone: `98${String(RUN).slice(-5)}${String(seq).padStart(3, '0')}`,
    pickupLocation: 'Office',
    pickupDate: start.date, pickupTime: start.time,
    totalAmount: 2200,
    ...overrides,
  });
  const id = body?._id || body?.id;
  expect(id, `booking create response: ${JSON.stringify(body)}`).toBeTruthy();
  return { id: String(id), code: body.bookingId as string };
}

async function toStatus(page: Page, token: string, id: string, status: string) {
  await post(page, token, `/api/bookings/${id}/status`, { status });
}

async function startTrip(page: Page, token: string, id: string) {
  await toStatus(page, token, id, 'ready_for_dispatch');
  await toStatus(page, token, id, 'trip_started');
}

const sweep = (page: Page, token: string) => post(page, token, '/api/operations/reminders/run', {});
const liveView = (page: Page) => getJson(page, '/api/operations/live-vehicles');
const openAlerts = (page: Page) => getJson(page, '/api/operations/alerts?status=open');
const resolvedAlerts = (page: Page) => getJson(page, '/api/operations/alerts?status=resolved');

const cardOf = (view: any, id: string) => view.cards.find((c: any) => c.id === id);
const alertsFor = (alerts: any[], id: string, kind?: string) =>
  alerts.filter((a: any) => String((a.bookingId as any)?._id ?? a.bookingId) === id && (!kind || a.kind === kind));

test('Self Drive: live card with deposit, T-30 reminder fires once, acknowledge persists, extension resweeps', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  const vehicleId = await mkVehicle(page, token);
  const ret = parts(minsFromNow(25));
  const sd = await mkBooking(page, token, {
    bookingType: 'self_drive', vehicleId,
    returnDate: ret.date, returnTime: ret.time,
    dropoffLocation: 'Indore Airport',
    totalAmount: 2200,
    securityDepositAmount: 5000, securityDepositStatus: 'collected', startFuelLevel: '82%',
  });
  await startTrip(page, token, sd.id);
  await sweep(page, token);

  // Live view: canonical booking summarized, deposit strictly separate.
  const view = await liveView(page);
  const card = cardOf(view, sd.id);
  expect(card, 'self-drive booking must appear in Vehicles on Booking').toBeTruthy();
  expect(card.serviceMode).toBe('self_drive');
  expect(card.runtimeStatus).toBe('ENDING_SOON');
  expect(card.securityDepositAmount).toBe(5000);
  expect(card.balance).toBe(2200);
  expect(card.returnLocation).toBe('Indore Airport');
  expect(view.summary.selfDrive).toBeGreaterThanOrEqual(1);

  // T-30 stage fired (25 min remaining -> most imminent enabled stage).
  let alerts = await openAlerts(page);
  const ending = alertsFor(alerts, sd.id, 'ending_soon');
  expect(ending).toHaveLength(1);
  expect(ending[0].stageKey).toBe('t-30');
  expect(['urgent', 'attention']).toContain(ending[0].priority);

  // Idempotency: a retried sweep never duplicates the same reminder.
  await sweep(page, token);
  alerts = await openAlerts(page);
  expect(alertsFor(alerts, sd.id, 'ending_soon')).toHaveLength(1);

  // Acknowledge persists server-side with actor attribution.
  const ackRes = await post(page, token, `/api/operations/alerts/${ending[0]._id}/acknowledge`, {});
  expect(ackRes.body.status).toBe('acknowledged');
  expect(ackRes.body.acknowledgedBy?.userId).toBe(ownerUserId);

  // Contact attempt is recorded and attributed.
  const contactRes = await post(page, token, `/api/operations/alerts/${ending[0]._id}/contact`, { action: 'called_customer', note: 'Will return on time' });
  expect(contactRes.body.contactLog.some((c: any) => c.action === 'called_customer' && c.userId === ownerUserId)).toBe(true);

  // Extension: canonical /extend revalidates and moves the end; the stale
  // time-anchored alert is superseded on resweep, and the card leaves the
  // ending-soon state.
  const newEnd = parts(minsFromNow(25 + 180));
  await post(page, token, `/api/bookings/${sd.id}/extend`, {
    newReturnDate: newEnd.date, newReturnTime: newEnd.time,
    reason: 'QA extension +3h', charges: { additionalDaysCharge: 600 },
  });
  await sweep(page, token);
  const after = cardOf(await liveView(page), sd.id);
  expect(after.runtimeStatus).toBe('RUNNING');
  expect(after.extensionCount).toBe(1);
  expect(after.totalAmount).toBe(2800); // 2200 + 600 through canonical pricing
  alerts = await openAlerts(page);
  expect(alertsFor(alerts, sd.id, 'ending_soon')).toHaveLength(0);
  const superseded = alertsFor(await resolvedAlerts(page), sd.id, 'ending_soon');
  expect(superseded.some((a: any) => a.resolvedReason === 'superseded')).toBe(true);
});

test('Self Drive overdue: vehicle is never auto-freed, critical alert cannot be snoozed, return workflow releases it', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  const vehicleId = await mkVehicle(page, token);
  const ret = parts(minsFromNow(-120)); // 2h past scheduled end (grace 15m)
  const sd = await mkBooking(page, token, {
    bookingType: 'self_drive', vehicleId,
    returnDate: ret.date, returnTime: ret.time,
  });
  await startTrip(page, token, sd.id);
  await sweep(page, token);

  const card = cardOf(await liveView(page), sd.id);
  expect(card, 'overdue self-drive booking must REMAIN in the live view').toBeTruthy();
  expect(card.runtimeStatus).toBe('OVERDUE');

  const overdue = alertsFor(await openAlerts(page), sd.id, 'overdue');
  expect(overdue).toHaveLength(1);
  expect(overdue[0].priority).toBe('critical');

  // Critical overdue stays visible — snooze is rejected.
  const snooze = await page.request.post(`/api/operations/alerts/${overdue[0]._id}/snooze`, {
    headers: { 'X-CSRF-Token': token }, data: { minutes: 30 },
  });
  expect(snooze.status()).toBe(400);

  // Retried sweep: still exactly one overdue alert.
  await sweep(page, token);
  expect(alertsFor(await openAlerts(page), sd.id, 'overdue')).toHaveLength(1);

  // Only the real return workflow releases the vehicle.
  await toStatus(page, token, sd.id, 'return_pending');
  await post(page, token, `/api/bookings/${sd.id}/complete`, {});
  await sweep(page, token);
  expect(cardOf(await liveView(page), sd.id)).toBeFalsy();
  const resolved = alertsFor(await resolvedAlerts(page), sd.id, 'overdue');
  expect(resolved.some((a: any) => a.resolvedReason === 'completed')).toBe(true);
});

test('With Driver: driver + fare + balance on card, payment-due alert clears through the canonical ledger, completion exits the view', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  const vehicleId = await mkVehicle(page, token);
  const { body: driver } = await post(page, token, '/api/drivers', {
    name: `LiveOps Driver ${RUN}`, phone: `97${String(RUN).slice(-8)}`,
  });
  const driverId = String(driver._id || driver.id);

  const ret = parts(minsFromNow(40));
  const wd = await mkBooking(page, token, {
    bookingType: 'round_trip', vehicleId, driverId,
    returnDate: ret.date, returnTime: ret.time,
    dropoffLocation: 'Ujjain',
    totalAmount: 3500,
  });
  await startTrip(page, token, wd.id);
  await sweep(page, token);

  const card = cardOf(await liveView(page), wd.id);
  expect(card).toBeTruthy();
  expect(card.serviceMode).toBe('with_driver');
  expect(card.driverPending).toBe(false);
  expect(card.driver?.name).toContain('LiveOps Driver');
  expect(card.balance).toBe(3500);
  expect(card.securityDepositAmount).toBeNull(); // deposit is a self-drive concept

  // 40 min remaining -> most imminent enabled with-driver stage is T-60,
  // and an unpaid balance near trip end raises PAYMENT DUE.
  const alerts = await openAlerts(page);
  const ending = alertsFor(alerts, wd.id, 'ending_soon');
  expect(ending).toHaveLength(1);
  expect(ending[0].stageKey).toBe('t-60');
  expect(alertsFor(alerts, wd.id, 'payment_due')).toHaveLength(1);

  // Collect through the ONE canonical payment ledger — live balance and the
  // payment-due alert both clear from that single record.
  await post(page, token, `/api/bookings/${wd.id}/payments`, {
    amount: 3500, paymentType: 'final_payment', paymentMode: 'upi',
    idempotencyKey: `liveops-e2e-${wd.id}`,
  });
  await sweep(page, token);
  const paid = cardOf(await liveView(page), wd.id);
  expect(paid.received).toBe(3500);
  expect(paid.balance).toBe(0);
  expect(alertsFor(await openAlerts(page), wd.id, 'payment_due')).toHaveLength(0);
  const resolvedPay = alertsFor(await resolvedAlerts(page), wd.id, 'payment_due');
  expect(resolvedPay.some((a: any) => a.resolvedReason === 'paid')).toBe(true);

  await post(page, token, `/api/bookings/${wd.id}/complete`, {});
  expect(cardOf(await liveView(page), wd.id)).toBeFalsy();
});

test('Extension conflict: a future booking on the same vehicle blocks the extension with structured 409 and no silent overwrite', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  const vehicleId = await mkVehicle(page, token);
  const retA = parts(minsFromNow(60));
  const a = await mkBooking(page, token, {
    bookingType: 'self_drive', vehicleId,
    returnDate: retA.date, returnTime: retA.time,
  });
  await startTrip(page, token, a.id);

  const startB = parts(minsFromNow(120));
  const endB = parts(minsFromNow(300));
  const b = await mkBooking(page, token, {
    bookingType: 'self_drive', vehicleId,
    pickupDate: startB.date, pickupTime: startB.time,
    returnDate: endB.date, returnTime: endB.time,
  });

  const conflictEnd = parts(minsFromNow(240)); // extends A across B's start
  const res = await page.request.post(`/api/bookings/${a.id}/extend`, {
    headers: { 'X-CSRF-Token': token },
    data: { newReturnDate: conflictEnd.date, newReturnTime: conflictEnd.time, charges: {} },
  });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.code).toBe('AVAILABILITY_CONFLICT');
  expect((body.conflicts?.vehicle || []).some((c: any) => c.id === b.id || c.bookingId === b.code)).toBe(true);

  // The current end was NOT silently overwritten and the next booking is intact.
  const after = cardOf(await liveView(page), a.id);
  expect(Math.abs(new Date(after.endAt).getTime() - minsFromNow(60).getTime())).toBeLessThan(5 * 60000);
  const bDoc = await getJson(page, `/api/bookings/${b.id}`);
  expect(['confirmed', 'vehicle_assigned']).toContain(bDoc.status);
});

test('UI: Vehicles on Booking page, dashboard summary, alert strip and controlled popup acknowledge', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  const vehicleId = await mkVehicle(page, token);
  const ret = parts(minsFromNow(20));
  const sd = await mkBooking(page, token, {
    bookingType: 'self_drive', vehicleId,
    returnDate: ret.date, returnTime: ret.time,
    securityDepositAmount: 3000, securityDepositStatus: 'collected',
  });
  await startTrip(page, token, sd.id);
  await sweep(page, token);

  // Dashboard: compact Live Operations summary + persistent alert strip.
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-live-operations')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('operations-alert-strip')).toBeVisible({ timeout: 10000 });

  // Controlled popup for the new urgent alert — acknowledge from it. Loop:
  // it shows one alert at a time and re-opens for the next unseen one, and
  // its overlay would otherwise intercept the strip click below.
  for (let i = 0; i < 5; i++) {
    const popup = page.getByTestId('operations-alert-popup');
    if (!(await popup.isVisible({ timeout: 3000 }).catch(() => false))) break;
    await page.getByTestId('popup-acknowledge').click();
    await popup.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }

  // Strip [View] lands on the Vehicles on Booking control screen.
  await page.getByTestId('alert-strip-view').click();
  await expect(page.getByTestId('live-operations-page')).toBeVisible({ timeout: 10000 });
  const card = page.getByTestId(`live-card-${sd.code}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Self Drive');
  await expect(card).toContainText('Deposit');
  await expect(card).toContainText('3,000');

  // Tab filtering: the card sits in Ending Soon; the With Driver tab hides it.
  await page.getByTestId('ops-tab-ending_soon').click();
  await expect(page.getByTestId(`live-card-${sd.code}`)).toBeVisible();
  await page.getByTestId('ops-tab-with_driver').click();
  await expect(page.getByTestId(`live-card-${sd.code}`)).not.toBeVisible();

  // Cleanup so later suites/preview don't inherit a permanent live card.
  await toStatus(page, token, sd.id, 'return_pending');
  await post(page, token, `/api/bookings/${sd.id}/complete`, {});
});
