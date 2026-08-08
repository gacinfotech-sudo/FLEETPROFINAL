import { expect, Page, test } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('Google review requests are linked, idempotent and require evidence before received status', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const headers = { 'X-CSRF-Token': token };
  const marker = String(Date.now());
  const phone = `93${marker.slice(-8)}`;
  const date = new Date();
  date.setDate(date.getDate() + 25000 + Math.floor(Math.random() * 500));
  const dateStr = date.toISOString().slice(0, 10);

  const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dateStr}&returnDate=${dateStr}`)).json();
  expect(vehicles.length).toBeGreaterThan(0);
  const bookingResponse = await page.request.post('/api/bookings', {
    headers,
    data: {
      customerName: `Google Review ${marker}`, customerPhone: phone,
      pickupLocation: 'Ujjain', dropoffLocation: 'Indore', pickupDate: dateStr, pickupTime: '09:00',
      returnDate: dateStr, returnTime: '13:00', bookingType: 'self_drive', tripType: 'one_way',
      vehicleId: vehicles[0]._id, totalAmount: 1500, status: 'confirmed',
    },
  });
  expect(bookingResponse.ok()).toBe(true);
  const booking = await bookingResponse.json();
  const customer = (await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json()).customer;
  const reviewPageUrl = `https://g.page/r/fleetpro-${marker}/review`;
  const requestId = `review_${marker}`;

  const tooEarly = await page.request.post(`/api/customers/${customer._id}/google-reviews/request`, {
    headers, data: { bookingId: booking._id, channel: 'whatsapp', reviewPageUrl, requestId },
  });
  expect(tooEarly.status()).toBe(400);

  for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
    const response = await page.request.post(`/api/bookings/${booking._id}/status`, { headers, data: { status } });
    expect(response.ok()).toBe(true);
  }

  const unconfirmedManualRequest = await page.request.post(`/api/customers/${customer._id}/google-reviews/request`, {
    headers,
    data: { bookingId: booking._id, channel: 'email', reviewPageUrl, requestId: `manual_${marker}`, confirmedSent: false },
  });
  expect(unconfirmedManualRequest.status()).toBe(400);
  const unsafeReviewUrl = await page.request.post(`/api/customers/${customer._id}/google-reviews/request`, {
    headers,
    data: { bookingId: booking._id, channel: 'email', reviewPageUrl: 'https://example.com/not-google', requestId: `unsafe_${marker}`, confirmedSent: true },
  });
  expect(unsafeReviewUrl.status()).toBe(400);

  const sent = await page.request.post(`/api/customers/${customer._id}/google-reviews/request`, {
    headers, data: { bookingId: booking._id, channel: 'whatsapp', reviewPageUrl, requestId },
  });
  expect(sent.status()).toBe(201);
  const sentBody = await sent.json();
  expect(sentBody.review.reviewRequested).toBe(true);
  expect(sentBody.review.reviewReceived).toBe(false);
  expect(sentBody.review.requestSentThrough).toBe('whatsapp');
  expect(sentBody.review.requestHistory).toHaveLength(1);
  expect(sentBody.message.status).toBe('sent');
  const reviewId = sentBody.review._id;

  const duplicate = await page.request.post(`/api/customers/${customer._id}/google-reviews/request`, {
    headers, data: { bookingId: booking._id, channel: 'whatsapp', reviewPageUrl, requestId },
  });
  expect(duplicate.ok()).toBe(true);
  const duplicateBody = await duplicate.json();
  expect(duplicateBody.alreadyProcessed).toBe(true);
  expect(duplicateBody.review.requestHistory).toHaveLength(1);

  const messages = await (await page.request.get(`/api/customers/${customer._id}/messages`)).json();
  expect(messages.filter((message: any) => message.messageType === 'customer_google_review_request')).toHaveLength(1);
  const followUps = await (await page.request.get(`/api/customers/${customer._id}/follow-ups`)).json();
  expect(followUps.some((task: any) => task.taskType === 'Google review follow-up' && task.status === 'pending')).toBe(true);

  const noConfirmation = await page.request.put(`/api/customers/${customer._id}/google-reviews/${reviewId}/received`, {
    headers, data: { confirmedReceived: false, reviewRating: 5, reviewReference: `Screenshot ${marker}` },
  });
  expect(noConfirmation.status()).toBe(400);
  const noEvidence = await page.request.put(`/api/customers/${customer._id}/google-reviews/${reviewId}/received`, {
    headers, data: { confirmedReceived: true, reviewRating: 5 },
  });
  expect(noEvidence.status()).toBe(400);

  const received = await page.request.put(`/api/customers/${customer._id}/google-reviews/${reviewId}/received`, {
    headers,
    data: {
      confirmedReceived: true, reviewRating: 5, reviewReference: `Google Business screenshot ${marker}`,
      reviewLink: `https://www.google.com/maps/reviews/${marker}`, responseStatus: 'pending',
    },
  });
  expect(received.ok()).toBe(true);
  const receivedBody = await received.json();
  expect(receivedBody.reviewReceived).toBe(true);
  expect(receivedBody.reviewRating).toBe(5);
  expect(receivedBody.followUpRequired).toBe(false);
  expect(receivedBody.reviewConfirmedBy.userId).toBe('qaclient');

  const afterReceivedTasks = await (await page.request.get(`/api/customers/${customer._id}/follow-ups`)).json();
  expect(afterReceivedTasks.find((task: any) => task.taskType === 'Google review follow-up').status).toBe('resolved');
  const responseUpdate = await page.request.put(`/api/customers/${customer._id}/google-reviews/${reviewId}`, {
    headers, data: { responseStatus: 'responded', notes: `Owner replied ${marker}` },
  });
  expect(responseUpdate.ok()).toBe(true);
  expect((await responseUpdate.json()).respondedAt).toBeTruthy();

  const timeline = await (await page.request.get(`/api/customers/${customer._id}/timeline`)).json();
  expect(timeline.some((event: any) => event.type === 'google_review_request' && event.bookingId === booking.bookingId)).toBe(true);
  expect(timeline.some((event: any) => event.type === 'google_review_received' && event.description.includes('5★'))).toBe(true);
  expect(timeline.some((event: any) => event.type === 'google_review_responded')).toBe(true);

  await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(dashboard.getByText('Google Review Tracking')).toBeVisible();
  await expect(dashboard.getByText('5★ received').first()).toBeVisible();
  await expect(dashboard.getByText(`Google Business screenshot ${marker}`)).toBeVisible();
  await expect(dashboard.getByText('Response: responded')).toBeVisible();
  await expect(dashboard.getByRole('link', { name: 'Open Google Review Page' })).toBeVisible();
});
