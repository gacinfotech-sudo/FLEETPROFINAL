import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

// The core reason for deferring numbering to finalization: a draft that's
// created and simply left alone (never finalized) must NOT have reserved
// a real sequence number — otherwise a business's invoice series would
// have unexplained gaps every time someone opened "Create Invoice" and
// changed their mind, which auditors/GST filing flag as suspicious.
test.describe('Invoice numbering is deferred to finalization', () => {
  test('An unfinalized draft never consumes a sequence number — later finalized invoices stay gap-free', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const day = new Date();
    day.setDate(day.getDate() + 18000 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=09:00&returnDate=${dayStr}&returnTime=13:00`);
    const vehicles = await vehiclesRes.json();

    async function makeDraft(customerName: string, vehicleIndex: number) {
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
      const invoiceRes = await page.request.post(`/api/customers/${booking.customerId}/invoices`, {
        headers: { 'X-CSRF-Token': csrfToken },
        data: { bookingId: booking._id, documentType: 'tax_invoice', serviceDescription: 'Deferred numbering test' },
      });
      const created = await invoiceRes.json();
      expect(invoiceRes.ok(), JSON.stringify(created)).toBe(true);
      return created.invoice;
    }

    // Three drafts created; only the first and third are ever finalized —
    // the second is deliberately abandoned as a draft, simulating a
    // "changed my mind" real-world case.
    const draftA = await makeDraft('Deferred Numbering A', 0);
    const draftB = await makeDraft('Deferred Numbering B (abandoned)', 1);
    const draftC = await makeDraft('Deferred Numbering C', 2);

    expect(draftA.invoiceNumber).toBeFalsy();
    expect(draftB.invoiceNumber).toBeFalsy();
    expect(draftC.invoiceNumber).toBeFalsy();

    const finalizeA = await (await page.request.post(`/api/invoices/${draftA._id}/finalize`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
    // draftB is intentionally never finalized.
    const finalizeC = await (await page.request.post(`/api/invoices/${draftC._id}/finalize`, { headers: { 'X-CSRF-Token': csrfToken } })).json();

    const seqA = parseInt(finalizeA.invoiceNumber.match(/(\d{4})$/)[1], 10);
    const seqC = parseInt(finalizeC.invoiceNumber.match(/(\d{4})$/)[1], 10);
    // C is issued the very next number after A — B's abandonment left no gap.
    expect(seqC).toBe(seqA + 1);

    // The abandoned draft still exists (drafts aren't auto-deleted) but
    // permanently has no number.
    const stillDraftB = await (await page.request.get(`/api/invoices/${draftB._id}`)).json();
    expect(stillDraftB.status).toBe('draft');
    expect(stillDraftB.invoiceNumber).toBeFalsy();
  });

  test('UI: an unfinalized draft shows a clear placeholder instead of a blank or "undefined" number', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const customerName = `UI Deferred Draft ${Date.now()}`;

    const day = new Date();
    day.setDate(day.getDate() + 18500 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=09:00&returnDate=${dayStr}&returnTime=13:00`);
    const vehicles = await vehiclesRes.json();
    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName, customerPhone: '9' + String(Date.now()).slice(-9),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id || vehicles[0].id,
        totalAmount: 1000, status: 'confirmed',
      },
    });
    const booking = await bookingRes.json();
    await page.request.post(`/api/customers/${booking.customerId}/invoices`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { bookingId: booking._id, documentType: 'tax_invoice', serviceDescription: 'UI deferred numbering test' },
    });

    await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
    await page.getByPlaceholder('Search name, mobile, or email').fill(booking.customerPhone);
    // customers.tsx debounces the search box 350ms before re-querying; wait
    // for it to settle (and the "Updating results..." guard to clear) so this
    // doesn't click the still-rendered stale table and open the wrong record.
    await page.waitForTimeout(600);
    await page.locator('table tbody tr').first().click();
    const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
    await expect(dashboard.getByText('DRAFT (not yet numbered)')).toBeVisible();
    await expect(dashboard.getByText('undefined', { exact: true })).toHaveCount(0);
  });
});
