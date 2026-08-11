import { MaintenanceRecord, type IMaintenanceRecord } from './models';
import { evaluateMaintenanceTrigger } from './triggerEvaluation';
import type { MaintenanceCategory, MaintenanceScheduleConfig, VehicleCurrentReadings } from './types';

export interface CreateMaintenanceRecordInput {
  tenantId: string;
  vehicleId: string;
  category: MaintenanceCategory;
  description?: string;
  schedule?: MaintenanceScheduleConfig;
  cost?: number;
  vendorName?: string;
  odometerAtService?: number;
  engineHoursAtService?: number;
  serviceDate?: Date;
  createdBy: { userId: string; role: string };
}

export async function createMaintenanceRecord(input: CreateMaintenanceRecordInput): Promise<IMaintenanceRecord> {
  return MaintenanceRecord.create({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    category: input.category,
    description: input.description,
    status: 'SCHEDULED',
    schedule: input.schedule ?? {},
    cost: input.cost,
    vendorName: input.vendorName,
    odometerAtService: input.odometerAtService,
    engineHoursAtService: input.engineHoursAtService,
    serviceDate: input.serviceDate,
    createdBy: input.createdBy,
  });
}

export async function listMaintenanceRecordsForVehicle(tenantId: string, vehicleId: string): Promise<IMaintenanceRecord[]> {
  return MaintenanceRecord.find({ tenantId, vehicleId }).sort({ createdAt: -1 });
}

export interface CompleteMaintenanceInput {
  tenantId: string;
  recordId: string;
  serviceDate: Date;
  odometerAtService?: number;
  engineHoursAtService?: number;
  cost?: number;
  vendorName?: string;
  /** The NEXT schedule to set once this service is complete — e.g. "next
   * oil change due in 5000km / 6 months, whichever first." Optional: not
   * every maintenance category recurs (e.g. a one-off repair). */
  nextSchedule?: MaintenanceScheduleConfig;
}

export class MaintenanceRecordNotFoundError extends Error {}

export async function completeMaintenanceRecord(input: CompleteMaintenanceInput): Promise<IMaintenanceRecord> {
  const record = await MaintenanceRecord.findOne({ _id: input.recordId, tenantId: input.tenantId });
  if (!record) throw new MaintenanceRecordNotFoundError(`Maintenance record ${input.recordId} not found`);

  record.status = 'COMPLETED';
  record.serviceDate = input.serviceDate;
  if (input.odometerAtService !== undefined) record.odometerAtService = input.odometerAtService;
  if (input.engineHoursAtService !== undefined) record.engineHoursAtService = input.engineHoursAtService;
  if (input.cost !== undefined) record.cost = input.cost;
  if (input.vendorName !== undefined) record.vendorName = input.vendorName;
  await record.save();

  // A completed service that recurs creates its OWN next record rather
  // than mutating this one's schedule in place — preserves this record as
  // an immutable history entry of what was actually done and when.
  if (input.nextSchedule) {
    return createMaintenanceRecord({
      tenantId: input.tenantId,
      vehicleId: String(record.vehicleId),
      category: record.category,
      description: record.description,
      schedule: input.nextSchedule,
      createdBy: record.createdBy,
    });
  }
  return record;
}

/**
 * Sweeps a vehicle's open (SCHEDULED/DUE) maintenance records against its
 * current readings and flips any that have crossed a trigger into
 * DUE/OVERDUE — the one place `evaluateMaintenanceTrigger` gets wired to
 * real persisted records. Returns the records that changed state this
 * call, so a caller (e.g. a scheduled job, or an on-demand check from the
 * Vehicle 360 Maintenance tab) can react (e.g. set the vehicle's
 * OperationalStatus to MAINTENANCE_DUE).
 */
export async function sweepDueMaintenanceForVehicle(
  tenantId: string,
  vehicleId: string,
  currentReadings: VehicleCurrentReadings,
): Promise<IMaintenanceRecord[]> {
  const openRecords = await MaintenanceRecord.find({
    tenantId, vehicleId, status: { $in: ['SCHEDULED', 'DUE'] },
  });

  const changed: IMaintenanceRecord[] = [];
  for (const record of openRecords) {
    const result = evaluateMaintenanceTrigger(
      { nextDueDate: record.schedule?.nextDueDate, nextDueKm: record.schedule?.nextDueKm, nextDueEngineHours: record.schedule?.nextDueEngineHours },
      currentReadings,
    );
    if (result.due && record.status !== 'DUE') {
      record.status = 'DUE';
      record.triggeredBy = result.primaryTrigger;
      await record.save();
      changed.push(record);
    }
  }
  return changed;
}
