// Operations -> Payment Collection Due: any non-cancelled booking with an
// outstanding balance (totalAmount - advanceReceived > 0), regardless of
// trip status — a due amount exists whether the trip hasn't happened yet,
// is ongoing, or has already completed.

const EXCLUDED_STATUSES = ['cancelled', 'no_show'];

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function buildPaymentDues(bookings: any[], now: Date = new Date()) {
  return bookings
    .filter((b) => !EXCLUDED_STATUSES.includes(b.status))
    .map((b) => {
      const remainingBalance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0));
      return { booking: b, remainingBalance };
    })
    .filter((x) => x.remainingBalance > 0)
    .map(({ booking, remainingBalance }) => {
      const pickupDate = booking.pickupDate ? new Date(booking.pickupDate) : null;
      const daysOverdue = pickupDate ? Math.max(0, daysBetween(now, pickupDate)) : 0;
      return {
        id: booking._id?.toString?.() || booking._id,
        bookingId: booking.bookingId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        pickupDate: booking.pickupDate,
        status: booking.status,
        totalAmount: booking.totalAmount,
        advanceReceived: booking.advanceReceived || 0,
        remainingBalance,
        paymentStatus: booking.paymentStatus,
        daysOverdue,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}
