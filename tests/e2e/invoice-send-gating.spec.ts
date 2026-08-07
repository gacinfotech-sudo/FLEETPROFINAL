import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

// Spec §16: "Do not send unfinished Draft invoices by default." A draft
// invoice's Email/WhatsApp buttons must be visibly present (not silently
// removed — a missing button reads as a missing feature) but disabled
// with a clear reason, and become real clickable links only once the
// invoice is finalized.
test('UI: Email/WhatsApp are disabled with an explanatory tooltip on a draft invoice, and become real send links once finalized', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);
  const marker = Date.now();
  const customerName = `Send Gating Test ${marker}`;

  const day = new Date();
  day.setDate(day.getDate() + 19700 + Math.floor(Math.random() * 300));
  const dayStr = day.toISOString().slice(0, 10);
  const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=09:00&returnDate=${dayStr}&returnTime=13:00`);
  const vehicles = await vehiclesRes.json();
  const bookingRes = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      // customerEmail must be unique per run: findOrCreateCustomer (server/
      // services/customerService.ts) dedupes on email as well as phone, so
      // a hardcoded literal here would silently reuse whichever customer
      // first ran this test — with THEIR primaryMobile, not this run's
      // freshly generated one — and the search step below would (correctly)
      // find nothing for this run's phone number.
      customerName, customerPhone: '9' + String(Date.now()).slice(-9), customerEmail: `sendgating+${marker}@example.com`,
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
      bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id || vehicles[0].id,
      totalAmount: 1000, status: 'confirmed',
    },
  });
  const booking = await bookingRes.json();
  const createRes = await page.request.post(`/api/customers/${booking.customerId}/invoices`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { bookingId: booking._id, documentType: 'tax_invoice', serviceDescription: 'Send gating test service' },
  });
  const created = await createRes.json();
  expect(createRes.ok(), JSON.stringify(created)).toBe(true);

  await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(booking.customerPhone);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  // exact: true — a loose substring match on "View" also matches any
  // disabled button whose text contains "revieW" (e.g. Google Reviews'
  // "Send Review Request"), which can win the .first() race and hang the
  // click forever since that button is legitimately disabled here.
  await dashboard.getByRole('button', { name: 'View', exact: true }).first().click();
  const doc = page.getByRole('dialog', { name: 'Invoice Document' });

  // Draft state: both buttons visible but disabled, with a clear reason.
  const emailBtn = doc.getByRole('button', { name: 'Email' });
  const whatsappBtn = doc.getByRole('button', { name: 'WhatsApp' });
  await expect(emailBtn).toBeVisible();
  await expect(emailBtn).toBeDisabled();
  await expect(emailBtn).toHaveAttribute('title', /finalize/i);
  await expect(whatsappBtn).toBeVisible();
  await expect(whatsappBtn).toBeDisabled();
  await expect(whatsappBtn).toHaveAttribute('title', /finalize/i);

  // Finalize. The invoice viewer dialog stays open (finalizeMutation's
  // onSuccess re-sets viewingInvoice with the finalized doc in place —
  // client/src/components/customers/customer-invoices.tsx), so it already
  // reflects the finalized state; no need to close and reopen it via the
  // Customer Dashboard underneath (which Radix's modal stacking removes
  // from the accessibility tree while this dialog is on top of it anyway).
  await doc.getByRole('button', { name: 'Finalize & Lock' }).click();
  await expect(page.getByText('Invoice finalized and locked')).toBeVisible({ timeout: 5000 });

  const doc2 = page.getByRole('dialog', { name: 'Invoice Document' });
  const emailLink2 = doc2.getByRole('link', { name: /Email/ });
  const whatsappLink2 = doc2.getByRole('link', { name: /WhatsApp/ });
  await expect(emailLink2).toBeVisible();
  await expect(emailLink2).toHaveAttribute('href', /^mailto:/);
  await expect(whatsappLink2).toBeVisible();
  await expect(whatsappLink2).toHaveAttribute('href', /^https:\/\/wa\.me\//);
  // Buttons inside the links must not be disabled once finalized.
  await expect(emailLink2.getByRole('button')).toBeEnabled();
  await expect(whatsappLink2.getByRole('button')).toBeEnabled();
});
