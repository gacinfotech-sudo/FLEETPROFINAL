import { expect, Page, test } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('verified reviews earn one configured bonus and pending-review campaigns target the right customers', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const headers = { 'X-CSRF-Token': token };
  const marker = String(Date.now());

  async function completedCustomer(suffix: string, dayOffset: number) {
    const phone = `92${String(Number(marker.slice(-8)) + dayOffset).slice(-8)}`;
    const day = new Date();
    day.setDate(day.getDate() + 27000 + dayOffset);
    const dayString = day.toISOString().slice(0, 10);
    const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dayString}&returnDate=${dayString}`)).json();
    expect(vehicles.length).toBeGreaterThan(0);
    const response = await page.request.post('/api/bookings', {
      headers,
      data: {
        customerName: `Review Reward ${suffix} ${marker}`, customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain', pickupDate: dayString, pickupTime: '09:00',
        returnDate: dayString, returnTime: '13:00', bookingType: 'self_drive', tripType: 'one_way',
        vehicleId: vehicles[0]._id, totalAmount: 1200, status: 'confirmed',
      },
    });
    const booking = await response.json();
    expect(response.ok(), JSON.stringify(booking)).toBe(true);
    for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
      const transition = await page.request.post(`/api/bookings/${booking._id}/status`, { headers, data: { status } });
      expect(transition.ok(), `Transition to ${status} failed`).toBe(true);
    }
    const customer = (await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json()).customer;
    const consent = await page.request.post(`/api/customers/${customer._id}/consent`, {
      headers, data: { channel: 'promotional', source: 'manual' },
    });
    expect(consent.ok()).toBe(true);
    return { booking, customer, phone };
  }

  const reviewed = await completedCustomer('Reviewed', 11);
  const pending = await completedCustomer('Pending', 29);
  const beforeRewards = await (await page.request.get(`/api/customers/${reviewed.customer._id}/rewards`)).json();
  const configuredBonus = Number(beforeRewards.rule.reviewBonusPoints);
  expect(configuredBonus).toBeGreaterThan(0);

  const request = await page.request.post(`/api/customers/${reviewed.customer._id}/google-reviews/request`, {
    headers,
    data: {
      bookingId: reviewed.booking._id, channel: 'whatsapp',
      reviewPageUrl: `https://g.page/r/reward-${marker}/review`, requestId: `reward_${marker}`,
    },
  });
  const requestBody = await request.json();
  expect(request.status(), JSON.stringify(requestBody)).toBe(201);

  // A one-star review is deliberately used to prove the bonus rewards
  // verified participation, not only positive sentiment.
  const received = await page.request.put(`/api/customers/${reviewed.customer._id}/google-reviews/${requestBody.review._id}/received`, {
    headers,
    data: {
      confirmedReceived: true, reviewRating: 1,
      reviewReference: `Verified screenshot ${marker}`, responseStatus: 'pending',
    },
  });
  const receivedBody = await received.json();
  expect(received.ok(), JSON.stringify(receivedBody)).toBe(true);
  expect(receivedBody.rewardTransactionId.transactionType).toBe('review_bonus');
  expect(receivedBody.rewardTransactionId.points).toBe(configuredBonus);

  const afterFirstCredit = await (await page.request.get(`/api/customers/${reviewed.customer._id}/rewards`)).json();
  expect(afterFirstCredit.balance).toBe(beforeRewards.balance + configuredBonus);
  expect(afterFirstCredit.transactions.filter((tx: any) => tx.transactionType === 'review_bonus')).toHaveLength(1);

  const retry = await page.request.put(`/api/customers/${reviewed.customer._id}/google-reviews/${requestBody.review._id}/received`, {
    headers,
    data: { confirmedReceived: true, reviewRating: 1, reviewReference: `Verified screenshot ${marker}` },
  });
  expect(retry.ok()).toBe(true);
  const afterRetry = await (await page.request.get(`/api/customers/${reviewed.customer._id}/rewards`)).json();
  expect(afterRetry.balance).toBe(afterFirstCredit.balance);
  expect(afterRetry.transactions.filter((tx: any) => tx.transactionType === 'review_bonus')).toHaveLength(1);

  const segments = await (await page.request.get('/api/customers/segments')).json();
  const pendingSegment = segments.find((segment: any) => segment.key === 'google_review_pending');
  expect(pendingSegment?.label).toBe('Google Review Pending');
  expect(pendingSegment.count).toBeGreaterThan(0);
  const pendingCustomers = await (await page.request.get('/api/customers?segment=google_review_pending')).json();
  expect(pendingCustomers.some((customer: any) => customer._id === pending.customer._id)).toBe(true);
  expect(pendingCustomers.some((customer: any) => customer._id === reviewed.customer._id)).toBe(false);

  const invalidCampaign = await page.request.post('/api/campaigns', {
    headers,
    data: {
      name: `Invalid segment ${marker}`, targetType: 'segment', targetKey: 'typo_segment',
      offerType: 'announcement', messageTemplate: 'This must never target all customers.',
    },
  });
  expect(invalidCampaign.status()).toBe(400);

  const campaignResponse = await page.request.post('/api/campaigns', {
    headers,
    data: {
      name: `Pending review campaign ${marker}`, targetType: 'segment', targetKey: 'google_review_pending',
      offerType: 'announcement', messageTemplate: 'Hi {{name}}, please share your honest trip feedback.',
    },
  });
  const campaign = await campaignResponse.json();
  expect(campaignResponse.ok(), JSON.stringify(campaign)).toBe(true);
  const preview = await (await page.request.get(`/api/campaigns/${campaign._id}/preview`)).json();
  expect(preview.totalTargeted).toBe(pendingCustomers.length);
  expect(preview.eligible).toBeGreaterThan(0);

  const send = await page.request.post(`/api/campaigns/${campaign._id}/send`, { headers });
  expect(send.ok(), JSON.stringify(await send.json())).toBe(true);
  const recipients = await (await page.request.get(`/api/campaigns/${campaign._id}/recipients`)).json();
  const recipientIds = recipients.map((recipient: any) => recipient.customerId?._id || recipient.customerId);
  expect(recipientIds).toContain(pending.customer._id);
  expect(recipientIds).not.toContain(reviewed.customer._id);

  await page.locator('nav').getByRole('button', { name: 'Campaigns' }).click();
  await page.getByRole('button', { name: 'New Campaign' }).click();
  const campaignDialog = page.getByRole('dialog');
  await campaignDialog.locator('button[role="combobox"]').nth(2).click();
  await expect(page.getByRole('option', { name: /Google Review Pending/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(reviewed.phone);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(dashboard.getByText('review bonus', { exact: false }).first()).toBeVisible();
  await expect(dashboard.getByText(`+${configuredBonus} review reward points`)).toBeVisible();
});
