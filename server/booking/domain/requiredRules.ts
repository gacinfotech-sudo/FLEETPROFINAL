// Pure predicate functions backing the Mongoose-layer "conditionally
// required" rule proposed for server/models/index.ts's `pickupDate` path.
// Mongoose's idiomatic way to express "required depending on a sibling
// field" is `required: function(this) { return <bool>; }` — the function
// is called with `this` bound to the document being validated. Keeping
// the actual boolean logic here (rather than inline in the schema
// definition the Integrator applies) means it's unit-testable against
// plain objects without booting Mongoose at all, and the Zod-layer
// refine in bookingCertaintySchema.ts and this file can be checked
// against each other for drift.
//
// This is the SECOND line of defense — the primary gate is the Zod
// schema in bookingCertaintySchema.ts, which runs first in routes.ts and
// returns a clean 400 instead of a raw Mongoose ValidationError. This
// layer exists for every write path that does NOT go through that route
// (data imports, migration scripts, `Booking.create()` called directly
// from another service).
//
// NOTE (scope, 2026-08-07 revision): `vehicleId`'s conditional-required
// rule is explicitly OUT of scope for this task — it already shipped on
// this worktree's base branch via `resourceFulfilmentStatus` (merged to
// trunk at `1da105b`). This file only covers the date-certainty axis.

interface PickupDateRuleInput {
  travelDateStatus?: string | null;
}

export function isPickupDateRequired(doc: PickupDateRuleInput): boolean {
  // Same rule as legacy.ts's resolveTravelDateStatus — absent/'confirmed'
  // requires a real pickupDate; 'range'/'not_decided' do not.
  return !doc.travelDateStatus || doc.travelDateStatus === 'confirmed';
}

interface TentativeRangeRuleInput {
  travelDateStatus?: string | null;
}

export function isTentativeRangeRequired(doc: TentativeRangeRuleInput): boolean {
  return doc.travelDateStatus === 'range';
}
