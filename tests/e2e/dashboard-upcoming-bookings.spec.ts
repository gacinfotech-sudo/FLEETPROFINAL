import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function dateOffset(days: number): string {
  // Local calendar date, NOT toISOString() — the UTC date is yesterday's
  // date until 05:30 IST, which made this suite classify "today's"
  // booking as past when run between midnight and dawn.
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Deliberately does NOT use GET /api/vehicles/available — that endpoint is
// a known-stale read path (see docs/REAL_WORLD_WORKFLOW_GAPS.md Gap 6) that
// can both over- and under-report availability against a long-lived shared
// dev database with hundreds of accumulated bookings from other test runs.
// The real authority on whether a vehicle is free is booking creation
// itself (transactional, time-accurate) — so this tries each of the
// tenant's own vehicles in turn and lets a 409 conflict pick the next one,
// which is robust regardless of what else already occupies near-term dates.
// A long-lived shared dev database (hundreds of bookings accumulated across
// many prior test runs) can leave every vehicle genuinely occupied at any
// single fixed time on a near-term date, so this also varies the time
// window per attempt, not just the vehicle, before giving up.
const FALLBACK_TIME_WINDOWS: Array<[string, string]> = [
  ['06:00', '07:00'],
  ['13:00', '14:00'],
  ['21:00', '22:30'],
  ['23:00', '23:59'],
];

async function createBookingOnAnyAvailableVehicle(
  page: Page,
  csrfToken: string,
  opts: { customerName: string; pickupDate: string; pickupTime: string; returnTime: string }
) {
  const vehiclesRes = await page.request.get('/api/vehicles');
  const vehicles = (await vehiclesRes.json()).filter((v: any) => v.status === 'available');
  expect(vehicles.length, 'tenant must have at least one available-status vehicle for this test').toBeGreaterThan(0);

  const attempts: Array<[string, string]> = [[opts.pickupTime, opts.returnTime], ...FALLBACK_TIME_WINDOWS];
  let lastError: any = null;
  for (const [pickupTime, returnTime] of attempts) {
    for (const vehicle of vehicles) {
      const res = await page.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: {
          customerName: opts.customerName,
          customerPhone: '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9),
          pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
          pickupDate: opts.pickupDate, pickupTime, returnDate: opts.pickupDate, returnTime,
          bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicle._id || vehicle.id,
          totalAmount: 2000, status: 'confirmed',
        },
      });
      if (res.ok()) return await res.json();
      lastError = await res.json().catch(() => ({ status: res.status() }));
    }
  }
  throw new Error(`No vehicle/time combination was free for ${opts.pickupDate} across ${vehicles.length} available vehicles and ${attempts.length} time windows. Last error: ${JSON.stringify(lastError)}`);
}

// Exact acceptance scenario from the CEO Dashboard spec: Booking A (today),
// B (tomorrow), C (three days later), D (one month later), E (cancelled
// future booking), F (completed booking) — verifying the centralized
// Today/Tomorrow/Future/All Upcoming classification excludes cancelled and
// completed bookings regardless of their scheduled date.
test('Dashboard Upcoming Bookings: Today/Tomorrow/Future/All Upcoming classify bookings A-F correctly', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);
  const marker = String(Date.now());

  const todayDate = dateOffset(0);
  const tomorrowDate = dateOffset(1);
  const threeDaysDate = dateOffset(3);
  const oneMonthDate = dateOffset(30);
  const cancelledDate = dateOffset(5);

  const bookingA = await createBookingOnAnyAvailableVehicle(page, csrfToken, { customerName: `Acceptance A ${marker}`, pickupDate: todayDate, pickupTime: '14:00', returnTime: '18:00' });
  const bookingB = await createBookingOnAnyAvailableVehicle(page, csrfToken, { customerName: `Acceptance B ${marker}`, pickupDate: tomorrowDate, pickupTime: '08:00', returnTime: '12:00' });
  const bookingC = await createBookingOnAnyAvailableVehicle(page, csrfToken, { customerName: `Acceptance C ${marker}`, pickupDate: threeDaysDate, pickupTime: '10:00', returnTime: '14:00' });
  const bookingD = await createBookingOnAnyAvailableVehicle(page, csrfToken, { customerName: `Acceptance D ${marker}`, pickupDate: oneMonthDate, pickupTime: '10:00', returnTime: '14:00' });

  const bookingE = await createBookingOnAnyAvailableVehicle(page, csrfToken, { customerName: `Acceptance E ${marker}`, pickupDate: cancelledDate, pickupTime: '10:00', returnTime: '14:00' });
  const cancelRes = await page.request.post(`/api/bookings/${bookingE._id}/cancel`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { cancellationReason: 'Acceptance test: proving cancelled bookings are excluded' },
  });
  expect(cancelRes.ok(), JSON.stringify(await cancelRes.json())).toBe(true);

  const bookingF = await createBookingOnAnyAvailableVehicle(page, csrfToken, { customerName: `Acceptance F ${marker}`, pickupDate: todayDate, pickupTime: '09:00', returnTime: '11:00' });
  for (const status of ['vehicle_assigned', 'ready_for_dispatch', 'trip_started', 'completed']) {
    const statusRes = await page.request.post(`/api/bookings/${bookingF._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status },
    });
    expect(statusRes.ok(), `transition to ${status}: ${JSON.stringify(await statusRes.json())}`).toBe(true);
  }

  // --- API-level verification of the centralized classification rule ---
  const classified = await (await page.request.get('/api/dashboard/upcoming-bookings')).json();
  const idsIn = (list: any[]) => list.map((b: any) => b._id || b.id);

  expect(idsIn(classified.today)).toContain(bookingA._id);
  expect(idsIn(classified.tomorrow)).toContain(bookingB._id);
  expect(idsIn(classified.future)).toContain(bookingC._id);
  expect(idsIn(classified.future)).toContain(bookingD._id);
  expect(idsIn(classified.all)).toContain(bookingA._id);
  expect(idsIn(classified.all)).toContain(bookingB._id);
  expect(idsIn(classified.all)).toContain(bookingC._id);
  expect(idsIn(classified.all)).toContain(bookingD._id);

  // E is cancelled — must not appear anywhere despite its date otherwise qualifying for "future".
  expect(idsIn(classified.future)).not.toContain(bookingE._id);
  expect(idsIn(classified.all)).not.toContain(bookingE._id);

  // F is completed and scheduled today — must not appear in "today" or "all".
  expect(idsIn(classified.today)).not.toContain(bookingF._id);
  expect(idsIn(classified.all)).not.toContain(bookingF._id);

  // Sanity: today's bucket never contains tomorrow's/future's bookings and vice versa.
  expect(idsIn(classified.today)).not.toContain(bookingB._id);
  expect(idsIn(classified.tomorrow)).not.toContain(bookingA._id);

  // --- UI verification: compact card renders, respects the 3-record limit,
  // and row click opens the existing Booking Details dialog ---
  await page.goto('/dashboard/dashboard');
  await page.waitForLoadState('networkidle');

  const upcomingCard = page.locator('main div.rounded-lg', { has: page.getByText('Upcoming Bookings', { exact: true }) }).first();
  await expect(upcomingCard.getByRole('button', { name: /today \(/i })).toBeVisible();
  await expect(upcomingCard.getByRole('button', { name: /tomorrow \(/i })).toBeVisible();
  await expect(upcomingCard.getByRole('button', { name: /future \(/i })).toBeVisible();

  // The dashboard is a summary: never more than 3 booking rows per tab,
  // regardless of how many the API returns (record-limit regression).
  await upcomingCard.getByRole('button', { name: /future \(/i }).click();
  const futureRows = upcomingCard.locator('button[type="button"]').filter({ hasText: /·/ });
  expect(await futureRows.count()).toBeLessThanOrEqual(3);

  // Today tab shows booking A (created above for today) among its rows.
  await upcomingCard.getByRole('button', { name: /today \(/i }).click();
  await expect(upcomingCard.getByText(`Acceptance A ${marker}`)).toBeVisible();

  // Clicking a row opens the ONE Unified Booking Workspace (no duplicate detail UI).
  await upcomingCard.getByText(`Acceptance A ${marker}`).click();
  const workspace = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Allocation' }) });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText(`Acceptance A ${marker}`).first()).toBeVisible();

  // "View All" routes to the full Upcoming Bookings page, where the
  // beyond-limit records (C and D) are actually reachable.
  await page.keyboard.press('Escape');
  await upcomingCard.getByRole('button', { name: /View All/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/upcoming-bookings$/);
});

test('Dashboard KPI cards: Bookings and Vehicles cards navigate to their existing views', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  await page.goto('/dashboard/dashboard');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Bookings — view Booking History/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/history/);

  await page.goto('/dashboard/dashboard');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Vehicles — view Fleet/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/fleet/);
});
