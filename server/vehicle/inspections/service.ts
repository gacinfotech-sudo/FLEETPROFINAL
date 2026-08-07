import mongoose from 'mongoose';
import { DailyInspection, type InspectionDefectSeverity } from './models/dailyInspection';

export interface RecordInspectionInput {
  tenantId: string;
  vehicleId: string;
  inspectedBy: string;
  inspectedAt?: Date;
  odometerReading?: number;
  notes?: string;
  defects?: Array<{ description: string; severity: InspectionDefectSeverity }>;
}

export async function recordDailyInspection(input: RecordInspectionInput) {
  return DailyInspection.create({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    inspectedBy: input.inspectedBy,
    inspectedAt: input.inspectedAt ?? new Date(),
    odometerReading: input.odometerReading,
    notes: input.notes,
    defects: (input.defects ?? []).map((d) => ({ description: d.description, severity: d.severity })),
  });
}

export async function listDailyInspections(tenantId: string, vehicleId: string) {
  return DailyInspection.find({ tenantId, vehicleId }).sort({ inspectedAt: -1 }).lean();
}

export async function resolveInspectionDefect(params: {
  tenantId: string;
  vehicleId: string;
  inspectionId: string;
  defectId: string;
  resolvedBy: string;
  resolutionNotes?: string;
}) {
  if (!mongoose.isValidObjectId(params.inspectionId) || !mongoose.isValidObjectId(params.defectId)) return null;
  const inspection = await DailyInspection.findOne({
    _id: params.inspectionId,
    tenantId: params.tenantId,
    vehicleId: params.vehicleId,
  });
  if (!inspection) return null;
  const defect = inspection.defects.id(params.defectId);
  if (!defect) return null;
  defect.resolvedAt = new Date();
  defect.resolvedBy = params.resolvedBy;
  defect.resolutionNotes = params.resolutionNotes;
  await inspection.save();
  return inspection;
}

/**
 * Implements server/vehicle/core/types.ts's SafetyHoldFlag rule: a vehicle
 * with an unresolved CRITICAL Daily Inspection defect is SAFETY_HOLD,
 * independent of Operational status. No I/O beyond this one query — callers
 * (deriveBookingEligibility's future wiring) pass the resulting boolean in.
 */
export async function computeSafetyHold(tenantId: string, vehicleId: string): Promise<{ safetyHold: boolean; openCriticalDefects: Array<{ inspectionId: string; defectId: string; description: string; inspectedAt: Date }> }> {
  const inspections = await DailyInspection.find({
    tenantId,
    vehicleId,
    defects: { $elemMatch: { severity: 'CRITICAL', resolvedAt: { $exists: false } } },
  }).lean();

  const openCriticalDefects = inspections.flatMap((inspection) =>
    inspection.defects
      .filter((d) => d.severity === 'CRITICAL' && !d.resolvedAt)
      .map((d) => ({
        inspectionId: String(inspection._id),
        defectId: String(d._id),
        description: d.description,
        inspectedAt: inspection.inspectedAt,
      })),
  );

  return { safetyHold: openCriticalDefects.length > 0, openCriticalDefects };
}
