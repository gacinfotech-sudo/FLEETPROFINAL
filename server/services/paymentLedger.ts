import mongoose from 'mongoose';
import { Booking, PaymentTransaction } from '../models/index';

// Types that represent money actually received from/via the customer.
// driver_collection / vendor_collection count here too — the money still
// came from the customer, just handed to a driver/vendor instead of the
// company directly, and that fact needs to be visible in the booking's
// balance the same way a cash payment at the counter would be.
const RECEIPT_TYPES = new Set(['advance', 'partial_payment', 'final_payment', 'driver_collection', 'vendor_collection']);

export interface PaymentSummary {
  totalReceived: number;
  remainingBalance: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
}

export function computePaymentSummary(totalAmount: number, transactions: any[]): PaymentSummary {
  let net = 0;
  let totalRefunded = 0;
  for (const t of transactions) {
    if (t.status !== 'completed') continue;
    if (RECEIPT_TYPES.has(t.paymentType)) net += t.amount;
    else if (t.paymentType === 'refund') { net -= t.amount; totalRefunded += t.amount; }
    else if (t.paymentType === 'adjustment') net += t.amount; // signed: positive = customer owes more, negative = owes less
  }
  const remainingBalance = Math.max(0, totalAmount - net);
  const paymentStatus: PaymentSummary['paymentStatus'] =
    totalRefunded > 0 && net <= 0 ? 'refunded' : remainingBalance <= 0 && net > 0 ? 'paid' : 'pending';
  return { totalReceived: Math.max(0, net), remainingBalance, paymentStatus };
}

// The one place that writes booking.advanceReceived — every other write
// path (create, edit, extend, cancel) must call this after touching
// payments rather than setting the field directly, or the cached summary
// drifts from the ledger it's supposed to mirror.
export async function recomputeBookingPaymentSummary(bookingId: string, session?: mongoose.ClientSession) {
  const booking = await Booking.findById(bookingId).session(session ?? null);
  if (!booking) return null;
  const transactions = await PaymentTransaction.find({ bookingId }).session(session ?? null);
  const summary = computePaymentSummary(booking.totalAmount, transactions);
  booking.advanceReceived = summary.totalReceived;
  booking.paymentStatus = summary.paymentStatus;
  await booking.save({ session });
  return { booking, summary };
}

export interface RecordPaymentInput {
  tenantId: string;
  bookingId: string;
  amount: number;
  paymentType: 'advance' | 'partial_payment' | 'final_payment' | 'refund' | 'adjustment' | 'driver_collection' | 'vendor_collection';
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'card' | 'payment_gateway' | 'driver_collection' | 'vendor_collection' | 'credit';
  transactionReference?: string;
  receivedBy?: string;
  receivedAt?: Date;
  notes?: string;
  createdBy: { userId: string; role: string };
  idempotencyKey?: string;
}

export async function recordPayment(input: RecordPaymentInput) {
  if (input.idempotencyKey) {
    const existing = await PaymentTransaction.findOne({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) {
      const result = await recomputeBookingPaymentSummary(input.bookingId);
      return { transaction: existing, booking: result?.booking, summary: result?.summary, alreadyRecorded: true };
    }
  }

  let transaction;
  try {
    transaction = await PaymentTransaction.create({
      tenantId: input.tenantId,
      bookingId: input.bookingId,
      amount: input.amount,
      paymentType: input.paymentType,
      paymentMode: input.paymentMode,
      status: 'completed',
      transactionReference: input.transactionReference,
      receivedBy: input.receivedBy,
      receivedAt: input.receivedAt || new Date(),
      notes: input.notes,
      createdBy: input.createdBy,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error: any) {
    if (error?.code !== 11000 || !input.idempotencyKey) throw error;
    transaction = await PaymentTransaction.findOne({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
    });
    if (!transaction) throw error;
  }
  const result = await recomputeBookingPaymentSummary(input.bookingId);
  return { transaction, booking: result?.booking, summary: result?.summary };
}

// Corrections never edit or delete a completed transaction (spec:
// "Completed payments must not be silently overwritten"). The original
// remains completed and this creates exactly one offsetting transaction,
// preserving an append-only audit trail without double-counting.
export async function reversePayment(tenantId: string, transactionId: string, reason: string, actor: { userId: string; role: string }) {
  const original = await PaymentTransaction.findOne({ _id: transactionId, tenantId });
  if (!original) return null;
  const existingReversal = await PaymentTransaction.findOne({ tenantId, reversalOf: original._id });
  if (existingReversal) return { original, reversal: existingReversal, alreadyReversed: true };

  // A reversal is recorded as a signed 'adjustment': reversing a receipt
  // (advance/partial/etc.) should REDUCE net received, so it's stored as
  // a negative amount; reversing a refund un-reduces it, so positive.
  const reversalAmount = RECEIPT_TYPES.has(original.paymentType) ? -original.amount : original.amount;
  // Keep the original completed row in the ledger and add one offsetting
  // transaction. Marking the original `reversed` *and* adding this offset
  // double-counted the correction (₹500 reversed on a ₹1,500 booking made
  // the remaining balance ₹2,000). A unique reversalOf index prevents two
  // concurrent correction requests from creating duplicate offsets.
  let reversal;
  try {
    reversal = await PaymentTransaction.create({
      tenantId,
      bookingId: original.bookingId,
      amount: reversalAmount,
      paymentType: 'adjustment',
      paymentMode: original.paymentMode,
      status: 'completed',
      receivedAt: new Date(),
      notes: `Reversal of ${original._id}: ${reason}`,
      idempotencyKey: `${tenantId}_payment_reversal_${original._id}`,
      createdBy: actor,
      reversalOf: original._id,
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    reversal = await PaymentTransaction.findOne({ tenantId, reversalOf: original._id });
  }

  const result = await recomputeBookingPaymentSummary(original.bookingId.toString());
  return { original, reversal, booking: result?.booking, summary: result?.summary };
}
