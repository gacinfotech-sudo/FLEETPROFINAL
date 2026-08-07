/**
 * Single source of truth for booking money math.
 *
 * Why this exists: `enhanced-booking-form.tsx` used to inline the same
 * "final total" formula independently in three places (submit payload,
 * live Final Total summary, live Remaining Balance summary), each doing
 * plain floating-point rupee arithmetic. Nothing disagreed *yet*, but any
 * future edit to one copy and not the others is a live drift risk — and
 * floating-point rupee addition/subtraction (e.g. repeated 33.33s) can
 * itself introduce sub-rupee drift that rounds visibly wrong.
 *
 * The fix: do all arithmetic in integer minor units (paise) — integers
 * never accumulate floating-point rounding error under +/- — then convert
 * back to rupees once, at the boundary, for display/payload use.
 */

const PAISE_PER_RUPEE = 100;

/**
 * Converts a rupee amount (as typed into a form field — may be `undefined`,
 * `null`, or `NaN` for an empty/untouched field) into an integer number of
 * paise. Missing/invalid input is treated as zero so every call site here
 * can pass raw form values straight through without its own `|| 0` guard.
 */
export function toPaise(rupees: number | null | undefined): number {
  if (rupees === null || rupees === undefined || Number.isNaN(rupees)) {
    return 0;
  }
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** Converts an integer paise amount back into a rupee number. */
export function fromPaise(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

export interface BookingChargeInputs {
  /** Base fare / editable final amount. */
  amount?: number | null;
  tollCharges?: number | null;
  parkingCharges?: number | null;
  miscellaneousAmount?: number | null;
  /** Fuel charges are deductions, subtracted from the total below. */
  petrolCharges?: number | null;
  dieselCharges?: number | null;
  cngCharges?: number | null;
}

/**
 * The booking "final total" formula, in integer paise:
 *   base + toll + parking + misc - (petrol + diesel + cng)
 *
 * This is the one formula previously duplicated at
 * enhanced-booking-form.tsx:640 (submit payload), :~2950 (Final Total
 * summary) and :~3158 (Remaining Balance summary). All three now call this
 * function (or `calculateBookingFinalTotal` below) instead of inlining it.
 */
export function calculateBookingFinalTotalPaise(charges: BookingChargeInputs): number {
  return (
    toPaise(charges.amount) +
    toPaise(charges.tollCharges) +
    toPaise(charges.parkingCharges) +
    toPaise(charges.miscellaneousAmount) -
    toPaise(charges.petrolCharges) -
    toPaise(charges.dieselCharges) -
    toPaise(charges.cngCharges)
  );
}

/** Same as {@link calculateBookingFinalTotalPaise}, returned in rupees. */
export function calculateBookingFinalTotal(charges: BookingChargeInputs): number {
  return fromPaise(calculateBookingFinalTotalPaise(charges));
}

/**
 * Remaining balance owed after advance payment and/or reward-point
 * redemption are subtracted from the final total. Never goes below zero.
 *
 * Advance received (and redemption) may only ever reduce the *remaining
 * balance* — never the final total or the base amount. Callers must not
 * feed `advanceReceived` into {@link calculateBookingFinalTotal}.
 *
 * `redemptionDiscountRupees` is a separate rupee discount (e.g. reward
 * points already converted to a rupee value by the caller) applied only
 * to the remaining balance, matching the existing behaviour at
 * enhanced-booking-form.tsx's Remaining Balance summary.
 */
export function calculateRemainingBalancePaise(
  charges: BookingChargeInputs,
  advanceReceived?: number | null,
  redemptionDiscountRupees?: number | null,
): number {
  const finalTotalPaise = calculateBookingFinalTotalPaise(charges);
  const deductionsPaise = toPaise(advanceReceived) + toPaise(redemptionDiscountRupees);
  return Math.max(0, finalTotalPaise - deductionsPaise);
}

/** Same as {@link calculateRemainingBalancePaise}, returned in rupees. */
export function calculateRemainingBalance(
  charges: BookingChargeInputs,
  advanceReceived?: number | null,
  redemptionDiscountRupees?: number | null,
): number {
  return fromPaise(calculateRemainingBalancePaise(charges, advanceReceived, redemptionDiscountRupees));
}
