/**
 * Next Action Service
 *
 * Calculates the most urgent next action required for a booking based on its
 * current state. Drives UI navigation and operational priority sequencing.
 *
 * Action priority hierarchy:
 * 1. critical   - Booking cannot close, immediate action required
 * 2. high       - Blocking close, but can wait briefly
 * 3. normal     - Post-close operations
 * 4. low        - Optional/informational
 */

import { PaymentTransaction } from '../models/index';
import { SelfDriveTrip } from '../booking/self-drive';
import type { IBooking } from '../models/index';

export interface NextAction {
  action: string; // Machine-readable action code
  label: string; // User-facing action label
  destination: string; // UI route to navigate to
  priority: 'critical' | 'high' | 'normal' | 'low';
  dueAt?: Date; // When this action is due
  blockingClose?: boolean; // Whether this action blocks booking closure
}

/**
 * Determines the next required action for a booking.
 *
 * For self-drive bookings, evaluates this sequence:
 * 1. Return vehicle (if not completed)
 * 2. Create settlement (if return done but settlement pending)
 * 3. Process refund (if settlement done but refund pending)
 * 4. Collect payment (if balance due)
 * 5. Close booking (if all above done)
 *
 * For with-driver bookings:
 * 1. Collect payment (if balance due after completion)
 * 2. Close booking (if payment done)
 *
 * @param booking - Booking document (required)
 * @returns NextAction object describing the most urgent required action
 * @throws Error if booking is null/undefined
 */
export async function getNextAction(booking: IBooking | any): Promise<NextAction> {
  if (!booking) {
    throw new Error('Booking required');
  }

  try {
    // Self-drive booking workflow
    if (booking.bookingType === 'self_drive') {
      try {
        const trip = await SelfDriveTrip.findOne({
          bookingId: booking._id,
        });

        // Step 1: Vehicle return not yet recorded
        if (!trip?.returnRecord) {
          return {
            action: 'start_return',
            label: 'Return Vehicle & Record Inspection',
            destination: `/bookings/${booking._id}/self-drive/return`,
            priority: 'critical',
            blockingClose: true,
          };
        }

        // Step 2: Settlement not yet created from return data
        if (!trip?.settlement) {
          return {
            action: 'create_settlement',
            label: 'Generate Settlement from Return Data',
            destination: `/bookings/${booking._id}/self-drive/settlement`,
            priority: 'critical',
            blockingClose: true,
          };
        }

        // Step 3: Refund settlement pending
        if (trip.refund && trip.refund.status === 'pending') {
          return {
            action: 'process_refund',
            label: 'Review & Confirm Refund Deductions',
            destination: `/bookings/${booking._id}/self-drive/refund`,
            priority: 'high',
            blockingClose: true,
          };
        }

        // Step 4: Check remaining payment balance
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
            // Add adjustments
            else if (t.paymentType === 'adjustment') {
              totalReceived += t.amount;
            }
          }

          const remainingBalance = Math.max(0, booking.totalAmount - totalReceived);

          if (remainingBalance > 0) {
            return {
              action: 'collect_payment',
              label: `Collect ₹${remainingBalance} from Customer`,
              destination: `/bookings/${booking._id}/payments`,
              priority: 'high',
              blockingClose: true,
            };
          }
        } catch (err) {
          console.debug(
            `[nextActionService] Warning: Could not fetch PaymentTransaction for booking ${booking._id}`,
            err instanceof Error ? err.message : String(err),
          );
        }

        // Step 5: All prerequisites met, ready to close
        return {
          action: 'close_booking',
          label: 'Mark Booking as Closed',
          destination: `/bookings/${booking._id}/close`,
          priority: 'normal',
          blockingClose: false,
        };
      } catch (err) {
        console.error(
          `[nextActionService] Error processing self-drive booking ${booking._id}:`,
          err instanceof Error ? err.message : String(err),
        );

        // Fallback action for self-drive bookings with errors
        return {
          action: 'unknown',
          label: 'Complete Required Operations',
          destination: `/bookings/${booking._id}`,
          priority: 'normal',
        };
      }
    }

    // With-driver booking workflow
    // Step 1: Payment due after trip completion
    if (
      booking.status === 'completed' &&
      (booking.paymentStatus === 'pending' || booking.paymentStatus === 'unpaid')
    ) {
      const advanceReceived = booking.advanceReceived || 0;
      const balanceDue = Math.max(0, booking.totalAmount - advanceReceived);

      if (balanceDue > 0) {
        return {
          action: 'collect_payment',
          label: `Collect ₹${balanceDue} from Customer`,
          destination: `/bookings/${booking._id}/payments`,
          priority: 'high',
          blockingClose: true,
        };
      }
    }

    // Step 2: Ready to close (payment done or not applicable)
    if (booking.status === 'completed' || booking.status === 'payment_pending') {
      return {
        action: 'close_booking',
        label: 'Close Booking',
        destination: `/bookings/${booking._id}/close`,
        priority: 'normal',
      };
    }

    // Fallback: generic view for other statuses
    return {
      action: 'view_details',
      label: 'View Booking Details',
      destination: `/bookings/${booking._id}`,
      priority: 'low',
    };
  } catch (err) {
    console.error(
      `[nextActionService] Unexpected error in getNextAction for booking ${booking?._id}:`,
      err instanceof Error ? err.message : String(err),
    );

    // Fail-safe action
    return {
      action: 'view_details',
      label: 'View Booking Details',
      destination: `/bookings/${booking?._id || 'unknown'}`,
      priority: 'low',
    };
  }
}
