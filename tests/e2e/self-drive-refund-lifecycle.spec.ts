import { expect, test, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { login } from './helpers';
import { Tenant, User, OperationsAlert, Booking } from '../../server/models/index';
import { SelfDriveTrip } from '../../server/booking/self-drive/models';

// SELF-DRIVE OPS — deposit → handover → overdue+late charge → return →
// auto refund case → deductions → partial/full refund → close, plus the
// guard rails (Rule H/J) and backward compatibility for pre-refund-era
// trips. Real HTTP + real DB, isolated tenant per run (same rationale as
// live-operations.spec.ts).

// 60s: login-time popup acknowledgements + accumulated alerts can eat the
// default 30s (same lesson as the live-operations suite).
test.describe.configure({ mode: 'serial', timeout: 60_000 });

const RUN = Date.now();
let ownerUserId: string;
let tenantId: string;
const OWNER_PASSWORD = 'SdRefundQA-1!';

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI);
  const tenant = await Tenant.create({
    name: `SdRefundQA-${RUN}`, businessName: `SD Refund QA ${RUN}`,
    isActive: true, maxManagers: 5, subscriptionPlan: 'pro',
    limits: { vehicles: 500, drivers: 500, managers: 50 },
  });
  tenantId = String(tenant._id);
  ownerUserId = `sdrefundqa${RUN}`;
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
  // Occasionally the first fetch right after a fresh login round-trips as a
  // cached/empty body — retry briefly rather than failing the whole test.
  for (let i = 0; i < 3; i++) {
    const res = await page.request.get('/api/csrf-token', { headers: { 'Cache-Control': 'no-cache' } });
    const body = await res.json().catch(() => null);
    if (body?.csrfToken) return body.csrfToken;
    await page.waitForTimeout(500);
  }
  throw new Error('Could not obtain CSRF token after 3 attempts');
}

async function post(page: Page, token: string, url: string, data: any, expectStatus?: number) {
  const res = await page.request.post(url, { headers: { 'X-CSRF-Token': token }, data });
  const body = await res.json().catch(() => null);
  if (expectStatus !== undefined) {
    expect(res.status(), `POST ${url} -> ${JSON.stringify(body)}`).toBe(expectStatus);
  } else {
    expect([200, 201].includes(res.status()), `POST ${url} -> ${res.status()}: ${JSON.stringify(body)}`).toBe(true);
  }
  return body;
}

async function patch(page: Page, token: string, url: string, data: any, expectStatus?: number) {
  const res = await page.request.patch(url, { headers: { 'X-CSRF-Token': token }, data });
  const body = await res.json().catch(() => null);
  if (expectStatus !== undefined) expect(res.status(), `PATCH ${url} -> ${JSON.stringify(body)}`).toBe(expectStatus);
  else expect(res.ok(), `PATCH ${url} -> ${res.status()}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}

function parts(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
const minsFromNow = (m: number) => new Date(Date.now() + m * 60000);

let seq = 0;
async function mkSdBooking(page: Page, token: string, endMinsFromNow: number, extra: Record<string, any> = {}) {
  seq += 1;
  const start = parts(minsFromNow(-360));
  const ret = parts(minsFromNow(endMinsFromNow));
  const vehicle = await post(page, token, '/api/vehicles', { make: `SdOps${seq}`, vehicleModel: 'QA', licensePlate: `SD${RUN % 100000}${seq}`, type: 'economy' });
  const booking = await post(page, token, '/api/bookings', {
    customerName: `SD Refund Customer ${seq}`, customerPhone: `96${String(RUN).slice(-5)}${String(seq).padStart(3, '0')}`,
    pickupLocation: 'Office', bookingType: 'self_drive', vehicleId: String(vehicle._id || vehicle.id),
    pickupDate: start.date, pickupTime: start.time, returnDate: ret.date, returnTime: ret.time,
    totalAmount: 4500, ...extra,
  });
  const id = String(booking._id || booking.id);
  await post(page, token, `/api/bookings/${id}/status`, { status: 'ready_for_dispatch' });
  await post(page, token, `/api/bookings/${id}/status`, { status: 'trip_started' });
  return { id, code: booking.bookingId as string, base: `/api/bookings/${id}/self-drive` };
}

test('full lifecycle: deposit → handover checklist → late return → auto refund with late charge → deductions → partial + full refund → close', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  // Scheduled end 2h15m ago → grace 15m → 2h chargeable at ₹200/h = ₹400.
  const sd = await mkSdBooking(page, token, -135, { securityDepositAmount: 5000, securityDepositStatus: 'pending' });

  await patch(page, token, `${sd.base}/late-policy`, { graceMinutes: 15, rate: 200, unit: 'per_hour' });
  const afterDeposit = await post(page, token, `${sd.base}/deposit`, { amount: 5000, method: 'upi', reference: `UTR${RUN}` });
  expect(afterDeposit.stage).toBe('awaiting_handover');
  expect(afterDeposit.deposit.reference).toBe(`UTR${RUN}`);

  const afterHandover = await post(page, token, `${sd.base}/handover`, {
    odometerReading: 50000, fuelLevel: 75, condition: 'Clean, no scratches',
    documentsHandedOver: 'RC, insurance', accessoriesHandedOver: 'Stepney, jack',
    depositConfirmed: true, notes: 'QA handover',
  });
  expect(afterHandover.stage).toBe('on_trip');
  expect(afterHandover.handover.depositConfirmed).toBe(true);

  // Booking denormalized deposit + opening readings for the live card.
  const bookingDoc = await (await page.request.get(`/api/bookings/${sd.id}`)).json();
  expect(bookingDoc.securityDepositStatus).toBe('collected');
  expect(bookingDoc.startOdometer).toBe(50000);

  // Live card shows fuel/km out + a live late-charge estimate (overdue now).
  const view = await (await page.request.get('/api/operations/live-vehicles')).json();
  const card = view.cards.find((c: any) => c.id === sd.id);
  expect(card.selfDrive.fuelOut).toBe(75);
  expect(card.selfDrive.kmOut).toBe(50000);
  expect(card.selfDrive.lateChargeEstimate).toBeGreaterThanOrEqual(400);
  expect(card.runtimeStatus).toBe('OVERDUE');

  // Return: auto-opens refund with the ₹400 late deduction pre-seeded.
  const afterReturn = await post(page, token, `${sd.base}/return`, {
    odometerReading: 50300, fuelLevel: 50, challanFound: false, condition: 'OK', damageNoted: '',
  });
  expect(afterReturn.stage).toBe('refund_pending');
  expect(afterReturn.refund.status).toBe('pending');
  const lateDed = afterReturn.refund.deductions.find((d: any) => d.kind === 'late');
  expect(lateDed.amount).toBe(400);
  expect(afterReturn.refund.computation.refundable).toBe(4600);

  const bookingAfterReturn = await (await page.request.get(`/api/bookings/${sd.id}`)).json();
  expect(bookingAfterReturn.securityDepositStatus).toBe('refund_pending');

  // Deduction checklist (test 6 amounts): toll 300, parking 100, fuel 250 + late 400 = 1050.
  const afterDeds = await patch(page, token, `${sd.base}/refund/deductions`, {
    deductions: [
      { kind: 'late', amount: 400 },
      { kind: 'toll', amount: 300, remarks: 'FASTag pending' },
      { kind: 'parking', amount: 100 },
      { kind: 'fuel', amount: 250, remarks: 'Fuel Out 75% vs In 50%' },
    ],
  });
  expect(afterDeds.refund.computation.totalDeduction).toBe(1050);
  expect(afterDeds.refund.computation.refundable).toBe(3950);

  // Refund alert exists after a sweep; resolves once fully refunded.
  await post(page, token, '/api/operations/reminders/run', {});
  const alerts = await (await page.request.get('/api/operations/alerts?status=open')).json();
  expect(alerts.some((a: any) => a.kind === 'refund_pending' && String((a.bookingId as any)?._id ?? a.bookingId) === sd.id)).toBe(true);

  // Refund queue row.
  const queue = await (await page.request.get('/api/operations/self-drive/refunds?status=open')).json();
  const row = queue.rows.find((r: any) => r.bookingId === sd.id);
  expect(row.balance).toBe(3950);
  expect(row.slaLevel).toBe('normal');

  // Partial refund ₹2000 → partially_refunded; overpay guard.
  await post(page, token, `${sd.base}/refund/transactions`, { amount: 5000, mode: 'upi' }, 400);
  const partial = await post(page, token, `${sd.base}/refund/transactions`, { amount: 2000, mode: 'upi', reference: `RF${RUN}A` });
  expect(partial.refund.status).toBe('partially_refunded');
  expect(partial.refund.computation.balance).toBe(1950);

  // Full refund → refunded; close → closed; deposit synced.
  const full = await post(page, token, `${sd.base}/refund/transactions`, { amount: 1950, mode: 'cash' });
  expect(full.refund.status).toBe('refunded');
  expect(full.refund.computation.balance).toBe(0);
  const closed = await post(page, token, `${sd.base}/refund/close`, {});
  expect(closed.refund.status).toBe('closed');
  expect(closed.stage).toBe('settled');
  const bookingClosed = await (await page.request.get(`/api/bookings/${sd.id}`)).json();
  expect(bookingClosed.securityDepositStatus).toBe('refunded');

  // Sweep resolves the refund alert.
  await post(page, token, '/api/operations/reminders/run', {});
  const alertsAfter = await (await page.request.get('/api/operations/alerts?status=open')).json();
  expect(alertsAfter.some((a: any) => a.kind === 'refund_pending' && String((a.bookingId as any)?._id ?? a.bookingId) === sd.id)).toBe(false);

  // Customer 360 history reflects the whole story.
  const customerId = bookingClosed.customerId;
  const history = await (await page.request.get(`/api/customers/${customerId}/self-drive`)).json();
  const h = history.find((x: any) => x.id === sd.id);
  expect(h.refund.status).toBe('closed');
  expect(h.fuelOut).toBe(75);
  expect(h.fuelIn).toBe(50);
  expect(h.wasLate).toBe(true);
});

test('guard rails: reason required for waiver/changes and forfeit; owner close-with-balance needs reason; audit trail records overrides', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);
  const sd = await mkSdBooking(page, token, -60);

  await post(page, token, `${sd.base}/deposit`, { amount: 3000, method: 'cash' });
  await post(page, token, `${sd.base}/handover`, { odometerReading: 100, fuelLevel: 50 });
  const ret = await post(page, token, `${sd.base}/return`, { odometerReading: 200, fuelLevel: 50 });
  expect(ret.refund.status).toBe('pending');
  const auto = ret.refund.deductions.find((d: any) => d.kind === 'late');
  expect(auto).toBeTruthy(); // 30m grace default, 60m late → charged

  // Waiving the auto late charge without a reason → rejected.
  await patch(page, token, `${sd.base}/refund/deductions`, {
    deductions: [{ kind: 'late', amount: auto.amount, waived: true }],
  }, 400);
  // With a reason → accepted, audited, refundable = full deposit.
  const waived = await patch(page, token, `${sd.base}/refund/deductions`, {
    deductions: [{ kind: 'late', amount: auto.amount, waived: true }],
    reason: 'Customer informed delay in advance',
  });
  expect(waived.refund.computation.refundable).toBe(3000);
  expect(waived.refund.overrides.some((o: any) => o.field === 'deduction.late' && o.reason.includes('advance'))).toBe(true);

  // Close with full balance outstanding: owner may, but only WITH a reason.
  await post(page, token, `${sd.base}/refund/close`, {}, 400);
  // Forfeit without reason → rejected; with reason → closed as forfeited.
  await post(page, token, `${sd.base}/refund/forfeit`, {}, 400);
  const forfeited = await post(page, token, `${sd.base}/refund/forfeit`, { reason: 'Customer damaged vehicle and absconded' });
  expect(forfeited.refund.status).toBe('forfeited');
  const b = await (await page.request.get(`/api/bookings/${sd.id}`)).json();
  expect(b.securityDepositStatus).toBe('forfeited');
});

test('zero deposit: return opens no refund case; stage stays returned', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);
  const sd = await mkSdBooking(page, token, 120);
  await post(page, token, `${sd.base}/handover`, { odometerReading: 10, fuelLevel: 100 });
  const ret = await post(page, token, `${sd.base}/return`, { odometerReading: 20, fuelLevel: 100 });
  expect(ret.refund).toBeNull();
  expect(ret.stage).toBe('returned');
});

test('backward compatibility: pre-refund-era trip (no new fields) still reads fine and /refund/ensure opens the case', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);
  const sd = await mkSdBooking(page, token, -30);
  // Write a legacy-shaped trip document directly (as if created before this feature).
  await SelfDriveTrip.create({
    tenantId, bookingId: sd.id,
    deposit: { amount: 2000, method: 'cash', collectedAt: new Date(), collectedBy: 'legacy' },
    handover: { odometerReading: 1, fuelLevel: 50, conductedAt: new Date(Date.now() - 3600000), conductedBy: 'legacy' },
    returnRecord: { odometerReading: 2, fuelLevel: 40, conductedAt: new Date(), conductedBy: 'legacy' },
  });
  const trip = await (await page.request.get(sd.base)).json();
  expect(trip.stage).toBe('returned'); // legacy derivation untouched
  expect(trip.latePolicy.graceMinutes).toBe(30); // defaults applied at read time
  const ensured = await post(page, token, `${sd.base}/refund/ensure`, {});
  expect(ensured.refund.status).toBe('pending');
  expect(ensured.refund.computation.depositAmount).toBe(2000);
});

test('overdue re-arm: acknowledged overdue alert re-activates after the re-alert window with a bumped realertCount', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);
  const sd = await mkSdBooking(page, token, -120);
  await post(page, token, '/api/operations/reminders/run', {});
  const alerts = await (await page.request.get('/api/operations/alerts?status=open')).json();
  const overdue = alerts.find((a: any) => a.kind === 'overdue' && String((a.bookingId as any)?._id ?? a.bookingId) === sd.id);
  expect(overdue).toBeTruthy();
  await post(page, token, `/api/operations/alerts/${overdue._id}/acknowledge`, {});

  // Sweep immediately: stays acknowledged (inside the re-alert window).
  await post(page, token, '/api/operations/reminders/run', {});
  let fresh = await OperationsAlert.findById(overdue._id).lean() as any;
  expect(fresh.status).toBe('acknowledged');

  // Age the acknowledgement past the default 30-min window, sweep again →
  // active once more with realertCount bumped (popup re-pops client-side).
  await OperationsAlert.updateOne({ _id: overdue._id }, { $set: { acknowledgedAt: new Date(Date.now() - 31 * 60000) } });
  await post(page, token, '/api/operations/reminders/run', {});
  fresh = await OperationsAlert.findById(overdue._id).lean() as any;
  expect(fresh.status).toBe('active');
  expect(fresh.realertCount).toBe(1);

  // Cleanup: return the vehicle so later runs aren't polluted.
  await post(page, token, `${sd.base}/handover`, { odometerReading: 1, fuelLevel: 50 });
  await post(page, token, `${sd.base}/return`, { odometerReading: 2, fuelLevel: 50 });
  await post(page, token, `/api/bookings/${sd.id}/status`, { status: 'return_pending' });
  await post(page, token, `/api/bookings/${sd.id}/complete`, {});
});
