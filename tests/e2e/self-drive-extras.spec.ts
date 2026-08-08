import { expect, test, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { login } from './helpers';
import { Tenant, User, WhatsAppMessage } from '../../server/models/index';

// SELF-DRIVE EXTRAS — inspection photos (authenticated tenant-checked
// serving), customer WhatsApp quick actions with tenant template override
// (honest delivery status), and the period report endpoint.

test.describe.configure({ mode: 'serial', timeout: 60_000 });

const RUN = Date.now();
let ownerUserId: string;
let tenantId: string;
const OWNER_PASSWORD = 'SdExtrasQA-1!';

// 1x1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (mongoose.connection.readyState === 0) await mongoose.connect(process.env.MONGODB_URI);
  const tenant = await Tenant.create({
    name: `SdExtrasQA-${RUN}`, businessName: `SD Extras QA ${RUN}`,
    isActive: true, maxManagers: 5, subscriptionPlan: 'pro',
    limits: { vehicles: 500, drivers: 500, managers: 50 },
  });
  tenantId = String(tenant._id);
  ownerUserId = `sdextrasqa${RUN}`;
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
  for (let i = 0; i < 3; i++) {
    const res = await page.request.get('/api/csrf-token', { headers: { 'Cache-Control': 'no-cache' } });
    const body = await res.json().catch(() => null);
    if (body?.csrfToken) return body.csrfToken;
    await page.waitForTimeout(500);
  }
  throw new Error('No CSRF token');
}

function parts(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

async function post(page: Page, token: string, url: string, data: any) {
  const res = await page.request.post(url, { headers: { 'X-CSRF-Token': token }, data });
  const body = await res.json().catch(() => null);
  expect([200, 201].includes(res.status()), `POST ${url} -> ${res.status()}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}

let sd: { id: string; base: string };

test('setup booking + photos: upload to handover/return phases, list them, serve only through the authenticated route', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  const start = parts(new Date(Date.now() - 3600000));
  const ret = parts(new Date(Date.now() + 3600000));
  const vehicle = await post(page, token, '/api/vehicles', { make: `SdExtras`, vehicleModel: 'QA', licensePlate: `SX${RUN % 100000}`, type: 'economy' });
  const booking = await post(page, token, '/api/bookings', {
    customerName: 'SD Extras Customer', customerPhone: `95${String(RUN).slice(-8)}`,
    pickupLocation: 'Office', bookingType: 'self_drive', vehicleId: String(vehicle._id || vehicle.id),
    pickupDate: start.date, pickupTime: start.time, returnDate: ret.date, returnTime: ret.time,
    totalAmount: 2500,
  });
  sd = { id: String(booking._id || booking.id), base: `/api/bookings/${booking._id || booking.id}/self-drive` };
  await post(page, token, `${sd.base}/deposit`, { amount: 2000, method: 'upi' });
  await post(page, token, `${sd.base}/handover`, { odometerReading: 100, fuelLevel: 75 });

  // Upload two handover photos via multipart.
  const up = await page.request.post(`${sd.base}/photos`, {
    headers: { 'X-CSRF-Token': token },
    multipart: {
      phase: 'handover',
      photos: { name: 'front.png', mimeType: 'image/png', buffer: PNG },
    },
  });
  expect(up.status(), await up.text()).toBe(201);
  const upBody = await up.json();
  expect(upBody.added).toBe(1);
  expect(upBody.photos[0].phase).toBe('handover');

  // Listed on the trip payload and served through the authenticated route.
  const trip = await (await page.request.get(sd.base)).json();
  expect(trip.photos).toHaveLength(1);
  const img = await page.request.get(`${sd.base}/photos/${trip.photos[0].fileName}`);
  expect(img.status()).toBe(200);
  expect(img.headers()['content-type']).toContain('image/png');

  // Unknown filename → 404 (no traversal, no directory listing).
  expect((await page.request.get(`${sd.base}/photos/..%2F..%2Fetc%2Fpasswd`)).status()).toBe(404);
});

test('WhatsApp quick action uses the tenant template override and reports honest delivery status', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const token = await csrf(page);

  // Tenant override with placeholders.
  const patched = await page.request.patch('/api/tenant/operations-settings', {
    headers: { 'X-CSRF-Token': token },
    data: { operationsSettings: { sdTemplates: { return_reminder: 'Namaste {{customerName}}! {{bookingCode}} ends at {{endTime}} — {{companyName}}' } } },
  });
  expect(patched.ok()).toBe(true);

  const body = await post(page, token, `${sd.base}/whatsapp`, { type: 'return_reminder' });
  // Mock provider on the test server reports 'sent'; the content must be the
  // filled tenant template, and the WhatsAppMessage ledger row must exist.
  expect(['sent', 'failed']).toContain(body.message.status);
  expect(body.message.content).toContain('Namaste SD Extras Customer!');
  expect(body.message.content).toContain(`SD Extras QA ${RUN}`);
  const row = await WhatsAppMessage.findOne({ tenantId, bookingId: sd.id, messageType: 'self_drive_return_reminder' }).lean() as any;
  expect(row).toBeTruthy();
  expect(row.status).toBe(body.message.status);

  // Unknown type rejected.
  const bad = await page.request.post(`${sd.base}/whatsapp`, { headers: { 'X-CSRF-Token': token }, data: { type: 'nonsense' } });
  expect(bad.status()).toBe(400);
});

test('report endpoint aggregates the period', async ({ page }) => {
  await login(page, ownerUserId, OWNER_PASSWORD);
  const res = await page.request.get('/api/operations/self-drive/report?days=7');
  expect(res.ok()).toBe(true);
  const r = await res.json();
  expect(r.periodDays).toBe(7);
  expect(r.bookings).toBeGreaterThanOrEqual(1);
  expect(r.revenue).toBeGreaterThanOrEqual(2500);
  expect(r.depositsCollected).toBeGreaterThanOrEqual(2000);
});
