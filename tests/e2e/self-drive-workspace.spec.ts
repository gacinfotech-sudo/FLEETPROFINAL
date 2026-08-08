import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// SELF-DRIVE WORKSPACE — deposit → handover → return → settlement lifecycle
// (service-modes spec §10+ follow-up). Contract:
//
// 1. The lifecycle record is one-per-booking, tenant-scoped, and only
//    exists for bookingType === 'self_drive' (400 SELF_DRIVE_ONLY otherwise).
// 2. Order guards: return requires handover (409 HANDOVER_REQUIRED),
//    settlement requires return (409 RETURN_REQUIRED); each step records
//    at most once (409 *_EXISTS on repeat).
// 3. Return odometer below handover odometer is rejected (400).
// 4. Settlement math is server-computed: refund = max(0, deposit − charges),
//    balanceDue = max(0, charges − deposit).
// 5. The workspace shows a Self-Drive tab only for self-drive bookings and
//    renders the recorded lifecycle.

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function createBooking(page: Page, csrfToken: string, bookingType: string) {
  const marker = String(Date.now()) + Math.floor(Math.random() * 1000);
  const res = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: `SelfDriveWs ${marker}`,
      customerPhone: '9' + marker.slice(-9),
      pickupLocation: 'Indore', dropoffLocation: 'Local',
      bookingType, tripType: 'local',
      totalAmount: 5000,
      status: 'tentative',
      travelDateStatus: 'not_decided',
      resourceAssignmentPending: true,
    },
  });
  const body = await res.json();
  expect(res.ok(), `create failed: ${JSON.stringify(body)}`).toBe(true);
  return { id: body._id as string, marker };
}

// qaclient is single-session — parallel workers bounce each other's logins,
// so this suite runs serially in one worker.
test.describe.configure({ mode: 'serial' });

test.describe('Self-drive lifecycle — deposit → handover → return → settlement', () => {
  test('API lifecycle with order guards and server-computed settlement', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const { id } = await createBooking(page, csrf, 'self_drive');
    const base = `/api/bookings/${id}/self-drive`;
    const H = { 'X-CSRF-Token': csrf };

    // Fresh record: stage deposit_pending.
    let res = await page.request.get(base);
    expect(res.ok()).toBe(true);
    expect((await res.json()).stage).toBe('deposit_pending');

    // Return before handover is refused.
    res = await page.request.post(`${base}/return`, { headers: H, data: { odometerReading: 100, fuelLevel: 50 } });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe('HANDOVER_REQUIRED');

    // Settlement before return is refused.
    res = await page.request.post(`${base}/settlement`, { headers: H, data: { charges: [] } });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe('RETURN_REQUIRED');

    // Deposit.
    res = await page.request.post(`${base}/deposit`, { headers: H, data: { amount: 5000, method: 'upi' } });
    expect(res.status()).toBe(201);
    expect((await res.json()).stage).toBe('awaiting_handover');

    // Second deposit refused.
    res = await page.request.post(`${base}/deposit`, { headers: H, data: { amount: 100, method: 'cash' } });
    expect(res.status()).toBe(409);
    expect((await res.json()).code).toBe('DEPOSIT_EXISTS');

    // Handover.
    res = await page.request.post(`${base}/handover`, { headers: H, data: { odometerReading: 12000, fuelLevel: 90 } });
    expect(res.status()).toBe(201);
    expect((await res.json()).stage).toBe('on_trip');

    // Return odometer below handover refused.
    res = await page.request.post(`${base}/return`, { headers: H, data: { odometerReading: 11900, fuelLevel: 40 } });
    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe('ODOMETER_BELOW_HANDOVER');

    // Return.
    res = await page.request.post(`${base}/return`, { headers: H, data: { odometerReading: 12350, fuelLevel: 40, damageNoted: 'Scratch on left door' } });
    expect(res.status()).toBe(201);
    expect((await res.json()).stage).toBe('returned');

    // Settlement: ₹5000 deposit − ₹1800 charges = ₹3200 refund, no balance due.
    res = await page.request.post(`${base}/settlement`, {
      headers: H,
      data: { charges: [{ label: 'Fuel shortage', amount: 800 }, { label: 'Door scratch', amount: 1000 }] },
    });
    expect(res.status()).toBe(201);
    const settled = await res.json();
    expect(settled.stage).toBe('settled');
    expect(settled.settlement.totalCharges).toBe(1800);
    expect(settled.settlement.depositRefund).toBe(3200);
    expect(settled.settlement.balanceDue).toBe(0);

    // Second settlement refused.
    res = await page.request.post(`${base}/settlement`, { headers: H, data: { charges: [] } });
    expect(res.status()).toBe(409);
  });

  test('charges beyond the deposit produce balanceDue, refund floored at 0', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const { id } = await createBooking(page, csrf, 'self_drive');
    const base = `/api/bookings/${id}/self-drive`;
    const H = { 'X-CSRF-Token': csrf };

    await page.request.post(`${base}/deposit`, { headers: H, data: { amount: 1000, method: 'cash' } });
    await page.request.post(`${base}/handover`, { headers: H, data: { odometerReading: 500, fuelLevel: 100 } });
    await page.request.post(`${base}/return`, { headers: H, data: { odometerReading: 700, fuelLevel: 20 } });
    const res = await page.request.post(`${base}/settlement`, {
      headers: H,
      data: { charges: [{ label: 'Major damage', amount: 4500 }] },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.settlement.depositRefund).toBe(0);
    expect(body.settlement.balanceDue).toBe(3500);
  });

  test('self-drive endpoints refuse non-self-drive bookings', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const { id } = await createBooking(page, csrf, 'with_driver');
    const res = await page.request.get(`/api/bookings/${id}/self-drive`);
    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe('SELF_DRIVE_ONLY');
  });

  test('workspace shows the Self-Drive tab and recorded lifecycle for a self-drive booking', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const { id, marker } = await createBooking(page, csrf, 'self_drive');
    const base = `/api/bookings/${id}/self-drive`;
    const H = { 'X-CSRF-Token': csrf };
    await page.request.post(`${base}/deposit`, { headers: H, data: { amount: 2000, method: 'upi' } });

    await page.goto('/dashboard/booking-queues');
    const row = page.locator('tr', { hasText: `SelfDriveWs ${marker}` }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.getByRole('button', { name: 'Open' }).click();

    await page.getByTestId('tab-selfdrive').click();
    await expect(page.getByTestId('self-drive-panel')).toBeVisible();
    await expect(page.getByTestId('sd-stage-badge')).toHaveText(/awaiting handover/i);
    await expect(page.getByTestId('sd-deposit-summary')).toContainText('₹2,000');
    // Handover form is available; return/settlement are gated.
    await expect(page.getByTestId('sd-handover-save')).toBeVisible();
    await expect(page.getByText('Record the handover first.')).toBeVisible();
  });
});
