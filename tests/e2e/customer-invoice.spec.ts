import { expect, Page, test } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('billing profiles and immutable invoice lifecycle use booking and payment ledger data', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const headers = { 'X-CSRF-Token': token };
  const marker = String(Date.now());
  const phone = `95${marker.slice(-8)}`;
  const date = new Date();
  date.setDate(date.getDate() + 16000 + Math.floor(Math.random() * 500));
  const dateStr = date.toISOString().slice(0, 10);
  const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dateStr}&pickupTime=09:00&returnDate=${dateStr}&returnTime=13:00`)).json();
  expect(vehicles.length).toBeGreaterThan(0);

  const bookingResponse = await page.request.post('/api/bookings', {
    headers,
    data: {
      customerName: `Invoice Test ${marker}`, customerPhone: phone,
      customerEmail: `invoice-${marker}@example.com`, pickupLocation: 'Indore Airport', dropoffLocation: 'Ujjain',
      pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '13:00',
      bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id,
      totalAmount: 2360, tollCharges: 100, parkingCharges: 60, status: 'confirmed',
    },
  });
  expect(bookingResponse.ok()).toBe(true);
  const booking = await bookingResponse.json();
  const customer = (await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json()).customer;

  const paymentResponse = await page.request.post(`/api/bookings/${booking._id}/payments`, {
    headers,
    data: { amount: 500, paymentType: 'advance', paymentMode: 'upi', transactionReference: `INV-ADV-${marker}`, receivedBy: 'Invoice Desk' },
  });
  expect(paymentResponse.ok()).toBe(true);

  const personalResponse = await page.request.post(`/api/customers/${customer._id}/billing-profiles`, {
    headers,
    data: { label: 'Personal', customerKind: 'individual', billingName: customer.name, billingAddress: 'Vijay Nagar, Indore', billingEmail: customer.email },
  });
  expect(personalResponse.status()).toBe(201);
  const personal = await personalResponse.json();
  expect(personal.isDefault).toBe(true);

  const corporateResponse = await page.request.post(`/api/customers/${customer._id}/billing-profiles`, {
    headers,
    data: {
      label: 'Corporate GST', customerKind: 'company', billingName: 'Invoice Accounts', companyName: `Invoice Corp ${marker}`,
      gstNumber: '23AAAAA0000A1Z5', panNumber: 'AAAAA0000A', billingAddress: 'Scheme 54, Indore',
      billingEmail: `accounts-${marker}@example.com`, accountsContact: 'Accounts Manager', purchaseOrderNumber: `PO-${marker}`,
      paymentTerms: 'Net 15 days', creditPeriodDays: 15,
    },
  });
  expect(corporateResponse.status()).toBe(201);
  const corporate = await corporateResponse.json();
  expect(corporate.isDefault).toBe(false);
  expect((await page.request.post(`/api/customers/${customer._id}/billing-profiles/${corporate._id}/set-default`, { headers, data: {} })).ok()).toBe(true);

  const payload = {
    bookingId: booking._id, billingProfileId: corporate._id, documentType: 'tax_invoice', gstRate: 18,
    discount: 0, tollParkingTreatment: 'separate_non_taxable', serviceDescription: 'Airport transfer service',
    paymentTerms: 'Net 15 days', bankDetails: 'FleetPro Test Bank A/C 1234', upiId: 'fleetprotest@upi',
  };
  const previewResponse = await page.request.post(`/api/customers/${customer._id}/invoices/preview`, { headers, data: payload });
  expect(previewResponse.ok()).toBe(true);
  const preview = await previewResponse.json();
  expect(preview.billingSnapshot.companyName).toBe(`Invoice Corp ${marker}`);
  expect(preview.bookingSnapshot.bookingNumber).toBe(booking.bookingId);
  expect(preview.taxableAmount).toBe(1864.41);
  expect(preview.gstAmount).toBe(335.59);
  expect(preview.tollAmount).toBe(100);
  expect(preview.parkingAmount).toBe(60);
  expect(preview.totalAmount).toBe(2360);
  expect(preview.amountReceived).toBe(500);
  expect(preview.balanceDue).toBe(1860);

  const createResponse = await page.request.post(`/api/customers/${customer._id}/invoices`, { headers, data: payload });
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();
  expect(created.alreadyExists).toBe(false);
  const invoice = created.invoice;
  expect(invoice.status).toBe('draft');

  const duplicateResponse = await page.request.post(`/api/customers/${customer._id}/invoices`, { headers, data: payload });
  expect(duplicateResponse.status()).toBe(200);
  const duplicate = await duplicateResponse.json();
  expect(duplicate.alreadyExists).toBe(true);
  expect(duplicate.invoice._id).toBe(invoice._id);

  const finalizeResponse = await page.request.post(`/api/invoices/${invoice._id}/finalize`, { headers, data: {} });
  expect(finalizeResponse.ok()).toBe(true);
  const finalized = await finalizeResponse.json();
  expect(finalized.status).toBe('finalized');
  const immutableCompany = finalized.billingSnapshot.companyName;

  const editProfile = await page.request.put(`/api/customers/${customer._id}/billing-profiles/${corporate._id}`, {
    headers,
    data: { companyName: `Renamed Corp ${marker}`, billingAddress: 'A new address that must not rewrite old invoices' },
  });
  expect(editProfile.ok()).toBe(true);
  const storedFinal = await (await page.request.get(`/api/invoices/${invoice._id}`)).json();
  expect(storedFinal.billingSnapshot.companyName).toBe(immutableCompany);
  expect(storedFinal.billingSnapshot.billingAddress).toBe('Scheme 54, Indore');

  const forbiddenEdit = await page.request.put(`/api/invoices/${invoice._id}`, { headers, data: { serviceDescription: 'Illegal rewrite' } });
  expect(forbiddenEdit.status()).toBe(409);

  const finalPayment = await page.request.post(`/api/bookings/${booking._id}/payments`, {
    headers,
    data: { amount: 1860, paymentType: 'final_payment', paymentMode: 'bank_transfer', transactionReference: `INV-FINAL-${marker}`, receivedBy: 'Invoice Desk' },
  });
  expect(finalPayment.ok()).toBe(true);
  const settledInvoice = await (await page.request.get(`/api/invoices/${invoice._id}`)).json();
  expect(settledInvoice.amountReceived).toBe(500);
  expect(settledInvoice.balanceDue).toBe(1860);
  expect(settledInvoice.currentAmountReceived).toBe(2360);
  expect(settledInvoice.currentBalanceDue).toBe(0);

  const revisionResponse = await page.request.post(`/api/invoices/${invoice._id}/revise`, { headers, data: {} });
  expect(revisionResponse.status()).toBe(201);
  const revision = await revisionResponse.json();
  expect(revision.status).toBe('draft');
  expect(revision.parentInvoiceId).toBe(invoice._id);
  expect(revision.invoiceNumber).toContain(`${invoice.invoiceNumber}-R2`);
  expect(revision.billingSnapshot.companyName).toBe(immutableCompany);

  const noteResponse = await page.request.post(`/api/invoices/${invoice._id}/adjustment-note`, {
    headers,
    data: { noteType: 'credit_note', amount: 200, reason: 'Service recovery credit' },
  });
  expect(noteResponse.status()).toBe(201);
  const note = await noteResponse.json();
  expect(note.documentType).toBe('credit_note');
  expect(note.relatedInvoiceId).toBe(invoice._id);
  expect(note.totalAmount).toBe(200);
  expect((await page.request.post(`/api/invoices/${note._id}/finalize`, { headers, data: {} })).ok()).toBe(true);

  const invoices = await (await page.request.get(`/api/customers/${customer._id}/invoices`)).json();
  expect(invoices.filter((row: any) => row._id === invoice._id)).toHaveLength(1);
  expect(invoices.some((row: any) => row._id === revision._id)).toBe(true);
  expect(invoices.some((row: any) => row._id === note._id && row.status === 'finalized')).toBe(true);
  const timeline = await (await page.request.get(`/api/customers/${customer._id}/timeline`)).json();
  expect(timeline.some((event: any) => event.type === 'invoice' && event.description.includes(invoice.invoiceNumber))).toBe(true);

  await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(dashboard.getByText('Invoices & Billing Profiles')).toBeVisible();
  await expect(dashboard.getByText(invoice.invoiceNumber, { exact: true })).toBeVisible();
  await expect(dashboard.getByRole('button', { name: 'Create Invoice' }).first()).toBeEnabled();
  await dashboard.getByRole('button', { name: 'View' }).first().click();
  const document = page.getByRole('dialog', { name: 'Invoice Document' });
  await expect(document.getByText('UPI: fleetprotest@upi')).toBeVisible();
  await expect(document.getByAltText('UPI payment QR')).toBeVisible();
  await expect(document.getByRole('button', { name: 'PDF' })).toBeEnabled();
  await expect(document.getByRole('button', { name: 'Print' })).toBeEnabled();
  await expect(document.getByRole('button', { name: 'Email' })).toBeEnabled();
  await expect(document.getByRole('button', { name: 'WhatsApp' })).toBeEnabled();
});
