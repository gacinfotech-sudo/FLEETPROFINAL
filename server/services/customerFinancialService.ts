import { Booking, Customer, PaymentTransaction, Tenant } from '../models/index';
import { computePaymentSummary } from './paymentLedger';

const RECEIPT_TYPES = new Set(['advance', 'partial_payment', 'final_payment', 'driver_collection', 'vendor_collection']);
const NON_BILLABLE_STATUSES = new Set(['cancelled', 'no_show']);

export async function buildCustomerFinancialSummary(tenantId: string, customerId: string) {
  const customer = await Customer.findOne({ _id: customerId, tenantId, isDeleted: { $ne: true } }).lean();
  if (!customer) return null;
  const bookings = await Booking.find({ tenantId, customerId }).sort({ pickupDate: -1 }).lean();
  const bookingIds = bookings.map((booking: any) => booking._id);
  const transactions = await PaymentTransaction.find({
    tenantId, bookingId: { $in: bookingIds }, status: 'completed',
  }).sort({ receivedAt: -1, createdAt: -1 }).lean();
  const transactionsByBooking = new Map<string, any[]>();
  for (const transaction of transactions as any[]) {
    const key = transaction.bookingId.toString();
    transactionsByBooking.set(key, [...(transactionsByBooking.get(key) || []), transaction]);
  }

  const breakdown: Record<string, number> = {
    advance: 0, partial_payment: 0, final_payment: 0, refund: 0,
    adjustment: 0, driver_collection: 0, vendor_collection: 0,
  };
  const modeTotals: Record<string, number> = {};
  for (const transaction of transactions as any[]) {
    breakdown[transaction.paymentType] = (breakdown[transaction.paymentType] || 0) + transaction.amount;
    if (RECEIPT_TYPES.has(transaction.paymentType)) {
      modeTotals[transaction.paymentMode] = (modeTotals[transaction.paymentMode] || 0) + transaction.amount;
    }
  }

  const billableBookings = bookings.filter((booking: any) => !NON_BILLABLE_STATUSES.has(booking.status));
  const perBooking = billableBookings.map((booking: any) => {
    const paymentSummary = computePaymentSummary(booking.totalAmount || 0, transactionsByBooking.get(booking._id.toString()) || []);
    const dueDate = new Date(booking.returnDate || booking.pickupDate);
    dueDate.setHours(23, 59, 59, 999);
    return {
      bookingId: booking._id,
      bookingNumber: booking.bookingId,
      pickupDate: booking.pickupDate,
      route: `${booking.pickupLocation || ''} → ${booking.dropoffLocation || '-'}`,
      status: booking.status,
      bookingTotal: booking.totalAmount || 0,
      totalReceived: paymentSummary.totalReceived,
      remainingDue: paymentSummary.remainingBalance,
      isOverdue: paymentSummary.remainingBalance > 0 && dueDate.getTime() < Date.now(),
    };
  });

  const lifetimeBilledAmount = perBooking.reduce((sum, booking) => sum + booking.bookingTotal, 0);
  const lifetimeCollectedAmount = Object.entries(breakdown)
    .filter(([type]) => RECEIPT_TYPES.has(type))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const lifetimeRefunds = breakdown.refund || 0;
  const lifetimeAdjustments = breakdown.adjustment || 0;
  const netCollectedAmount = lifetimeCollectedAmount - lifetimeRefunds + lifetimeAdjustments;
  const totalPendingDue = perBooking.reduce((sum, booking) => sum + booking.remainingDue, 0);
  const overdueAmount = perBooking.filter((booking) => booking.isOverdue).reduce((sum, booking) => sum + booking.remainingDue, 0);

  return {
    customerId,
    generatedAt: new Date(),
    billableBookingCount: perBooking.length,
    lifetimeBilledAmount,
    lifetimeCollectedAmount,
    lifetimeRefunds,
    lifetimeAdjustments,
    netCollectedAmount,
    netLifetimeValue: netCollectedAmount,
    averageBookingValue: perBooking.length ? lifetimeBilledAmount / perBooking.length : 0,
    totalPendingDue,
    overdueAmount,
    paymentBreakdown: breakdown,
    paymentModeTotals: modeTotals,
    bookings: perBooking,
  };
}

export async function buildPaymentReceipt(tenantId: string, customerId: string, paymentId: string) {
  const customer = await Customer.findOne({ _id: customerId, tenantId, isDeleted: { $ne: true } }).lean();
  if (!customer) return null;
  const payment = await PaymentTransaction.findOne({ _id: paymentId, tenantId }).lean();
  if (!payment) return null;
  const booking = await Booking.findOne({ _id: payment.bookingId, tenantId, customerId }).lean();
  if (!booking) return null;
  const [tenant, reversal] = await Promise.all([
    Tenant.findById(tenantId).lean(),
    PaymentTransaction.findOne({ tenantId, reversalOf: payment._id }).lean(),
  ]);
  return {
    receiptNumber: `RCT-${payment._id.toString().slice(-10).toUpperCase()}`,
    generatedAt: new Date(),
    status: reversal ? 'reversed' : 'valid',
    reversalId: reversal?._id,
    business: {
      name: tenant?.businessName || tenant?.name || 'FleetPro',
      email: tenant?.email,
      phone: tenant?.phone,
      address: tenant?.address,
    },
    customer: {
      customerId: customer.customerCode || customer._id,
      name: customer.billing?.billingName || customer.name,
      primaryMobile: customer.primaryMobile,
      email: customer.billing?.billingEmail || customer.email,
      companyName: customer.companyName,
      gstNumber: customer.gstNumber,
    },
    booking: {
      id: booking._id,
      bookingNumber: booking.bookingId,
      route: `${booking.pickupLocation} → ${booking.dropoffLocation || '-'}`,
      pickupDate: booking.pickupDate,
      totalAmount: booking.totalAmount || 0,
    },
    payment: {
      id: payment._id,
      amount: payment.amount,
      type: payment.paymentType,
      mode: payment.paymentMode,
      transactionReference: payment.transactionReference,
      receivedBy: payment.receivedBy,
      receivedAt: payment.receivedAt,
      notes: payment.notes,
    },
  };
}
