// TASK-VEHICLE-HANDOVER-05 — shared types.
// Governed by docs/driver-research/VEHICLE-HANDOVER-SPEC.md. A VehicleHandover
// record represents either the "handover" (staff gives vehicle to driver) or
// "return" (driver gives vehicle back to staff) side of one paired event —
// see models.ts's `linkedReturnHandoverId` for how the pair is linked.

export const HANDOVER_DIRECTIONS = ['handover', 'return'] as const;
export type HandoverDirection = typeof HANDOVER_DIRECTIONS[number];

// Per the spec's exact enum. 'disputed' doubles as this task's
// "flagged/pending-review" state for a return with discrepancies (missing
// item / new damage / large odometer gap) — reusing the spec's own value
// rather than inventing a fourth, per this initiative's stated preference for
// resolving ambiguity against an existing model instead of a new one (see
// TASK-DRIVER-DOMAIN-02's identical resolution for `lifecycleStage=suspended`).
// Critically: 'disputed' status never blocks the return record from being
// created, and never blocks the vehicle's isOpenForVehicle slot from closing —
// see returnService.ts.
export const HANDOVER_STATUSES = ['pending_driver_acceptance', 'accepted', 'disputed'] as const;
export type HandoverStatus = typeof HANDOVER_STATUSES[number];

export const REMOVABLE_ITEM_CONDITIONS = ['good', 'damaged', 'missing'] as const;
export type RemovableItemCondition = typeof REMOVABLE_ITEM_CONDITIONS[number];

export interface RemovableItemInventoryEntry {
  item: string;
  present: boolean;
  condition: RemovableItemCondition;
  notes?: string;
}

export interface ConditionPhotoRef {
  // Points into TASK-DRIVER-DOCUMENTS-03's document registry
  // (DriverDocument._id) — see documentIntegration.ts for why documentType
  // 'other' + a handover-derived label is used instead of the matrix's
  // 'vehicle_handover_acknowledgement' type (that type only supports one
  // live record per driver, which would silently collapse every handover's
  // photos for the same driver into a single evolving version chain).
  documentId: string;
  angle: 'front' | 'rear' | 'left' | 'right' | 'interior' | 'odometer' | 'other';
  takenAt: Date;
}

export const DISCREPANCY_FLAG_TYPES = ['missing_item', 'damaged_item', 'new_damage', 'odometer_discrepancy'] as const;
export type DiscrepancyFlagType = typeof DISCREPANCY_FLAG_TYPES[number];

export interface DiscrepancyFlag {
  type: DiscrepancyFlagType;
  description: string;
  itemName?: string;
  createdAt: Date;
}

// Large-odometer-discrepancy threshold (km) — flags, never blocks. Kept as a
// named constant rather than a magic number so it's one place to tune/make
// tenant-configurable later (out of scope for this task per the spec, which
// does not mention tenant-level configurability for this specific threshold).
export const ODOMETER_DISCREPANCY_THRESHOLD_KM = 50;
