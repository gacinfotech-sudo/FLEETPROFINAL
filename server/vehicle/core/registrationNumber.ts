// Re-exports the existing, proven registration-number normalizer rather than
// duplicating it — CURRENT-FLEET-MODULE-AUDIT.md §11 identifies
// `normalizeRegistrationNumber` (server/services/vendorVehicleService.ts) as
// the exact pattern to copy for owned-fleet vehicles, so this module reuses
// the same function (single source of truth for what "the same registration
// number" means across owned-fleet and vendor vehicles) instead of writing a
// second, potentially-drifting implementation.
export { normalizeRegistrationNumber } from '../../services/vendorVehicleService';
