// Return-side business logic. See VEHICLE-HANDOVER-SPEC.md's "Return flow":
// odometer/fuel/condition/inventory are compared against the paired handover
// record automatically; any shortfall is FLAGGED, never blocking the return.
import mongoose from 'mongoose';
import { VehicleHandover, type IVehicleHandover } from './models';
import { HandoverNotFoundError } from './handoverService';
import { ODOMETER_DISCREPANCY_THRESHOLD_KM } from './types';
import type { ConditionPhotoRef, RemovableItemInventoryEntry, DiscrepancyFlag } from './types';

export interface CreateReturnInput {
  tenantId: string;
  vehicleId: string;
  odometerReading: number;
  fuelLevel: number;
  conditionPhotos?: ConditionPhotoRef[];
  removableItemInventory?: RemovableItemInventoryEntry[];
  damageNoted?: string;
  staffConductedBy: string;
  // Optional — if the trip's expected distance is known, an odometer delta
  // far beyond it is flagged. If omitted, only a negative/implausible
  // odometer delta (return < handover reading) is flagged.
  expectedTripDistanceKm?: number;
}

/** Compares the return's reported state against the open handover record and
 * returns the list of discrepancy flags — pure function, no writes, so it's
 * independently testable. Never throws / never used to reject a return. */
export function computeDiscrepancyFlags(input: {
  handover: IVehicleHandover;
  returnOdometerReading: number;
  returnInventory: RemovableItemInventoryEntry[];
  damageNoted?: string;
  expectedTripDistanceKm?: number;
}): DiscrepancyFlag[] {
  const flags: DiscrepancyFlag[] = [];
  const now = new Date();

  const odometerDelta = input.returnOdometerReading - input.handover.odometerReading;
  if (odometerDelta < 0) {
    flags.push({
      type: 'odometer_discrepancy',
      description: `Return odometer (${input.returnOdometerReading}) is lower than handover odometer (${input.handover.odometerReading}).`,
      createdAt: now,
    });
  } else if (typeof input.expectedTripDistanceKm === 'number') {
    const gap = Math.abs(odometerDelta - input.expectedTripDistanceKm);
    if (gap > ODOMETER_DISCREPANCY_THRESHOLD_KM) {
      flags.push({
        type: 'odometer_discrepancy',
        description: `Odometer delta (${odometerDelta}km) differs from expected trip distance (${input.expectedTripDistanceKm}km) by ${gap}km, exceeding the ${ODOMETER_DISCREPANCY_THRESHOLD_KM}km threshold.`,
        createdAt: now,
      });
    }
  }

  const handoverItemsByName = new Map(input.handover.removableItemInventory.map((entry) => [entry.item, entry]));
  for (const [name, handoverEntry] of handoverItemsByName) {
    if (!handoverEntry.present) continue; // wasn't present at handover, nothing to lose
    const returnEntry = input.returnInventory.find((entry) => entry.item === name);
    if (!returnEntry || !returnEntry.present) {
      flags.push({
        type: 'missing_item',
        description: `"${name}" was present at handover but is missing at return.`,
        itemName: name,
        createdAt: now,
      });
    } else if (returnEntry.condition === 'damaged' && handoverEntry.condition !== 'damaged') {
      flags.push({
        type: 'damaged_item',
        description: `"${name}" was in '${handoverEntry.condition}' condition at handover, now '${returnEntry.condition}'.`,
        itemName: name,
        createdAt: now,
      });
    }
  }

  if (input.damageNoted && input.damageNoted.trim()) {
    flags.push({
      type: 'new_damage',
      description: input.damageNoted.trim(),
      createdAt: now,
    });
  }

  return flags;
}

/** Creates the "return" side of a pair for the vehicle's current open
 * handover. Always succeeds (201) regardless of discrepancies — flags are
 * recorded on the record, never used to reject the request. This is the
 * acceptance criterion this task is explicitly tested against. */
export async function createReturn(input: CreateReturnInput): Promise<IVehicleHandover> {
  if (!mongoose.isValidObjectId(input.vehicleId)) throw new HandoverNotFoundError();

  // Pre-generate the return record's id so the "claim" step below can
  // atomically point the handover at it before the return document itself
  // exists — this is what makes the claim a single conditional write rather
  // than create-then-link (which would leave a window where two concurrent
  // returns both read isOpenForVehicle=true and both proceed to create a
  // return record against the same handover).
  const returnId = new mongoose.Types.ObjectId();

  // Atomically claim the vehicle's open handover: only a request that finds
  // isOpenForVehicle still `true` can clear it, in the same operation that
  // sets linkedReturnHandoverId. A concurrent second return request's
  // findOneAndUpdate matches nothing (the filter no longer matches once the
  // first request's update has applied) and gets `null` back — a real
  // atomic-conditional-write guard, not check-then-write.
  const openHandover = await VehicleHandover.findOneAndUpdate(
    { tenantId: input.tenantId, vehicleId: input.vehicleId, isOpenForVehicle: true },
    { $unset: { isOpenForVehicle: 1 }, $set: { linkedReturnHandoverId: returnId } },
    { new: false }, // return the PRE-update document — need its odometer/inventory to compare against
  );
  if (!openHandover) {
    throw new HandoverNotFoundError('No open handover exists for this vehicle to return against.');
  }

  const returnInventory = input.removableItemInventory || [];
  const flags = computeDiscrepancyFlags({
    handover: openHandover,
    returnOdometerReading: input.odometerReading,
    returnInventory,
    damageNoted: input.damageNoted,
    expectedTripDistanceKm: input.expectedTripDistanceKm,
  });

  const now = new Date();
  try {
    const returnRecord = await VehicleHandover.create({
      _id: returnId,
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      driverId: openHandover.driverId,
      bookingId: openHandover.bookingId,
      direction: 'return',
      odometerReading: input.odometerReading,
      fuelLevel: input.fuelLevel,
      conditionPhotos: input.conditionPhotos || [],
      removableItemInventory: returnInventory,
      damageNoted: input.damageNoted,
      flags,
      driverAcceptance: { accepted: false },
      staffConductedBy: input.staffConductedBy,
      conductedAt: now,
      linkedReturnHandoverId: openHandover._id,
      // Flagged records are 'disputed' (this task's pending-review state) —
      // never blocked, always created. See computeDiscrepancyFlags's callers
      // and this file's header comment.
      status: flags.length > 0 ? 'disputed' : 'pending_driver_acceptance',
      // Not itself an open slot — the vehicle's open slot was the HANDOVER
      // record just closed above.
    });
    return returnRecord;
  } catch (error) {
    // Extremely unlikely (the id is a fresh ObjectId), but if the insert
    // somehow fails, put the handover's open slot back rather than leaving
    // the vehicle permanently un-returnable.
    await VehicleHandover.updateOne(
      { _id: openHandover._id },
      { $set: { isOpenForVehicle: true }, $unset: { linkedReturnHandoverId: 1 } },
    );
    throw error;
  }
}
