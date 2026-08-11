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

async function createQualifiedLead(page: Page, csrfToken: string, customerName: string, mobile: string) {
  const inquiry = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { customerName, primaryMobile: mobile, source: 'whatsapp' },
  })).json();
  await page.request.patch(`/api/inquiries/${inquiry._id}`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      pickupDate: new Date(Date.now() + 24 * 24 * 3600 * 1000).toISOString(),
      pickupLocation: 'Indore Airport', numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya',
    },
  });
  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
  return { inquiry, leadId: converted.lead._id as string };
}

test.describe('Lead → Customer conversion (Phase 6)', () => {
  test('API: converting a lead with a brand-new phone number creates a real Customer, links both Lead and Inquiry, never deletes either', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const mobile = freshMobile();
    const { inquiry, leadId } = await createQualifiedLead(page, csrfToken, `New Customer Convert ${marker}`, mobile);

    const convertRes = await page.request.post(`/api/leads/${leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrfToken } });
    const result = await convertRes.json();
    expect(convertRes.ok(), JSON.stringify(result)).toBe(true);
    expect(result.wasCreated).toBe(true);
    expect(result.customer.name).toBe(`New Customer Convert ${marker}`);
    expect(result.customer.primaryMobile).toContain(mobile.slice(-10));
    expect(result.lead.linkedCustomerId).toBe(result.customer._id);

    // Neither the Inquiry nor the Lead was deleted — both remain, now linked.
    const inquiryAfter = await (await page.request.get(`/api/inquiries/${inquiry._id}`)).json();
    expect(inquiryAfter.linkedCustomerId).toBe(result.customer._id);
    const leadAfter = await (await page.request.get(`/api/leads/${leadId}`)).json();
    expect(leadAfter.linkedCustomerId).toBe(result.customer._id);

    // Duplicate conversion attempt is rejected, returning the existing link.
    const secondAttempt = await page.request.post(`/api/leads/${leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrfToken } });
    expect(secondAttempt.status()).toBe(400);
    const secondBody = await secondAttempt.json();
    expect(secondBody.customer._id).toBe(result.customer._id);

    // The conversion is reflected in the customer's timeline (spec §41),
    // assembled live from Inquiry/Lead, not a second stored copy.
    const timelineRes = await page.request.get(`/api/customers/${result.customer._id}/timeline`);
    expect(timelineRes.ok()).toBe(true);
    const events = await timelineRes.json();
    expect(events.some((e: any) => e.type === 'lead_converted_to_customer')).toBe(true);
    expect(events.some((e: any) => e.type === 'inquiry_converted_to_lead')).toBe(true);
  });

  test('API: converting a second lead with the SAME phone number links to the existing customer instead of creating a duplicate', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const sharedMobile = freshMobile();

    const first = await createQualifiedLead(page, csrfToken, `Repeat Contact A ${marker}`, sharedMobile);
    const firstConvert = await (await page.request.post(`/api/leads/${first.leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
    expect(firstConvert.wasCreated).toBe(true);

    const second = await createQualifiedLead(page, csrfToken, `Repeat Contact B ${marker}`, sharedMobile);
    const secondConvertRes = await page.request.post(`/api/leads/${second.leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrfToken } });
    const secondConvert = await secondConvertRes.json();
    expect(secondConvertRes.ok(), JSON.stringify(secondConvert)).toBe(true);
    expect(secondConvert.wasCreated).toBe(false);
    expect(secondConvert.customer._id).toBe(firstConvert.customer._id); // same customer, not a duplicate

    // Tenant-wide: only one Customer document exists for this phone number.
    const lookupRes = await page.request.get(`/api/customers/lookup?phone=${sharedMobile}`);
    const lookup = await lookupRes.json();
    expect(lookup.customer._id).toBe(firstConvert.customer._id);
  });

  test('UI: Convert to Customer from the Lead detail view opens the real Customer 360 dashboard', async ({ page }) => {
    test.setTimeout(30000);
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `UI Convert ${marker}`;
    await createQualifiedLead(page, csrfToken, customerName, freshMobile());

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();
    await page.getByRole('button', { name: 'Convert to Customer' }).click();

    await expect(page.getByText('New customer created')).toBeVisible({ timeout: 5000 });
    const customerDialog = page.getByRole('dialog', { name: 'Customer Dashboard' });
    await expect(customerDialog).toBeVisible();
    await expect(customerDialog.getByText(customerName)).toBeVisible();

    // Reopening the same lead now offers "Open Customer 360°" instead of
    // "Convert to Customer" — the action correctly reflects the new state.
    await customerDialog.getByRole('button', { name: /close/i }).click().catch(() => page.keyboard.press('Escape'));
    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();
    await expect(page.getByRole('button', { name: 'Open Customer 360°' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Convert to Customer' })).toHaveCount(0);
  });
});
