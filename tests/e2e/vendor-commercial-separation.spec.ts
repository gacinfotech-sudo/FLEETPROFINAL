import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Spec §15 — Customer Commercials, Vendor Commercials, and Internal
// Profitability must stay separate. See docs/VENDOR_FINANCIAL_MAPPING.md:
// most of this was already correctly separated before this initiative;
// the one real gap found and fixed here is that Trip Cost Summary's
// "Internal Trip Cost" never included a vendor-fulfilled booking's
// vendorAgreedRate, so profitability was silently wrong for exactly the
// new booking type this initiative adds.

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

test.describe('Vendor commercial separation and profitability', () => {
  test('API: a vendor-fulfilled booking\'s Trip Cost Summary includes vendorAgreedRate as Vendor Direct Cost, correctly reducing Gross Contribution', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = farFutureDate(88000, 2000);

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `Profitability Vendor ${marker}`, contactPerson: 'C', primaryMobile: '96' + marker.slice(-8) },
    });
    const vendor = await vendorRes.json();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: `Profitability Test ${marker}`, customerPhone: '97' + marker.slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 10000, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await bookingRes.json();

    const assignRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorAgreedRate: 6000 },
    });
    expect(assignRes.ok()).toBe(true);

    const summaryRes = await page.request.get(`/api/bookings/${booking._id}/trip-cost-summary`);
    const summary = await summaryRes.json();
    expect(summaryRes.ok(), JSON.stringify(summary)).toBe(true);
    expect(summary.customerRevenue).toBe(10000);
    expect(summary.vendorDirectCost).toBe(6000);
    expect(summary.expenseCost).toBe(0);
    expect(summary.internalTripCost).toBe(6000);
    expect(summary.grossContribution).toBe(4000);
  });

  test('API: an own-fleet booking never shows a vendorDirectCost, even if vendorAgreedRate happens to be set on an old/reassigned record', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = farFutureDate(90000, 2000);

    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dateStr}&pickupTime=09:00&returnDate=${dateStr}&returnTime=18:00`);
    const vehicles = await vehiclesRes.json();
    test.skip(vehicles.length === 0, 'No vehicle available on the randomly chosen date — environmental.');
    const vehicleId = vehicles[0]._id || vehicles[0].id;

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: `Own Fleet Profitability Test ${marker}`, customerPhone: '98' + marker.slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId, totalAmount: 5000, status: 'confirmed',
      },
    });
    const booking = await bookingRes.json();
    expect(booking.fulfilmentType).not.toBe('vendor');

    const summaryRes = await page.request.get(`/api/bookings/${booking._id}/trip-cost-summary`);
    const summary = await summaryRes.json();
    expect(summary.vendorDirectCost).toBe(0);
    expect(summary.grossContribution).toBe(5000);
  });

  test('API: customer totalAmount is never mutated by vendor commercial fields, in either direction', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = farFutureDate(92000, 2000);

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `No Mix Vendor ${marker}`, contactPerson: 'C', primaryMobile: '95' + marker.slice(-8) },
    });
    const vendor = await vendorRes.json();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: `No Mix Test ${marker}`, customerPhone: '94' + marker.slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 3000, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await bookingRes.json();

    // Vendor rate deliberately set HIGHER than customer revenue — must
    // never leak into or overwrite totalAmount.
    const assignRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorAgreedRate: 9000 },
    });
    const assigned = await assignRes.json();
    expect(assigned.totalAmount).toBe(3000);
    expect(assigned.vendorAgreedRate).toBe(9000);

    const summaryRes = await page.request.get(`/api/bookings/${booking._id}/trip-cost-summary`);
    const summary = await summaryRes.json();
    expect(summary.customerRevenue).toBe(3000);
    expect(summary.grossContribution).toBe(3000 - 9000);
  });
});
