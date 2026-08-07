// Status-dimension types for owned-fleet Vehicle 360 (TASK-VEHICLE-DOMAIN-01).
// Four independent axes per docs/vehicle-research/VEHICLE-360-SPEC.md's "Status
// dimensions" section — never collapsed into one generic flag. Every other
// Wave 2/3 task in this batch imports these types (via their own report,
// since server/models/index.ts is Integrator-only and hasn't been patched
// with the real enum yet) rather than inventing their own status strings.

/** Extends today's 3-value `IVehicle.status` (`available|on_trip|maintenance`)
 * as an additive superset — every existing value remains valid. */
export type OperationalStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'ASSIGNED'
  | 'ON_TRIP'
  | 'RETURNING'
  | 'CLEANING'
  | 'MAINTENANCE_DUE'
  | 'IN_MAINTENANCE'
  | 'BREAKDOWN'
  | 'ACCIDENT_HOLD'
  | 'INACTIVE'
  | 'SOLD';

/** Derivation rule owned by TASK-VEHICLE-COMPLIANCE-02
 * (VEHICLE-COMPLIANCE-MATRIX.md's "Compliance status derivation" section) —
 * this module only defines the shape, not how it's computed. */
export type ComplianceStatus =
  | 'COMPLIANT'
  | 'EXPIRING_SOON'
  | 'PENDING'
  | 'EXPIRED'
  | 'COMPLIANCE_HOLD';

/** Derived by the GPS tab once GpsVehicleLatestState merges (not this task's
 * concern) — `NOT_CONFIGURED` is the correct default until then. */
export type GpsStatus = 'ONLINE' | 'STALE' | 'OFFLINE' | 'NOT_CONFIGURED';

/**
 * A vehicle with an unresolved CRITICAL Daily Inspection defect is
 * SAFETY_HOLD regardless of its Operational status — a cross-cutting flag,
 * not a value bolted onto the Operational enum (spec's explicit instruction).
 */
export type SafetyHoldFlag = boolean;
