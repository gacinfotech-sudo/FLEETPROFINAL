import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { Booking } from '../../server/models/index';
import { VehicleGpsAssignment } from '../../server/gps/models/vehicleGpsAssignment';
import { correlateDriverAndDevice } from '../../server/gps/services/driverDeviceCorrelation';

// Pure service-layer verification (no HTTP surface exists for this
// correlation function — see TASK-GPS-MAPPING-03's "Expected APIs: None
// required"), against a real MongoDB connection, mirroring the established
// pattern in gps-device-master.spec.ts's first test: synthetic
// tenantId/vehicleId per test (via new mongoose.Types.ObjectId()) rather
// than shared dev-tenant fixtures, so runs are fully isolated and never
// collide with real data or with each other.

async function createBooking(overrides: Record<string, any>) {
  return Booking.create({
    customerName: 'Correlation Test Customer',
    customerPhone: '9000000000',
    pickupLocation: 'Test Origin',
    pickupDate: overrides.actualStartDateTime || new Date(),
    bookingType: 'with_driver',
    totalAmount: 1000,
    ...overrides,
  });
}

test.describe('Driver <-> GPS device correlation (TASK-GPS-MAPPING-03)', () => {
  test.setTimeout(60_000);

  test('booking and device both on record for the window: returns both unambiguously', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for correlation verification.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const gpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T17:00:00Z');

      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `CORR-BOTH-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
      });

      const assignment = await VehicleGpsAssignment.create({
        tenantId, vehicleId, gpsDeviceId, connectionId,
        assignedFrom: new Date('2026-01-01T00:00:00Z'),
        status: 'active',
        assignedBy: 'test-setup',
      });

      const result = await correlateDriverAndDevice(tenantId, vehicleId, windowStart, windowEnd);

      expect(result.driver.status).toBe('found');
      expect((result.driver as any).driverId).toBe(driverId);
      expect((result.driver as any).bookingId).toBe(String(booking._id));

      expect(result.device.status).toBe('found');
      expect((result.device as any).gpsDeviceId).toBe(gpsDeviceId);
      expect((result.device as any).assignmentId).toBe(String(assignment._id));
    } finally {
      await mongoose.disconnect();
    }
  });

  test('no active booking for the window: driver is "none", not an exception', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for correlation verification.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const gpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();

      // A booking exists for this vehicle, but its actual window is
      // entirely before the requested window — must not match.
      await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `CORR-NODRIVER-${marker}`,
        actualStartDateTime: new Date('2025-01-01T09:00:00Z'),
        actualEndDateTime: new Date('2025-01-01T17:00:00Z'),
      });
      await VehicleGpsAssignment.create({
        tenantId, vehicleId, gpsDeviceId, connectionId,
        assignedFrom: new Date('2020-01-01T00:00:00Z'),
        status: 'active',
        assignedBy: 'test-setup',
      });

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T17:00:00Z');
      const result = await correlateDriverAndDevice(tenantId, vehicleId, windowStart, windowEnd);

      expect(result.driver).toEqual({ status: 'none' });
      // The device lookup is independent of the driver/booking lookup —
      // still resolves normally.
      expect(result.device.status).toBe('found');
    } finally {
      await mongoose.disconnect();
    }
  });

  test('no GPS device assigned: device is "none", not an exception (historical, pre-GPS booking)', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for correlation verification.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T17:00:00Z');
      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `CORR-NODEVICE-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
      });
      // Deliberately no VehicleGpsAssignment document at all for this vehicle.

      const result = await correlateDriverAndDevice(tenantId, vehicleId, windowStart, windowEnd);

      expect(result.driver.status).toBe('found');
      expect((result.driver as any).bookingId).toBe(String(booking._id));
      expect(result.device).toEqual({ status: 'none' });
    } finally {
      await mongoose.disconnect();
    }
  });

  test('a booking with no actualEndDateTime yet (trip started, not returned) still overlaps an open window', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for correlation verification.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();

      const actualStart = new Date('2026-01-10T09:00:00Z');
      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `CORR-ONGOING-${marker}`,
        actualStartDateTime: actualStart,
        // actualEndDateTime intentionally omitted — trip still ongoing.
      });

      const result = await correlateDriverAndDevice(
        tenantId, vehicleId,
        new Date('2026-01-10T12:00:00Z'), new Date('2026-01-10T13:00:00Z'),
      );

      expect(result.driver.status).toBe('found');
      expect((result.driver as any).bookingId).toBe(String(booking._id));
      expect((result.driver as any).actualEndDateTime).toBeUndefined();
      expect(result.device).toEqual({ status: 'none' });
    } finally {
      await mongoose.disconnect();
    }
  });

  test('two overlapping bookings for the same vehicle: flagged as ambiguous, not silently resolved', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for correlation verification.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverA = new mongoose.Types.ObjectId().toString();
      const driverB = new mongoose.Types.ObjectId().toString();

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T17:00:00Z');

      // Two bookings on the same vehicle whose actual windows both overlap
      // the requested window — should not happen per the availability
      // engine's invariants, but this function must still handle it
      // deterministically if the underlying data is inconsistent.
      const bookingA = await createBooking({
        tenantId, vehicleId, driverId: driverA,
        bookingId: `CORR-AMBIG-A-${marker}`,
        actualStartDateTime: new Date('2026-01-10T08:00:00Z'),
        actualEndDateTime: new Date('2026-01-10T12:00:00Z'),
      });
      const bookingB = await createBooking({
        tenantId, vehicleId, driverId: driverB,
        bookingId: `CORR-AMBIG-B-${marker}`,
        actualStartDateTime: new Date('2026-01-10T11:00:00Z'),
        actualEndDateTime: new Date('2026-01-10T18:00:00Z'),
      });

      const result = await correlateDriverAndDevice(tenantId, vehicleId, windowStart, windowEnd);

      expect(result.driver.status).toBe('ambiguous');
      const candidates = (result.driver as any).candidates as any[];
      expect(candidates).toHaveLength(2);
      expect(candidates.map((c) => c.bookingId).sort()).toEqual(
        [String(bookingA._id), String(bookingB._id)].sort(),
      );
      expect(candidates.map((c) => c.driverId)).toContain(driverA);
      expect(candidates.map((c) => c.driverId)).toContain(driverB);
      // Not silently picked — no single driverId field is exposed on an
      // ambiguous result.
      expect((result.driver as any).driverId).toBeUndefined();
    } finally {
      await mongoose.disconnect();
    }
  });

  test('a booking that does not overlap the window at all is excluded (adjacent, non-overlapping)', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for correlation verification.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();

      // Ends exactly when the requested window starts — half-open
      // interval semantics (matching availability.ts's existing
      // findVehicleConflicts convention) mean this does NOT overlap.
      await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `CORR-ADJACENT-${marker}`,
        actualStartDateTime: new Date('2026-01-10T05:00:00Z'),
        actualEndDateTime: new Date('2026-01-10T09:00:00Z'),
      });

      const result = await correlateDriverAndDevice(
        tenantId, vehicleId,
        new Date('2026-01-10T09:00:00Z'), new Date('2026-01-10T17:00:00Z'),
      );

      expect(result.driver).toEqual({ status: 'none' });
    } finally {
      await mongoose.disconnect();
    }
  });

  test('invalid window (end before start) throws rather than returning a misleading result', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for correlation verification.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      await expect(correlateDriverAndDevice(
        tenantId, vehicleId,
        new Date('2026-01-10T17:00:00Z'), new Date('2026-01-10T09:00:00Z'),
      )).rejects.toThrow(RangeError);
    } finally {
      await mongoose.disconnect();
    }
  });
});
