import { test, expect } from '@playwright/test';
import mongoose from 'mongoose';
import { execSync } from 'child_process';
import { Booking } from '../../server/models/index';
import { storage } from '../../server/storage-mongodb';
import { mongoBookingSchemaWithCertainty } from '../../server/booking/domain';

// TASK-BOOKING-QA-06 — cross-cutting verification, DB-level (no HTTP layer).
//
// Why DB-level and not through POST /api/bookings like TASK-BOOKING-DOMAIN-02's
// own tests (tests/e2e/booking-domain-certainty.spec.ts): this suite
// independently re-verifies the REAL, currently-merged trunk state, not the
// worker's self-report. Uses a fully isolated database
// (fleetpro_qa06_isolated, never the shared dev `fleetpro` DB other
// worktrees' dev servers point at) via a direct mongoose connection —
// exactly the pattern TASK-RESOURCE-03's own committed test
// (booking-resource-composition.spec.ts) already established for this repo.
//
// Fully self-contained: fresh random tenantId per test, cleaned up in
// afterEach, no login/session/shared-server dependency.

test.describe('QA-06: date-certainty runtime integrity (no new Date() default)', () => {
  test.setTimeout(30_000);
  let tenantId: mongoose.Types.ObjectId;

  test.beforeAll(async () => {
    const uri = process.env.QA06_ISOLATED_MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_qa06_isolated';
    await mongoose.connect(uri);
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test.beforeEach(() => {
    tenantId = new mongoose.Types.ObjectId();
  });

  test.afterEach(async () => {
    await Booking.collection.deleteMany({ tenantId });
  });

  test('grep-verify (independent of DOMAIN-02\'s own copy of this check): no code path under server/ assigns pickupDate/confirmedTravelDate/tentativeStartDate/tentativeEndDate from new Date()/Date.now()', async () => {
    // Matches an assignment TO one of the date-certainty fields FROM
    // new Date()/Date.now() specifically — not every new Date() in the
    // codebase (there are hundreds of legitimate timestamp uses:
    // createdAt, sentAt, etc., see server/routes.ts). This is
    // deliberately narrower and more targeted than a bare `grep new Date()`.
    const suspiciousPatterns = [
      'pickupDate\\s*[:=]\\s*new Date\\(\\)',
      'pickupDate\\s*[:=]\\s*Date\\.now\\(\\)',
      'confirmedTravelDate\\s*[:=]\\s*new Date\\(\\)',
      'tentativeStartDate\\s*[:=]\\s*new Date\\(\\)',
      'tentativeEndDate\\s*[:=]\\s*new Date\\(\\)',
    ];
    for (const pattern of suspiciousPatterns) {
      let matched = '';
      try {
        matched = execSync(
          `grep -rnE "${pattern}" server/ client/src/ --include="*.ts" --include="*.tsx" || true`,
          { cwd: process.cwd(), encoding: 'utf-8' },
        );
      } catch {
        matched = '';
      }
      expect(matched.trim(), `Found a date-certainty field defaulted from the current date: ${matched}`).toBe('');
    }
  });

  test('Mongoose-level (real schema, real save path): a not_decided booking with no pickupDate never gets pickupDate silently set to today', async () => {
    const marker = String(Date.now());
    const booking = new Booking({
      tenantId, bookingId: `QA06D1${marker}`, customerName: 'QA06 date-integrity',
      customerPhone: '9' + marker.slice(-9), pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed',
      travelDateStatus: 'not_decided',
      // pickupDate deliberately omitted.
    } as any);

    // This is the honest, currently-real outcome: the Integrator has not
    // yet applied TASK-BOOKING-DOMAIN-02's proposed patch making
    // `pickupDate`'s `required` conditional (see that task's report,
    // "Files forbidden to modify — exact proposed patches" — verified
    // locally then fully reverted, never applied to the shared files).
    // server/models/index.ts on THIS merged trunk still has the
    // conditional-required rule wired in (it references
    // isPickupDateRequired), so this assertion exercises the REAL rule as
    // it exists in the actually-merged commit today.
    let thrown: any;
    try {
      await booking.save();
    } catch (e) {
      thrown = e;
    }

    if (thrown) {
      // Confirmed real gap, not a "defaults to new Date()" bug: the save
      // is correctly REJECTED (fails loudly), never silently coerced to
      // today's date. This is the acceptance criterion's actual concern —
      // "never new Date()" — holding true even in the current
      // not-yet-fully-wired state.
      expect(String(thrown.message)).toMatch(/pickupDate/i);
      expect(booking.pickupDate).toBeUndefined();
    } else {
      // If a future re-run of this suite finds the save succeeded (i.e.
      // the Integrator has applied the patch), assert the strong,
      // positive form of the same guarantee.
      const stored = await Booking.findById(booking._id).lean();
      expect((stored as any)?.pickupDate == null).toBe(true);
    }
  });

  test('domain module\'s OWN validation layer (server/booking/domain/bookingCertaintySchema.ts, already committed and real): accepts not_decided with no pickupDate and never invents one', () => {
    const parsed = mongoBookingSchemaWithCertainty.safeParse({
      tenantId: tenantId.toString(),
      customerName: 'QA06', customerPhone: '9999999999', pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed',
      travelDateStatus: 'not_decided',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as any).pickupDate).toBeUndefined();
    }
  });

  test('the same domain schema STILL requires pickupDate for the default (confirmed) state — old-client regression guard, independent copy of the same guarantee DOMAIN-02 tests', () => {
    const parsed = mongoBookingSchemaWithCertainty.safeParse({
      tenantId: tenantId.toString(),
      customerName: 'QA06', customerPhone: '9999999999', pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed',
      // travelDateStatus omitted entirely — must resolve to 'confirmed'.
    });
    expect(parsed.success).toBe(false);
  });
});

test.describe('QA-06: real parallel concurrent allocation (genuine race, not sequential awaits)', () => {
  test.setTimeout(30_000);
  let tenantId: mongoose.Types.ObjectId;
  let vehicleId: mongoose.Types.ObjectId;

  test.beforeAll(async () => {
    const uri = process.env.QA06_ISOLATED_MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_qa06_isolated';
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test.beforeEach(() => {
    tenantId = new mongoose.Types.ObjectId();
    vehicleId = new mongoose.Types.ObjectId();
  });

  test.afterEach(async () => {
    await Booking.collection.deleteMany({ tenantId });
  });

  test('two staff members allocate the SAME vehicle to two different bookings for the SAME overlapping window, at the same time: exactly one wins, the other gets a structured VEHICLE_DOUBLE_BOOKING conflict — never both, never neither', async () => {
    // Scenario #14 in REAL-WORLD-SCENARIO-MATRIX.md. This calls the REAL,
    // unmodified storage.createBooking (server/storage-mongodb.ts) — the
    // exact function every POST /api/bookings request goes through — via
    // Promise.all, so both createBooking() calls' actual async Mongo I/O
    // (session creation, transaction start, conflict query, insert) are
    // genuinely interleaved by the Node event loop, not run one after the
    // other. This is a materially different (and stronger) test than a
    // sequential `await createBooking(); await createBooking();` pair,
    // which could never observe a race even if one existed.
    const start = new Date('2099-03-01T09:00:00Z');
    const end = new Date('2099-03-01T18:00:00Z');
    const marker = String(Date.now());

    const payloadA: any = {
      tenantId: tenantId.toString(), bookingId: `QA06RACE-A-${marker}`,
      customerName: 'Race Customer A', customerPhone: '9' + marker.slice(-9),
      pickupLocation: 'Indore', bookingType: 'self_drive', totalAmount: 1000,
      status: 'confirmed', vehicleId: vehicleId.toString(),
      pickupDate: start, pickupTime: '09:00', returnDate: end, returnTime: '18:00',
    };
    const payloadB: any = {
      ...payloadA, bookingId: `QA06RACE-B-${marker}`, customerName: 'Race Customer B',
      customerPhone: '8' + marker.slice(-9),
    };

    const results = await Promise.allSettled([
      storage.createBooking({ ...payloadA }),
      storage.createBooking({ ...payloadB }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    // The real, currently-observed outcome is reported here regardless of
    // which branch is hit — see the report for which one this run actually
    // produced. All three assertions below are the acceptance criterion
    // ("exactly one wins, one gets a structured conflict, never both
    // succeeding or both silently failing") stated as a hard requirement;
    // a failure here is a genuine, reproducible finding, not a flake.
    expect(fulfilled.length, 'exactly one booking must be created, not zero, not two (double-booking)').toBe(1);
    expect(rejected.length, 'exactly one attempt must be rejected').toBe(1);
    const err: any = rejected[0]?.reason;
    expect(err?.code, 'the rejected attempt must carry the structured VEHICLE_DOUBLE_BOOKING code, not a generic/opaque error').toBe('VEHICLE_DOUBLE_BOOKING');

    // Confirm at the DB level too — not just trusting the promise
    // resolution, in case of a partial-write bug.
    const savedCount = await Booking.collection.countDocuments({ tenantId, vehicleId });
    expect(savedCount, 'the database must contain exactly one booking for this vehicle/window, not zero or two').toBe(1);
  });
});

test.describe('QA-06: existing idempotency (pre-initiative) still works after all four Wave-3 merges', () => {
  test.setTimeout(30_000);
  let tenantId: mongoose.Types.ObjectId;

  test.beforeAll(async () => {
    const uri = process.env.QA06_ISOLATED_MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_qa06_isolated';
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
    // Mongoose builds indexes asynchronously in the background after
    // connect/model-compile and does NOT block queries on it by default —
    // on a brand-new, empty isolated database the {tenantId,
    // idempotencyKey} partial unique index may genuinely not exist yet
    // the instant a query runs. Booking.init() resolves once index
    // building is actually complete, which the shared dev DB (in
    // continuous use for a long time) already has by definition. Without
    // this await, this test would produce a false-positive "idempotency is
    // broken" result that's really just an isolated-DB startup race, not a
    // regression.
    await Booking.init();
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test.beforeEach(() => {
    tenantId = new mongoose.Types.ObjectId();
  });

  test.afterEach(async () => {
    await Booking.collection.deleteMany({ tenantId });
  });

  test('sanity check: the partial unique index on {tenantId, idempotencyKey} actually exists on this connection before the race test below runs', async () => {
    const indexes = await Booking.collection.indexes();
    const idemIndex = indexes.find((i: any) => i.key?.tenantId === 1 && i.key?.idempotencyKey === 1);
    expect(idemIndex, `Booking collection indexes were: ${JSON.stringify(indexes.map((i: any) => i.name))}`).toBeTruthy();
    expect((idemIndex as any)?.unique).toBe(true);
  });

  test('the {tenantId, idempotencyKey} partial unique index (the actual last line of defense, per CURRENT-BOOKING-AUDIT.md) still rejects a genuine concurrent duplicate after the DOMAIN-02/RESOURCE-03/UI-04/QUEUES-05 merges', async () => {
    // Exercises the real, unmodified index declared in
    // server/models/index.ts:861-862 directly (two real parallel inserts
    // sharing one idempotencyKey), independent of routes.ts's own
    // pre-check (which is a secondary optimization, not the actual
    // guarantee — see routes.ts:2503-2511's own comment: "Two truly
    // simultaneous requests carrying the same idempotencyKey ... the
    // unique partial index is the real guarantee").
    const marker = String(Date.now());
    const key = `qa06-idem-${marker}`;
    const base = {
      tenantId, idempotencyKey: key, customerName: 'Idempotency Test',
      customerPhone: '9' + marker.slice(-9), pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed',
      pickupDate: new Date('2099-04-01T09:00:00Z'),
    };

    const results = await Promise.allSettled([
      new Booking({ ...base, bookingId: `QA06IDEM-A-${marker}` }).save(),
      new Booking({ ...base, bookingId: `QA06IDEM-B-${marker}` }).save(),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0]?.reason?.code).toBe(11000);

    const count = await Booking.collection.countDocuments({ tenantId, idempotencyKey: key });
    expect(count).toBe(1);
  });
});

test.describe('QA-06: all five safe-save outcomes are independently reachable (storage layer)', () => {
  test.setTimeout(30_000);
  let tenantId: mongoose.Types.ObjectId;

  test.beforeAll(async () => {
    const uri = process.env.QA06_ISOLATED_MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_qa06_isolated';
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test.beforeEach(() => {
    tenantId = new mongoose.Types.ObjectId();
  });

  test.afterEach(async () => {
    await Booking.collection.deleteMany({ tenantId });
  });

  const basePayload = (marker: string) => ({
    tenantId: tenantId.toString(), customerName: 'Safe Save Outcome',
    customerPhone: '9' + marker.slice(-9), pickupLocation: 'Indore',
    bookingType: 'self_drive' as const, totalAmount: 1000,
  });

  test('1. Save Quote Only (status=enquiry, no vehicle, no confirmed date)', async () => {
    const marker = String(Date.now());
    const b = await storage.createBooking({
      ...basePayload(marker), bookingId: `QA06S1${marker}`, status: 'enquiry',
      pickupDate: new Date('2099-05-01T09:00:00Z'),
    } as any);
    expect(b.status).toBe('enquiry');
  });

  test('2. Save Tentative Booking (status=tentative, no vehicle consumed)', async () => {
    const marker = String(Date.now());
    const b = await storage.createBooking({
      ...basePayload(marker), bookingId: `QA06S2${marker}`, status: 'tentative',
      pickupDate: new Date('2099-05-02T09:00:00Z'),
    } as any);
    expect(b.status).toBe('tentative');
  });

  test('3. Save Confirmed Booking with a vehicle assigned now', async () => {
    const marker = String(Date.now());
    const vehicleId = new mongoose.Types.ObjectId();
    const b = await storage.createBooking({
      ...basePayload(marker), bookingId: `QA06S3${marker}`, status: 'confirmed',
      pickupDate: new Date('2099-05-03T09:00:00Z'), pickupTime: '09:00',
      returnDate: new Date('2099-05-03T18:00:00Z'), returnTime: '18:00',
      vehicleId: vehicleId.toString(),
    } as any);
    expect(b.status).toBe('confirmed');
    expect(String(b.vehicleId)).toBe(String(vehicleId));
  });

  test('4. Save Confirmed Booking with Allocation Pending (already-shipped resourceAssignmentPending path, no vehicleId)', async () => {
    const marker = String(Date.now());
    const b = await storage.createBooking({
      ...basePayload(marker), bookingId: `QA06S4${marker}`, status: 'confirmed',
      pickupDate: new Date('2099-05-04T09:00:00Z'),
      resourceFulfilmentStatus: 'not_started',
      // No vehicleId — this is exactly the already-shipped
      // resourceFulfilmentStatus escape hatch DOMAIN-02's report
      // references, re-verified here independently.
    } as any);
    expect(b.status).toBe('confirmed');
    expect(b.vehicleId).toBeFalsy();
    expect(b.resourceFulfilmentStatus).toBe('not_started');
  });

  test('5. Save Vendor Sourcing Pending (resourceFulfilmentStatus=outsourcing_requested, no vehicle consumed)', async () => {
    const marker = String(Date.now());
    const b = await storage.createBooking({
      ...basePayload(marker), bookingId: `QA06S5${marker}`, status: 'confirmed',
      pickupDate: new Date('2099-05-05T09:00:00Z'),
      resourceFulfilmentStatus: 'outsourcing_requested',
    } as any);
    expect(b.resourceFulfilmentStatus).toBe('outsourcing_requested');
    expect(b.vehicleId).toBeFalsy();
  });
});
