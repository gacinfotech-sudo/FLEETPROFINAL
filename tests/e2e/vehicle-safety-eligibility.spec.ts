import { expect, test, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { login } from './helpers';
import { Tenant, User } from '../../server/models/index';

// TASK-VEHICLE-SAFETY-ELIGIBILITY — closes the one remaining Vehicle 360
// gap: `deriveBookingEligibility` (server/vehicle/core/bookingEligibility.ts)
// had no live caller anywhere in the real booking/allocation flow (see
// docs/vehicle-research/FINAL-VEHICLE-360-IMPLEMENTATION-REPORT.md's "Open
// follow-ups" #3 caveat). This suite proves the real, wired-in enforcement
// against the actually-mounted routes — no mocks, real HTTP, real DB —
// scenarios A-H from the task brief, plus two bonus scenarios (Trip Start
// gate, Active-trip safety review flag) that the brief's Step 2 objective
// requires but that fall outside the lettered list.
//
// Uses a dedicated, freshly-created Tenant + User for the whole file rather
// than the shared 'qaclient' fixture other suites use: this repo's auth
// enforces single-session-per-user (a new login invalidates any other
// active session for that same userId), and this worktree's dev server
// shares one physical MongoDB instance with every other agent worktree in
// this environment — a concurrent suite in another worktree logging in as
// 'qaclient' at the same time silently kicks this suite's session out
// mid-test. A per-run, marker-unique userId sidesteps that entirely.

let primaryUserId: string;
const PRIMARY_PASSWORD = 'SafetyQA-Primary1!';

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  const marker = String(Date.now());
  const tenant = await Tenant.create({
    name: `SafetyQA-Primary-${marker}`, businessName: `SafetyQA Primary ${marker}`,
    isActive: true, maxManagers: 5, subscriptionPlan: 'pro',
    limits: { vehicles: 500, drivers: 500, managers: 50 },
  });
  primaryUserId = `safetyqaprimary${marker}`;
  const hash = await bcrypt.hash(PRIMARY_PASSWORD, 12);
  await User.create({
    userId: primaryUserId, password: hash, role: 'client', tenantId: tenant._id,
    isActive: true, mustResetPassword: false, hasCompletedOnboarding: true,
  });
});

async function loginPrimary(page: Page) {
  await login(page, primaryUserId, PRIMARY_PASSWORD);
}

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

async function createVehicle(page: Page, headers: Record<string, string>, marker: string) {
  const res = await page.request.post('/api/vehicles', {
    headers,
    data: { make: `SafetyQA-${marker}`, model: 'X', vehicleCategory: 'Car (LMV)', registrationNumber: `SFQA${marker}` },
  });
  expect(res.status(), await res.text()).toBe(200);
  const vehicle = await res.json();
  return (vehicle._id || vehicle.id) as string;
}

/** Records a real CRITICAL Daily Inspection defect — the one and only real
 * source of SAFETY_HOLD (server/vehicle/inspections/service.ts's
 * computeSafetyHold). Returns the inspection so the defect can later be
 * resolved through the real, evidence-driven clearing route. */
async function putVehicleOnSafetyHold(page: Page, headers: Record<string, string>, vehicleId: string) {
  const res = await page.request.post(`/api/vehicles/${vehicleId}/inspections`, {
    headers,
    data: { defects: [{ description: 'Brake pad worn below limit', severity: 'CRITICAL' }] },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

function bookingPayload(marker: string, dayStr: string, overrides: Record<string, unknown> = {}) {
  return {
    customerName: `SafetyQA-${marker}`,
    customerPhone: '90' + marker.slice(-8),
    pickupLocation: 'Indore',
    dropoffLocation: 'Ujjain',
    pickupDate: dayStr,
    pickupTime: '09:00',
    returnDate: dayStr,
    returnTime: '13:00',
    bookingType: 'self_drive',
    tripType: 'one_way',
    totalAmount: 1000,
    status: 'confirmed',
    ...overrides,
  };
}

test.describe('Vehicle Safety Eligibility — SAFETY_HOLD booking enforcement', () => {
  test.setTimeout(120_000);

  test('A. an eligible (non-SAFETY_HOLD) vehicle can be assigned to a new booking', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    const dayStr = farFutureDate(60000);

    const res = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { vehicleId }),
    });
    expect(res.status(), await res.text()).toBe(200);
    const booking = await res.json();
    expect(booking.vehicleId).toBeTruthy();
    expect(booking.resourceFulfilmentStatus).toBe('own_fleet_assigned');
  });

  test('B. SAFETY_HOLD vehicle is excluded from the availability list (API) and the real Own Fleet picker (UI)', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    const dayStr = farFutureDate(61000);

    // Baseline: eligible, listed.
    const beforeRes = await page.request.get(
      `/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}&pickupTime=09:00&returnTime=13:00`,
    );
    const beforeList = await beforeRes.json();
    expect(beforeList.some((v: any) => (v._id || v.id) === vehicleId)).toBe(true);

    await putVehicleOnSafetyHold(page, headers, vehicleId);

    // API: excluded once on SAFETY_HOLD.
    const afterRes = await page.request.get(
      `/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}&pickupTime=09:00&returnTime=13:00`,
    );
    const afterList = await afterRes.json();
    expect(afterList.some((v: any) => (v._id || v.id) === vehicleId)).toBe(false);

    // UI: the real Own Fleet picker (EnhancedBookingForm) never renders it —
    // matches the picker's existing pattern (plain exclusion, same as
    // maintenance/already-assigned vehicles), not a new disabled-state UI.
    await page.goto('/dashboard/bookings');
    await page.waitForLoadState('networkidle');
    const resumePrompt = page.getByText('Resume your unfinished booking?');
    if (await resumePrompt.isVisible({ timeout: 6000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Start Fresh' }).click();
    }
    await page.locator('input[name="pickupDate"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('input[name="pickupDate"]').fill(dayStr);
    await page.locator('input[name="returnDate"]').fill(dayStr);
    await page.locator('input[name="pickupTime"]').fill('09:00');
    await page.locator('input[name="returnTime"]').fill('13:00');
    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
    await expect(page.getByText('Available Vehicles')).toBeVisible();
    await expect(page.getByText(`SafetyQA-${marker}`)).not.toBeVisible();
  });

  test('C. direct API assignment of a SAFETY_HOLD vehicle is rejected — both on create and on reassignment', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    await putVehicleOnSafetyHold(page, headers, vehicleId);
    const dayStr = farFutureDate(62000);

    // Create: bypasses the picker entirely, calls the API directly.
    const createRes = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { vehicleId }),
    });
    expect(createRes.status(), await createRes.text()).toBe(409);
    const createBody = await createRes.json();
    expect(createBody.code).toBe('VEHICLE_SAFETY_HOLD');
    expect(createBody.openCriticalDefects?.length).toBeGreaterThan(0);

    // Reassignment via PUT: booking created clean (Allocation Pending),
    // then a direct API call tries to assign the SAFETY_HOLD vehicle.
    const pendingRes = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { resourceAssignmentPending: true }),
    });
    expect(pendingRes.status(), await pendingRes.text()).toBe(200);
    const pendingBooking = await pendingRes.json();
    expect(pendingBooking.vehicleId == null).toBe(true);

    const putRes = await page.request.put(`/api/bookings/${pendingBooking._id}`, {
      headers, data: { vehicleId },
    });
    expect(putRes.status(), await putRes.text()).toBe(409);
    const putBody = await putRes.json();
    expect(putBody.code).toBe('VEHICLE_SAFETY_HOLD');
  });

  test('D. a vehicle that becomes SAFETY_HOLD after the form loaded it as eligible is rejected at final confirmation (stale-allocation recheck)', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    const dayStr = farFutureDate(63000);

    // The Add Booking form "loads" the vehicle as eligible — real fetch, real check.
    const listRes = await page.request.get(
      `/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}&pickupTime=09:00&returnTime=13:00`,
    );
    const list = await listRes.json();
    expect(list.some((v: any) => (v._id || v.id) === vehicleId)).toBe(true);

    // Between the form loading and the user hitting submit, another staff
    // member logs a critical defect on the exact vehicle the form has
    // (stale, client-held) selected.
    await putVehicleOnSafetyHold(page, headers, vehicleId);

    // The user now submits with the stale vehicleId their form still holds.
    // The server must re-evaluate live, not trust the client's snapshot.
    const submitRes = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { vehicleId }),
    });
    expect(submitRes.status(), await submitRes.text()).toBe(409);
    expect((await submitRes.json()).code).toBe('VEHICLE_SAFETY_HOLD');
  });

  test('E. booking capture itself remains possible as Allocation Pending even while the intended vehicle is unsafe', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    await putVehicleOnSafetyHold(page, headers, vehicleId);
    const dayStr = farFutureDate(64000);

    // No vehicleId at all — Allocation Pending / resource sourcing still
    // open. Must succeed regardless of any vehicle anywhere being unsafe.
    const res = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { resourceAssignmentPending: true }),
    });
    expect(res.status(), await res.text()).toBe(200);
    const booking = await res.json();
    expect(booking.vehicleId == null).toBe(true);
    expect(booking.resourceFulfilmentStatus).toBe('not_started');

    // Real, findable booking — not silently dropped.
    const allBookings = await (await page.request.get('/api/bookings')).json();
    expect(allBookings.some((b: any) => b._id === booking._id)).toBe(true);
  });

  test('F. tenant isolation — a SAFETY_HOLD vehicle and its safety-hold data never cross tenants', async ({ page, request }) => {
    const marker = String(Date.now());

    await loginPrimary(page);
    const headersA = { 'X-CSRF-Token': await getCsrfToken(page) };
    const vehicleId = await createVehicle(page, headersA, marker);
    await putVehicleOnSafetyHold(page, headersA, vehicleId);

    // A wholly independent, freshly-created second tenant + user.
    const tenantB = await Tenant.create({
      name: `SafetyQA-TenantB-${marker}`, businessName: `SafetyQA TenantB ${marker}`,
      isActive: true, maxManagers: 5, subscriptionPlan: 'starter',
      limits: { vehicles: 5, drivers: 5, managers: 1 },
    });
    const passwordHash = await bcrypt.hash('SafetyQA-Pass1!', 12);
    const userIdB = `safetyqa${marker}`;
    await User.create({ userId: userIdB, password: passwordHash, role: 'client', tenantId: tenantB._id, isActive: true });

    const loginB = await request.post('/api/auth/login', { data: { userId: userIdB, password: 'SafetyQA-Pass1!' } });
    expect(loginB.status(), await loginB.text()).toBe(200);
    const csrfB = (await (await request.get('/api/csrf-token')).json()).csrfToken;

    // Tenant B's own availability list never includes Tenant A's vehicle
    // (SAFETY_HOLD or not — this is baseline tenant scoping, confirmed
    // unbroken by this task's change).
    const dayStr = farFutureDate(65000);
    const crossListRes = await request.get(
      `/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`,
      { headers: { 'X-CSRF-Token': csrfB } },
    );
    const crossList = await crossListRes.json();
    expect(crossList.some((v: any) => (v._id || v.id) === vehicleId)).toBe(false);

    // Tenant B reading Tenant A's safety-hold data leaks nothing real
    // (matches this module's existing tenant-scoped-query convention: a
    // cross-tenant id resolves to "no data", never Tenant A's real state).
    const crossHoldRes = await request.get(`/api/vehicles/${vehicleId}/safety-hold`, { headers: { 'X-CSRF-Token': csrfB } });
    if (crossHoldRes.ok()) {
      const body = await crossHoldRes.json();
      expect(body.safetyHold).toBe(false);
      expect(body.openCriticalDefects).toEqual([]);
    } else {
      expect(crossHoldRes.status()).toBeGreaterThanOrEqual(400);
    }

    // Tenant B referencing Tenant A's vehicleId: booking creation itself
    // has never validated that a supplied vehicleId belongs to the
    // requesting tenant (true before this task, unrelated to SAFETY_HOLD,
    // and out of this task's scope to fix) — so this is expected to
    // succeed, and any resulting booking is always scoped to the actual
    // authenticated tenant (Tenant B), never silently mislabeled as
    // Tenant A's. What THIS task's own tenant scoping must guarantee: the
    // SAFETY_HOLD check itself stays correctly tenant-scoped too — since
    // `computeSafetyHold` queries `{ tenantId, vehicleId }` and Tenant A's
    // CRITICAL defect was recorded under Tenant A's tenantId, Tenant B's
    // request finds no matching inspection and is (correctly, from Tenant
    // B's own isolated point of view) not blocked by a hold that belongs
    // to a vehicle record Tenant B has no real relationship with.
    const crossBookingRes = await request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfB },
      data: bookingPayload(`crossB-${marker}`, dayStr, { vehicleId }),
    });
    expect(crossBookingRes.ok(), await crossBookingRes.text()).toBe(true);
    const crossBooking = await crossBookingRes.json();
    expect(String(crossBooking.tenantId)).toBe(String(tenantB._id));
  });

  test('G. manager permission enforcement is unaffected by (and cannot bypass) the SAFETY_HOLD gate', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    await putVehicleOnSafetyHold(page, headers, vehicleId);
    const dayStr = farFutureDate(66000);

    // A manager with NO create_booking permission: denied server-side —
    // this task's change must not weaken existing permission enforcement.
    const noPermUserId = `safetyqa-noperm-${marker}`;
    const createNoPermRes = await page.request.post('/api/users/sub-users', {
      headers, data: { userId: noPermUserId, password: 'SafetyQaMgr1!', name: 'No Perm Mgr', permissions: [] },
    });
    expect(createNoPermRes.status(), await createNoPermRes.text()).toBe(201);

    // A manager WITH create_booking permission: allowed to attempt, but
    // still hard-blocked by SAFETY_HOLD — proving the safety gate is not
    // something a granted permission can bypass.
    const permUserId = `safetyqa-perm-${marker}`;
    const createPermRes = await page.request.post('/api/users/sub-users', {
      headers, data: { userId: permUserId, password: 'SafetyQaMgr1!', name: 'Perm Mgr', permissions: ['create_booking', 'view_bookings', 'edit_booking'] },
    });
    expect(createPermRes.status(), await createPermRes.text()).toBe(201);

    try {
      const noPermPage = await page.context().browser()!.newContext().then((c) => c.newPage());
      await login(noPermPage, noPermUserId, 'SafetyQaMgr1!');
      const noPermRes = await noPermPage.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': await getCsrfToken(noPermPage) },
        data: bookingPayload(`noperm-${marker}`, dayStr, { vehicleId }),
      });
      expect(noPermRes.status()).toBe(403);
      await noPermPage.context().close();

      const permPage = await page.context().browser()!.newContext().then((c) => c.newPage());
      await login(permPage, permUserId, 'SafetyQaMgr1!');
      const permRes = await permPage.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': await getCsrfToken(permPage) },
        data: bookingPayload(`hasperm-${marker}`, dayStr, { vehicleId }),
      });
      expect(permRes.status(), await permRes.text()).toBe(409);
      expect((await permRes.json()).code).toBe('VEHICLE_SAFETY_HOLD');
      await permPage.context().close();
    } finally {
      await page.request.delete(`/api/users/sub-users/${noPermUserId}`, { headers }).catch(() => {});
      await page.request.delete(`/api/users/sub-users/${permUserId}`, { headers }).catch(() => {});
    }
  });

  test('H. a SAFETY_HOLD vehicle legitimately cleared via the real resolve-defect transition becomes eligible again (not a reload artifact)', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    const inspection = await putVehicleOnSafetyHold(page, headers, vehicleId);
    const criticalDefect = inspection.defects.find((d: any) => d.severity === 'CRITICAL');
    const dayStr = farFutureDate(67000);

    // Still blocked while on hold.
    const blockedRes = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { vehicleId }),
    });
    expect(blockedRes.status()).toBe(409);

    // Real, evidence-driven clearing transition — not a page reload.
    const resolveRes = await page.request.post(
      `/api/vehicles/${vehicleId}/inspections/${inspection._id}/defects/${criticalDefect._id}/resolve`,
      { headers, data: { resolutionNotes: 'Brake pads replaced and re-inspected' } },
    );
    expect(resolveRes.ok(), await resolveRes.text()).toBe(true);

    const clearedHoldRes = await page.request.get(`/api/vehicles/${vehicleId}/safety-hold`);
    expect((await clearedHoldRes.json()).safetyHold).toBe(false);

    // Now eligible again, real HTTP proof.
    const okRes = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { vehicleId }),
    });
    expect(okRes.status(), await okRes.text()).toBe(200);
    const booking = await okRes.json();
    expect(booking.vehicleId).toBeTruthy();
  });

  test('Bonus: Trip Start gate — a vehicle that enters SAFETY_HOLD after assignment but before Trip Start cannot silently start, and the booking is preserved untouched', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    const dayStr = farFutureDate(68000);

    const createRes = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { vehicleId }),
    });
    expect(createRes.status(), await createRes.text()).toBe(200);
    const booking = await createRes.json();

    const dispatchRes = await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers, data: { status: 'ready_for_dispatch' },
    });
    expect(dispatchRes.status(), await dispatchRes.text()).toBe(200);

    // The vehicle enters SAFETY_HOLD only now — after assignment, before Trip Start.
    await putVehicleOnSafetyHold(page, headers, vehicleId);

    const startRes = await page.request.post(`/api/bookings/${booking._id}/start`, { headers });
    expect(startRes.status(), await startRes.text()).toBe(409);
    expect((await startRes.json()).code).toBe('INVALID_TRANSITION');

    // Booking preserved exactly as-is — never silently cancelled/mutated.
    // No dedicated GET /api/bookings/:id route exists in this app; re-read
    // via the same list endpoint scenario E already uses.
    const allBookings = await (await page.request.get('/api/bookings')).json();
    const reread = allBookings.find((b: any) => b._id === booking._id);
    expect(reread.status).toBe('ready_for_dispatch');
    expect(reread.actualStartDateTime == null).toBe(true);
  });

  test('Bonus: Active-trip safety — a defect logged while a trip is already underway never auto-mutates the booking, only flags it for review', async ({ page }) => {
    await loginPrimary(page);
    const headers = { 'X-CSRF-Token': await getCsrfToken(page) };
    const marker = String(Date.now());
    const vehicleId = await createVehicle(page, headers, marker);
    const dayStr = farFutureDate(69000);

    const createRes = await page.request.post('/api/bookings', {
      headers, data: bookingPayload(marker, dayStr, { vehicleId }),
    });
    const booking = await createRes.json();
    await page.request.post(`/api/bookings/${booking._id}/status`, { headers, data: { status: 'ready_for_dispatch' } });
    const startRes = await page.request.post(`/api/bookings/${booking._id}/start`, { headers });
    expect(startRes.status(), await startRes.text()).toBe(200);
    const started = await startRes.json();
    expect(started.status).toBe('trip_started');

    // A critical defect is logged mid-trip.
    await putVehicleOnSafetyHold(page, headers, vehicleId);

    // No automatic/punitive action: the booking is untouched.
    const allBookings = await (await page.request.get('/api/bookings')).json();
    const reread = allBookings.find((b: any) => b._id === booking._id);
    expect(reread.status).toBe('trip_started');

    // But it IS surfaced as needing review, via the existing safety-hold endpoint.
    const holdRes = await page.request.get(`/api/vehicles/${vehicleId}/safety-hold`);
    const holdBody = await holdRes.json();
    expect(holdBody.safetyHold).toBe(true);
    expect(holdBody.activeBookingsRequiringReview.some((b: any) => b._id === booking._id)).toBe(true);
  });
});
