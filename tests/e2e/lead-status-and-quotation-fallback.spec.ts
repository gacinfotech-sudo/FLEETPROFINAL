import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function createLeadWithApprovedQuotation(page: Page, csrf: string, customerName: string, mobile: string) {
  const inquiry = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrf },
    data: { customerName, primaryMobile: mobile, source: 'whatsapp' },
  })).json();
  await page.request.patch(`/api/inquiries/${inquiry._id}`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { pickupDate: '2027-02-10T00:00:00.000Z', pickupLocation: 'Indore Airport', numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya' },
  });
  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrf } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrf } })).json();
  const leadId = converted.lead._id as string;
  await page.request.post(`/api/leads/${leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrf } });
  const quotation = await (await page.request.post(`/api/leads/${leadId}/quotations`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { options: [{ vehicleNameSnapshot: 'Innova Crysta', quantity: 1, pricingType: 'fixed', baseRatePaise: 600000 }] },
  })).json();
  await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrf } });
  return { leadId, quotationId: quotation._id as string };
}

test.describe('Lead status errors and stuck-quotation fallback (bug fixes)', () => {
  test('API: an invalid lead status transition returns a clean, structured message (not a raw JSON dump when surfaced client-side)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const { leadId } = await createLeadWithApprovedQuotation(page, csrf, `Invalid Transition Test ${marker}`, '9' + marker.slice(-9));

    const res = await page.request.patch(`/api/leads/${leadId}`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { status: 'converted_to_booking' }, // invalid direct jump from "new"
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_LEAD_TRANSITION');
    expect(body.message).toMatch(/Cannot move a lead from "new" to "converted_to_booking"/);
  });

  test('UI: an invalid lead status selection shows the clean rejection reason in the toast, not raw JSON', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `Invalid Transition UI ${marker}`;
    await createLeadWithApprovedQuotation(page, csrf, customerName, '9' + marker.slice(-9));

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    const row = page.locator('tr', { has: page.getByText(customerName) });
    await row.locator('select, [role="combobox"]').first().click();
    await page.getByRole('option', { name: 'converted to booking', exact: true }).click();

    // Two elements legitimately carry this text (the visible toast body and
    // its screen-reader-only live-region mirror) — .first() is enough here.
    const toast = page.getByText('Cannot move a lead from "new" to "converted_to_booking".').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
    // The bug being fixed: the raw JSON body must never appear in the toast.
    await expect(page.getByText('INVALID_LEAD_TRANSITION', { exact: false })).not.toBeVisible();
  });

  test('UI: an approved quotation with WhatsApp unavailable can be moved to "sent" manually, then accepted, then the lead converts to booking without the "No accepted quotation" block', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `Stuck Quotation UI ${marker}`;
    await createLeadWithApprovedQuotation(page, csrf, customerName, '9' + marker.slice(-9));

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();

    // The status Badge's text content is lowercase in the DOM ("approved")
    // with a CSS `capitalize` class doing the visual capitalization — an
    // exact, case-sensitive match against "Approved" would never match.
    await expect(page.getByText('approved', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark as Sent (manual)' })).toBeVisible();

    await page.getByRole('button', { name: 'Mark as Sent (manual)' }).click();
    await expect(page.getByText('Quotation marked as sent')).toBeVisible();
    await expect(page.getByText('sent', { exact: true })).toBeVisible();

    await page.getByText('Accept option...').click();
    await page.getByRole('option', { name: /Innova Crysta/i }).click();
    await page.getByRole('button', { name: 'Confirm Accept' }).click();
    await expect(page.getByText('Quotation accepted')).toBeVisible();

    await page.getByRole('button', { name: 'Convert to Booking' }).click();
    await expect(page.getByText('No accepted quotation')).not.toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/bookings$/, { timeout: 5000 });
  });
});
