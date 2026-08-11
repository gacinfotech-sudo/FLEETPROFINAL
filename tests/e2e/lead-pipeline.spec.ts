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

async function createQualifiedInquiry(page: Page, csrfToken: string, customerName: string) {
  const created = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { customerName, primaryMobile: freshMobile(), source: 'whatsapp' },
  })).json();
  await page.request.patch(`/api/inquiries/${created._id}`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      pickupDate: new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString(),
      pickupLocation: 'Indore Airport', numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya',
    },
  });
  const qualified = await (await page.request.post(`/api/inquiries/${created._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
  expect(qualified.status).toBe('qualified');
  return qualified;
}

test.describe('Lead pipeline (Phase 3)', () => {
  test('API: converting a qualified inquiry creates exactly one real Lead, referencing the inquiry (not duplicating its data)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());

    const inquiry = await createQualifiedInquiry(page, csrfToken, `Lead Convert ${marker}`);

    const convertRes = await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } });
    const result = await convertRes.json();
    expect(convertRes.ok(), JSON.stringify(result)).toBe(true);
    expect(result.lead).toBeTruthy();
    expect(result.lead.leadNumber).toMatch(/^LEAD-\d{4}$/);
    expect(result.lead.status).toBe('new');
    expect(result.lead.inquiryId).toBe(inquiry._id);

    // Fetch it back via the Leads list — confirms the real GET /api/leads
    // path works and correctly populates the linked inquiry's data (not a
    // duplicated copy — reading it live off the Inquiry record).
    const leadDetail = await (await page.request.get(`/api/leads/${result.lead._id}`)).json();
    expect(leadDetail.inquiryId.customerName).toBe(`Lead Convert ${marker}`);
    expect(leadDetail.inquiryId.pickupLocation).toBe('Indore Airport');

    // A second conversion attempt must fail — one Lead per Inquiry (unique index).
    const secondAttempt = await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } });
    expect(secondAttempt.status()).toBe(400);
  });

  test('API: Lead status transitions are validated, and mark-lost requires a reason', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const inquiry = await createQualifiedInquiry(page, csrfToken, `Lead Status ${Date.now()}`);
    const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
    const leadId = converted.lead._id;

    // Invalid jump: 'new' cannot go straight to 'converted_to_booking'.
    const badJump = await page.request.patch(`/api/leads/${leadId}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'converted_to_booking' },
    });
    expect(badJump.status()).toBe(400);

    // Valid path: new -> assigned -> quotation_draft.
    const step1 = await (await page.request.patch(`/api/leads/${leadId}`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'assigned' },
    })).json();
    expect(step1.status).toBe('assigned');
    const step2 = await (await page.request.patch(`/api/leads/${leadId}`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'quotation_draft' },
    })).json();
    expect(step2.status).toBe('quotation_draft');

    const noReason = await page.request.post(`/api/leads/${leadId}/mark-lost`, { headers: { 'X-CSRF-Token': csrfToken }, data: {} });
    expect(noReason.status()).toBe(400);

    const lost = await (await page.request.post(`/api/leads/${leadId}/mark-lost`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { lostReason: 'Vehicle unavailable for requested dates' },
    })).json();
    expect(lost.status).toBe('lost');
    expect(lost.lostReason).toBe('Vehicle unavailable for requested dates');
  });

  test('UI: convert an inquiry to a lead and see it on the Leads page with the linked inquiry data', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `UI Lead Convert ${marker}`;
    const inquiry = await createQualifiedInquiry(page, csrfToken, customerName);

    await page.goto('/dashboard/inquiries');
    await page.waitForLoadState('networkidle');
    const row = page.locator('tr', { hasText: customerName });
    await expect(row.getByText('qualified', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Convert to Lead' }).click();
    await expect(page.getByText('Converted to lead', { exact: true })).toBeVisible({ timeout: 5000 });

    await page.locator('nav').getByRole('button', { name: 'Leads' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(customerName).first()).toBeVisible({ timeout: 5000 });
    const leadRow = page.locator('tr', { hasText: customerName });
    await expect(leadRow.getByText('Indore Airport')).toBeVisible();
  });
});
