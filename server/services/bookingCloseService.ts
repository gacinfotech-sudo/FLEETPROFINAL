/**
 * Booking Close Eligibility Service
 *
 * Evaluates whether a booking can be closed and identifies blocking reasons
 * and required next actions. Handles both self-drive and with-driver bookings
 * with proper error handling for missing data.
 */

import { Booking, PaymentTransaction } from '../models/index';
import { SelfDriveTrip } from '../booking/self-drive';

export interface CloseEligibility {
  eligible: boolean;
  blockingReasons: string[];
  nextActions: string[];
}

/**
 * Checks if a booking is eligible to be closed.
 *
 * Evaluates multiple conditions:
 * 1. Booking exists
 * 2. For self-drive: refund is settled (closed/forfeited)
 * 3. For self-drive: security deposit is settled (refunded/forfeited)
 * 4. All payment is collected (no balance due)
 *
 * @param bookingId - MongoDB ObjectId or string ID of the booking
 * @param tenantId - Optional tenant ID for multi-tenant filtering
 * @returns CloseEligibility object with eligible flag, blocking reasons, and next actions
 */
export async function canCloseBooking(
  bookingId: string,
  tenantId?: string,
): Promise<CloseEligibility> {
  try {
    // Fetch booking with basic validation
    const booking = await Booking.findOne({
      _id: bookingId,
      ...(tenantId && { tenantId }),
    });

    if (!booking) {
      return {
        eligible: false,
        blockingReasons: ['Booking not found'],
        nextActions: [],
      };
    }

    const blockingReasons: string[] = [];
    const nextActions: string[] = [];

    // Check 1: Refund (self-drive only)
    if (booking.bookingType === 'self_drive') {
      try {
        const trip = await SelfDriveTrip.findOne({ bookingId: booking._id });

        if (trip?.refund && !['closed', 'forfeited'].includes(trip.refund.status)) {
          blockingReasons.push(`Refund ${trip.refund.status}`);
          if (!nextActions.includes('Complete refund deductions and payment')) {
            nextActions.push('Complete refund deductions and payment');
          }
        }
      } catch (err) {
        // Silently skip if SelfDriveTrip not available or error accessing it
        console.debug(
          `[bookingCloseService] Warning: Could not fetch SelfDriveTrip for booking ${bookingId}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // Check 2: Payment balance
    try {
      const transactions = await PaymentTransaction.find({
        bookingId: booking._id,
      });

      let totalReceived = 0;

      for (const t of transactions) {
        if (t.status !== 'completed') continue;

        // Add received payments
        if (
          ['advance', 'partial_payment', 'final_payment', 'driver_collection', 'vendor_collection'].includes(
            t.paymentType,
          )
        ) {
          totalReceived += t.amount;
        }
        // Subtract refunds
        else if (t.paymentType === 'refund') {
          totalReceived -= t.amount;
        }
        // Add adjustments (credits)
        else if (t.paymentType === 'adjustment') {
          totalReceived += t.amount;
        }
      }

      const remainingBalance = Math.max(0, booking.totalAmount - totalReceived);

      if (remainingBalance > 0) {
        blockingReasons.push(`Payment ₹${remainingBalance} due`);
        if (!nextActions.includes('Collect remaining payment')) {
          nextActions.push('Collect remaining payment');
        }
      }
    } catch (err) {
      // Silently skip payment check if error — don't block close on DB issues
      console.debug(
        `[bookingCloseService] Warning: Could not fetch PaymentTransaction for booking ${bookingId}`,
        err instanceof Error ? err.message : String(err),
      );
    }

    // Check 3: Deposit settlement (self-drive only)
    if (booking.bookingType === 'self_drive' && booking.securityDepositStatus) {
      if (!['refunded', 'forfeited'].includes(booking.securityDepositStatus)) {
        blockingReasons.push('Security deposit settlement incomplete');
        if (!nextActions.includes('Complete deposit refund process')) {
          nextActions.push('Complete deposit refund process');
        }
      }
    }

    return {
      eligible: blockingReasons.length === 0,
      blockingReasons,
      nextActions: Array.from(new Set(nextActions)), // Deduplicate actions
    };
  } catch (err) {
    // Outer catch for unexpected errors — return ineligible with error context
    console.error('[bookingCloseService] Unexpected error in canCloseBooking:', err);
    return {
      eligible: false,
      blockingReasons: ['Error checking close eligibility'],
      nextActions: ['Contact support'],
    };
  }
}
