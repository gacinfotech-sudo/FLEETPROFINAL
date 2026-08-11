import { TyreRecord, BatteryRecord, type ITyreRecord, type IBatteryRecord } from './models';
import { calculateTyreLifeKm, calculateTyreCostPerKm } from './tyreCalculations';
import type { TyrePosition } from './types';

export class DuplicateInServiceTyreError extends Error {}
export class TyreRecordNotFoundError extends Error {}

export interface InstallTyreInput {
  tenantId: string;
  vehicleId: string;
  position: TyrePosition;
  brand?: string;
  serialNumber?: string;
  purchaseCost: number;
  purchaseDate: Date;
  installationOdometerKm: number;
  createdBy: { userId: string; role: string };
}

export async function installTyre(input: InstallTyreInput): Promise<ITyreRecord> {
  try {
    return await TyreRecord.create({
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      position: input.position,
      brand: input.brand,
      serialNumber: input.serialNumber,
      purchaseCost: input.purchaseCost,
      purchaseDate: input.purchaseDate,
      installationOdometerKm: input.installationOdometerKm,
      status: 'IN_SERVICE',
      createdBy: input.createdBy,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new DuplicateInServiceTyreError(
        `Position ${input.position} already has an in-service tyre on this vehicle — remove it first.`
      );
    }
    throw error;
  }
}

export interface RemoveTyreInput {
  tenantId: string;
  tyreRecordId: string;
  removalOdometerKm: number;
  removalDate: Date;
  removalReason: 'WORN_OUT' | 'PUNCTURE_UNREPAIRABLE' | 'DAMAGE' | 'ROTATED_OUT' | 'OTHER';
  /** RETREADED/SCRAPPED are both terminal "removed" outcomes but tracked
   * distinctly for fleet reporting — default REMOVED covers the common case. */
  finalStatus?: 'REMOVED' | 'RETREADED' | 'SCRAPPED';
}

export async function removeTyre(input: RemoveTyreInput): Promise<{ record: ITyreRecord; lifeKm: number; costPerKm: number | null }> {
  const record = await TyreRecord.findOne({ _id: input.tyreRecordId, tenantId: input.tenantId, status: 'IN_SERVICE' });
  if (!record) throw new TyreRecordNotFoundError(`In-service tyre record ${input.tyreRecordId} not found`);

  record.removalOdometerKm = input.removalOdometerKm;
  record.removalDate = input.removalDate;
  record.removalReason = input.removalReason;
  record.status = input.finalStatus ?? 'REMOVED';
  await record.save();

  return {
    record,
    lifeKm: calculateTyreLifeKm(record),
    costPerKm: calculateTyreCostPerKm(record),
  };
}

export async function listTyresForVehicle(tenantId: string, vehicleId: string): Promise<ITyreRecord[]> {
  return TyreRecord.find({ tenantId, vehicleId }).sort({ createdAt: -1 });
}

// ---- Battery ----

export class DuplicateInServiceBatteryError extends Error {}
export class BatteryRecordNotFoundError extends Error {}

export interface InstallBatteryInput {
  tenantId: string;
  vehicleId: string;
  brand?: string;
  serialNumber?: string;
  capacityAh?: number;
  purchaseCost: number;
  purchaseDate: Date;
  installationDate: Date;
  warrantyMonths?: number;
  createdBy: { userId: string; role: string };
}

export async function installBattery(input: InstallBatteryInput): Promise<IBatteryRecord> {
  try {
    return await BatteryRecord.create({
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      brand: input.brand,
      serialNumber: input.serialNumber,
      capacityAh: input.capacityAh,
      purchaseCost: input.purchaseCost,
      purchaseDate: input.purchaseDate,
      installationDate: input.installationDate,
      warrantyMonths: input.warrantyMonths,
      status: 'IN_SERVICE',
      createdBy: input.createdBy,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new DuplicateInServiceBatteryError('This vehicle already has an in-service battery — remove it first.');
    }
    throw error;
  }
}

export interface RemoveBatteryInput {
  tenantId: string;
  batteryRecordId: string;
  removalDate: Date;
  removalReason: 'DEAD' | 'DAMAGE' | 'WARRANTY_REPLACEMENT' | 'OTHER';
}

export async function removeBattery(input: RemoveBatteryInput): Promise<IBatteryRecord> {
  const record = await BatteryRecord.findOne({ _id: input.batteryRecordId, tenantId: input.tenantId, status: 'IN_SERVICE' });
  if (!record) throw new BatteryRecordNotFoundError(`In-service battery record ${input.batteryRecordId} not found`);

  record.removalDate = input.removalDate;
  record.removalReason = input.removalReason;
  record.status = 'REMOVED';
  await record.save();
  return record;
}

export async function listBatteriesForVehicle(tenantId: string, vehicleId: string): Promise<IBatteryRecord[]> {
  return BatteryRecord.find({ tenantId, vehicleId }).sort({ createdAt: -1 });
}
