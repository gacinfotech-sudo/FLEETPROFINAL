import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test('Positive-feedback and unresolved-complaint segments are real, and the timeline assembles every real event', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);
  const phone = '93' + String(Date.now()).slice(-8);
  const day = new Date();
  day.setDate(day.getDate() + 4500 + Math.floor(Math.random() * 400));
  const dayStr = day.toISOString().slice(0, 10);

  const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
  const vehicles = await vehiclesRes.json();
  const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

  const bookingRes = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: 'Timeline Test Customer', customerPhone: phone,
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
      bookingType: 'self_drive', tripType: 'one_way',
      vehicleId, totalAmount: 1000, status: 'confirmed',
    },
  });
  const booking = await bookingRes.json();
  const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
  const customerId = lookup.customer._id;

  // A real status transition so booking.statusHistory has an entry — the
  // timeline's booking_status events are read straight from that array,
  // and it's only populated by actual transitionBooking() calls, not by
  // the initial status set at creation.
  await page.request.post(`/api/bookings/${booking._id}/status`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { status: 'ready_for_dispatch' },
  });

  // Positive feedback (avg >= 4).
  await page.request.post(`/api/customers/${customerId}/feedback`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { bookingId: booking._id, driverRating: 5, vehicleRating: 5, serviceRating: 4 },
  });

  // Unresolved complaint.
  await page.request.post(`/api/customers/${customerId}/complaints`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { bookingId: booking._id, category: 'other', severity: 'low', description: 'Minor issue, still open.' },
  });

  // A tag too, to exercise another timeline event type.
  await page.request.post(`/api/customers/${customerId}/tags`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { tag: 'timeline-test' },
  });

  const segments = await (await page.request.get('/api/customers/segments')).json();
  const positiveFeedback = segments.find((s: any) => s.key === 'positive_feedback');
  const unresolvedComplaints = segments.find((s: any) => s.key === 'unresolved_complaints');
  expect(positiveFeedback.count).toBeGreaterThanOrEqual(1);
  expect(unresolvedComplaints.count).toBeGreaterThanOrEqual(1);

  const positiveFiltered = await (await page.request.get('/api/customers?segment=positive_feedback')).json();
  expect(positiveFiltered.some((c: any) => c._id === customerId)).toBe(true);

  const unresolvedFiltered = await (await page.request.get('/api/customers?segment=unresolved_complaints')).json();
  expect(unresolvedFiltered.some((c: any) => c._id === customerId)).toBe(true);

  // Timeline must include every real event, newest first.
  const timeline = await (await page.request.get(`/api/customers/${customerId}/timeline`)).json();
  const types = timeline.map((e: any) => e.type);
  expect(types).toContain('customer_created');
  expect(types).toContain('booking_created');
  expect(types).toContain('booking_status');
  expect(types).toContain('feedback');
  expect(types).toContain('complaint');
  expect(types).toContain('tag');

  for (let i = 1; i < timeline.length; i++) {
    expect(new Date(timeline[i - 1].date).getTime()).toBeGreaterThanOrEqual(new Date(timeline[i].date).getTime());
  }
});
