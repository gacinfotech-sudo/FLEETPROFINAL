import { expect, Page, test } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('Raju exact Customer 360 acceptance scenario links every module without duplicates', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const headers = { 'X-CSRF-Token': token };
  const marker = String(Date.now());
  const phone = `91${marker.slice(-8)}`;
  const tripDate = new Date();
  tripDate.setDate(tripDate.getDate() + 31000 + Math.floor(Math.random() * 300));
  const tripDay = tripDate.toISOString().slice(0, 10);

  const [vehicles, drivers] = await Promise.all([
    page.request.get(`/api/vehicles/available?pickupDate=${tripDay}&pickupTime=08:00&returnDate=${tripDay}&returnTime=12:00`).then((response) => response.json()),
    page.request.get(`/api/drivers/available?pickupDate=${tripDay}&pickupTime=08:00&returnDate=${tripDay}&returnTime=12:00`).then((response) => response.json()),
  ]);
  const swift = vehicles.find((vehicle: any) => /swift|dzire/i.test(`${vehicle.make} ${vehicle.vehicleModel}`));
  const amit = drivers.find((driver: any) => /amit/i.test(driver.name));
  expect(swift, 'Exact scenario requires Swift Dzire').toBeTruthy();
  expect(amit, 'Exact scenario requires Amit').toBeTruthy();

  const bookingResponse = await page.request.post('/api/bookings', {
    headers,
    data: {
      customerName: 'Raju', customerPhone: phone, customerEmail: `raju-${marker}@example.com`,
      pickupLocation: 'Ujjain', dropoffLocation: 'Indore', pickupDate: tripDay, pickupTime: '08:00',
      returnDate: tripDay, returnTime: '12:00', bookingType: 'with_driver', tripType: 'one_way',
      vehicleId: swift._id, driverId: amit._id, totalAmount: 1500, tollCharges: 150, status: 'confirmed',
    },
  });
  const booking = await bookingResponse.json();
  expect(bookingResponse.ok(), JSON.stringify(booking)).toBe(true);
  expect(booking.customerId).toBeTruthy();
  expect(booking.totalAmount).toBe(1500);
  expect(booking.tollCharges).toBe(150);

  const initialLookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
  const customer = initialLookup.customer;
  expect(customer.name).toBe('Raju');
  expect(customer.customerStatus).toBe('new');
  expect(customer._id).toBe(booking.customerId);

  const advanceRequestId = `raju_advance_${marker}`;
  const advanceResponse = await page.request.post(`/api/bookings/${booking._id}/payments`, {
    headers,
    data: {
      amount: 500, paymentType: 'advance', paymentMode: 'upi', transactionReference: `RAJU-ADV-${marker}`,
      receivedBy: 'Acceptance Desk', requestId: advanceRequestId,
    },
  });
  const advance = await advanceResponse.json();
  expect(advanceResponse.ok(), JSON.stringify(advance)).toBe(true);
  expect(advance.summary.totalReceived).toBe(500);
  expect(advance.summary.remainingBalance).toBe(1000);

  expect((await page.request.post(`/api/bookings/${booking._id}/status`, { headers, data: { status: 'ready_for_dispatch' } })).ok()).toBe(true);
  expect((await page.request.post(`/api/bookings/${booking._id}/start`, { headers, data: { startOdometer: 25000 } })).ok()).toBe(true);
  expect((await page.request.post(`/api/bookings/${booking._id}/complete`, { headers, data: { endOdometer: 24999 } })).status()).toBe(409);
  expect((await page.request.post(`/api/bookings/${booking._id}/complete`, { headers, data: { endOdometer: 25065 } })).ok()).toBe(true);
  expect((await page.request.post(`/api/bookings/${booking._id}/complete`, { headers, data: { endOdometer: 25065 } })).ok()).toBe(true);

  const storedBooking = (await (await page.request.get('/api/bookings')).json()).find((row: any) => row._id === booking._id);
  expect(storedBooking.status).toBe('completed');
  expect(storedBooking.driverId?._id || storedBooking.driverId).toBe(amit._id);
  expect(storedBooking.vehicleId?._id || storedBooking.vehicleId).toBe(swift._id);
  expect(storedBooking.startOdometer).toBe(25000);
  expect(storedBooking.endOdometer).toBe(25065);
  expect(storedBooking.totalKilometers).toBe(65);
  expect(storedBooking.advanceReceived).toBe(500);
  const completionTasks = await (await page.request.get(`/api/customers/${customer._id}/follow-ups`)).json();
  expect(completionTasks.filter((task: any) => (task.bookingId?._id || task.bookingId) === booking._id)).toHaveLength(3);

  const billingResponse = await page.request.post(`/api/customers/${customer._id}/billing-profiles`, {
    headers,
    data: {
      label: 'Raju Personal', customerKind: 'individual', billingName: 'Raju',
      billingAddress: 'Ujjain, Madhya Pradesh', billingEmail: `raju-${marker}@example.com`, isDefault: true,
    },
  });
  const billing = await billingResponse.json();
  expect(billingResponse.status(), JSON.stringify(billing)).toBe(201);

  const invoicePayload = {
    bookingId: booking._id, billingProfileId: billing._id, documentType: 'non_gst_invoice',
    discount: 0, tollParkingTreatment: 'separate_non_taxable',
    serviceDescription: 'Ujjain to Indore transport with Amit and Swift Dzire',
    paymentTerms: 'Due on completion', upiId: 'fleetprotest@upi',
  };
  const preview = await (await page.request.post(`/api/customers/${customer._id}/invoices/preview`, { headers, data: invoicePayload })).json();
  expect(preview.customerSnapshot.name).toBe('Raju');
  expect(preview.billingSnapshot.billingName).toBe('Raju');
  expect(preview.bookingSnapshot.bookingNumber).toBe(booking.bookingId);
  expect(preview.bookingSnapshot.vehicle.registration).toBe(swift.licensePlate);
  expect(preview.taxableAmount).toBe(1350);
  expect(preview.tollAmount).toBe(150);
  expect(preview.totalAmount).toBe(1500);
  expect(preview.amountReceived).toBe(500);
  expect(preview.balanceDue).toBe(1000);

  const invoiceResponse = await page.request.post(`/api/customers/${customer._id}/invoices`, { headers, data: invoicePayload });
  const invoiceResult = await invoiceResponse.json();
  expect(invoiceResponse.status(), JSON.stringify(invoiceResult)).toBe(201);
  const invoice = invoiceResult.invoice;
  const duplicateInvoice = await (await page.request.post(`/api/customers/${customer._id}/invoices`, { headers, data: invoicePayload })).json();
  expect(duplicateInvoice.alreadyExists).toBe(true);
  expect(duplicateInvoice.invoice._id).toBe(invoice._id);
  expect((await page.request.post(`/api/invoices/${invoice._id}/finalize`, { headers, data: {} })).ok()).toBe(true);
  expect((await page.request.put(`/api/invoices/${invoice._id}`, { headers, data: { serviceDescription: 'Must not overwrite finalized invoice' } })).status()).toBe(409);

  const feedbackResponse = await page.request.post(`/api/customers/${customer._id}/feedback`, {
    headers,
    data: {
      bookingId: booking._id, type: 'feedback', overallRating: 4, driverRating: 5, vehicleRating: 4, serviceRating: 4,
      driverPunctualityRating: 5, driverBehaviourRating: 5, driverSafetyRating: 5,
      vehicleCleanlinessRating: 4, vehicleComfortRating: 4, vehicleAcRating: 4, vehicleConditionRating: 4,
      wouldBookAgain: true, wouldRecommend: true, comments: `Raju acceptance feedback ${marker}`,
    },
  });
  const feedback = await feedbackResponse.json();
  expect(feedbackResponse.status(), JSON.stringify(feedback)).toBe(201);
  expect(feedback.driverId._id).toBe(amit._id);
  expect(feedback.vehicleId._id).toBe(swift._id);
  expect((await page.request.post(`/api/customers/${customer._id}/feedback`, {
    headers, data: { bookingId: booking._id, type: 'feedback', driverRating: 1 },
  })).status()).toBe(409);

  const invalidComplaint = await page.request.post(`/api/customers/${customer._id}/complaints`, {
    headers,
    data: { bookingId: booking._id, category: 'service_delay', severity: 'medium', description: 'Invalid category must fail safely.' },
  });
  expect(invalidComplaint.status()).toBe(400);
  const complaintResponse = await page.request.post(`/api/customers/${customer._id}/complaints`, {
    headers,
    data: {
      bookingId: booking._id, category: 'booking_issue', severity: 'medium',
      description: `Acceptance-linked complaint ${marker}`,
    },
  });
  const complaint = await complaintResponse.json();
  expect(complaintResponse.status(), JSON.stringify(complaint)).toBe(201);
  expect(complaint.driverId._id).toBe(amit._id);
  expect(complaint.vehicleId._id).toBe(swift._id);

  const [driverProfile, vehicleProfile] = await Promise.all([
    page.request.get(`/api/drivers/${amit._id}/customer-feedback-profile`).then((response) => response.json()),
    page.request.get(`/api/vehicles/${swift._id}/customer-feedback-profile`).then((response) => response.json()),
  ]);
  expect(driverProfile.averageRating).toBeGreaterThanOrEqual(1);
  expect(driverProfile.timeline.some((event: any) => event.recordId === feedback._id)).toBe(true);
  expect(driverProfile.timeline.some((event: any) => event.recordId === complaint._id)).toBe(true);
  expect(vehicleProfile.averageVehicleRating).toBeGreaterThanOrEqual(1);
  expect(vehicleProfile.totalKilometers).toBeGreaterThanOrEqual(65);
  expect(vehicleProfile.timeline.some((event: any) => event.recordId === feedback._id)).toBe(true);
  expect(vehicleProfile.timeline.some((event: any) => event.recordId === complaint._id)).toBe(true);

  const reviewRequest = await page.request.post(`/api/customers/${customer._id}/google-reviews/request`, {
    headers,
    data: {
      bookingId: booking._id, channel: 'whatsapp', reviewPageUrl: `https://g.page/r/raju-${marker}/review`,
      requestId: `raju_review_${marker}`,
    },
  });
  const reviewRequestBody = await reviewRequest.json();
  expect(reviewRequest.status(), JSON.stringify(reviewRequestBody)).toBe(201);
  const reviewReceived = await page.request.put(`/api/customers/${customer._id}/google-reviews/${reviewRequestBody.review._id}/received`, {
    headers,
    data: { confirmedReceived: true, reviewRating: 5, reviewReference: `Raju verified screenshot ${marker}`, responseStatus: 'pending' },
  });
  expect(reviewReceived.ok(), JSON.stringify(await reviewReceived.json())).toBe(true);

  expect((await page.request.post(`/api/customers/${customer._id}/consent`, {
    headers, data: { channel: 'promotional', source: 'manual' },
  })).ok()).toBe(true);
  const offerRequestId = `raju_offer_${marker}`;
  const offerResponse = await page.request.post(`/api/customers/${customer._id}/whatsapp/send`, {
    headers, data: { templateKey: 'loyalty_offer', bookingId: booking._id, requestId: offerRequestId },
  });
  const offer = await offerResponse.json();
  expect(offerResponse.ok(), JSON.stringify(offer)).toBe(true);
  expect(offer.messageDoc.status).toBe('sent');
  const duplicateOffer = await (await page.request.post(`/api/customers/${customer._id}/whatsapp/send`, {
    headers, data: { templateKey: 'loyalty_offer', bookingId: booking._id, requestId: offerRequestId },
  })).json();
  expect(duplicateOffer.alreadySent).toBe(true);

  const finalRequestId = `raju_final_${marker}`;
  const finalPaymentData = {
    amount: 1000, paymentType: 'final_payment', paymentMode: 'bank_transfer',
    transactionReference: `RAJU-FINAL-${marker}`, receivedBy: 'Acceptance Desk', requestId: finalRequestId,
  };
  const finalPayment = await page.request.post(`/api/bookings/${booking._id}/payments`, { headers, data: finalPaymentData });
  const finalPaymentBody = await finalPayment.json();
  expect(finalPayment.ok(), JSON.stringify(finalPaymentBody)).toBe(true);
  expect(finalPaymentBody.summary.remainingBalance).toBe(0);
  const duplicatePayment = await (await page.request.post(`/api/bookings/${booking._id}/payments`, { headers, data: finalPaymentData })).json();
  expect(duplicatePayment.alreadyRecorded).toBe(true);
  expect(duplicatePayment.transaction._id).toBe(finalPaymentBody.transaction._id);
  const primaryPayments = await (await page.request.get(`/api/bookings/${booking._id}/payments`)).json();
  expect(primaryPayments).toHaveLength(2);
  expect(primaryPayments.reduce((sum: number, payment: any) => sum + payment.amount, 0)).toBe(1500);
  const settledInvoice = await (await page.request.get(`/api/invoices/${invoice._id}`)).json();
  expect(settledInvoice.currentAmountReceived).toBe(1500);
  expect(settledInvoice.currentBalanceDue).toBe(0);

  const repeatDate = new Date(tripDate);
  repeatDate.setDate(repeatDate.getDate() + 2);
  const repeatDay = repeatDate.toISOString().slice(0, 10);
  const repeatBookingResponse = await page.request.post('/api/bookings', {
    headers,
    data: {
      customerName: 'Raju', customerPhone: phone, pickupLocation: 'Indore', dropoffLocation: 'Omkareshwar',
      pickupDate: repeatDay, pickupTime: '09:00', returnDate: repeatDay, returnTime: '12:00',
      bookingType: 'self_drive', tripType: 'one_way', vehicleId: swift._id, totalAmount: 900, status: 'confirmed',
    },
  });
  const repeatBooking = await repeatBookingResponse.json();
  expect(repeatBookingResponse.ok(), JSON.stringify(repeatBooking)).toBe(true);
  expect(repeatBooking.customerId).toBe(customer._id);
  for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
    expect((await page.request.post(`/api/bookings/${repeatBooking._id}/status`, { headers, data: { status } })).ok()).toBe(true);
  }
  expect((await page.request.post(`/api/bookings/${repeatBooking._id}/payments`, {
    headers,
    data: {
      amount: 900, paymentType: 'final_payment', paymentMode: 'upi', transactionReference: `RAJU-REPEAT-${marker}`,
      receivedBy: 'Acceptance Desk', requestId: `raju_repeat_payment_${marker}`,
    },
  })).ok()).toBe(true);

  const finalLookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
  expect(finalLookup.customer._id).toBe(customer._id);
  expect(finalLookup.customer.customerStatus).toBe('repeat');
  expect(finalLookup.customer.totalBookings).toBe(2);
  const customerMatches = await (await page.request.get(`/api/customers?search=${phone}`)).json();
  expect(customerMatches.filter((row: any) => row._id === customer._id)).toHaveLength(1);
  const history = await (await page.request.get(`/api/customers/${customer._id}/bookings`)).json();
  expect(history.map((row: any) => row._id)).toEqual(expect.arrayContaining([booking._id, repeatBooking._id]));

  const rewards = await (await page.request.get(`/api/customers/${customer._id}/rewards`)).json();
  expect(rewards.transactions.filter((row: any) => row.transactionType === 'booking_reward')).toHaveLength(2);
  expect(rewards.transactions.filter((row: any) => row.transactionType === 'review_bonus')).toHaveLength(1);
  expect(rewards.balance).toBe(rewards.transactions.reduce((sum: number, row: any) => sum + row.points, 0));
  const finances = await (await page.request.get(`/api/customers/${customer._id}/financial-summary`)).json();
  expect(finances.totalPendingDue).toBe(0);
  expect(finances.netCollectedAmount).toBe(2400);

  const campaignResponse = await page.request.post('/api/campaigns', {
    headers,
    data: {
      name: `Raju repeat campaign ${marker}`, targetType: 'segment', targetKey: 'repeat', offerType: 'announcement',
      messageTemplate: 'Namaste {{name}} ji, thank you for booking with us again.',
    },
  });
  const campaign = await campaignResponse.json();
  expect(campaignResponse.ok(), JSON.stringify(campaign)).toBe(true);
  expect((await page.request.post(`/api/campaigns/${campaign._id}/send`, { headers })).ok()).toBe(true);
  const recipients = await (await page.request.get(`/api/campaigns/${campaign._id}/recipients`)).json();
  expect(recipients.some((recipient: any) => (recipient.customerId?._id || recipient.customerId) === customer._id)).toBe(true);

  const messages = await (await page.request.get(`/api/customers/${customer._id}/messages`)).json();
  expect(messages.filter((message: any) => message.messageType === 'customer_loyalty_offer')).toHaveLength(1);
  const reviews = await (await page.request.get(`/api/customers/${customer._id}/google-reviews`)).json();
  expect(reviews.filter((review: any) => review.reviewReceived)).toHaveLength(1);
  const feedbackRows = await (await page.request.get(`/api/customers/${customer._id}/feedback`)).json();
  expect(feedbackRows.filter((row: any) => row.bookingId?._id === booking._id)).toHaveLength(1);
  const invoiceRows = await (await page.request.get(`/api/customers/${customer._id}/invoices`)).json();
  expect(invoiceRows.filter((row: any) => row._id === invoice._id)).toHaveLength(1);
  const timeline = await (await page.request.get(`/api/customers/${customer._id}/timeline`)).json();
  const timelineTypes = timeline.map((event: any) => event.type);
  for (const type of ['booking_created', 'booking_status', 'payment', 'reward', 'feedback', 'complaint', 'follow_up', 'invoice', 'google_review_request', 'google_review_received']) {
    expect(timelineTypes).toContain(type);
  }

  await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(dashboard.getByText('Raju', { exact: true }).first()).toBeVisible();
  await expect(dashboard.getByText('Complete Payment Ledger')).toBeVisible();
  await expect(dashboard.getByText('Invoices & Billing Profiles')).toBeVisible();
  await expect(dashboard.getByText('Drivers Who Served This Customer')).toBeVisible();
  await expect(dashboard.getByText('Vehicles Used by This Customer')).toBeVisible();
  await expect(dashboard.getByText('Google Review Tracking')).toBeVisible();
  await expect(dashboard.getByText(amit.name, { exact: true }).first()).toBeVisible();
  await expect(dashboard.getByText(swift.licensePlate, { exact: false }).first()).toBeVisible();
  await expect(dashboard.getByText(/25,000 → 25,065 \(65 km\)/).first()).toBeVisible();
  await expect(dashboard.getByText(invoice.invoiceNumber, { exact: true })).toBeVisible();
  await expect(dashboard.getByText('5★ received').first()).toBeVisible();
  await expect(dashboard.getByText('review bonus', { exact: false }).first()).toBeVisible();
});
