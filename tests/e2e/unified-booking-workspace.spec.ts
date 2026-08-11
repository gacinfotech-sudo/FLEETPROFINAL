import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// UNIFIED BOOKING WORKSPACE — the §68/§52/§34 regression contract:
//
// 1. A tentative, date-not-decided, unallocated booking is created once.
// 2. Set Date (the queue's compact editor path = canonical PUT) moves it
//    out of Date Pending and into date-confirmed state — same booking id,
//    same bookingId code, no duplicate record.
// 3. Confirm (canonical status endpoint) succeeds with allocation still
//    pending (§24), and the booking leaves the Tentative queue.
// 4. The queue rows expose the precise two-axis allocation summary, so
//    "Status: driver_assigned + Flag: Unallocated" can no longer render:
//    assigning a driver (no vehicle) yields driverAssigned=true,
//    vehicleAssigned=false, label "Driver Assigned · Vehicle Pending".
// 5. resourceFulfilmentStatus no longer drifts: assigning a vehicle
//    through the canonical PUT flips not_started → own_fleet_assigned
//    atomically; clearing it flips back.
// 6. GET /api/bookings/:id serves allowedNextStatuses off the ONE server
//    state machine, and lastActivityAt moves on every edit.

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

async function createTentativeDatelessBooking(page: Page, csrfToken: string) {
  const marker = String(Date.now()) + Math.floor(Math.random() * 1000);
  const res = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: `UnifiedWs ${marker}`,
      customerPhone: '9' + marker.slice(-9),
      pickupLocation: 'Indore', dropoffLocation: 'Local',
      bookingType: 'with_driver', tripType: 'local',
      totalAmount: 6000,
      status: 'tentative',
      travelDateStatus: 'not_decided',
      resourceAssignmentPending: true,
    },
  });
  const body = await res.json();
  expect(res.ok(), `create failed: ${JSON.stringify(body)}`).toBe(true);
  return body;
}

test.describe('Unified Booking Workspace — one booking, one flow', () => {
  test('queue → Set Date → Confirm keeps ONE canonical record and reclassifies queues automatically', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const booking = await createTentativeDatelessBooking(page, csrfToken);
    const id = booking._id;

    // Starts in Date Pending and Tentative.
    let res = await page.request.get('/api/bookings/queues/date-pending?limit=500');
    expect((await res.json()).items.map((r: any) => r.id)).toContain(id);
    res = await page.request.get('/api/bookings/queues/tentative?limit=500');
    expect((await res.json()).items.map((r: any) => r.id)).toContain(id);

    // GET by id serves the state machine's own allowed transitions.
    res = await page.request.get(`/api/bookings/${id}`);
    expect(res.ok()).toBe(true);
    const detail = await res.json();
    expect(detail.allowedNextStatuses).toContain('confirmed');
    const activityBefore = detail.lastActivityAt;

    // Set Date — the SetDateDialog/ScheduleEditor save path (canonical PUT).
    const travelDay = dateOffset(800 + Math.floor(Math.random() * 100));
    res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { travelDateStatus: 'confirmed', pickupDate: travelDay, pickupTime: '08:00' },
    });
    expect(res.ok(), await res.text()).toBe(true);
    const dated = await res.json();
    expect(dated._id).toBe(id);
    expect(dated.bookingId).toBe(booking.bookingId); // same public code, no duplicate

    // Date Pending no longer contains it — derived, not manually moved (§52).
    res = await page.request.get('/api/bookings/queues/date-pending?limit=500');
    expect((await res.json()).items.map((r: any) => r.id)).not.toContain(id);

    // lastActivityAt moved (Most Recent queue stays truthful).
    res = await page.request.get(`/api/bookings/${id}`);
    const afterDate = await res.json();
    expect(new Date(afterDate.lastActivityAt).getTime()).toBeGreaterThan(new Date(activityBefore || 0).getTime());

    // Confirm with allocation still pending (§24) via the ONE status engine.
    res = await page.request.post(`/api/bookings/${id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'confirmed' },
    });
    expect(res.ok(), await res.text()).toBe(true);
    const confirmed = await res.json();
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed._id).toBe(id);

    // Leaves the Tentative queue; still exactly one record.
    res = await page.request.get('/api/bookings/queues/tentative?limit=500');
    expect((await res.json()).items.map((r: any) => r.id)).not.toContain(id);

    // statusHistory recorded the transition (audit timeline §60).
    res = await page.request.get(`/api/bookings/${id}`);
    const final = await res.json();
    const transitions = (final.statusHistory || []).map((h: any) => `${h.fromStatus}->${h.toStatus}`);
    expect(transitions).toContain('tentative->confirmed');
  });

  test('precise allocation state replaces the Driver Assigned + Unallocated contradiction', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const booking = await createTentativeDatelessBooking(page, csrfToken);
    const id = booking._id;

    // Give it a confirmed far-future date so a driver can be assigned.
    const travelDay = dateOffset(900 + Math.floor(Math.random() * 50));
    let res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { travelDateStatus: 'confirmed', pickupDate: travelDay, pickupTime: '09:00', returnDate: travelDay, returnTime: '18:00' },
    });
    expect(res.ok(), await res.text()).toBe(true);

    // Find any driver to assign (availability endpoint, same as the workspace).
    res = await page.request.get(`/api/drivers/available?pickupDate=${travelDay}&returnDate=${travelDay}&pickupTime=09:00&returnTime=18:00&excludeBookingId=${id}`);
    expect(res.ok()).toBe(true);
    const drivers = await res.json();
    test.skip(!Array.isArray(drivers) || drivers.length === 0, 'no drivers in tenant to exercise allocation');

    res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { driverId: String(drivers[0]._id || drivers[0].id) },
    });
    expect(res.ok(), await res.text()).toBe(true);

    // The Needs Attention queue row must now carry the precise two-axis truth.
    res = await page.request.get('/api/bookings/queues/needs-attention?limit=500');
    const { items } = await res.json();
    const row = items.find((r: any) => r.id === id);
    expect(row, 'still needs attention (vehicle pending)').toBeTruthy();
    expect(row.allocation).toBeTruthy();
    expect(row.allocation.driverAssigned).toBe(true);
    expect(row.allocation.vehicleAssigned).toBe(false);
    expect(row.allocation.complete).toBe(false);
    expect(row.allocation.label).toBe('Driver Assigned · Vehicle Pending');
  });

  test('resourceFulfilmentStatus is recomputed atomically on vehicle assign/clear via canonical PUT', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const booking = await createTentativeDatelessBooking(page, csrfToken);
    const id = booking._id;
    expect(booking.resourceFulfilmentStatus).toBe('not_started');

    const travelDay = dateOffset(950 + Math.floor(Math.random() * 40));
    let res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { travelDateStatus: 'confirmed', pickupDate: travelDay, pickupTime: '09:00', returnDate: travelDay, returnTime: '18:00' },
    });
    expect(res.ok(), await res.text()).toBe(true);

    res = await page.request.get(`/api/vehicles/available?pickupDate=${travelDay}&returnDate=${travelDay}&pickupTime=09:00&returnTime=18:00`);
    expect(res.ok()).toBe(true);
    const vehicles = await res.json();
    test.skip(!Array.isArray(vehicles) || vehicles.length === 0, 'no vehicles in tenant to exercise fulfilment recompute');

    // Assign → own_fleet_assigned, atomically with the assignment itself.
    res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { vehicleId: String(vehicles[0]._id || vehicles[0].id) },
    });
    expect(res.ok(), await res.text()).toBe(true);
    let updated = await res.json();
    expect(updated.resourceFulfilmentStatus).toBe('own_fleet_assigned');

    // Clear ('' = unset) → back to not_started; no availability check fires
    // against the vehicle being removed.
    res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { vehicleId: '' },
    });
    expect(res.ok(), await res.text()).toBe(true);
    updated = await res.json();
    expect(updated.vehicleId ?? null).toBe(null);
    expect(updated.resourceFulfilmentStatus).toBe('not_started');
  });

  test('follow-up completes through the same PUT (clear followUpAt) and leaves the Follow-up Due queue', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const booking = await createTentativeDatelessBooking(page, csrfToken);
    const id = booking._id;

    const overdue = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { followUpAt: overdue },
    });
    expect(res.ok(), await res.text()).toBe(true);

    res = await page.request.get('/api/bookings/queues/follow-up-due?limit=500');
    expect((await res.json()).items.map((r: any) => r.id)).toContain(id);

    // "Mark Follow-up Done" in the workspace = PUT followUpAt: ''.
    res = await page.request.put(`/api/bookings/${id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { followUpAt: '' },
    });
    expect(res.ok(), await res.text()).toBe(true);

    res = await page.request.get('/api/bookings/queues/follow-up-due?limit=500');
    expect((await res.json()).items.map((r: any) => r.id)).not.toContain(id);
  });

  test('exact-money invariant survives the workspace path (₹6000 − ₹4000 = ₹2000, no drift)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const booking = await createTentativeDatelessBooking(page, csrfToken); // totalAmount 6000
    const id = booking._id;

    // Record a real ledger payment of ₹4000 (the workspace's Add Payment).
    const res = await page.request.post(`/api/bookings/${id}/payments`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { amount: 4000, paymentType: 'advance', paymentMode: 'cash', idempotencyKey: `uw-${id}-1` },
    });
    expect(res.ok(), await res.text()).toBe(true);

    const detail = await (await page.request.get(`/api/bookings/${id}`)).json();
    expect(detail.totalAmount).toBe(6000);
    expect(detail.advanceReceived).toBe(4000);
    expect(detail.totalAmount - detail.advanceReceived).toBe(2000);
  });
});
