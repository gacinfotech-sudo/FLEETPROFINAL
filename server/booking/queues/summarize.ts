// Converts a raw (lean, populated) booking document into the consistent
// QueueBookingRow shape every queue endpoint returns. Mirrors the
// summarize() convention already used by server/services/upcomingBookings.ts
// (same populated-vehicle/driver shape) so the frontend's row rendering can
// stay one shared component across every queue tab.

import { BookingLike, QueueBookingRow, AttentionReason } from './types';
import { resolveTravelDateStatus, resolveLastActivityAt, resolveFollowUpAt } from './resolvers';

export function summarizeBooking(b: BookingLike, reasons?: AttentionReason[]): QueueBookingRow {
  const vehicle = b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId : null;
  const driver = b.driverId && typeof b.driverId === 'object' ? b.driverId : null;
  const followUpAt = resolveFollowUpAt(b);

  return {
    id: b._id?.toString?.() || String(b._id),
    bookingId: b.bookingId,
    customerId: b.customerId ? (b.customerId.toString?.() || String(b.customerId)) : null,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    pickupLocation: b.pickupLocation,
    dropoffLocation: b.dropoffLocation,
    pickupDate: b.pickupDate ? new Date(b.pickupDate).toISOString() : null,
    pickupTime: b.pickupTime,
    status: b.status,
    travelDateStatus: resolveTravelDateStatus(b),
    tentativeStartDate: b.tentativeStartDate ? new Date(b.tentativeStartDate).toISOString() : null,
    tentativeEndDate: b.tentativeEndDate ? new Date(b.tentativeEndDate).toISOString() : null,
    followUpAt: followUpAt ? followUpAt.toISOString() : null,
    lastActivityAt: resolveLastActivityAt(b).toISOString(),
    resourceFulfilmentStatus: b.resourceFulfilmentStatus,
    totalAmount: b.totalAmount,
    vehicle: vehicle ? { id: vehicle._id?.toString?.() || String(vehicle._id), make: vehicle.make, model: vehicle.vehicleModel, licensePlate: vehicle.licensePlate } : null,
    driver: driver ? { id: driver._id?.toString?.() || String(driver._id), name: driver.name, phone: driver.phone } : null,
    ...(reasons ? { reasons } : {}),
  };
}
