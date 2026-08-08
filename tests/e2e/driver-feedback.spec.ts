import { expect, Page, test } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('driver feedback links Customer, Booking and Driver profiles without unverified blame', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const headers = { 'X-CSRF-Token': token };
  const marker = String(Date.now());
  const phone = `93${marker.slice(-8)}`;
  const date = new Date();
  date.setDate(date.getDate() + 19000 + Math.floor(Math.random() * 500));
  const dateStr = date.toISOString().slice(0, 10);
  const drivers = await (await page.request.get(`/api/drivers/available?pickupDate=${dateStr}&pickupTime=08:00&returnDate=${dateStr}&returnTime=12:00`)).json();
  expect(drivers.length).toBeGreaterThan(1);
  const driver = drivers.find((row: any) => /amit/i.test(row.name)) || drivers[0];
  const unrelatedDriver = drivers.find((row: any) => row._id !== driver._id);
  const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dateStr}&pickupTime=08:00&returnDate=${dateStr}&returnTime=12:00`)).json();
  expect(vehicles.length).toBeGreaterThan(0);

  const bookingResponse = await page.request.post('/api/bookings', {
    headers,
    data: {
      customerName: `Driver Feedback ${marker}`, customerPhone: phone,
      pickupLocation: 'Ujjain', dropoffLocation: 'Indore', pickupDate: dateStr, pickupTime: '08:00',
      returnDate: dateStr, returnTime: '12:00', bookingType: 'with_driver', tripType: 'one_way',
      vehicleId: vehicles[0]._id, driverId: driver._id, totalAmount: 1500, tollCharges: 150, status: 'confirmed',
    },
  });
  expect(bookingResponse.ok()).toBe(true);
  const booking = await bookingResponse.json();
  const customer = (await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json()).customer;

  const feedbackResponse = await page.request.post(`/api/customers/${customer._id}/feedback`, {
    headers,
    data: {
      bookingId: booking._id, type: 'appreciation', driverRating: 5, vehicleRating: 4, serviceRating: 5,
      driverPunctualityRating: 4, driverBehaviourRating: 5, driverSafetyRating: 4,
      driverRouteKnowledgeRating: 5, driverCommunicationRating: 5, driverAssistanceRating: 4,
      driverPaymentHandlingRating: 4, wouldBookAgain: true, wouldRecommend: true,
      comments: `Excellent driver assistance ${marker}`,
    },
  });
  expect(feedbackResponse.status()).toBe(201);
  const feedback = await feedbackResponse.json();
  expect(feedback.customerId).toBe(customer._id);
  expect(feedback.bookingId._id).toBe(booking._id);
  expect(feedback.driverId._id).toBe(driver._id);
  expect(feedback.vehicleId._id).toBe(vehicles[0]._id);

  const duplicate = await page.request.post(`/api/customers/${customer._id}/feedback`, {
    headers, data: { bookingId: booking._id, type: 'appreciation', driverRating: 5, comments: 'Duplicate' },
  });
  expect(duplicate.status()).toBe(409);

  const complaintResponse = await page.request.post(`/api/customers/${customer._id}/complaints`, {
    headers,
    data: { bookingId: booking._id, category: 'driver_late', severity: 'medium', description: `Reported delay ${marker}` },
  });
  expect(complaintResponse.status()).toBe(201);
  const complaint = await complaintResponse.json();
  expect(complaint.driverId._id).toBe(driver._id);
  expect(complaint.responsibleParty).toBe('unclear');

  let profile = await (await page.request.get(`/api/drivers/${driver._id}/customer-feedback-profile`)).json();
  expect(profile.totalCustomersServed).toBeGreaterThanOrEqual(1);
  expect(profile.totalTrips).toBeGreaterThanOrEqual(1);
  expect(profile.averageRating).toBe(5);
  expect(profile.punctualityRating).toBe(4);
  expect(profile.behaviourRating).toBe(5);
  expect(profile.drivingSafetyRating).toBe(4);
  expect(profile.routeKnowledgeRating).toBe(5);
  expect(profile.paymentHandlingRating).toBe(4);
  expect(profile.appreciationCount).toBeGreaterThanOrEqual(1);
  expect(profile.awaitingResponsibilityCount).toBeGreaterThanOrEqual(1);
  expect(profile.timeline.some((event: any) => event.recordId === feedback._id)).toBe(true);
  expect(profile.timeline.find((event: any) => event.recordId === complaint._id).responsibleParty).toBe('unclear');

  const noEvidence = await page.request.put(`/api/customers/${customer._id}/complaints/${complaint._id}`, {
    headers, data: { responsibleParty: 'driver' },
  });
  expect(noEvidence.status()).toBe(400);
  const verifyResponsibility = await page.request.put(`/api/customers/${customer._id}/complaints/${complaint._id}`, {
    headers,
    data: { responsibleParty: 'driver', responsibilityReason: 'Office call log confirms driver reported after agreed pickup time.' },
  });
  expect(verifyResponsibility.ok()).toBe(true);
  profile = await (await page.request.get(`/api/drivers/${driver._id}/customer-feedback-profile`)).json();
  expect(profile.verifiedDriverFaultComplaints).toBeGreaterThanOrEqual(1);
  expect(profile.verifiedLateArrivalCount).toBeGreaterThanOrEqual(1);

  const unrelatedProfile = await (await page.request.get(`/api/drivers/${unrelatedDriver._id}/customer-feedback-profile`)).json();
  expect(unrelatedProfile.timeline.some((event: any) => event.recordId === feedback._id || event.recordId === complaint._id)).toBe(false);

  const resolve = await page.request.put(`/api/customers/${customer._id}/complaints/${complaint._id}`, {
    headers,
    data: { status: 'resolved', responsibleParty: 'driver', responsibilityReason: 'Office call log confirms driver reported after agreed pickup time.', correctiveAction: 'apology', resolution: 'Driver counselled and customer informed.' },
  });
  expect(resolve.ok()).toBe(true);
  profile = await (await page.request.get(`/api/drivers/${driver._id}/customer-feedback-profile`)).json();
  expect(profile.timeline.find((event: any) => event.recordId === complaint._id).status).toBe('resolved');

  const customerDrivers = await (await page.request.get(`/api/customers/${customer._id}/drivers`)).json();
  const customerDriver = customerDrivers.find((row: any) => row.driver._id === driver._id);
  expect(customerDriver.totalTripsServed).toBe(1);
  expect(customerDriver.averageRating).toBe(5);
  expect(customerDriver.feedback.some((row: any) => row._id === feedback._id)).toBe(true);

  await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.locator('table tbody tr').first().click();
  const customerDashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(customerDashboard.getByText('Drivers Who Served This Customer')).toBeVisible();
  await expect(customerDashboard.getByText(driver.name, { exact: true }).first()).toBeVisible();
  await expect(customerDashboard.getByText(`Excellent driver assistance ${marker}`, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  await page.locator('nav').getByRole('button', { name: 'Manage Drivers' }).click();
  const driverRow = page.locator('table tbody tr').filter({ hasText: driver.name }).first();
  await driverRow.getByRole('button', { name: 'View Profile' }).click();
  const driverDialog = page.getByRole('dialog', { name: 'Driver Profile' });
  await expect(driverDialog.getByText('Customer Feedback & Service Analytics')).toBeVisible();
  await expect(driverDialog.getByText(`Excellent driver assistance ${marker}`, { exact: true }).first()).toBeVisible();
  const relatedBookingRow = driverDialog.getByRole('row').filter({ hasText: booking.bookingId });
  const openBooking = relatedBookingRow.getByRole('button', { name: 'Open Booking' });
  await expect(openBooking).toBeEnabled();
  await openBooking.click();
  const bookingDialog = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Allocation' }) });
  await expect(bookingDialog.getByText(booking.bookingId, { exact: true })).toBeVisible();

  // The feedback-time driver link is historical evidence. Reassigning the
  // booking later must not move the preserved feedback to the new driver.
  const reassign = await page.request.put(`/api/bookings/${booking._id}`, {
    headers, data: { driverId: unrelatedDriver._id },
  });
  expect(reassign.ok()).toBe(true);
  const originalAfterReassignment = await (await page.request.get(`/api/drivers/${driver._id}/customer-feedback-profile`)).json();
  const unrelatedAfterReassignment = await (await page.request.get(`/api/drivers/${unrelatedDriver._id}/customer-feedback-profile`)).json();
  expect(originalAfterReassignment.timeline.some((event: any) => event.recordId === feedback._id)).toBe(true);
  expect(unrelatedAfterReassignment.timeline.some((event: any) => event.recordId === feedback._id)).toBe(false);
});
