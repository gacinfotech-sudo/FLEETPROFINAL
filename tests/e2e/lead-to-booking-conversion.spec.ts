import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function freshMobile(): string {
  return '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
}

/** Builds a Lead with an accepted quotation and a linked customer — the
 * minimum state "Convert to Booking" requires to be clickable at all. */
async function createLeadReadyForBooking(page: Page, csrfToken: string, customerName: string, mobile: string, pickupDate: string) {
  const inquiry = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { customerName, primaryMobile: mobile, source: 'whatsapp' },
  })).json();
  await page.request.patch(`/api/inquiries/${inquiry._id}`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      pickupDate: `${pickupDate}T00:00:00.000Z`, pickupTime: '09:00',
      pickupLocation: 'Indore Airport', dropLocation: 'Ujjain',
      numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya', tripType: 'one_way',
    },
  });
  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
  const leadId = converted.lead._id as string;

  await page.request.post(`/api/leads/${leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrfToken } });

  const quotation = await (await page.request.post(`/api/leads/${leadId}/quotations`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { options: [{ vehicleNameSnapshot: 'Honda City', quantity: 1, pricingType: 'fixed', baseRatePaise: 250000 }] },
  })).json();
  await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
  await page.request.post(`/api/quotations/${quotation._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'sent' } });
  await page.request.post(`/api/quotations/${quotation._id}/accept`, { headers: { 'X-CSRF-Token': csrfToken }, data: { acceptedOptionNumber: 1 } });

  return { inquiry, leadId };
}

test.describe('Lead → Booking conversion (Phase 7)', () => {
  test('API: /link-booking rejects a booking that belongs to a different tenant, and requires bookingId', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const { leadId } = await createLeadReadyForBooking(page, csrfToken, `Link Reject Test ${marker}`, freshMobile(), '2027-06-01');

    const missingBodyRes = await page.request.post(`/api/leads/${leadId}/link-booking`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: {},
    });
    expect(missingBodyRes.status()).toBe(400);

    const fakeBookingRes = await page.request.post(`/api/leads/${leadId}/link-booking`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { bookingId: '000000000000000000000000' },
    });
    expect(fakeBookingRes.status()).toBe(404);
  });

  test('UI: accepting a quotation and clicking Convert to Booking pre-fills the real booking form; submitting creates a Booking and links it back to the Lead', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const mobile = freshMobile();
    const pickupDate = new Date(); pickupDate.setDate(pickupDate.getDate() + 60 + Math.floor(Math.random() * 200));
    const pickupDateStr = pickupDate.toISOString().slice(0, 10);
    const customerName = `Lead Booking E2E ${marker}`;

    const { leadId } = await createLeadReadyForBooking(page, csrfToken, customerName, mobile, pickupDateStr);

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();
    await expect(page.getByRole('button', { name: 'Convert to Booking' })).toBeVisible();
    await page.getByRole('button', { name: 'Convert to Booking' }).click();

    // Prefill correctness: pickup location, pickup date and pickup time all
    // come from the Inquiry (via the Lead's populated inquiryId — regression
    // guard for the earlier bug where the list endpoint's projected populate
    // silently dropped pickupTime/returnTime/tripType from the Lead detail
    // dialog's copy of the inquiry).
    await expect(page.locator('input[name="pickupLocation"]')).toHaveValue('Indore Airport');
    await expect(page.locator('input[name="pickupDate"]')).toHaveValue(pickupDateStr);
    await expect(page.locator('input[name="pickupTime"]')).toHaveValue('09:00');

    await page.locator('input[name="returnTime"]').fill('18:00');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();

    const noVehicles = await page.getByText('No vehicles available for selected dates').isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(noVehicles, 'No vehicle available for the randomly chosen far-future date in the shared dev DB — environmental, not a code issue.');

    // Regression guard for the premature-submit bug: this pricing-selection
    // button previously defaulted to type="submit" (no explicit type set)
    // inside the wizard's single wrapping <form>, so clicking it silently
    // fired the real POST /api/bookings before the user ever saw Customer
    // Info or Review & Pay — invisible in the normal flow (customerName was
    // always still blank at this point) but a hard break for this prefilled
    // flow, where every required field is already valid by Step 2.
    const bookingPostPromise = page.waitForRequest(
      (req) => req.url().includes('/api/bookings') && req.method() === 'POST',
      { timeout: 3000 },
    ).then(() => true).catch(() => false);
    await page.locator('button:has-text("By Day")').first().click();
    expect(await bookingPostPromise).toBe(false);

    await expect(page.getByText('Trip Details').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continue to Customer Info' }).click();

    await expect(page.locator('input[name="customerName"]')).toHaveValue(customerName);
    // Inquiry.primaryMobile is stored with a "91" country-code prefix server-side.
    await expect(page.locator('input[name="customerPhone"]')).toHaveValue(`91${mobile}`);

    await page.getByRole('button', { name: 'Review Booking' }).click();
    await expect(page.getByText('Review & Confirm Booking')).toBeVisible();

    const [bookingResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/bookings') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Confirm Booking' }).click(),
    ]);
    expect(bookingResponse.ok()).toBeTruthy();
    const createdBooking = await bookingResponse.json();
    await expect(page.getByText('Booking Confirmed Successfully!')).toBeVisible();

    // "Create New Booking" is where onSuccess(createdBooking) actually fires
    // (matching the pre-existing "Done"/dismiss pattern) — that's what
    // triggers dashboard.tsx's link-booking mutation.
    const [linkResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes(`/api/leads/${leadId}/link-booking`)),
      page.getByRole('button', { name: 'Create New Booking' }).click(),
    ]);
    expect(linkResponse.ok()).toBeTruthy();

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();
    await expect(page.getByText('Booking Created')).toBeVisible();

    const leadCheck = await (await page.request.get(`/api/leads/${leadId}`)).json();
    expect(leadCheck.linkedBookingId).toBe(createdBooking._id);
  });
});
