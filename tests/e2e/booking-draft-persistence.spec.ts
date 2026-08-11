import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function clearDraft(page: Page, csrfToken: string) {
  await page.request.delete('/api/booking-drafts/mine', { headers: { 'X-CSRF-Token': csrfToken } });
}

test.describe('Booking wizard draft persistence', () => {
  test('API: PUT saves a draft, GET returns it, DELETE clears it', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    await clearDraft(page, csrfToken);

    const noDraft = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(noDraft).toBeNull();

    const saveRes = await page.request.put('/api/booking-drafts/mine', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { step: 2, formData: { customerName: 'API Draft Test', pickupLocation: 'Indore' } },
    });
    expect(saveRes.ok()).toBeTruthy();

    const fetched = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(fetched.step).toBe(2);
    expect(fetched.formData.customerName).toBe('API Draft Test');

    // Saving again overwrites the same single slot rather than creating a second row.
    await page.request.put('/api/booking-drafts/mine', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { step: 3, formData: { customerName: 'API Draft Test Updated' } },
    });
    const updated = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(updated.step).toBe(3);
    expect(updated.formData.customerName).toBe('API Draft Test Updated');

    await clearDraft(page, csrfToken);
    const clearedDraft = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(clearedDraft).toBeNull();
  });

  test('UI: filling in Trip Details auto-saves a draft; revisiting Add Booking offers to resume it, and Resume restores the fields', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    await clearDraft(page, csrfToken);

    const marker = String(Date.now());
    const day = new Date(); day.setDate(day.getDate() + 120 + Math.floor(Math.random() * 100));
    const dayStr = day.toISOString().slice(0, 10);

    await page.getByText('Add Booking').first().click();
    await expect(page).toHaveURL(/\/dashboard\/bookings$/);

    await page.getByLabel('Pickup Date').fill(dayStr);
    await page.getByLabel('Pickup Time').fill('10:00');
    await page.getByLabel('Return Date').fill(dayStr);
    await page.getByLabel('Return Time').fill('18:00');
    await page.getByLabel('From (Pickup Location)').fill(`Draft Persistence Test ${marker}`);
    await page.getByLabel('To (Drop-off Location)').fill('Ujjain');

    // Autosave is debounced (1.2s) — wait past it, then confirm the server
    // side actually holds this session's own in-progress data.
    await page.waitForTimeout(1800);
    const saved = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(saved?.formData?.pickupLocation).toBe(`Draft Persistence Test ${marker}`);

    // Simulate navigating away and coming back — a fresh mount of the same page.
    await page.goto('/dashboard/dashboard');
    await page.getByText('Add Booking').first().click();
    await expect(page).toHaveURL(/\/dashboard\/bookings$/);

    await expect(page.getByText('Resume your unfinished booking?')).toBeVisible();
    await page.getByRole('button', { name: 'Resume Booking' }).click();

    await expect(page.getByLabel('From (Pickup Location)')).toHaveValue(`Draft Persistence Test ${marker}`);
    await expect(page.getByLabel('Pickup Date')).toHaveValue(dayStr);
  });

  test('UI: "Start Fresh" discards the draft server-side, and it does not reappear', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    await clearDraft(page, csrfToken);

    await page.request.put('/api/booking-drafts/mine', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { step: 1, formData: { customerName: 'Discard Me', pickupLocation: 'Somewhere' } },
    });

    await page.getByText('Add Booking').first().click();
    await expect(page).toHaveURL(/\/dashboard\/bookings$/);
    await expect(page.getByText('Resume your unfinished booking?')).toBeVisible();

    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/booking-drafts/mine') && res.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'Start Fresh' }).click(),
    ]);

    await expect(page.getByLabel('From (Pickup Location)')).toHaveValue('');

    const afterDiscard = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(afterDiscard).toBeNull();
  });

  test('UI: submitting a real booking clears the draft automatically, without an explicit discard', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    await clearDraft(page, csrfToken);

    const marker = String(Date.now());
    const day = new Date(); day.setDate(day.getDate() + 130 + Math.floor(Math.random() * 100));
    const dayStr = day.toISOString().slice(0, 10);

    await page.getByText('Add Booking').first().click();
    await expect(page).toHaveURL(/\/dashboard\/bookings$/);

    await page.getByLabel('Pickup Date').fill(dayStr);
    await page.getByLabel('Pickup Time').fill('10:00');
    await page.getByLabel('Return Date').fill(dayStr);
    await page.getByLabel('Return Time').fill('18:00');
    await page.getByLabel('From (Pickup Location)').fill('Indore');
    await page.getByLabel('To (Drop-off Location)').fill('Ujjain');
    await page.waitForTimeout(1800);

    const midway = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(midway).not.toBeNull();

    await page.getByRole('button', { name: /Continue/i }).click();
    const noVehicles = await page.getByText('No vehicles available for selected dates').isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(noVehicles, 'No vehicle available for the randomly chosen far-future date in the shared dev DB — environmental, not a code issue.');

    await page.getByText('Self Drive').first().click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("By Day")').first().click();
    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();

    await page.getByLabel('Customer Name').fill(`Draft Submit ${marker}`);
    await page.getByLabel('Phone Number').fill('9' + marker.slice(-9));
    await page.getByRole('button', { name: /Review Booking/i }).click();

    const [bookingResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/bookings') && res.request().method() === 'POST'),
      page.getByRole('button', { name: /Confirm Booking/i }).click(),
    ]);
    expect(bookingResponse.ok()).toBeTruthy();
    await expect(page.getByText('Booking Confirmed Successfully!')).toBeVisible();

    const afterSubmit = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(afterSubmit).toBeNull();
  });

  test('UI: a Lead-conversion prefill session never shows the resume-draft prompt, regardless of any organic draft left over', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    // Deliberately leave a real draft in place — the point of this test is
    // that the Lead-conversion prefill path (initialValues set) is entirely
    // unaffected by draft persistence, one way or the other.
    await page.request.put('/api/booking-drafts/mine', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { step: 2, formData: { customerName: 'Should Never Surface Here', pickupLocation: 'Nowhere' } },
    });

    const marker = String(Date.now());
    const mobile = '9' + String(Date.now() + 1).slice(-9);
    const pickupDate = new Date(); pickupDate.setDate(pickupDate.getDate() + 140 + Math.floor(Math.random() * 100));
    const pickupDateStr = pickupDate.toISOString().slice(0, 10);
    const customerName = `Draft Guard Lead ${marker}`;

    const inquiry = await (await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerName, primaryMobile: mobile, source: 'whatsapp' },
    })).json();
    await page.request.patch(`/api/inquiries/${inquiry._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        pickupDate: `${pickupDateStr}T00:00:00.000Z`, pickupTime: '09:00',
        pickupLocation: 'Indore Airport', dropLocation: 'Ujjain',
        numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya', tripType: 'one_way',
      },
    });
    const qualifyRes = await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } });
    expect(qualifyRes.ok()).toBeTruthy();
    const convertRes = await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } });
    expect(convertRes.ok()).toBeTruthy();
    const converted = await convertRes.json();
    const leadId = converted.lead._id as string;
    await page.request.post(`/api/leads/${leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrfToken } });
    const quotation = await (await page.request.post(`/api/leads/${leadId}/quotations`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { options: [{ vehicleNameSnapshot: 'Honda City', quantity: 1, pricingType: 'fixed', baseRatePaise: 250000 }] },
    })).json();
    await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
    await page.request.post(`/api/quotations/${quotation._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'sent' } });
    await page.request.post(`/api/quotations/${quotation._id}/accept`, { headers: { 'X-CSRF-Token': csrfToken }, data: { acceptedOptionNumber: 1 } });

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();
    await page.getByRole('button', { name: 'Convert to Booking' }).click();

    await expect(page.locator('input[name="pickupLocation"]')).toHaveValue('Indore Airport');
    await expect(page.getByText('Resume your unfinished booking?')).not.toBeVisible();

    // The leftover organic draft must still be exactly as it was — untouched by this Lead session.
    const untouchedDraft = await (await page.request.get('/api/booking-drafts/mine')).json();
    expect(untouchedDraft?.formData?.customerName).toBe('Should Never Surface Here');

    await clearDraft(page, csrfToken);
  });
});
