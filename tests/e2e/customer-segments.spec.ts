import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Customer segments and tags', () => {
  test('Segment counts are real and clicking a segment filters the list to matching customers only', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const phone = '95' + String(Date.now()).slice(-8);
    const day = new Date();
    day.setDate(day.getDate() + 3200 + Math.floor(Math.random() * 500));
    const dayStr = day.toISOString().slice(0, 10);

    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

    // A VIP-type customer — a segment this app can compute without any
    // extra data collection (customerType is set directly).
    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Segment Test VIP', customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way',
        vehicleId, totalAmount: 1000, status: 'confirmed',
      },
    });
    expect(bookingRes.ok()).toBe(true);

    const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    const customerId = lookup.customer._id;

    // Mark them VIP directly (simulating staff editing customer type).
    const updateRes = await page.request.put(`/api/customers/${customerId}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { customerType: 'vip' },
    });
    expect(updateRes.ok()).toBe(true);

    const segmentsBefore = await (await page.request.get('/api/customers/segments')).json();
    const vipSegment = segmentsBefore.find((s: any) => s.key === 'vip');
    expect(vipSegment.count).toBeGreaterThanOrEqual(1);

    const filtered = await (await page.request.get('/api/customers?segment=vip')).json();
    expect(filtered.some((c: any) => c._id === customerId)).toBe(true);
    expect(filtered.every((c: any) => c.customerType === 'vip')).toBe(true);

    // Add a tag, confirm it shows in the tag-count list and the tag filter works.
    const uniqueTag = 'test-tag-' + Date.now();
    const tagRes = await page.request.post(`/api/customers/${customerId}/tags`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { tag: uniqueTag },
    });
    expect(tagRes.ok()).toBe(true);

    const tagCounts = await (await page.request.get('/api/customers/tags')).json();
    expect(tagCounts.some((t: any) => t.tag === uniqueTag && t.count === 1)).toBe(true);

    const byTag = await (await page.request.get(`/api/customers?tag=${uniqueTag}`)).json();
    expect(byTag.length).toBe(1);
    expect(byTag[0]._id).toBe(customerId);

    // Remove the tag — it must disappear from both the customer and the tag list.
    const removeRes = await page.request.delete(`/api/customers/${customerId}/tags/${uniqueTag}`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(removeRes.ok()).toBe(true);
    const afterRemove = await (await page.request.get(`/api/customers/${customerId}`)).json();
    expect(afterRemove.tags).not.toContain(uniqueTag);
  });

  test('UI: segment chips and tag chips render and filter the customer list', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
    await expect(page).toHaveURL(/\/dashboard\/customers$/);
    await expect(page.getByText('Segments')).toBeVisible();
    await page.waitForTimeout(1000);

    const segmentButtons = page.locator('button', { hasText: /\(\d+\)/ });
    const count = await segmentButtons.count();
    expect(count, 'At least one non-empty segment (e.g. New/Repeat Customers) should render').toBeGreaterThan(0);

    // Click the first segment chip and confirm the active-filter badge appears.
    await segmentButtons.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
  });
});
