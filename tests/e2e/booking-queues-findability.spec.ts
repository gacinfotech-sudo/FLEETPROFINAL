import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// TASK-BOOKING-QUEUES-05: Most Recent, Date Pending, Follow-up Due,
// Tentative Bookings, and the de-duplicated Needs Attention queue.
//
// NOTE on travelDateStatus/followUpAt/lastActivityAt: these are
// TASK-BOOKING-DOMAIN-02's fields. At the time this test was written,
// DOMAIN-02's own schema patch had been verified then fully reverted on
// its own branch (see .claude/tasks/reports/TASK-BOOKING-DOMAIN-02-REPORT.md)
// and had not landed on trunk. This suite runs against this task's own
// temporary, local-only stand-in patch to server/models/index.ts /
// server/schemas/mongodb-schemas.ts (also reverted before commit — see
// this task's own REPORT.md) so the query logic in
// server/booking/queues/queries.ts can be exercised against real documents
// end-to-end rather than only unit-tested. Once the Integrator applies
// DOMAIN-02's real patch, this same suite should keep passing unmodified —
// it only depends on the field names, not on which patch supplied them.

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

async function createBooking(page: Page, csrfToken: string, overrides: Record<string, any>) {
  const marker = String(Date.now()) + Math.floor(Math.random() * 1000);
  const day = dateOffset(500 + Math.floor(Math.random() * 300)); // far future, clear of other suites' ranges
  const res = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: `QueuesTest ${marker}`,
      customerPhone: '9' + marker.slice(-9),
      pickupLocation: 'Bhopal', dropoffLocation: 'Indore',
      pickupDate: day, pickupTime: '10:00', returnDate: day, returnTime: '14:00',
      bookingType: 'self_drive', tripType: 'one_way',
      totalAmount: 1000, status: 'confirmed',
      // No vehicle needed for these queue tests — uses the already-shipped
      // flexible-fulfilment escape hatch (see server/routes.ts's
      // VEHICLE_OR_ASSIGNMENT_PENDING_REQUIRED check).
      resourceAssignmentPending: true,
      ...overrides,
    },
  });
  const body = await res.json();
  expect(res.ok(), `Booking creation failed: ${JSON.stringify(body)}`).toBe(true);
  return body;
}

test.describe('Booking Queues — findability', () => {
  test('Date Pending queue returns only travelDateStatus=not_decided bookings, and absent field defaults to confirmed', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const pending = await createBooking(page, csrfToken, { travelDateStatus: 'not_decided' });
    const confirmed = await createBooking(page, csrfToken, {}); // no travelDateStatus sent at all

    const res = await page.request.get('/api/bookings/queues/date-pending?limit=500');
    expect(res.ok()).toBe(true);
    const { items } = await res.json();
    const ids = items.map((r: any) => r.id);

    expect(ids, 'a not_decided booking must appear in Date Pending').toContain(pending._id);
    expect(ids, 'a booking with no travelDateStatus sent must default to confirmed, never appear in Date Pending').not.toContain(confirmed._id);

    const pendingRow = items.find((r: any) => r.id === pending._id);
    expect(pendingRow.travelDateStatus).toBe('not_decided');
  });

  test('Follow-up Due queue returns only followUpAt <= now, sorted soonest first', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const overdue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    const soon = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago (more recent overdue than `overdue`)
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now — not due yet

    const dueA = await createBooking(page, csrfToken, { followUpAt: overdue });
    const dueB = await createBooking(page, csrfToken, { followUpAt: soon });
    const notDue = await createBooking(page, csrfToken, { followUpAt: future });
    const noFollowUp = await createBooking(page, csrfToken, {});

    const res = await page.request.get('/api/bookings/queues/follow-up-due?limit=500');
    const { items } = await res.json();
    const ids = items.map((r: any) => r.id);

    expect(ids).toContain(dueA._id);
    expect(ids).toContain(dueB._id);
    expect(ids, 'a followUpAt in the future must not appear as due').not.toContain(notDue._id);
    expect(ids, 'a booking with no followUpAt must not appear').not.toContain(noFollowUp._id);

    // Sorted soonest-due first (ascending followUpAt) by default.
    const indexA = ids.indexOf(dueA._id);
    const indexB = ids.indexOf(dueB._id);
    expect(indexA, 'the older overdue item must sort before the more recently-due one').toBeLessThan(indexB);
  });

  test('Tentative Bookings queue reuses the existing status=tentative value, not a new field', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const tentative = await createBooking(page, csrfToken, { status: 'tentative' });
    const confirmed = await createBooking(page, csrfToken, { status: 'confirmed' });

    const res = await page.request.get('/api/bookings/queues/tentative?limit=500');
    const { items } = await res.json();
    const ids = items.map((r: any) => r.id);

    expect(ids).toContain(tentative._id);
    expect(ids).not.toContain(confirmed._id);
    expect(items.find((r: any) => r.id === tentative._id).status).toBe('tentative');
  });

  test('Most Recent queue orders by lastActivityAt desc, and an edit bumps a booking back to the top', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const first = await createBooking(page, csrfToken, {});
    await new Promise((r) => setTimeout(r, 1100)); // ensure a distinct timestamp
    const second = await createBooking(page, csrfToken, {});

    let res = await page.request.get('/api/bookings/queues/most-recent?limit=500');
    let items = (await res.json()).items;
    let indexFirst = items.findIndex((r: any) => r.id === first._id);
    let indexSecond = items.findIndex((r: any) => r.id === second._id);
    expect(indexSecond, 'the more recently created booking must sort before the older one').toBeLessThan(indexFirst);

    // Touch `first` via a real edit — must bump it back above `second`.
    await new Promise((r) => setTimeout(r, 1100));
    const editRes = await page.request.put(`/api/bookings/${first._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { notes: 'touched to bump lastActivityAt' },
    });
    expect(editRes.ok(), JSON.stringify(await editRes.json())).toBe(true);

    res = await page.request.get('/api/bookings/queues/most-recent?limit=500');
    items = (await res.json()).items;
    indexFirst = items.findIndex((r: any) => r.id === first._id);
    indexSecond = items.findIndex((r: any) => r.id === second._id);
    expect(indexFirst, 'editing the older booking must move it above the untouched newer one').toBeLessThan(indexSecond);
  });

  test('Needs Attention de-duplicates a booking qualifying under more than one condition — appears exactly once with both reasons', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const overdueFollowUp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Explicitly marked resource-allocated on all three bookings below so
    // this test isolates date_pending/follow_up_due only — createBooking's
    // default (resourceAssignmentPending: true, no vehicleId) would
    // otherwise also tag every one of them 'unallocated' via the server's
    // own resourceFulfilmentStatus default ('not_started'), muddying this
    // specific de-dup assertion (unallocated has its own dedicated test
    // below).
    const allocated = { resourceFulfilmentStatus: 'own_fleet_assigned' };

    // Qualifies under BOTH date_pending (travelDateStatus=not_decided) AND
    // follow_up_due (followUpAt in the past) — the exact overlap case the
    // acceptance criterion calls out.
    const both = await createBooking(page, csrfToken, {
      ...allocated,
      travelDateStatus: 'not_decided',
      followUpAt: overdueFollowUp,
    });
    // Qualifies under exactly one condition, for contrast.
    const dateOnly = await createBooking(page, csrfToken, { ...allocated, travelDateStatus: 'not_decided' });
    // Qualifies under neither — must not appear at all.
    const neither = await createBooking(page, csrfToken, { ...allocated });

    const res = await page.request.get('/api/bookings/queues/needs-attention?limit=500');
    expect(res.ok()).toBe(true);
    const { items } = await res.json();

    const matchesForBoth = items.filter((r: any) => r.id === both._id);
    expect(matchesForBoth.length, 'a booking qualifying under two conditions must appear exactly once, not twice').toBe(1);
    expect(matchesForBoth[0].reasons.sort()).toEqual(['date_pending', 'follow_up_due'].sort());

    const matchesForDateOnly = items.filter((r: any) => r.id === dateOnly._id);
    expect(matchesForDateOnly.length).toBe(1);
    expect(matchesForDateOnly[0].reasons).toEqual(['date_pending']);

    expect(items.map((r: any) => r.id)).not.toContain(neither._id);
  });

  test('Needs Attention includes an unallocated booking (resourceFulfilmentStatus-based, not the driverNotAssigned/vehicleNotAssigned flags)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const unallocated = await createBooking(page, csrfToken, {
      resourceFulfilmentStatus: 'resource_sourcing_pending',
      resourceAssignmentPending: true,
      vehicleId: undefined,
    });

    const res = await page.request.get('/api/bookings/queues/needs-attention?limit=500');
    const { items } = await res.json();
    const row = items.find((r: any) => r.id === unallocated._id);
    expect(row, 'a booking with an unresolved resourceFulfilmentStatus must appear in Needs Attention').toBeTruthy();
    expect(row.reasons).toContain('unallocated');
  });

  test('search/sort/filter query params work on a queue endpoint', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const marker = 'Findability' + Date.now();
    const booking = await createBooking(page, csrfToken, { customerName: marker, travelDateStatus: 'not_decided' });

    const res = await page.request.get(`/api/bookings/queues/date-pending?q=${encodeURIComponent(marker)}`);
    const { items } = await res.json();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((r: any) => r.customerName.includes(marker))).toBe(true);
    expect(items.map((r: any) => r.id)).toContain(booking._id);
  });
});
