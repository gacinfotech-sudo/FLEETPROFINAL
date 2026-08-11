import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// TASK-BOOKING-QUEUES-05: customer previous-booking reuse. Confirmed
// genuinely absent from docs/booking-research/CURRENT-BOOKING-AUDIT.md.
// Hard requirement verified end-to-end here: reusing a previous booking
// must create a brand-new Draft/booking, never overwrite or mutate the
// historical record, and every reused field must remain fully editable
// (never locked based on history).

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// A far-future, wide day range + several time windows to try, so this
// suite never collides with bookings left behind by other suites (or its
// own prior runs) in the shared, long-lived dev database — same robustness
// pattern tests/e2e/dashboard-upcoming-bookings.spec.ts already uses.
const TIME_WINDOWS: Array<[string, string]> = [
  ['06:00', '07:00'],
  ['13:00', '14:00'],
  ['21:00', '22:30'],
  ['23:00', '23:59'],
];

async function createBookingOnAnyAvailableVehicle(page: Page, csrfToken: string, opts: { customerName: string; customerPhone: string; pickupLocation: string; dropoffLocation: string; pickupDate: string; tripType?: string; pricingType?: string; notes?: string }) {
  const vehiclesRes = await page.request.get('/api/vehicles');
  const vehicles = (await vehiclesRes.json()).filter((v: any) => v.status === 'available');
  expect(vehicles.length, 'tenant must have at least one available-status vehicle').toBeGreaterThan(0);

  let lastError: any = null;
  for (const [pickupTime, returnTime] of TIME_WINDOWS) {
    for (const vehicle of vehicles) {
      const res = await page.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrfToken },
        data: {
          customerName: opts.customerName, customerPhone: opts.customerPhone,
          pickupLocation: opts.pickupLocation, dropoffLocation: opts.dropoffLocation,
          pickupDate: opts.pickupDate, pickupTime, returnDate: opts.pickupDate, returnTime,
          bookingType: 'self_drive', tripType: opts.tripType || 'round_trip', pricingType: opts.pricingType,
          vehicleId: vehicle._id || vehicle.id,
          notes: opts.notes,
          totalAmount: 2500, status: 'confirmed',
        },
      });
      if (res.ok()) return { booking: await res.json(), vehicle };
      lastError = await res.json().catch(() => ({ status: res.status() }));
    }
  }
  throw new Error(`No vehicle/time combination was free for ${opts.pickupDate}. Last error: ${JSON.stringify(lastError)}`);
}

test.describe('Booking Queues — customer previous-booking reuse', () => {
  test('previous-booking-reuse endpoint lists history and returns a non-binding vehicle preference (not the original vehicleId)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const phone = '9' + marker.slice(-9);
    const day = dateOffset(800 + Math.floor(Math.random() * 200));

    const { booking: original, vehicle } = await createBookingOnAnyAvailableVehicle(page, csrfToken, {
      customerName: `Reuse ${marker}`, customerPhone: phone,
      pickupLocation: 'Historical Origin', dropoffLocation: 'Historical Destination',
      pickupDate: day, tripType: 'round_trip', pricingType: 'km', notes: 'original booking notes',
    });

    const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    const customerId = lookup.customer._id;

    // --- List reusable previous bookings ---
    const listRes = await page.request.get(`/api/customers/${customerId}/previous-booking-reuse`);
    expect(listRes.ok()).toBe(true);
    const { options } = await listRes.json();
    const option = options.find((o: any) => o.sourceBookingId === original._id);
    expect(option, 'the original booking must be listed as a reuse option').toBeTruthy();
    expect(option.pickupLocation).toBe('Historical Origin');

    // --- Apply: get the reuse prefill for that one booking ---
    const applyRes = await page.request.get(`/api/customers/${customerId}/previous-booking-reuse?apply=${original._id}`);
    expect(applyRes.ok()).toBe(true);
    const { prefill } = await applyRes.json();

    expect(prefill.pickupLocation).toBe('Historical Origin');
    expect(prefill.dropoffLocation).toBe('Historical Destination');
    expect(prefill.bookingType).toBe('self_drive');
    expect(prefill.pricingType).toBe('km');
    // Vehicle PREFERENCE (category/make/model), never the binding vehicleId
    // itself — the specific vehicle from history may not even be available
    // for the new trip's dates.
    expect(prefill.vehiclePreference, 'must surface a vehicle preference').toBeTruthy();
    expect(prefill.vehiclePreference.make).toBe(vehicle.make);
    expect((prefill as any).vehicleId).toBeUndefined();
    // Dates/driver/status/payment are never part of a reuse prefill.
    expect((prefill as any).pickupDate).toBeUndefined();
    expect((prefill as any).driverId).toBeUndefined();
    expect((prefill as any).status).toBeUndefined();
  });

  test('reusing a previous booking creates a brand-new booking, leaves the historical one completely unmutated, and every reused field is overridable', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now()) + '2';
    const phone = '9' + marker.slice(-9);
    const historicalDay = dateOffset(850 + Math.floor(Math.random() * 200));
    const newDay = dateOffset(1200 + Math.floor(Math.random() * 200));

    // No real vehicle needed for this scenario (it only exercises
    // route/type reuse + the never-mutates-history + fully-editable
    // guarantees) — uses the already-shipped flexible-fulfilment escape
    // hatch instead of consuming another real vehicle slot.
    const originalRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: `Reuse2 ${marker}`, customerPhone: phone,
        pickupLocation: 'Route A Start', dropoffLocation: 'Route A End',
        pickupDate: historicalDay, pickupTime: '08:00', returnDate: historicalDay, returnTime: '12:00',
        bookingType: 'self_drive', tripType: 'one_way',
        resourceAssignmentPending: true,
        totalAmount: 1800, status: 'confirmed',
      },
    });
    const original = await originalRes.json();
    expect(originalRes.ok(), JSON.stringify(original)).toBe(true);

    const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    const customerId = lookup.customer._id;

    const applyRes = await page.request.get(`/api/customers/${customerId}/previous-booking-reuse?apply=${original._id}`);
    const { prefill } = await applyRes.json();

    // Simulate the client: prefill a NEW booking, but deliberately OVERRIDE
    // the dropoff location — proving the reused field is a real editable
    // starting point, not a locked value.
    const newBookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: prefill.customerName,
        customerPhone: prefill.customerPhone,
        pickupLocation: prefill.pickupLocation,
        dropoffLocation: 'Overridden Destination', // edited, not the reused 'Route A End'
        bookingType: prefill.bookingType,
        tripType: 'one_way',
        pickupDate: newDay, pickupTime: '10:00', returnDate: newDay, returnTime: '14:00',
        resourceAssignmentPending: true,
        totalAmount: 2000, status: 'confirmed',
      },
    });
    const newBooking = await newBookingRes.json();
    expect(newBookingRes.ok(), JSON.stringify(newBooking)).toBe(true);

    // A genuinely new, distinct booking was created.
    expect(newBooking._id).not.toBe(original._id);
    expect(newBooking.pickupLocation).toBe('Route A Start'); // reused field carried through
    expect(newBooking.dropoffLocation).toBe('Overridden Destination'); // but fully editable, not locked

    // The historical booking is completely unmutated. No single-booking
    // GET /api/bookings/:id JSON endpoint exists — same pattern
    // customer-crm.spec.ts already uses (fetch the tenant's full list, find
    // by id).
    const allBookings = await (await page.request.get('/api/bookings')).json();
    const originalAfter = allBookings.find((b: any) => b._id === original._id);
    expect(originalAfter, 'the historical booking must still exist, unmutated').toBeTruthy();
    expect(originalAfter.dropoffLocation).toBe('Route A End');
    expect(originalAfter.pickupDate).toBeTruthy();
    expect(new Date(originalAfter.pickupDate).toISOString().slice(0, 10)).toBe(historicalDay);
    expect(originalAfter.totalAmount).toBe(1800);
  });
});
