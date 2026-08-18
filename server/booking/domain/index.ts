// TASK-BOOKING-DOMAIN-02 barrel export (date-certainty axis only —
// vehicleId/resourceFulfilmentStatus are out of scope, see types.ts).
// Nothing outside this directory (and
// tests/e2e/booking-domain-*.spec.ts) imports from here yet — wiring it
// into server/models/index.ts / server/schemas/mongodb-schemas.ts /
// server/routes.ts is the Integrator's job, per the exact patch blocks in
// .claude/tasks/reports/TASK-BOOKING-DOMAIN-02-REPORT.md.
export * from './types';
export * from './legacy';
export * from './requiredRules';
export * from './tripType';
export * from './revisionHistory';
export * from './bookingCertaintySchema';
