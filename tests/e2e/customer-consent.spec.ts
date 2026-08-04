import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test('Consent grant/opt-out ledger is real: history records every event, opt-out(all) flips status to do_not_contact, and re-opting in restores it', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);
  const phone = '96' + String(Date.now()).slice(-8);
  const day = new Date();
  day.setDate(day.getDate() + 6500 + Math.floor(Math.random() * 400));
  const dayStr = day.toISOString().slice(0, 10);

  const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
  const vehicles = await vehiclesRes.json();
  const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

  await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: 'Consent Test Customer', customerPhone: phone,
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
      bookingType: 'self_drive', tripType: 'one_way',
      vehicleId, totalAmount: 1000, status: 'confirmed',
    },
  });
  const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
  const customerId = lookup.customer._id;

  // Default consent granted at booking-time for transactional channels,
  // promotional requires explicit opt-in.
  const initial = await (await page.request.get(`/api/customers/${customerId}/consent`)).json();
  expect(initial.consent.whatsapp).toBe(true);
  expect(initial.consent.promotional).toBe(false);
  expect(initial.status).toBe('active');

  // Opt in to promotional.
  const afterGrant = await (await page.request.post(`/api/customers/${customerId}/consent`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { channel: 'promotional', source: 'manual' },
  })).json();
  expect(afterGrant.consent.promotional).toBe(true);

  // Mark Do Not Contact — must revoke all 4 channels and flip status.
  const afterDNC = await (await page.request.post(`/api/customers/${customerId}/opt-out`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { channel: 'all', reason: 'e2e test dnc' },
  })).json();
  expect(afterDNC.status).toBe('do_not_contact');
  expect(afterDNC.doNotContactReason).toBe('e2e test dnc');
  expect(afterDNC.consent).toEqual({ whatsapp: false, promotional: false, email: false, sms: false });

  // History must contain every event so far as append-only rows, never edited in place.
  const midHistory = await (await page.request.get(`/api/customers/${customerId}/consent`)).json();
  const optOutEvents = midHistory.history.filter((h: any) => h.action === 'opted_out');
  expect(optOutEvents.length).toBeGreaterThanOrEqual(4);
  expect(midHistory.history.some((h: any) => h.action === 'opted_in' && h.channel === 'promotional')).toBe(true);

  // Re-opt-in on any channel must restore active status.
  const afterRestore = await (await page.request.post(`/api/customers/${customerId}/consent`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { channel: 'whatsapp', source: 'manual' },
  })).json();
  expect(afterRestore.status).toBe('active');
  expect(afterRestore.doNotContactReason).toBeFalsy();
  expect(afterRestore.consent.whatsapp).toBe(true);

  // UI: consent toggles render on the Customer Dashboard and reflect live state.
  await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
  await expect(page).toHaveURL(/\/dashboard\/customers$/);
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.getByText('Consent Test Customer').first().click();
  await expect(page.getByText('Contact Preferences')).toBeVisible();
  await expect(page.getByText('WhatsApp: On')).toBeVisible();
});
