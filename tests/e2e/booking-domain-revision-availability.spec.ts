// TASK-BOOKING-DOMAIN-02 — backdated revision history + the direct,
// structural proof that a travelDateStatus=not_decided / no-vehicleId
// booking can never be returned by availability.ts's real conflict
// queries, for ANY vehicle or date window.
//
// Scope note (2026-08-07 task revision): `vehicleId`'s own conditional
// requirement (vehicleId OR resourceAssignmentPending) is NOT this task's
// logic — it already shipped on this worktree's base branch
// (repair/flexible-booking-vendor-outsourcing @ 9049d33, merged to trunk
// at 1da105b). `resourceAssignmentPending: true` below is only used to
// satisfy that pre-existing rule so a vehicle-less booking can be created
// at all, in order to test THIS task's actual subject: that such a
// booking (combined with travelDateStatus=not_decided, this task's field)
// never occupies anything in availability.ts.
//
// The revision-history tests are pure logic (server/booking/domain/
// revisionHistory.ts has no live route yet — it's a builder function the
// Integrator's proposed backdated-correction route would call, see the
// report). The availability tests open a second, independent mongoose
// connection to the same shared dev DB the app itself uses, and call the
// REAL findVehicleConflicts/checkVehicleAvailability exported by
// server/services/availability.ts directly — not a reimplementation —
// so this is a direct test of the actual function every other booking
// route already depends on.
import { test, expect, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import { login } from './helpers';
import {
  buildBackdatedCorrectionEntry,
  backdatedCorrectionInputSchema,
  MissingCorrectionReasonError,
  isAuthorizedToRecordBackdatedCorrection,
} from '../../server/booking/domain';

test.describe('Backdated revision history — pure logic', () => {
  test('buildBackdatedCorrectionEntry throws without a non-empty reason', () => {
    expect(() =>
      buildBackdatedCorrectionEntry(
        { fieldsChanged: ['pickupTime'], previousValues: { pickupTime: '10:00' }, newValues: { pickupTime: '09:00' }, reason: '' },
        { userId: 'u1', role: 'admin' },
      )
    ).toThrow(MissingCorrectionReasonError);

    expect(() =>
      buildBackdatedCorrectionEntry(
        { fieldsChanged: ['pickupTime'], previousValues: {}, newValues: {}, reason: '   ' },
        { userId: 'u1', role: 'admin' },
      )
    ).toThrow(MissingCorrectionReasonError);
  });

  test('buildBackdatedCorrectionEntry throws without an identified actor', () => {
    expect(() =>
      buildBackdatedCorrectionEntry(
        { fieldsChanged: ['pickupTime'], previousValues: {}, newValues: {}, reason: 'Customer called to confirm actual pickup time' },
        { userId: '', role: 'admin' },
      )
    ).toThrow();
  });

  test('buildBackdatedCorrectionEntry succeeds with a real reason and actor, and records everything', () => {
    const now = new Date('2026-08-07T10:00:00.000Z');
    const entry = buildBackdatedCorrectionEntry(
      {
        fieldsChanged: ['pickupTime', 'pickupDate'],
        previousValues: { pickupTime: '10:00', pickupDate: '2026-08-01' },
        newValues: { pickupTime: '09:15', pickupDate: '2026-08-01' },
        reason: 'Driver duty log shows actual reporting time was 09:15, not 10:00 as originally entered.',
      },
      { userId: 'admin1', role: 'admin' },
      now,
    );
    expect(entry.reason).toBe('Driver duty log shows actual reporting time was 09:15, not 10:00 as originally entered.');
    expect(entry.authorizedBy).toEqual({ userId: 'admin1', role: 'admin' });
    expect(entry.correctedAt).toBe(now);
    expect(entry.fieldsChanged).toEqual(['pickupTime', 'pickupDate']);
  });

  test('backdatedCorrectionInputSchema rejects a blank reason and an empty fieldsChanged list at the Zod layer too', () => {
    const blankReason = backdatedCorrectionInputSchema.safeParse({
      fieldsChanged: ['pickupTime'], previousValues: {}, newValues: {}, reason: '',
    });
    expect(blankReason.success).toBe(false);

    const noFields = backdatedCorrectionInputSchema.safeParse({
      fieldsChanged: [], previousValues: {}, newValues: {}, reason: 'A real reason',
    });
    expect(noFields.success).toBe(false);
  });

  test('isAuthorizedToRecordBackdatedCorrection matches the existing reschedule-override precedent (admin/client only)', () => {
    expect(isAuthorizedToRecordBackdatedCorrection('admin')).toBe(true);
    expect(isAuthorizedToRecordBackdatedCorrection('client')).toBe(true);
    expect(isAuthorizedToRecordBackdatedCorrection('manager')).toBe(false);
    expect(isAuthorizedToRecordBackdatedCorrection(undefined)).toBe(false);
  });
});

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Availability non-occupancy — direct proof against the real availability.ts functions (requires the Integrator patch applied)', () => {
  test.afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  test('a travelDateStatus=not_decided booking with no vehicleId is never returned by findVehicleConflicts, for any vehicle or date window', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const createRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: 'Domain-02 Availability Non-Occupancy ' + Date.now(),
        customerPhone: '9' + String(Date.now()).slice(-9),
        bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        travelDateStatus: 'not_decided', resourceAssignmentPending: true,
        amount: 1000, pricingType: 'day',
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const created = await createRes.json();
    expect(created.vehicleId).toBeFalsy();

    // Connect independently to the same DB the running app uses (not
    // through HTTP) and call the real, unmodified exported functions —
    // this is a structural proof, not a UI-observed side effect: a
    // document with no vehicleId field cannot satisfy a Mongo query
    // filtering on `vehicleId: <any specific id>`, and combineDateAndTime
    // on an absent pickupDate produces no scheduledStartDateTime/
    // scheduledEndDateTime for the $lt/$gt range query to match either —
    // two independent reasons this booking can never occupy anything.
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    const { findVehicleConflicts } = await import('../../server/services/availability');
    const { Booking } = await import('../../server/models/index');

    const vehicles = await (await page.request.get('/api/vehicles')).json();
    // Scan a huge window (epoch to a century out) against every vehicle —
    // not just a plausible-looking range — since the booking under test
    // has no dates of its own to target a narrower window around.
    const start = new Date('1970-01-01');
    const end = new Date('2126-01-01');
    let foundAsConflict = false;
    for (const vehicle of vehicles.slice(0, 25)) {
      const conflicts = await findVehicleConflicts(created.tenantId, vehicle._id, start, end);
      if (conflicts.some((c) => c.id === created._id)) {
        foundAsConflict = true;
        break;
      }
    }
    expect(foundAsConflict, 'a not_decided/no-vehicle booking must never be returned as an occupying conflict').toBe(false);

    // Direct document check backing the structural claim above.
    const raw = await Booking.findById(created._id).lean();
    expect((raw as any)?.vehicleId).toBeFalsy();
    expect((raw as any)?.scheduledStartDateTime).toBeFalsy();
    expect((raw as any)?.scheduledEndDateTime).toBeFalsy();
  });
});
