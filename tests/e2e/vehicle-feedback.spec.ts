import { expect, Page, test } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('vehicle feedback links Customer, Booking and Fleet profiles with odometer-based performance', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const headers = { 'X-CSRF-Token': token };
  const marker = String(Date.now());
  const phone = `92${marker.slice(-8)}`;
  const date = new Date();
  date.setDate(date.getDate() + 23000 + Math.floor(Math.random() * 500));
  const dateStr = date.toISOString().slice(0, 10);
  const month = dateStr.slice(0, 7);

  const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dateStr}&returnDate=${dateStr}`)).json();
  expect(vehicles.length).toBeGreaterThan(1);
  const vehicle = vehicles.find((row: any) => row.licensePlate === 'MP09AB1234')
    || vehicles.find((row: any) => /swift|dzire/i.test(`${row.make} ${row.vehicleModel}`))
    || vehicles[0];
  const unrelatedVehicle = vehicles.find((row: any) => row._id !== vehicle._id);
  const drivers = await (await page.request.get(`/api/drivers/available?pickupDate=${dateStr}&pickupTime=08:00&returnDate=${dateStr}&returnTime=12:00`)).json();
  expect(drivers.length).toBeGreaterThan(0);

  const bookingResponse = await page.request.post('/api/bookings', {
    headers,
    data: {
      customerName: `Vehicle Feedback ${marker}`, customerPhone: phone,
      pickupLocation: 'Ujjain', dropoffLocation: 'Indore', pickupDate: dateStr, pickupTime: '08:00',
      returnDate: dateStr, returnTime: '12:00', bookingType: 'with_driver', tripType: 'one_way',
      vehicleId: vehicle._id, driverId: drivers[0]._id, totalAmount: 1500, tollCharges: 150, status: 'confirmed',
    },
  });
  expect(bookingResponse.ok()).toBe(true);
  const booking = await bookingResponse.json();
  const customer = (await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json()).customer;

  const ready = await page.request.post(`/api/bookings/${booking._id}/status`, { headers, data: { status: 'ready_for_dispatch' } });
  expect(ready.ok()).toBe(true);
  const started = await page.request.post(`/api/bookings/${booking._id}/start`, { headers, data: { startOdometer: 25000 } });
  expect(started.ok()).toBe(true);
  const completed = await page.request.post(`/api/bookings/${booking._id}/complete`, { headers, data: { endOdometer: 25065 } });
  expect(completed.ok()).toBe(true);
  const baselineProfile = await (await page.request.get(`/api/vehicles/${vehicle._id}/customer-feedback-profile`)).json();

  const feedbackResponse = await page.request.post(`/api/customers/${customer._id}/feedback`, {
    headers,
    data: {
      bookingId: booking._id, type: 'feedback', vehicleRating: 4, serviceRating: 4,
      vehicleCleanlinessRating: 5, vehicleComfortRating: 4, vehicleAcRating: 3, vehicleConditionRating: 4,
      vehicleIssueReported: true, breakdownOccurred: true,
      vehicleIssueDescription: `AC stopped during trip ${marker}`,
      comments: `Vehicle feedback ${marker}`,
    },
  });
  expect(feedbackResponse.status()).toBe(201);
  const feedback = await feedbackResponse.json();
  expect(feedback.customerId).toBe(customer._id);
  expect(feedback.bookingId._id).toBe(booking._id);
  expect(feedback.vehicleId._id).toBe(vehicle._id);

  const duplicate = await page.request.post(`/api/customers/${customer._id}/feedback`, {
    headers, data: { bookingId: booking._id, type: 'feedback', vehicleRating: 5 },
  });
  expect(duplicate.status()).toBe(409);

  const complaintResponse = await page.request.post(`/api/customers/${customer._id}/complaints`, {
    headers,
    data: { bookingId: booking._id, category: 'vehicle_breakdown', severity: 'high', description: `Breakdown complaint ${marker}` },
  });
  expect(complaintResponse.status()).toBe(201);
  const complaint = await complaintResponse.json();
  expect(complaint.vehicleId._id).toBe(vehicle._id);
  expect(complaint.responsibleParty).toBe('unclear');

  let profile = await (await page.request.get(`/api/vehicles/${vehicle._id}/customer-feedback-profile`)).json();
  expect(profile.totalCustomersServed).toBeGreaterThanOrEqual(1);
  expect(profile.totalTrips).toBeGreaterThanOrEqual(1);
  expect(profile.completedTrips).toBeGreaterThanOrEqual(1);
  expect(profile.totalKilometers).toBeGreaterThanOrEqual(65);
  expect(profile.averageVehicleRating).toBeGreaterThanOrEqual(1);
  expect(profile.cleanlinessRating).toBeGreaterThanOrEqual(1);
  expect(profile.comfortRating).toBeGreaterThanOrEqual(1);
  expect(profile.acRating).toBeGreaterThanOrEqual(1);
  expect(profile.conditionRating).toBeGreaterThanOrEqual(1);
  expect(profile.feedbackIssueCount).toBe(baselineProfile.feedbackIssueCount + 1);
  expect(profile.feedbackBreakdownCount).toBe(baselineProfile.feedbackBreakdownCount + 1);
  expect(profile.awaitingResponsibilityCount).toBe(baselineProfile.awaitingResponsibilityCount + 1);
  expect(profile.verifiedVehicleFaultComplaints).toBe(baselineProfile.verifiedVehicleFaultComplaints);
  const feedbackEvent = profile.timeline.find((event: any) => event.recordId === feedback._id);
  expect(feedbackEvent).toBeTruthy();
  expect(feedbackEvent.ratings).toEqual(expect.objectContaining({ overall: 4, cleanliness: 5, comfort: 4, ac: 3, condition: 4 }));

  const noEvidence = await page.request.put(`/api/customers/${customer._id}/complaints/${complaint._id}`, {
    headers, data: { responsibleParty: 'vehicle' },
  });
  expect(noEvidence.status()).toBe(400);
  const verifyResponsibility = await page.request.put(`/api/customers/${customer._id}/complaints/${complaint._id}`, {
    headers,
    data: { responsibleParty: 'vehicle', responsibilityReason: 'Workshop inspection confirms compressor failure.' },
  });
  expect(verifyResponsibility.ok()).toBe(true);
  profile = await (await page.request.get(`/api/vehicles/${vehicle._id}/customer-feedback-profile`)).json();
  expect(profile.verifiedVehicleFaultComplaints).toBe(baselineProfile.verifiedVehicleFaultComplaints + 1);
  expect(profile.breakdownComplaintCount).toBe(baselineProfile.breakdownComplaintCount + 1);

  const unrelatedProfile = await (await page.request.get(`/api/vehicles/${unrelatedVehicle._id}/customer-feedback-profile`)).json();
  expect(unrelatedProfile.timeline.some((event: any) => event.recordId === feedback._id || event.recordId === complaint._id)).toBe(false);

  const customerVehicles = await (await page.request.get(`/api/customers/${customer._id}/vehicles`)).json();
  const customerVehicle = customerVehicles.find((row: any) => row.vehicle._id === vehicle._id);
  expect(customerVehicle.totalTrips).toBe(1);
  expect(customerVehicle.totalKilometers).toBe(65);
  expect(customerVehicle.averageVehicleRating).toBe(4);
  expect(customerVehicle.tripHistory[0].startOdometer).toBe(25000);
  expect(customerVehicle.tripHistory[0].endOdometer).toBe(25065);
  expect(customerVehicle.feedback.some((row: any) => row._id === feedback._id)).toBe(true);

  const monthly = await (await page.request.get(`/api/reports/vehicle-performance?month=${month}`)).json();
  const monthlyVehicle = monthly.vehicles.find((row: any) => row.vehicleId === vehicle._id);
  expect(monthlyVehicle.totalKilometers).toBeGreaterThanOrEqual(65);
  expect(monthlyVehicle.averageVehicleRating).toBe(4);
  expect(monthlyVehicle.cleanlinessRating).toBeGreaterThanOrEqual(1);
  expect(monthlyVehicle.verifiedVehicleIssueCount).toBeGreaterThanOrEqual(2);

  await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.locator('table tbody tr').first().click();
  const customerDashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(customerDashboard.getByText('Vehicles Used by This Customer')).toBeVisible();
  await expect(customerDashboard.getByText(vehicle.licensePlate, { exact: false }).first()).toBeVisible();
  await expect(customerDashboard.getByText(`Vehicle feedback ${marker}`, { exact: true }).first()).toBeVisible();
  await expect(customerDashboard.getByText(/25,000 → 25,065 \(65 km\)/).first()).toBeVisible();
  await page.keyboard.press('Escape');

  await page.locator('nav').getByRole('button', { name: 'View Fleet' }).click();
  const vehicleRow = page.locator('table tbody tr').filter({ hasText: vehicle.licensePlate }).first();
  await vehicleRow.getByRole('button', { name: 'View Profile' }).click();
  const vehicleDialog = page.getByRole('dialog', { name: 'Vehicle Profile' });
  await expect(vehicleDialog.getByText('Customer Feedback & Fleet Performance')).toBeVisible();
  await expect(vehicleDialog.getByText(`Vehicle feedback ${marker}`, { exact: true }).first()).toBeVisible();
  const relatedBookingRow = vehicleDialog.getByRole('row').filter({ hasText: booking.bookingId });
  await relatedBookingRow.getByRole('button', { name: 'Open Booking' }).click();
  const bookingDialog = page.getByRole('dialog', { name: 'Booking Details' });
  await expect(bookingDialog.getByText(booking.bookingId, { exact: true })).toBeVisible();
  await bookingDialog.getByRole('button', { name: 'Close' }).click();
  await expect(bookingDialog).toBeHidden();
  // Closing this nested booking view returns to the fleet list in the
  // existing dialog state, so wait for the parent modal to clear before
  // using sidebar navigation and avoid a modal focus-trap race.
  await expect(vehicleDialog).toBeHidden();

  await page.locator('nav').getByRole('button', { name: 'Vehicle Performance' }).click();
  await page.locator('input[type="month"]').fill(month);
  const performanceRow = page.locator('table tbody tr').filter({ hasText: vehicle.licensePlate }).first();
  await expect(performanceRow.getByText('Rating: 4 / 5')).toBeVisible();
  await expect(performanceRow.getByText(/verified issue/)).toBeVisible();

  // A later reassignment must not move preserved Fleet feedback to another vehicle.
  const reassign = await page.request.put(`/api/bookings/${booking._id}`, { headers, data: { vehicleId: unrelatedVehicle._id } });
  expect(reassign.ok()).toBe(true);
  const originalAfterReassignment = await (await page.request.get(`/api/vehicles/${vehicle._id}/customer-feedback-profile`)).json();
  const unrelatedAfterReassignment = await (await page.request.get(`/api/vehicles/${unrelatedVehicle._id}/customer-feedback-profile`)).json();
  expect(originalAfterReassignment.timeline.some((event: any) => event.recordId === feedback._id)).toBe(true);
  expect(unrelatedAfterReassignment.timeline.some((event: any) => event.recordId === feedback._id)).toBe(false);
});
