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

test.describe('Inquiry CRM — Phase 1 (capture, qualify, convert, lost)', () => {
  test('API: create requires customer name and a valid 10-digit mobile', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const noName = await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { primaryMobile: freshMobile() },
    });
    expect(noName.status()).toBe(400);

    const badMobile = await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerName: 'Bad Mobile Test', primaryMobile: '12345' },
    });
    expect(badMobile.status()).toBe(400);
  });

  test('API: create → qualify blocked until required fields present → qualify succeeds → convert-to-lead is idempotent-guarded', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());

    const createRes = await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerName: `Qualify Flow ${marker}`, primaryMobile: freshMobile(), source: 'whatsapp' },
    });
    const inquiry = await createRes.json();
    expect(createRes.ok(), JSON.stringify(inquiry)).toBe(true);
    expect(inquiry.inquiryNumber).toMatch(/^INQ-\d{4}$/);
    expect(inquiry.status).toBe('new');

    // Not enough fields yet (no pickup date/location/passengers/vehicle/executive).
    const earlyQualify = await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(earlyQualify.status()).toBe(400);
    const earlyBody = await earlyQualify.json();
    expect(Array.isArray(earlyBody.missing)).toBe(true);
    expect(earlyBody.missing.length).toBeGreaterThan(0);

    // Fill in the rest via safe-merge PATCH — unrelated fields (customerName) must survive.
    const patchRes = await page.request.patch(`/api/inquiries/${inquiry._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        pickupDate: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
        pickupLocation: 'Indore Airport',
        numberOfPassengers: 6,
        vehicleCategory: '7-Seater',
        assignedExecutive: 'Priya',
      },
    });
    const patched = await patchRes.json();
    expect(patchRes.ok(), JSON.stringify(patched)).toBe(true);
    expect(patched.customerName).toBe(`Qualify Flow ${marker}`); // unrelated field preserved

    const qualifyRes = await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    const qualified = await qualifyRes.json();
    expect(qualifyRes.ok(), JSON.stringify(qualified)).toBe(true);
    expect(qualified.status).toBe('qualified');

    const convertRes = await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    const converted = await convertRes.json();
    expect(convertRes.ok(), JSON.stringify(converted)).toBe(true);
    expect(converted.status).toBe('converted_to_lead');
    expect(converted.convertedToLeadAt).toBeTruthy();

    // Duplicate conversion must be rejected, and the original Inquiry record
    // must still exist afterward (never deleted) — spec §10.
    const doubleConvert = await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(doubleConvert.status()).toBe(400);
    const stillThere = await (await page.request.get(`/api/inquiries/${inquiry._id}`)).json();
    expect(stillThere.status).toBe('converted_to_lead');
    expect(stillThere.inquiryNumber).toBe(inquiry.inquiryNumber);

    // A converted (terminal) inquiry can no longer be edited.
    const editAfterConvert = await page.request.patch(`/api/inquiries/${inquiry._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { notes: 'should be rejected' },
    });
    expect(editAfterConvert.status()).toBe(400);
  });

  test('API: mark-lost requires a reason, preserves the record, and can be reopened', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const createRes = await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerName: `Lost Flow ${Date.now()}`, primaryMobile: freshMobile() },
    });
    const inquiry = await createRes.json();

    const noReason = await page.request.post(`/api/inquiries/${inquiry._id}/mark-lost`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {},
    });
    expect(noReason.status()).toBe(400);

    const lostRes = await page.request.post(`/api/inquiries/${inquiry._id}/mark-lost`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { lostReason: 'Vehicle unavailable for requested dates' },
    });
    const lost = await lostRes.json();
    expect(lostRes.ok(), JSON.stringify(lost)).toBe(true);
    expect(lost.status).toBe('lost');
    expect(lost.lostReason).toBe('Vehicle unavailable for requested dates');

    const reopenRes = await page.request.post(`/api/inquiries/${inquiry._id}/reopen`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    const reopened = await reopenRes.json();
    expect(reopenRes.ok(), JSON.stringify(reopened)).toBe(true);
    expect(reopened.status).toBe('contacted');
  });

  test('API: sequential inquiry numbers are gap-free and unique per tenant', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const a = await (await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerName: 'Seq A', primaryMobile: freshMobile() },
    })).json();
    const b = await (await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerName: 'Seq B', primaryMobile: freshMobile() },
    })).json();

    const seqA = parseInt(a.inquiryNumber.split('-')[1], 10);
    const seqB = parseInt(b.inquiryNumber.split('-')[1], 10);
    expect(seqB).toBe(seqA + 1);
  });

  test('UI: full Quick Inquiry flow — existing-customer lookup, save, list refresh, qualify, mark lost', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    // Seed a real customer via a booking (existing, unmodified flow) so the
    // Inquiry form's phone-lookup panel has something real to find.
    const day = new Date();
    day.setDate(day.getDate() + 21000 + Math.floor(Math.random() * 300));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=09:00&returnDate=${dayStr}&returnTime=13:00`);
    const vehicles = await vehiclesRes.json();
    const seedMobile = freshMobile();
    const marker = String(Date.now());
    const customerName = `Existing Lookup Customer ${marker}`;
    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName, customerPhone: seedMobile,
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id || vehicles[0].id,
        totalAmount: 1000, status: 'confirmed',
      },
    });
    expect(bookingRes.ok()).toBe(true);

    await page.goto('/dashboard/inquiries');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'New Inquiry', exact: true }).click();

    await page.locator('#inq-mobile').fill(seedMobile);
    await page.locator('#inq-mobile').blur();
    await expect(page.getByText('Existing Customer Found')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Use This Customer' }).click();
    await expect(page.locator('#inq-name')).toHaveValue(customerName);

    await page.getByRole('button', { name: 'Save Inquiry' }).click();
    await expect(page.getByText('Inquiry saved')).toBeVisible({ timeout: 5000 });

    // List must show the new row without a manual refresh (query-key invalidation).
    await expect(page.getByText(customerName).first()).toBeVisible({ timeout: 5000 });
    const row = page.locator('tr', { hasText: customerName });
    await expect(row.getByText('new', { exact: true })).toBeVisible();

    // Mark lost from the UI.
    await row.getByRole('button', { name: 'Mark Lost' }).click();
    await page.getByLabel('Lost Reason *').fill('Customer went with a competitor');
    await page.getByRole('button', { name: 'Mark Lost' }).last().click();
    await expect(page.getByText('Inquiry marked lost')).toBeVisible({ timeout: 5000 });
    await expect(row.getByText('lost', { exact: true })).toBeVisible();
  });
});
