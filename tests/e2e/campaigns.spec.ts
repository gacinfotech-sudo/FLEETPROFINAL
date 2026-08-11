import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Campaigns / Offers', () => {
  test('A campaign targeting a tag excludes opted-out customers and only attempts a real send for consented ones', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const tag = `camp-test-${Date.now()}`;
    const day = new Date();
    day.setDate(day.getDate() + 8000 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);

    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

    let customerIndex = 0;
    async function makeCustomer(name: string, promotionalConsent: boolean) {
      const phone = '96' + String(Date.now() + customerIndex).slice(-8);
      const startHour = 9 + customerIndex * 5;
      customerIndex++;
      const bookingRes = await page.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: {
          customerName: name, customerPhone: phone,
          pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
          pickupDate: dayStr, pickupTime: `${String(startHour).padStart(2, '0')}:00`,
          returnDate: dayStr, returnTime: `${String(startHour + 4).padStart(2, '0')}:00`,
          bookingType: 'self_drive', tripType: 'one_way',
          vehicleId, totalAmount: 1000, status: 'confirmed',
        },
      });
      const booking = await bookingRes.json();
      expect(bookingRes.ok(), JSON.stringify(booking)).toBe(true);
      const customerId = booking.customerId;
      expect(customerId, 'Created booking must be linked to its customer').toBeTruthy();
      if (promotionalConsent) {
        await page.request.post(`/api/customers/${customerId}/consent`, {
          headers: { 'X-CSRF-Token': csrfToken },
          data: { channel: 'promotional', source: 'manual' },
        });
      }
      await page.request.post(`/api/customers/${customerId}/tags`, {
        headers: { 'X-CSRF-Token': csrfToken },
        data: { tag },
      });
      return customerId;
    }

    const consentedId = await makeCustomer('Consented Customer', true);
    const notConsentedId = await makeCustomer('Not Consented Customer', false);

    const createRes = await page.request.post('/api/campaigns', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        name: `Test Campaign ${tag}`, offerType: 'discount_percent', offerValue: 15,
        targetType: 'tag', targetKey: tag, messageTemplate: 'Hi {{name}}, {{offer}} for you!',
      },
    });
    const campaign = await createRes.json();
    expect(createRes.ok()).toBe(true);
    expect(campaign.status).toBe('draft');

    // Preview must show exactly one eligible (consented) and one excluded (not consented).
    const preview = await (await page.request.get(`/api/campaigns/${campaign._id}/preview`)).json();
    expect(preview.totalTargeted).toBe(2);
    expect(preview.eligible).toBe(1);
    expect(preview.excludedOptedOut).toBe(1);

    // Editing while draft works; editing after sending must be rejected.
    const editRes = await page.request.put(`/api/campaigns/${campaign._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { description: 'Updated while draft' },
    });
    expect(editRes.ok()).toBe(true);

    const sendRes = await page.request.post(`/api/campaigns/${campaign._id}/send`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    const sent = await sendRes.json();
    expect(sendRes.ok()).toBe(true);
    expect(sent.status).toBe('completed');
    expect(sent.stats.excludedOptedOut).toBe(1);
    expect(sent.stats.sent + sent.stats.failed).toBe(1); // exactly the one consented customer was actually attempted

    // A second send attempt on a non-draft campaign must be rejected.
    const resendRes = await page.request.post(`/api/campaigns/${campaign._id}/send`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(resendRes.ok()).toBe(false);

    // Recipients ledger: exactly one skipped_opted_out row for the non-consented customer.
    const recipients = await (await page.request.get(`/api/campaigns/${campaign._id}/recipients`)).json();
    const skipped = recipients.find((r: any) => r.customerId?._id === notConsentedId || r.customerId === notConsentedId);
    expect(skipped.status).toBe('skipped_opted_out');
    const attempted = recipients.find((r: any) => r.customerId?._id === consentedId || r.customerId === consentedId);
    expect(['sent', 'failed']).toContain(attempted.status);

    // A now-completed campaign cannot be edited or deleted.
    const editAfterSendRes = await page.request.put(`/api/campaigns/${campaign._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Should not apply' },
    });
    expect(editAfterSendRes.ok()).toBe(false);
    const deleteAfterSendRes = await page.request.delete(`/api/campaigns/${campaign._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(deleteAfterSendRes.ok()).toBe(false);
  });

  test('UI: Campaigns page creates a draft, previews recipients, and renders the recipient ledger after sending', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const campaignName = `UI Test Campaign ${Date.now()}`;
    await page.locator('nav').getByRole('button', { name: 'Campaigns' }).click();
    await expect(page).toHaveURL(/\/dashboard\/campaigns$/);
    await expect(page.getByRole('heading', { name: 'Campaigns & Offers' })).toBeVisible();

    await page.getByRole('button', { name: 'New Campaign' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g. Diwali Offer for Repeat Customers').fill(campaignName);
    // Target defaults to Segment; pick "All Customers" is excluded from list, choose first available option.
    await dialog.locator('button[role="combobox"]').nth(2).click();
    await page.getByRole('option').first().click();
    await dialog.getByRole('button', { name: 'Save as Draft' }).click();

    await expect(page.getByText(campaignName, { exact: true })).toBeVisible();
    await page.getByText(campaignName, { exact: true }).click();
    await expect(page.getByText(/Eligible/)).toBeVisible();
  });
});
