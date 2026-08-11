import type { IVehicleHandover } from './models';

/** Staff-facing view of a VehicleHandover record. No PII masking concerns
 * here (unlike DriverDocument) — condition photos are referenced by
 * documentId only (never a raw URL/link), consistent with Documents-03's
 * "never a bare Drive link" rule; the actual bytes are fetched via that
 * module's own authenticated `GET /api/driver-documents/:id/file` route. */
export function publicVehicleHandover(handover: IVehicleHandover) {
  return {
    id: handover.id,
    tenantId: String(handover.tenantId),
    vehicleId: String(handover.vehicleId),
    driverId: String(handover.driverId),
    bookingId: handover.bookingId ? String(handover.bookingId) : undefined,
    direction: handover.direction,
    odometerReading: handover.odometerReading,
    fuelLevel: handover.fuelLevel,
    conditionPhotos: handover.conditionPhotos,
    removableItemInventory: handover.removableItemInventory,
    damageNoted: handover.damageNoted,
    flags: handover.flags,
    driverAcceptance: handover.driverAcceptance,
    staffConductedBy: handover.staffConductedBy,
    conductedAt: handover.conductedAt,
    linkedReturnHandoverId: handover.linkedReturnHandoverId ? String(handover.linkedReturnHandoverId) : undefined,
    status: handover.status,
    isOpenForVehicle: Boolean(handover.isOpenForVehicle),
    createdAt: handover.createdAt,
    updatedAt: handover.updatedAt,
  };
}

/** Minimal shape for embedding in GET /api/driver-portal/me — deliberately
 * smaller than the staff view (no staffConductedBy, no full flags detail
 * beyond a count) since this crosses the driver-portal auth boundary. */
export function driverPortalHandoverSummary(handover: IVehicleHandover) {
  return {
    id: handover.id,
    vehicleId: String(handover.vehicleId),
    direction: handover.direction,
    odometerReading: handover.odometerReading,
    fuelLevel: handover.fuelLevel,
    removableItemInventory: handover.removableItemInventory,
    damageNoted: handover.damageNoted,
    flagCount: handover.flags.length,
    status: handover.status,
    conductedAt: handover.conductedAt,
  };
}
