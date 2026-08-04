import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Invoice Settings + atomic financial-year-aware numbering', () => {
  test('Settings persist and are applied to newly generated invoice numbers and business snapshots (not nanoid, not retroactive)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const marker = String(Date.now());
    const patchRes = await page.request.patch('/api/invoice-settings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        legalCompanyName: `Numbering Test Co ${marker}`,
        gstNumber: '23AAAAA0000A1Z5',
        taxInvoicePrefix: `NT${marker.slice(-4)}`,
        bankAccountName: 'Test Holder', bankName: 'Test Bank', bankAccountNumber: '999888777',
        bankIfsc: 'TEST0009999', upiId: 'numberingtest@upi', defaultGstRate: 12,
      },
    });
    expect(patchRes.ok(), JSON.stringify(await patchRes.json())).toBe(true);

    const getRes = await page.request.get('/api/invoice-settings');
    const settings = await getRes.json();
    expect(settings.legalCompanyName).toBe(`Numbering Test Co ${marker}`);
    expect(settings.taxInvoicePrefix).toBe(`NT${marker.slice(-4)}`);

    const day = new Date();
    day.setDate(day.getDate() + 17500 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=09:00&returnDate=${dayStr}&returnTime=13:00`);
    const vehicles = await vehiclesRes.json();

    async function makeInvoice(customerName: string, vehicleIndex: number) {
      const bookingRes = await page.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: {
          customerName, customerPhone: '9' + String(Date.now() + vehicleIndex).slice(-9),
          pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
          pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
          bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[vehicleIndex]._id || vehicles[vehicleIndex].id,
          totalAmount: 1000, status: 'confirmed',
        },
      });
      const booking = await bookingRes.json();
      expect(bookingRes.ok(), JSON.stringify(booking)).toBe(true);
      const customerId = booking.customerId;
      const invoiceRes = await page.request.post(`/api/customers/${customerId}/invoices`, {
        headers: { 'X-CSRF-Token': csrfToken },
        data: { bookingId: booking._id, documentType: 'tax_invoice', serviceDescription: 'Numbering test service' },
      });
      const created = await invoiceRes.json();
      expect(invoiceRes.ok(), JSON.stringify(created)).toBe(true);
      // Numbering is deferred to finalization (see invoice-deferred-numbering.spec.ts)
      // — finalize here since this test is specifically checking the number format.
      const finalizeRes = await page.request.post(`/api/invoices/${created.invoice._id}/finalize`, { headers: { 'X-CSRF-Token': csrfToken } });
      const finalized = await finalizeRes.json();
      expect(finalizeRes.ok(), JSON.stringify(finalized)).toBe(true);
      return finalized;
    }

    const invoice1 = await makeInvoice('Numbering Test Customer 1', 0);
    const invoice2 = await makeInvoice('Numbering Test Customer 2', 1);

    // Real sequential financial-year-aware numbers, not nanoid randomness.
    const fyMatch = invoice1.invoiceNumber.match(/^([A-Z0-9]+)\/(\d{4}-\d{2})\/(\d{4})$/);
    expect(fyMatch, `unexpected format: ${invoice1.invoiceNumber}`).toBeTruthy();
    expect(invoice1.invoiceNumber.startsWith(`NT${marker.slice(-4)}/`)).toBe(true);
    const seq1 = parseInt(fyMatch![3], 10);
    const seq2Match = invoice2.invoiceNumber.match(/(\d{4})$/);
    const seq2 = parseInt(seq2Match![1], 10);
    expect(seq2).toBe(seq1 + 1);

    // businessSnapshot pulled from the newly saved settings, not hardcoded/old data.
    expect(invoice1.businessSnapshot.businessName).toBe(`Numbering Test Co ${marker}`);
    expect(invoice1.businessSnapshot.gstNumber).toBe('23AAAAA0000A1Z5');
    expect(invoice1.businessSnapshot.bankAccountNumber).toBe('999888777');
    expect(invoice1.upiId).toBe('numberingtest@upi');
    expect(invoice1.gstRate).toBe(12); // defaultGstRate from settings, not the old hardcoded 18

    // Changing settings again must NOT retroactively rewrite the first invoice's snapshot.
    await page.request.patch('/api/invoice-settings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { legalCompanyName: `Renamed Co ${marker}` },
    });
    const stillOld = await (await page.request.get(`/api/invoices/${invoice1._id}`)).json();
    expect(stillOld.businessSnapshot.businessName).toBe(`Numbering Test Co ${marker}`);
  });

  test('UI: Invoice Settings panel on Profile page saves and reloads real values', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const brandName = `UI Brand ${Date.now()}`;

    await page.locator('nav').getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByText('Invoice Settings', { exact: true })).toBeVisible();

    await page.getByLabel('Brand Name').fill(brandName);
    await page.getByRole('button', { name: 'Save Invoice Settings' }).click();
    await expect(page.getByText('Invoice settings saved')).toBeVisible({ timeout: 5000 });

    await page.reload();
    await expect(page.getByLabel('Brand Name')).toHaveValue(brandName, { timeout: 5000 });
  });
});
