// Converts a raw (lean, populated) booking document into the consistent
// QueueBookingRow shape every queue endpoint returns. Mirrors the
// summarize() convention already used by server/services/upcomingBookings.ts
// (same populated-vehicle/driver shape) so the frontend's row rendering can
// stay one shared component across every queue tab.

import { BookingLike, QueueBookingRow, AttentionReason, AllocationSummary } from './types';
import { resolveTravelDateStatus, resolveLastActivityAt, resolveFollowUpAt } from './resolvers';

// The precise allocation state behind the old contradictory
// "Driver Assigned + Unallocated" display: driver and vehicle are
// independent axes; vendor fulfilment satisfies both; self-drive needs no
// driver. Derived fresh from canonical resource facts on every read —
// never stored, so it can never drift the way resourceFulfilmentStatus
// could.
export function deriveAllocationSummary(b: BookingLike): AllocationSummary {
  const selfDrive = b?.bookingType === 'self_drive';
  const vendorFulfilled = !!(b?.fulfilmentType === 'vendor' || b?.vendorName || b?.vendorVehicleId || b?.fulfilmentVendorId);
  const vehicleAssigned = vendorFulfilled || !!b?.vehicleId;
  const driverAssigned = vendorFulfilled || selfDrive || !!b?.driverId;

  let label: string;
  if (vendorFulfilled) label = b?.vendorName ? `Vendor — ${b.vendorName}` : 'Vendor Fulfilled';
  else if (driverAssigned && vehicleAssigned) label = 'Allocated';
  else if (driverAssigned) label = 'Driver Assigned · Vehicle Pending';
  else if (vehicleAssigned) label = 'Vehicle Assigned · Driver Pending';
  else label = 'Allocation Pending';

  return { driverAssigned, vehicleAssigned, vendorFulfilled, selfDrive, complete: driverAssigned && vehicleAssigned, label };
}

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
    allocation: deriveAllocationSummary(b),
    ...(reasons ? { reasons } : {}),
  };
}
