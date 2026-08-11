// Wires the currently-dead `tripType` field (audit finding #3: declared
// and required on the client Zod schema at enhanced-booking-form.tsx:49,
// submitted in every create request per the form's createBookingMutation
// (enhanced-booking-form.tsx:454 spreads `...data` into the POST body),
// but silently stripped by mongoBookingSchema.parse() because it was
// never declared there, and never declared on IBooking/BookingSchema at
// all — so it never survived to the database. invoiceService.ts:117
// already reads `(booking as any).tripType` expecting it to be there.
//
// This file itself only re-exports the shared enum (see types.ts, kept as
// the single source both the Zod fragment in bookingCertaintySchema.ts
// and the Mongoose field addition proposed in the report reference) and
// adds a display-only legacy fallback — there is nothing to "fix" beyond
// declaring the field in the two schemas that were dropping it, since the
// client already sends the right value.
import { TRIP_TYPES, type TripType } from './types';

export { TRIP_TYPES };
export type { TripType };

// Every booking created before this task predates tripType entirely (it
// was never persisted, so there is no real historical value to recover —
// unlike travelDateStatus, whose absence has one unambiguous correct
// meaning). This resolver is therefore explicitly a DISPLAY fallback for
// read surfaces that want *something* to show (matches the client form's
// own default selection, enhanced-booking-form.tsx:173) — never write
// this value back onto a document; a legacy document's tripType field
// stays genuinely absent/unknown, which is the honest state.
export function resolveTripTypeForDisplay(booking: { tripType?: TripType | null }): TripType {
  return booking.tripType ?? 'one_way';
}
