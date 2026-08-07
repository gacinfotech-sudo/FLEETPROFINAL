// The actual, runnable server-side validation contract for
// TASK-BOOKING-DOMAIN-02 (date-certainty axis only — `vehicleId`/
// `resourceFulfilmentStatus` are explicitly OUT of scope per the
// 2026-08-07 task revision: they already shipped on this worktree's base
// branch, `repair/flexible-booking-vendor-outsourcing` @ `9049d33`,
// merged to trunk at `1da105b`. This module does not touch that field or
// vocabulary at all — see types.ts's header comment), expressed as a
// composition ON TOP OF the real `mongoBookingSchema` exported by
// server/schemas/mongodb-schemas.ts — NOT a reimplementation of it.
// `.extend()`/`.superRefine()` return new Zod objects; nothing here
// mutates the protected file, but `mongoBookingSchemaWithCertainty`
// below is a real, fully working schema that can be `.parse()`d today,
// which is what this task's own tests use to prove the logic against the
// actual base schema rather than a mocked stand-in.
//
// The Integrator's one-line change in routes.ts (see the report) is
// swapping `mongoBookingSchema.parse(mappedData)` for
// `mongoBookingSchemaWithCertainty.parse(mappedData)`.
import { z } from 'zod';
import { mongoBookingSchema } from '../../schemas/mongodb-schemas';
import { TRAVEL_DATE_STATUSES, TRIP_TYPES } from './types';

// Same "must be declared or Zod silently strips it" trap the schema's own
// comments already document for createdBy/idempotencyKey (mongodb-
// schemas.ts) — this is exactly how tripType went dead in the first place
// (audit finding #3): present on the client schema, absent here, so
// .parse() silently dropped it on every single booking ever created.
const certaintyFields = {
  // Re-declared (not just added) — Zod's .extend() lets a later key
  // override an earlier one with the same name, which is how this schema
  // relaxes pickupDate from the base schema's `z.string()` (effectively
  // required) to optional without editing mongodb-schemas.ts itself. The
  // actual conditional-requirement rule is enforced in the .superRefine
  // below, not by Zod's static shape (which can't see sibling fields).
  // vehicleId is deliberately NOT touched here — it's already optional on
  // the base schema and its own conditional-requirement rule (vehicleId
  // OR resourceAssignmentPending) already runs in routes.ts, out of
  // scope for this task.
  pickupDate: z.string().optional(),

  travelDateStatus: z.enum(TRAVEL_DATE_STATUSES).optional(),
  tentativeStartDate: z.string().optional(),
  tentativeEndDate: z.string().optional(),
  followUpAt: z.string().optional(),
  // lastActivityAt is deliberately NOT accepted from the client on
  // create/update — it's a server-derived "last touched" signal (see
  // legacy.ts's resolveLastActivityAt), not something a caller should be
  // able to backdate/forge through the booking payload.

  tripType: z.enum(TRIP_TYPES).optional(),
};

function parseDateOrUndefined(v: unknown): Date | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? undefined : d;
}

// The actual conditional-requirement rule for the date-certainty axis,
// run once, shared by both mongoBookingSchemaWithCertainty (full create)
// and mongoBookingSchemaWithCertaintyPartial (edit) below so the two
// paths can never drift.
const rawCertaintyRefine = (data: any, ctx: z.RefinementCtx) => {
  // Absent travelDateStatus on a freshly-submitted payload is NOT the
  // same legacy case resolveTravelDateStatus() handles (that's for
  // reading an old DB document back) — but the two must resolve to the
  // same value for a new document with no opinion supplied, which is
  // exactly 'confirmed', so a plain client that has never heard of this
  // field keeps getting today's "pickupDate is required" behavior with
  // zero change.
  const travelDateStatus = data.travelDateStatus ?? 'confirmed';

  if (travelDateStatus === 'confirmed') {
    if (!data.pickupDate || !String(data.pickupDate).trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickupDate'],
        message: "pickupDate is required when travelDateStatus is 'confirmed' (the default).",
      });
    }
  } else if (travelDateStatus === 'range') {
    if (!data.tentativeStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tentativeStartDate'],
        message: "tentativeStartDate is required when travelDateStatus is 'range'.",
      });
    }
    if (!data.tentativeEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tentativeEndDate'],
        message: "tentativeEndDate is required when travelDateStatus is 'range'.",
      });
    }
    const start = parseDateOrUndefined(data.tentativeStartDate);
    const end = parseDateOrUndefined(data.tentativeEndDate);
    if (start && end && end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tentativeEndDate'],
        message: 'tentativeEndDate cannot be before tentativeStartDate.',
      });
    }
  }
  // travelDateStatus === 'not_decided': no date field required. pickupDate
  // is intentionally left alone if the caller still sent one (a booking
  // can move from not_decided to range to confirmed over time without
  // ever losing data it already had) — this schema never invents a
  // placeholder pickup date either, it just doesn't require one.
};

// Full create-time schema: every base-schema field stays exactly as
// required/optional as it already is (customerName, totalAmount,
// bookingType, vehicleId/its own already-shipped conditional rule, ...)
// — only pickupDate moves from unconditionally required to conditionally
// required, and travelDateStatus/tentativeStartDate/tentativeEndDate/
// followUpAt/tripType are newly accepted.
export const mongoBookingSchemaWithCertainty = mongoBookingSchema
  .extend(certaintyFields)
  .superRefine(rawCertaintyRefine);

// Edit-time schema: mirrors routes.ts's existing
// `mongoBookingSchema.partial().parse(req.body)` for PUT /api/bookings/:id
// — every field optional, INCLUDING the conditional pair, because a
// partial update touching only (say) `notes` must not suddenly demand
// pickupDate just because it wasn't in this particular request body. The
// refine only fires when the caller is actually touching the
// date-certainty fields in this request.
export const mongoBookingSchemaWithCertaintyPartial = mongoBookingSchema
  .extend(certaintyFields)
  .partial()
  .superRefine((data: any, ctx) => {
    const touchesDateCertainty =
      'travelDateStatus' in data || 'pickupDate' in data || 'tentativeStartDate' in data || 'tentativeEndDate' in data;
    if (touchesDateCertainty) {
      rawCertaintyRefine(data, ctx);
    }
  });

export type BookingCertaintyInput = z.infer<typeof mongoBookingSchemaWithCertainty>;
