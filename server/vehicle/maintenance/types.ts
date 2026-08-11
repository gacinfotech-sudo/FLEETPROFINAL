// TASK-VEHICLE-MAINTENANCE-03 — maintenance engine, tyre/battery lifecycle,
// structured inventory catalog. See docs/vehicle-research/VEHICLE-360-SPEC.md
// ("Data model summary") and VEHICLE-REAL-WORLD-RESEARCH.md §3 (the
// "whichever trigger fires first" rule, confirmed real industry practice,
// not invented here).
//
// Consumes OperationalStatus from ../core/types (TASK-VEHICLE-DOMAIN-01) —
// MAINTENANCE_DUE/IN_MAINTENANCE are that task's status values; this module
// only computes WHEN a vehicle should transition into them, it does not own
// the enum itself.

export type MaintenanceTriggerType = 'DATE' | 'ODOMETER' | 'ENGINE_HOURS' | 'DIAGNOSTIC_ALERT';

export type MaintenanceCategory =
  | 'OIL_CHANGE'
  | 'FILTER_REPLACEMENT'
  | 'BRAKE_SERVICE'
  | 'GENERAL_SERVICE'
  | 'MAJOR_OVERHAUL'
  | 'OTHER';

export type MaintenanceRecordStatus = 'DUE' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export interface MaintenanceScheduleConfig {
  /** Next service due by this calendar date, if a date-based trigger is configured. */
  nextDueDate?: Date;
  /** Next service due once the vehicle's odometer reaches this value (km). */
  nextDueKm?: number;
  /** Next service due once cumulative engine hours reach this value. */
  nextDueEngineHours?: number;
}

export interface MaintenanceRecord {
  tenantId: string;
  vehicleId: string;
  category: MaintenanceCategory;
  description?: string;
  status: MaintenanceRecordStatus;

  /** Snapshot of the vehicle's odometer/engine hours at the time this record
   * was created/serviced — never re-derived later from a possibly-changed
   * live vehicle reading. */
  odometerAtService?: number;
  engineHoursAtService?: number;
  serviceDate?: Date;

  /** The schedule this record sets for the NEXT occurrence — read by
   * evaluateMaintenanceTrigger() against the vehicle's current readings. */
  schedule: MaintenanceScheduleConfig;

  /** Which trigger actually fired to bring this record into DUE/OVERDUE —
   * set by evaluateMaintenanceTrigger(), not chosen by the caller, so the
   * reason is always the real one, not an assumption. */
  triggeredBy?: MaintenanceTriggerType;

  cost?: number;
  vendorName?: string;
  odometerReadingSource?: 'MANUAL' | 'GPS_TELEMETRY';

  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleCurrentReadings {
  odometerKm: number;
  engineHours?: number;
  asOfDate?: Date;
  /** A connected-telematics diagnostic alert already fired for this vehicle
   * (e.g. check-engine light via GPS_TELEMETRY) — surfaced by the GPS module,
   * consumed here as a plain boolean per this task's scope (no GPS import). */
  hasActiveDiagnosticAlert?: boolean;
}

export interface MaintenanceTriggerResult {
  due: boolean;
  /** Every trigger that is currently past-due, not just the first one found —
   * useful for a UI badge ("2 triggers overdue") even though only one
   * `triggeredBy` is recorded on the record itself (the one that fired
   * FIRST, chronologically/by-magnitude, per the "whichever comes first"
   * rule). Empty when `due` is false. */
  firedTriggers: MaintenanceTriggerType[];
  /** The single trigger considered to have caused the due state — matches
   * industry convention of citing one primary reason even when several
   * triggers have since also crossed their threshold. */
  primaryTrigger?: MaintenanceTriggerType;
}

// ---- Tyres ----

export type TyrePosition =
  | 'FRONT_LEFT' | 'FRONT_RIGHT' | 'REAR_LEFT' | 'REAR_RIGHT'
  | 'REAR_LEFT_INNER' | 'REAR_RIGHT_INNER' | 'SPARE';

export interface TyreRecord {
  tenantId: string;
  vehicleId: string;
  position: TyrePosition;
  brand?: string;
  serialNumber?: string;
  purchaseCost: number;
  purchaseDate: Date;
  installationOdometerKm: number;
  /** Set only once removed/replaced — an in-service tyre has neither of
   * these, and tyre-life/cost-per-km must be computed against the
   * vehicle's CURRENT odometer instead (see tyreLifeCalculations.ts). */
  removalOdometerKm?: number;
  removalDate?: Date;
  removalReason?: 'WORN_OUT' | 'PUNCTURE_UNREPAIRABLE' | 'DAMAGE' | 'ROTATED_OUT' | 'OTHER';
  status: 'IN_SERVICE' | 'REMOVED' | 'RETREADED' | 'SCRAPPED';

  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

// ---- Battery ----

export interface BatteryRecord {
  tenantId: string;
  vehicleId: string;
  brand?: string;
  serialNumber?: string;
  capacityAh?: number;
  purchaseCost: number;
  purchaseDate: Date;
  installationDate: Date;
  warrantyMonths?: number;
  removalDate?: Date;
  removalReason?: 'DEAD' | 'DAMAGE' | 'WARRANTY_REPLACEMENT' | 'OTHER';
  status: 'IN_SERVICE' | 'REMOVED';

  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

// ---- Structured inventory catalog ----
// Closes the gap confirmed in CURRENT-FLEET-MODULE-AUDIT.md: today's
// VehicleHandover.removableItemInventory is free-text per-handover-event
// only (present/damaged/missing at that moment) — this catalog is the
// persistent, purchase-dated record an inventory ITEM has across its own
// lifetime, which a handover event can reference by name (see this task's
// report for the proposed reference pattern; wiring the two together is
// explicitly out of this task's scope).

export type InventoryItemCategory =
  | 'SPARE_TYRE' | 'JACK' | 'TOOLKIT' | 'FIRE_EXTINGUISHER' | 'FIRST_AID_KIT'
  | 'WARNING_TRIANGLE' | 'TOW_ROPE' | 'OTHER';

export interface VehicleInventoryItem {
  tenantId: string;
  vehicleId: string;
  category: InventoryItemCategory;
  name: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  warrantyExpiryDate?: Date;
  status: 'PRESENT' | 'MISSING' | 'DAMAGED' | 'REPLACED';

  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}
