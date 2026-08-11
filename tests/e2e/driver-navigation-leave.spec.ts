import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Permanent regressions for the driver-navigation consolidation + Leave
// Calendar workspace:
//  - ONE expandable "Drivers" sidebar group holds every driver item
//    (All Drivers / Add Driver / Attendance / Leave Calendar / Performance);
//    no scattered driver-* entries remain at top level
//  - the Leave Calendar page renders KPI row, Today-on-Leave strip,
//    month calendar with controls, and the status legend
//  - the leave lifecycle (create → approve → edit → cancel) drives the
//    canonical availability engine end-to-end, including multi-day ranges
//  - approving leave over an existing confirmed booking produces the
//    LEAVE_BOOKING_CONFLICT warning instead of silently coexisting
//  - no horizontal overflow at phone width

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, 'document must not scroll horizontally').toBeLessThanOrEqual(0);
}

// Far-future random window so runs never collide with each other or with
// other specs' persistent bookings on the shared qaclient test DB (same
// convention as driver-overlap.spec.ts).
function randomFutureDay(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30 + Math.floor(Math.random() * 4970));
  d.setHours(0, 0, 0, 0);
  return d;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function plusDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

// Pick a driver that is actually assignable for the given window — keeps
// the availability assertions about LEAVE, not about pre-existing state.
async function pickAvailableDriver(page: Page, day: Date): Promise<any> {
  const res = await page.request.get(
    `/api/drivers/available?pickupDate=${iso(day)}&pickupTime=10:00&returnDate=${iso(day)}&returnTime=18:00`);
  expect(res.ok()).toBeTruthy();
  const drivers = await res.json();
  expect(drivers.length, 'test tenant must have at least one available driver').toBeGreaterThan(0);
  return drivers[0];
}

async function availableDriverIds(page: Page, start: Date, end: Date): Promise<string[]> {
  const res = await page.request.get(
    `/api/drivers/available?pickupDate=${iso(start)}&pickupTime=10:00&returnDate=${iso(end)}&returnTime=18:00`);
  const drivers = await res.json();
  return drivers.map((d: any) => d._id);
}

async function cancelLeave(page: Page, csrfToken: string, leaveId: string) {
  await page.request.post(`/api/driver-leaves/${leaveId}/cancel`, {
    headers: { 'X-CSRF-Token': csrfToken }, data: {},
  });
}

test.describe('Drivers sidebar consolidation', () => {
  test('one expandable Drivers group holds every driver item; none scattered', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);
    const nav = page.locator('nav');

    // Group header exists, children hidden while collapsed (default).
    const driversGroup = nav.getByRole('button', { name: 'Drivers', exact: true });
    await expect(driversGroup).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Leave Calendar' })).not.toBeVisible();

    // The old scattered top-level labels are gone.
    for (const gone of ['Manage Drivers', 'Driver Attendance', 'Driver Leave', 'Driver Performance']) {
      await expect(nav.getByRole('button', { name: gone })).toHaveCount(0);
    }

    // Expand → all five children appear.
    await driversGroup.click();
    for (const child of ['All Drivers', 'Add Driver', 'Attendance', 'Leave Calendar', 'Performance']) {
      await expect(nav.getByRole('button', { name: child, exact: true })).toBeVisible();
    }

    // Order: after Follow-ups, before View Fleet.
    const labels = (await nav.getByRole('button').allTextContents()).map((l) => l.trim());
    const idx = (needle: string) => labels.findIndex((l) => l.startsWith(needle));
    expect(idx('Follow-ups')).toBeLessThan(idx('Drivers'));
    expect(idx('Drivers')).toBeLessThan(idx('View Fleet'));

    // Collapse again (no active child on the Dashboard view).
    await driversGroup.click();
    await expect(nav.getByRole('button', { name: 'Leave Calendar' })).not.toBeVisible();
  });

  test('Leave Calendar child navigates and keeps Drivers parent highlighted', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);
    const nav = page.locator('nav');

    await nav.getByRole('button', { name: 'Drivers', exact: true }).click();
    await nav.getByRole('button', { name: 'Leave Calendar' }).click();
    await expect(page).toHaveURL(/\/dashboard\/driver-leave$/);

    const active = nav.locator('[aria-current="page"]');
    await expect(active).toHaveText(/Leave Calendar/);
    // Parent stays visually active (semibold treatment on the trigger).
    await expect(nav.getByRole('button', { name: 'Drivers', exact: true })).toHaveClass(/font-semibold/);
  });

  test('Add Driver child opens the canonical Add Driver wizard', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);
    const nav = page.locator('nav');

    await nav.getByRole('button', { name: 'Drivers', exact: true }).click();
    await nav.getByRole('button', { name: 'Add Driver', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/drivers-add$/);
    await expect(page.getByRole('heading', { name: 'Add New Driver' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Leave Calendar workspace', () => {
  test('KPI row, Today-on-Leave strip, calendar controls and legend render', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/driver-leave');
    await page.waitForTimeout(600);

    for (const id of ['kpi-today-on-leave', 'kpi-upcoming', 'kpi-available', 'kpi-pending']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await expect(page.getByTestId('today-on-leave')).toBeVisible();

    const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    await expect(page.getByTestId('calendar-label')).toHaveText(monthLabel);

    // Month/Week/List toggle works.
    await page.getByRole('button', { name: 'list', exact: true }).click();
    await expect(page.getByTestId('calendar-label')).toHaveText(monthLabel); // list keeps month label
    await page.getByRole('button', { name: 'month', exact: true }).click();

    // Legend carries text labels, not just colors.
    const calendar = page.getByTestId('leave-calendar');
    for (const label of ['Approved', 'Pending', 'Cancelled', 'Half day']) {
      await expect(calendar.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('mobile 375px: no horizontal overflow; tapping a date opens day detail', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/driver-leave');
    await page.waitForTimeout(600);
    await assertNoHorizontalOverflow(page);

    // Tap today's cell → day-detail dialog.
    const calendar = page.getByTestId('leave-calendar');
    await calendar.locator('button.min-h-\\[64px\\]').nth(10).click();
    await expect(page.getByText(/Drivers on Leave \(\d+\)/)).toBeVisible();
  });
});

test.describe('Leave ↔ availability engine (canonical, end-to-end)', () => {
  test('multi-day approved leave blocks assignment; cancel restores it', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const start = randomFutureDay();
    const mid = plusDays(start, 1);
    const end = plusDays(start, 2);
    const driver = await pickAvailableDriver(page, mid);

    // Create (pending) — pending leave must NOT block availability.
    const createRes = await page.request.post(`/api/drivers/${driver._id}/leave`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { startDate: iso(start), endDate: iso(end), leaveType: 'paid', dayPart: 'full', reason: 'e2e multi-day' },
    });
    expect(createRes.status()).toBe(201);
    const leave = await createRes.json();
    expect(leave.status).toBe('pending');
    expect(leave.dayPart).toBe('full');
    expect((await availableDriverIds(page, mid, mid))).toContain(driver._id);

    // Approve — every day of the span now blocks, as ONE record.
    const approveRes = await page.request.post(`/api/driver-leaves/${leave._id}/approve`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: {},
    });
    expect(approveRes.ok()).toBeTruthy();
    for (const day of [start, mid, end]) {
      expect((await availableDriverIds(page, day, day)), `day ${iso(day)} must be blocked`).not.toContain(driver._id);
    }
    // The reason surfaces to the booking resource selector.
    const unavailRes = await page.request.get(
      `/api/drivers/available?pickupDate=${iso(mid)}&pickupTime=10:00&returnDate=${iso(mid)}&returnTime=18:00&includeUnavailable=true`);
    const withReasons = await unavailRes.json();
    const mine = withReasons.find((d: any) => d._id === driver._id);
    expect(mine?.available).toBe(false);
    expect(mine?.unavailabilityReason).toContain('On leave');

    // There is exactly ONE canonical record for the span — not one per day.
    const listRes = await page.request.get(`/api/driver-leaves?driverId=${driver._id}`);
    const records = (await listRes.json()).filter((l: any) => l._id === leave._id);
    expect(records.length).toBe(1);

    // Edit (approved, future) — allowed, keeps blocking.
    const editRes = await page.request.patch(`/api/driver-leaves/${leave._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { reason: 'e2e multi-day (edited)', dayPart: 'first_half' },
    });
    expect(editRes.ok()).toBeTruthy();
    expect((await editRes.json()).dayPart).toBe('first_half');

    // Cancel — soft state change, availability restored, history preserved.
    const cancelRes = await page.request.post(`/api/driver-leaves/${leave._id}/cancel`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: {},
    });
    expect(cancelRes.ok()).toBeTruthy();
    expect((await cancelRes.json()).status).toBe('cancelled');
    expect((await availableDriverIds(page, mid, mid))).toContain(driver._id);
    const afterList = await (await page.request.get(`/api/driver-leaves?driverId=${driver._id}`)).json();
    expect(afterList.find((l: any) => l._id === leave._id)?.status).toBe('cancelled');
  });

  test('approving leave over an existing confirmed booking raises LEAVE_BOOKING_CONFLICT', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const day = randomFutureDay();
    const driver = await pickAvailableDriver(page, day);
    const vehicles = await (await page.request.get('/api/vehicles')).json();
    expect(vehicles.length, 'test tenant must have at least one vehicle').toBeGreaterThan(0);

    // Some seeded vehicles carry state from other specs (e.g. a Safety
    // Hold from the daily-inspection suite) — try until one is bookable.
    let booking: any = null;
    let lastFailure = '';
    for (const vehicle of vehicles) {
      const bookingRes = await page.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: {
          customerName: 'Leave Conflict Test', customerPhone: '9222222222',
          pickupLocation: 'Indore', dropoffLocation: 'Bhopal',
          bookingType: 'with_driver', tripType: 'round_trip',
          pickupDate: iso(day), pickupTime: '10:00', returnDate: iso(day), returnTime: '20:00',
          vehicleId: vehicle._id, driverId: driver._id, totalAmount: 4000, status: 'confirmed',
        },
      });
      if (bookingRes.ok()) { booking = await bookingRes.json(); break; }
      lastFailure = `${bookingRes.status()}: ${await bookingRes.text()}`;
    }
    expect(booking, `setup: booking creation must succeed with some vehicle — last failure ${lastFailure}`).toBeTruthy();

    const leaveRes = await page.request.post(`/api/drivers/${driver._id}/leave`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { startDate: iso(day), endDate: iso(day), leaveType: 'emergency', reason: 'e2e conflict' },
    });
    const leave = await leaveRes.json();

    // Plain approve must refuse with an actionable conflict payload.
    const approveRes = await page.request.post(`/api/driver-leaves/${leave._id}/approve`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: {},
    });
    expect(approveRes.status()).toBe(409);
    const conflictBody = await approveRes.json();
    expect(conflictBody.code).toBe('LEAVE_BOOKING_CONFLICT');
    expect(conflictBody.conflicts.map((c: any) => c.bookingId)).toContain(booking.bookingId);

    // Explicit override approves AND records the affected bookings.
    const overrideRes = await page.request.post(`/api/driver-leaves/${leave._id}/approve`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { override: true },
    });
    expect(overrideRes.ok()).toBeTruthy();
    expect((await overrideRes.json()).conflictingBookings).toContain(booking.bookingId);

    await cancelLeave(page, csrfToken, leave._id);
  });

  test('Today-on-Leave strip and KPI reflect an approved leave covering today', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const today = new Date();
    const driver = await pickAvailableDriver(page, today);

    const createRes = await page.request.post(`/api/drivers/${driver._id}/leave`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { startDate: iso(today), endDate: iso(today), leaveType: 'medical', reason: 'e2e today strip' },
    });
    const leave = await createRes.json();
    const approveRes = await page.request.post(`/api/driver-leaves/${leave._id}/approve`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { override: true },
    });
    expect(approveRes.ok()).toBeTruthy();

    try {
      await page.goto('/dashboard/driver-leave');
      await page.waitForTimeout(800);
      const strip = page.getByTestId('today-on-leave');
      await expect(strip).toContainText(driver.name);
      await expect(strip).toContainText(/Today on Leave — [1-9]\d* Driver/);

      // Driver 360's Attendance & Leave tab sees the same record.
      await page.goto('/dashboard/drivers');
      await page.waitForTimeout(600);
    } finally {
      await cancelLeave(page, csrfToken, leave._id);
    }
  });
});
