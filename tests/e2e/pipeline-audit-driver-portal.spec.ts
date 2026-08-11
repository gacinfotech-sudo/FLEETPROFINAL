import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function pickAvailableVehicle(page: Page): Promise<any> {
  const vehicles = await (await page.request.get('/api/vehicles')).json();
  const available = vehicles.filter((v: any) => v.status === 'available');
  expect(available.length).toBeGreaterThan(0);
  return available[Math.floor(Math.random() * available.length)];
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

// This tenant's driver slots are ALSO a hard-capped, scarce resource
// (limit 15, confirmed exhausted once already while developing this test —
// 10 timestamp-suffixed driver records accumulated across debugging runs
// and had to be deleted to free capacity). Same fix as the manager-scarcity
// pattern established in availability-engine.spec.ts and reused throughout
// this session's pipeline-audit tests: find-or-create ONCE by a stable
// name/phone, never mint a fresh driver per run.
const PRIMARY_DRIVER_NAME = 'Portal Test Driver Primary';
const PRIMARY_DRIVER_PHONE = '9700000001';
const SECONDARY_DRIVER_NAME = 'Portal Test Driver Secondary';
const SECONDARY_DRIVER_PHONE = '9700000002';
const PRIMARY_PIN = '4321';

let managerUserId: string;
const managerPassword = 'AvTest456!';
let primaryDriverId: string;
let secondaryDriverId: string;

async function findOrCreateDriver(page: Page, csrf: string, name: string, phone: string): Promise<string> {
  const existing = await (await page.request.get('/api/drivers')).json();
  const found = existing.find((d: any) => d.name === name);
  if (found) return found._id;
  const res = await page.request.post('/api/drivers', { headers: { 'X-CSRF-Token': csrf }, data: { name, phone } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json())._id;
}

test.describe.configure({ mode: 'serial' });

test.describe('Pipeline audit — Driver Portal (phone + PIN login, own-duties scoping, accept-duty)', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const existing = await (await page.request.get('/api/users/sub-users')).json();
    const reusable = existing.find((u: any) => u.userId.startsWith('avtest_'));
    expect(reusable, 'expected availability-engine.spec.ts to have already created its reusable avtest_ manager').toBeTruthy();
    managerUserId = reusable.userId;

    primaryDriverId = await findOrCreateDriver(page, csrf, PRIMARY_DRIVER_NAME, PRIMARY_DRIVER_PHONE);
    secondaryDriverId = await findOrCreateDriver(page, csrf, SECONDARY_DRIVER_NAME, SECONDARY_DRIVER_PHONE);
    await page.close();
  });

  test('API: a manager without manage_drivers cannot set a driver login PIN', async ({ page }) => {
    await login(page, managerUserId, managerPassword);
    const csrf = await getCsrfToken(page);
    const blockedRes = await page.request.post(`/api/drivers/${primaryDriverId}/set-login-pin`, {
      headers: { 'X-CSRF-Token': csrf }, data: { pin: '1234' },
    });
    expect(blockedRes.status()).toBe(403);
  });

  test('API: full flow — set PIN, wrong PIN rejected, correct PIN logs in, sees only own duties, accepts a duty idempotently, cannot reach staff routes', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    const vehicle1 = await pickAvailableVehicle(page);
    const day1 = farFutureDate(64000, 1000);
    const myBookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: `Driver Portal QA ${marker}`, customerPhone: '9' + String(Date.now() + 1).slice(-9),
        bookingType: 'with_driver', tripType: 'one_way', pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: day1, pickupTime: '09:00', returnDate: day1, returnTime: '17:00',
        vehicleId: vehicle1._id, driverId: primaryDriverId, amount: 1500, pricingType: 'day', status: 'confirmed',
      },
    });
    expect(myBookingRes.ok(), await myBookingRes.text()).toBeTruthy();
    const myBooking = await myBookingRes.json();

    // A booking for the OTHER driver, that must NEVER appear in the
    // primary driver's duty list — the actual tenant/driver-scoping proof.
    const vehicle2 = await pickAvailableVehicle(page);
    const day2 = farFutureDate(65500, 1000);
    const otherBookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: `Driver Portal Other QA ${marker}`, customerPhone: '9' + String(Date.now() + 2).slice(-9),
        bookingType: 'with_driver', tripType: 'one_way', pickupLocation: 'Bhopal', dropoffLocation: 'Indore',
        pickupDate: day2, pickupTime: '09:00', returnDate: day2, returnTime: '17:00',
        vehicleId: vehicle2._id, driverId: secondaryDriverId, amount: 1800, pricingType: 'day', status: 'confirmed',
      },
    });
    expect(otherBookingRes.ok(), await otherBookingRes.text()).toBeTruthy();

    const setPinRes = await page.request.post(`/api/drivers/${primaryDriverId}/set-login-pin`, {
      headers: { 'X-CSRF-Token': csrf }, data: { pin: PRIMARY_PIN },
    });
    expect(setPinRes.ok(), await setPinRes.text()).toBeTruthy();

    // Wrong PIN is rejected.
    const wrongLoginRes = await page.request.post('/api/driver-auth/login', { headers: { 'X-CSRF-Token': csrf }, data: { phone: PRIMARY_DRIVER_PHONE, pin: '0000' } });
    expect(wrongLoginRes.status()).toBe(401);

    // Correct PIN succeeds.
    const loginRes = await page.request.post('/api/driver-auth/login', { headers: { 'X-CSRF-Token': csrf }, data: { phone: PRIMARY_DRIVER_PHONE, pin: PRIMARY_PIN } });
    expect(loginRes.ok(), await loginRes.text()).toBeTruthy();
    const loginBody = await loginRes.json();
    expect(loginBody.driver.name).toBe(PRIMARY_DRIVER_NAME);

    // Own-duties scoping: sees this run's own booking, never the other driver's.
    const dutiesRes = await page.request.get('/api/driver-portal/my-duties');
    expect(dutiesRes.ok(), await dutiesRes.text()).toBeTruthy();
    const duties = await dutiesRes.json();
    expect(duties.some((d: any) => d._id === myBooking._id)).toBe(true);
    expect(duties.every((d: any) => d.pickupLocation !== 'Bhopal')).toBe(true);
    const myDuty = duties.find((d: any) => d._id === myBooking._id);
    expect(myDuty.dutyAcceptedAt).toBeFalsy();

    // Accept duty, then accept again — idempotent, same timestamp both times.
    const acceptRes1 = await page.request.post(`/api/driver-portal/bookings/${myBooking._id}/accept-duty`, { headers: { 'X-CSRF-Token': csrf } });
    expect(acceptRes1.ok(), await acceptRes1.text()).toBeTruthy();
    const accepted1 = await acceptRes1.json();
    expect(accepted1.dutyAcceptedAt).toBeTruthy();
    const acceptRes2 = await page.request.post(`/api/driver-portal/bookings/${myBooking._id}/accept-duty`, { headers: { 'X-CSRF-Token': csrf } });
    const accepted2 = await acceptRes2.json();
    expect(accepted2.dutyAcceptedAt).toBe(accepted1.dutyAcceptedAt);

    // A driver session must never reach a staff-only route, even an
    // unrelated read-only one — proving genuine isolation, not just "this
    // one route happens to check the right thing."
    const staffRouteRes = await page.request.get('/api/bookings');
    expect(staffRouteRes.status()).toBe(401);

    // Logout invalidates the session.
    const logoutRes = await page.request.post('/api/driver-auth/logout', { headers: { 'X-CSRF-Token': csrf } });
    expect(logoutRes.ok()).toBeTruthy();
    const afterLogoutRes = await page.request.get('/api/driver-portal/my-duties');
    expect(afterLogoutRes.status()).toBe(401);
  });

  test('UI: staff sets a PIN from the Driver Profile dialog, then the driver logs in and accepts a fresh duty in the browser', async ({ page, browser }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    // A fresh booking for the same reusable primary driver — bookings
    // aren't a scarce resource the way drivers/managers are, so a new one
    // per run is fine and keeps this test's "Accept Duty" click meaningful
    // (the previous test already accepted its own, separate booking).
    const vehicle = await pickAvailableVehicle(page);
    const dayStr = farFutureDate(67000, 1000);
    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: `UI Portal QA ${marker}`, customerPhone: '9' + String(Date.now() + 3).slice(-9),
        bookingType: 'with_driver', tripType: 'one_way', pickupLocation: 'Indore', dropoffLocation: 'Dewas',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '17:00',
        vehicleId: vehicle._id, driverId: primaryDriverId, amount: 1200, pricingType: 'day', status: 'confirmed',
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const booking = await bookingRes.json();

    // Staff sets/resets the PIN via the real UI (re-setting is fine —
    // it's idempotent from the driver's point of view, same PIN as before).
    await page.goto('/dashboard/drivers');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/search drivers/i).fill(PRIMARY_DRIVER_NAME);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'View Profile' }).first().click();
    await page.getByRole('button', { name: 'Set Login PIN' }).click();
    await page.getByLabel(/New PIN/i).fill(PRIMARY_PIN);
    await page.getByRole('button', { name: 'Set PIN', exact: true }).click();
    await expect(page.getByText('Login PIN set').first()).toBeVisible({ timeout: 5000 });

    // Driver logs in and accepts their newest duty, in a fresh browser
    // context — this must work with no staff session/cookie involved.
    const driverContext = await browser.newContext();
    const driverPage = await driverContext.newPage();
    await driverPage.goto('/driver-login');
    await driverPage.getByLabel(/Phone Number/i).fill(PRIMARY_DRIVER_PHONE);
    await driverPage.getByLabel(/PIN/i).fill(PRIMARY_PIN);
    await driverPage.getByRole('button', { name: 'Login' }).click();
    await expect(driverPage).toHaveURL(/\/driver$/);
    await expect(driverPage.getByText(PRIMARY_DRIVER_NAME)).toBeVisible({ timeout: 5000 });
    await expect(driverPage.getByText('Indore → Dewas').first()).toBeVisible({ timeout: 5000 });

    // Located by this run's unique bookingId via a stable data-testid, not
    // by route text — the reusable primary driver accumulates more
    // "Indore → Dewas" bookings across repeated runs, and duty-list sort
    // order (by pickup date, a randomized far-future value) doesn't
    // guarantee the newest-created one sorts first, so route text alone
    // could pick an already-accepted card from an earlier run.
    const dutyCard = driverPage.getByTestId(`duty-${booking.bookingId}`);
    await dutyCard.getByRole('button', { name: 'Accept Duty' }).click();
    await expect(dutyCard.getByText(/Accepted/)).toBeVisible({ timeout: 5000 });
    await driverContext.close();
  });
});
