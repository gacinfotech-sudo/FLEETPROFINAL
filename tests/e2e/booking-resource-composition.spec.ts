import { test, expect } from '@playwright/test';
import mongoose from 'mongoose';
import { Booking } from '../../server/models/index';
import { findVehicleConflicts, findDriverConflicts } from '../../server/services/availability';

// TASK-RESOURCE-03 — composition verification only (no production code
// changed; see .claude/tasks/reports/TASK-RESOURCE-03-REPORT.md for the
// full analysis). This suite proves, against the REAL, unmodified
// findVehicleConflicts/findDriverConflicts in server/services/availability.ts,
// that the date-certainty axis (travelDateStatus, from TASK-BOOKING-DOMAIN-02,
// not yet wired into this branch's schema) and the resource-fulfilment axis
// (resourceFulfilmentStatus, already shipped in 9049d33) compose safely.
//
// travelDateStatus isn't declared on this branch's Mongoose/Zod schemas yet
// (TASK-BOOKING-DOMAIN-02's schema patch is still a proposed, unapplied
// diff — see its report). Documents are written directly via the native
// MongoDB driver (Booking.collection.insertOne), bypassing Mongoose
// schema/validation entirely, so each scenario below stores the EXACT
// document shape that field will produce once wired in (in particular: a
// travelDateStatus='not_decided' booking never gets a pickupDate, and so
// never gets a computed scheduledStartDateTime/scheduledEndDateTime — see
// combineDateAndTime in server/models/index.ts, which returns undefined for
// a missing date). This is a genuine test of the real query logic these
// functions run today, not a mock.
//
// Fully self-contained: a fresh, random tenantId/vehicleId/driverId per
// run, direct mongoose connection, no HTTP/login/shared dev-DB dependency,
// cleaned up in `finally`.

test.describe('travelDateStatus x resourceFulfilmentStatus composition (TASK-RESOURCE-03)', () => {
  test.setTimeout(30_000);

  let tenantId: mongoose.Types.ObjectId;
  const WINDOW_START = new Date('1970-01-01T00:00:00Z');
  const WINDOW_END = new Date('2126-01-01T00:00:00Z');

  test.beforeAll(async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for this test.');
    await mongoose.connect(process.env.MONGODB_URI);
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

  test('the literal acceptance-criteria scenario: travelDateStatus=not_decided AND resourceFulfilmentStatus=not_started never appears as a vehicle or driver conflict', async () => {
    const marker = String(Date.now());
    const candidateVehicleId = new mongoose.Types.ObjectId();
    const candidateDriverId = new mongoose.Types.ObjectId();

    const inserted = await Booking.collection.insertOne({
      tenantId, bookingId: `BKC1${marker}`, customerName: 'Composition Test — both pending',
      customerPhone: '9' + marker.slice(-9), pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed', // an OCCUPYING status
      travelDateStatus: 'not_decided', resourceFulfilmentStatus: 'not_started',
      // Deliberately absent: pickupDate, scheduledStartDateTime,
      // scheduledEndDateTime, vehicleId, driverId — exactly what
      // travelDateStatus='not_decided' + resourceFulfilmentStatus='not_started'
      // means on both TASK-BOOKING-DOMAIN-02's proposed model and the
      // already-shipped resourceFulfilmentStatus semantics.
      createdAt: new Date(),
    } as any);

    const vehicleConflicts = await findVehicleConflicts(tenantId.toString(), candidateVehicleId.toString(), WINDOW_START, WINDOW_END);
    const driverConflicts = await findDriverConflicts(tenantId.toString(), candidateDriverId.toString(), WINDOW_START, WINDOW_END);

    expect(vehicleConflicts.length).toBe(0);
    expect(driverConflicts.length).toBe(0);
    expect(vehicleConflicts.find((c) => c.id === inserted.insertedId.toString())).toBeUndefined();
    expect(driverConflicts.find((c) => c.id === inserted.insertedId.toString())).toBeUndefined();
  });

  test('resource axis resolved (vehicleId assigned) but date axis still not_decided — the date guard alone still excludes it', async () => {
    // The more interesting interaction: resourceFulfilmentStatus has moved
    // past 'not_started' (a real vehicleId/driverId is now on the
    // document, so the query's exact-match vehicleId/driverId fields WILL
    // match), but travelDateStatus is still 'not_decided' (no pickupDate
    // ever supplied). Proves the date-range guard alone (missing
    // scheduledStartDateTime/scheduledEndDateTime never matches $lt/$gt)
    // is sufficient even once the resource-identity guard has already been
    // defeated by a real vehicleId/driverId being present.
    const marker = String(Date.now());
    const assignedVehicleId = new mongoose.Types.ObjectId();
    const assignedDriverId = new mongoose.Types.ObjectId();

    const inserted = await Booking.collection.insertOne({
      tenantId, bookingId: `BKC2${marker}`, customerName: 'Composition Test — resource resolved, date not',
      customerPhone: '9' + marker.slice(-9), pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed',
      travelDateStatus: 'not_decided', resourceFulfilmentStatus: 'own_fleet_assigned',
      vehicleId: assignedVehicleId, driverId: assignedDriverId,
      // Still deliberately absent: pickupDate, scheduledStartDateTime, scheduledEndDateTime.
      createdAt: new Date(),
    } as any);

    const vehicleConflicts = await findVehicleConflicts(tenantId.toString(), assignedVehicleId.toString(), WINDOW_START, WINDOW_END);
    const driverConflicts = await findDriverConflicts(tenantId.toString(), assignedDriverId.toString(), WINDOW_START, WINDOW_END);

    expect(vehicleConflicts.length).toBe(0);
    expect(driverConflicts.length).toBe(0);
    expect(vehicleConflicts.find((c) => c.id === inserted.insertedId.toString())).toBeUndefined();
    expect(driverConflicts.find((c) => c.id === inserted.insertedId.toString())).toBeUndefined();
  });

  test('positive control: a fully-resolved booking (both axes done) DOES appear as a conflict in its real overlapping window, and does not appear in a non-overlapping one', async () => {
    // Proves the test harness/query mechanism actually works — the two
    // tests above are not trivially empty because of a broken connection,
    // wrong tenantId, etc.
    const marker = String(Date.now());
    const vehicleId = new mongoose.Types.ObjectId();
    const driverId = new mongoose.Types.ObjectId();
    const start = new Date('2099-06-01T09:00:00Z');
    const end = new Date('2099-06-01T18:00:00Z');

    await Booking.collection.insertOne({
      tenantId, bookingId: `BKC3${marker}`, customerName: 'Composition Test — fully resolved',
      customerPhone: '9' + marker.slice(-9), pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed',
      travelDateStatus: 'confirmed', resourceFulfilmentStatus: 'own_fleet_assigned',
      vehicleId, driverId,
      pickupDate: start, scheduledStartDateTime: start, scheduledEndDateTime: end,
      createdAt: new Date(),
    } as any);

    const overlapping = await findVehicleConflicts(
      tenantId.toString(), vehicleId.toString(),
      new Date('2099-06-01T12:00:00Z'), new Date('2099-06-01T20:00:00Z'),
    );
    expect(overlapping.length).toBe(1);

    const overlappingDriver = await findDriverConflicts(
      tenantId.toString(), driverId.toString(),
      new Date('2099-06-01T12:00:00Z'), new Date('2099-06-01T20:00:00Z'),
    );
    expect(overlappingDriver.length).toBe(1);

    const nonOverlapping = await findVehicleConflicts(
      tenantId.toString(), vehicleId.toString(),
      new Date('2099-06-02T09:00:00Z'), new Date('2099-06-02T18:00:00Z'),
    );
    expect(nonOverlapping.length).toBe(0);
  });

  test('date axis resolved but resource axis still not_started (no vehicleId/driverId) — never matches any candidate vehicle/driver query', async () => {
    // Mirror of the first scenario: a real pickupDate/scheduledStartDateTime
    // exists (travelDateStatus='confirmed'), but resourceFulfilmentStatus is
    // still 'not_started' (no vehicleId/driverId assigned yet) — the
    // already-shipped Allocation Pending case. Confirms it still can't leak
    // into a conflict check for some unrelated candidate vehicle/driver.
    const marker = String(Date.now());
    const someOtherVehicleId = new mongoose.Types.ObjectId();
    const someOtherDriverId = new mongoose.Types.ObjectId();
    const start = new Date('2099-07-01T09:00:00Z');
    const end = new Date('2099-07-01T18:00:00Z');

    await Booking.collection.insertOne({
      tenantId, bookingId: `BKC4${marker}`, customerName: 'Composition Test — date resolved, resource not',
      customerPhone: '9' + marker.slice(-9), pickupLocation: 'Indore',
      bookingType: 'self_drive', totalAmount: 1000, status: 'confirmed',
      travelDateStatus: 'confirmed', resourceFulfilmentStatus: 'not_started',
      pickupDate: start, scheduledStartDateTime: start, scheduledEndDateTime: end,
      // Deliberately absent: vehicleId, driverId.
      createdAt: new Date(),
    } as any);

    const vehicleConflicts = await findVehicleConflicts(tenantId.toString(), someOtherVehicleId.toString(), start, end);
    const driverConflicts = await findDriverConflicts(tenantId.toString(), someOtherDriverId.toString(), start, end);

    expect(vehicleConflicts.length).toBe(0);
    expect(driverConflicts.length).toBe(0);
  });
});
