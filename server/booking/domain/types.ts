// TASK-BOOKING-DOMAIN-02 (narrowed 2026-08-07) — shared types for the
// date-certainty domain model. `vehicleId`/`resourceFulfilmentStatus` are
// explicitly OUT of scope: they already shipped on this worktree's base
// branch (`repair/flexible-booking-vendor-outsourcing` @ `9049d33`,
// merged to trunk at `1da105b`) — see
// docs/booking-research/CURRENT-BOOKING-AUDIT.md's correction section.
// This module does not touch that field or vocabulary at all.
//
// Nothing here is wired into the live Booking model yet (that requires
// the Integrator to apply the patch in
// .claude/tasks/reports/TASK-BOOKING-DOMAIN-02-REPORT.md) — this file is
// the single source of truth both the Zod fragment
// (bookingCertaintySchema.ts) and the Mongoose "conditionally required"
// predicates (requiredRules.ts) build from, so the two layers can never
// drift out of sync with each other the way `tripType` did.

// Date-certainty axis. A booking can be vehicle-assigned (or not — that
// axis is already handled by resourceFulfilmentStatus, untouched by this
// task) with the travel date still a range/unknown (a customer who wants
// "our Innova, sometime in the first two weeks of next month").
//
// MUST default to 'confirmed' — every Booking document that predates this
// field was created back when pickupDate was unconditionally required, so
// its absence is never ambiguous: it always means a real, confirmed date
// was supplied. Defaulting the absent case to anything else would silently
// reclassify every historical booking as date-uncertain.
export const TRAVEL_DATE_STATUSES = ['confirmed', 'range', 'not_decided'] as const;
export type TravelDateStatus = typeof TRAVEL_DATE_STATUSES[number];

// Trip shape — kept strictly distinct from `bookingType`'s
// self_drive|with_driver axis (who drives) per the audit's finding #3.
// Values match the client's existing (currently dead-ended) Zod enum in
// enhanced-booking-form.tsx:49 exactly — do not diverge, TASK-BOOKING-UI-04
// coordinates off this file.
export const TRIP_TYPES = ['one_way', 'round_trip', 'local', 'airport'] as const;
export type TripType = typeof TRIP_TYPES[number];

// A single backdated, authorized correction — distinct from the existing
// rescheduleHistory[]/extensionHistory[] entries (which record a forward
// schedule change made through the normal reschedule/extend flow).
// "Backdated" here means: staff are correcting the record of something
// that already happened (or was recorded wrong) using today's tools, not
// scheduling a future change — e.g. "the pickup was actually at 9am, not
// 10am, fix the record" weeks after the trip completed. Every entry must
// carry a real reason; there is no code path in this module that can
// construct one without it (see revisionHistory.ts's
// buildBackdatedCorrectionEntry, which throws if reason is blank).
export interface BackdatedCorrectionEntry {
  fieldsChanged: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  reason: string;
  authorizedBy: { userId: string; role: string };
  correctedAt: Date;
}

// The full additive field set this task proposes on Booking. Kept as one
// named type so the Zod fragment, the Mongoose interface patch, and the
// legacy-read resolvers all reference the same shape. Deliberately does
// NOT include vehicleId/resourceFulfilmentStatus — out of scope.
export interface BookingCertaintyFields {
  travelDateStatus?: TravelDateStatus;
  tentativeStartDate?: Date;
  tentativeEndDate?: Date;
  followUpAt?: Date;
  lastActivityAt?: Date;
  updatedAt?: Date;
  tripType?: TripType;
  revisionHistory?: BackdatedCorrectionEntry[];
}
