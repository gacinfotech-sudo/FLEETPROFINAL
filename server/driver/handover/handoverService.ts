// Handover-side business logic: staff conducts a handover (gives a vehicle
// to a driver). See returnService.ts for the paired return side.
import mongoose from 'mongoose';
import { Vehicle, Driver } from '../../models/index';
import { isEligibleForAssignment } from '../domain/eligibility';
import { VehicleHandover, type IVehicleHandover } from './models';
import type { ConditionPhotoRef, RemovableItemInventoryEntry } from './types';

export class HandoverNotFoundError extends Error {
  constructor(message = 'Handover not found.') {
    super(message);
    this.name = 'HandoverNotFoundError';
  }
}

export class HandoverConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandoverConflictError';
  }
}

export class DriverNotEligibleError extends Error {
  constructor(public reason: string) {
    super(`Driver is not eligible for assignment: ${reason}`);
    this.name = 'DriverNotEligibleError';
  }
}

export interface CreateHandoverInput {
  tenantId: string;
  vehicleId: string;
  driverId: string;
  bookingId?: string;
  odometerReading: number;
  fuelLevel: number;
  conditionPhotos?: ConditionPhotoRef[];
  removableItemInventory?: RemovableItemInventoryEntry[];
  damageNoted?: string;
  staffConductedBy: string;
}

/** Creates the "handover" (staff -> driver) side of a pair.
 *
 * Concurrency: the actual protection against two staff handing over the same
 * vehicle at overlapping times is NOT this function's pre-checks — those
 * exist only to return a friendly 409 in the common case. The real guarantee
 * is `VehicleHandoverSchema`'s unique partial index on
 * `(tenantId, vehicleId)` scoped to `isOpenForVehicle: true` (models.ts): the
 * `VehicleHandover.create()` call below is a single atomic MongoDB insert,
 * and if two requests race, the storage engine allows exactly one of the two
 * inserts to succeed — the loser gets a real E11000 duplicate-key error, not
 * an application-level "I checked and then someone else wrote first" gap.
 * This is a single atomic conditional write, not check-then-write. */
export async function createHandover(input: CreateHandoverInput): Promise<IVehicleHandover> {
  if (!mongoose.isValidObjectId(input.vehicleId) || !mongoose.isValidObjectId(input.driverId)) {
    throw new HandoverNotFoundError();
  }
  const [vehicle, driver] = await Promise.all([
    Vehicle.findOne({ _id: input.vehicleId, tenantId: input.tenantId }),
    Driver.findOne({ _id: input.driverId, tenantId: input.tenantId }),
  ]);
  if (!vehicle) throw new HandoverNotFoundError('Vehicle not found.');
  if (!driver) throw new HandoverNotFoundError('Driver not found.');

  const eligibility = await isEligibleForAssignment(input.tenantId, input.driverId);
  if (!eligibility.eligible) {
    throw new DriverNotEligibleError(eligibility.reason || 'Driver is not eligible.');
  }

  // Friendly pre-check only (see doc comment above) — deliberately not the
  // source of correctness under concurrency.
  const existingOpen = await VehicleHandover.findOne({ tenantId: input.tenantId, vehicleId: input.vehicleId, isOpenForVehicle: true });
  if (existingOpen) {
    throw new HandoverConflictError('This vehicle already has an open, unreturned handover in progress.');
  }

  const now = new Date();
  try {
    const handover = await VehicleHandover.create({
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      bookingId: input.bookingId || undefined,
      direction: 'handover',
      odometerReading: input.odometerReading,
      fuelLevel: input.fuelLevel,
      conditionPhotos: input.conditionPhotos || [],
      removableItemInventory: input.removableItemInventory || [],
      damageNoted: input.damageNoted,
      flags: [],
      driverAcceptance: { accepted: false },
      staffConductedBy: input.staffConductedBy,
      conductedAt: now,
      status: 'pending_driver_acceptance',
      isOpenForVehicle: true,
    });
    return handover;
  } catch (error: any) {
    // The unique partial index (tenantId, vehicleId, isOpenForVehicle=true)
    // is exactly what turns a race into a deterministic single winner.
    if (error?.code === 11000) {
      throw new HandoverConflictError('This vehicle already has an open, unreturned handover in progress.');
    }
    throw error;
  }
}

export async function getTenantScopedHandover(tenantId: string, handoverId: string): Promise<IVehicleHandover | null> {
  if (!mongoose.isValidObjectId(handoverId)) return null;
  return VehicleHandover.findOne({ _id: handoverId, tenantId });
}

export async function listHandoversForVehicle(tenantId: string, vehicleId: string): Promise<IVehicleHandover[]> {
  return VehicleHandover.find({ tenantId, vehicleId }).sort({ createdAt: -1 });
}

export async function getOpenHandoverForVehicle(tenantId: string, vehicleId: string): Promise<IVehicleHandover | null> {
  return VehicleHandover.findOne({ tenantId, vehicleId, isOpenForVehicle: true });
}

/** The driver-portal acceptance action — generic across direction (a driver
 * can accept either the initial handover or acknowledge a return), since
 * this task adds exactly one new driver-portal route and both directions
 * share the same `driverAcceptance` shape. Ownership is verified against the
 * authenticated driver session's own id/tenant — never a client-supplied
 * value — matching every other /api/driver-portal/* route's pattern. */
export async function acceptHandoverAsDriver(input: { tenantId: string; driverId: string; handoverId: string }): Promise<IVehicleHandover> {
  const handover = await VehicleHandover.findOne({ _id: input.handoverId, tenantId: input.tenantId, driverId: input.driverId });
  if (!handover) throw new HandoverNotFoundError();
  if (!handover.driverAcceptance.accepted) {
    handover.driverAcceptance.accepted = true;
    handover.driverAcceptance.acceptedAt = new Date();
    // A flagged ('disputed') return stays disputed even once the driver
    // acknowledges seeing it — acceptance here means "I acknowledge this
    // record", not "I agree the flags are wrong". Only a non-disputed record
    // transitions to 'accepted'.
    if (handover.status !== 'disputed') {
      handover.status = 'accepted';
    }
    await handover.save();
  }
  return handover;
}

/** Lists a driver's own pending-acceptance handovers — used to extend the
 * existing GET /api/driver-portal/me response (proposed patch, see report)
 * so this task adds zero new GET routes to the driver-portal allow-list
 * beyond the one POST accept route. */
export async function listPendingHandoversForDriver(tenantId: string, driverId: string): Promise<IVehicleHandover[]> {
  return VehicleHandover.find({ tenantId, driverId, 'driverAcceptance.accepted': false }).sort({ createdAt: -1 });
}
