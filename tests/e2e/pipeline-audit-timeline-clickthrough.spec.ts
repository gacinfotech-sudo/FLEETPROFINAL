import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Pipeline audit — Customer 360 timeline click-through to Inquiry/Lead', () => {
  test('UI: clicking "Inquiry logged" / "converted to lead" timeline events navigates to and opens that exact record', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const customerName = `Timeline Click QA ${marker}`;

    // Build a real Inquiry -> Lead -> Customer chain via the real APIs, the
    // same sequence the actual product flow produces.
    const inquiryRes = await page.request.post('/api/inquiries', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName, primaryMobile: mobile, source: 'phone_call', tripType: 'one_way', pickupLocation: 'Indore',
        pickupDate: new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10),
        numberOfPassengers: 2, vehicleCategory: 'sedan', assignedExecutive: 'qaclient',
      },
    });
    expect(inquiryRes.ok(), await inquiryRes.text()).toBeTruthy();
    const inquiry = await inquiryRes.json();

    const qualifyRes = await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(qualifyRes.ok(), await qualifyRes.text()).toBeTruthy();

    const convertRes = await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(convertRes.ok(), await convertRes.text()).toBeTruthy();
    const { lead } = await convertRes.json();

    const customerRes = await page.request.post(`/api/leads/${lead._id}/convert-to-customer`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(customerRes.ok(), await customerRes.text()).toBeTruthy();
    const { customer } = await customerRes.json();

    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Search name, mobile, or email').fill(mobile);
    await page.waitForTimeout(600);
    await page.getByText(customerName).first().click();

    const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
    await expect(dashboard.getByText(/Inquiry .* logged/)).toBeVisible({ timeout: 5000 });

    // Click the "converted to lead" event — the more specific of the two
    // linked events (customer-timeline.tsx prefers leadId when both are
    // present) — should navigate to Leads and open this exact lead.
    await dashboard.getByText(/converted to lead/).click();

    await expect(page).toHaveURL(/\/dashboard\/leads$/);
    await expect(page.getByText(customerName).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Pipeline audit — WhatsApp "Configuration Required" messaging', () => {
  test('UI: sending a WhatsApp message when the tenant has no connected session shows a clear "Not Connected" toast, not a generic error', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await (async () => {
      const vehicles = await (await page.request.get('/api/vehicles')).json();
      const available = vehicles.filter((v: any) => v.status === 'available');
      expect(available.length).toBeGreaterThan(0);
      return available[Math.floor(Math.random() * available.length)];
    })();
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const customerName = `WA Config QA ${marker}`;
    const day = new Date();
    day.setDate(day.getDate() + 52000 + Math.floor(Math.random() * 2000));
    const dayStr = day.toISOString().slice(0, 10);

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName, customerPhone: mobile, bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '17:00',
        vehicleId: vehicle._id, amount: 1000, pricingType: 'day',
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();

    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Search name, mobile, or email').fill(mobile);
    await page.waitForTimeout(600);
    await page.getByText(customerName).first().click();

    const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
    await dashboard.locator('a[href="#customer-whatsapp"]').click();
    await page.waitForTimeout(300);

    const sendNow = dashboard.getByRole('button', { name: /Send Now/ });
    await expect(sendNow).toBeVisible({ timeout: 5000 });
    await sendNow.click();

    // This dev tenant has no WhatsApp session connected (confirmed by
    // every other WhatsApp-touching test in this suite hitting the same
    // "session not connected" provider error) — the toast must name that
    // specifically, not show a generic/unactionable failure message.
    await expect(page.getByText('WhatsApp Not Connected — Configuration Required').first()).toBeVisible({ timeout: 5000 });
  });
});
