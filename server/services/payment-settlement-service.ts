/**
 * PAYMENT SETTLEMENT SERVICE
 * Track customer payments, vendor settlements, driver collections
 */

import { Booking, VendorFinancialLedger } from '../models/index';
import mongoose from 'mongoose';

export interface PaymentRecord {
  type: 'customer' | 'vendor' | 'driver_collection';
  amount: number;
  status: 'received' | 'pending' | 'partial' | 'paid';
  receivedAt?: Date;
  notes?: string;
}

export interface SettlementBreakdown {
  bookingId: string;
  customerPayment: {
    total: number;
    received: number;
    pending: number;
    percentage: number;
  };
  vendorSettlement: {
    total: number;
    paid: number;
    pending: number;
    percentage: number;
  };
  driverCollection: {
    collected: number;
    pending: number;
  };
  tenantProfit: {
    amount: number;
    status: 'pending' | 'received';
  };
  settlement: {
    status: 'unsettled' | 'partial' | 'settled';
    notes: string;
  };
}

/**
 * Record customer payment received
 */
export async function recordCustomerPayment(
  bookingId: string,
  tenantId: string,
  amount: number,
  paymentMode: 'cash' | 'card' | 'bank_transfer' | 'wallet'
) {
  try {
    const booking = await Booking.findOne({ _id: bookingId, tenantId }).lean();
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Update booking with customer payment received
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        $inc: { advanceReceived: amount },
        $push: {
          paymentHistory: {
            type: 'customer',
            amount,
            paymentMode,
            receivedAt: new Date(),
            notes: `Customer payment received via ${paymentMode}`,
          },
        },
      },
      { new: true }
    );

    console.log(`[SETTLEMENT] Customer payment recorded: ₹${amount} for booking ${booking.bookingId}`);

    return {
      success: true,
      bookingId: booking.bookingId,
      totalReceived: updatedBooking?.advanceReceived || amount,
      totalDue: booking.totalAmount,
    };
  } catch (error: any) {
    console.error(`[SETTLEMENT] Error recording payment:`, error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Record vendor payment made
 */
export async function recordVendorPayment(
  bookingId: string,
  tenantId: string,
  vendorId: string,
  amount: number,
  paymentMode: 'cash' | 'bank_transfer' | 'wallet'
) {
  try {
    const booking = await Booking.findOne({ _id: bookingId, tenantId }).lean();
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Create or update vendor payment ledger
    const ledgerEntry = await VendorFinancialLedger.findOneAndUpdate(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vendorId: new mongoose.Types.ObjectId(vendorId),
        bookingId: new mongoose.Types.ObjectId(bookingId),
        transactionType: 'service_charge',
      },
      {
        status: 'completed',
        paymentMethod: paymentMode,
        updatedAt: new Date(),
        notes: `Payment made via ${paymentMode} on ${new Date().toLocaleDateString('en-IN')}`,
      },
      { new: true }
    );

    console.log(`[SETTLEMENT] Vendor payment recorded: ₹${amount} for booking ${booking.bookingId}`);

    return {
      success: true,
      bookingId: booking.bookingId,
      vendorId,
      amountPaid: amount,
      ledgerId: ledgerEntry?._id,
    };
  } catch (error: any) {
    console.error(`[SETTLEMENT] Error recording vendor payment:`, error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Record driver collection (direct from customer)
 */
export async function recordDriverCollection(
  bookingId: string,
  tenantId: string,
  amount: number,
  collectedBy: string // Driver name
) {
  try {
    const booking = await Booking.findOne({ _id: bookingId, tenantId }).lean();
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        $inc: { advanceReceived: amount },
        $push: {
          paymentHistory: {
            type: 'driver_collection',
            amount,
            collectedBy,
            receivedAt: new Date(),
            notes: `Direct collection by driver ${collectedBy}`,
          },
        },
      },
      { new: true }
    );

    console.log(
      `[SETTLEMENT] Driver collection recorded: ₹${amount} collected by ${collectedBy} for booking ${booking.bookingId}`
    );

    return {
      success: true,
      bookingId: booking.bookingId,
      collectedBy,
      amount,
      totalReceived: updatedBooking?.advanceReceived || amount,
    };
  } catch (error: any) {
    console.error(`[SETTLEMENT] Error recording collection:`, error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Get complete settlement breakdown
 */
export async function getSettlementBreakdown(
  bookingId: string,
  tenantId: string
): Promise<SettlementBreakdown | null> {
  try {
    const booking = await Booking.findOne({ _id: bookingId, tenantId })
      .populate('fulfilmentVendorId', 'vendorName')
      .lean();

    if (!booking) {
      return null;
    }

    // Get vendor payment status
    const vendorLedger = await VendorFinancialLedger.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      bookingId: new mongoose.Types.ObjectId(bookingId),
      transactionType: 'service_charge',
    }).lean();

    const totalCustomerPayment = booking.totalAmount || 0;
    const customerReceived = booking.advanceReceived || 0;
    const customerPending = Math.max(0, totalCustomerPayment - customerReceived);

    const totalVendorCost = booking.vendorAgreedRate || 0;
    const vendorPaid = vendorLedger?.status === 'completed' ? totalVendorCost : 0;
    const vendorPending = Math.max(0, totalVendorCost - vendorPaid);

    const driverCollected = (booking.paymentHistory || [])
      .filter((p: any) => p.type === 'driver_collection')
      .reduce((sum, p: any) => sum + (p.amount || 0), 0);

    const tenantProfit = totalCustomerPayment - totalVendorCost;
    const tenantProfitStatus =
      customerReceived >= tenantProfit + vendorPending ? 'received' : 'pending';

    const isFullySettled =
      customerPending === 0 && vendorPending === 0;
    const isPartiallySettled = customerReceived > 0 || vendorPaid > 0;

    let settlementStatus = 'unsettled';
    let settlementNotes = '';

    if (isFullySettled) {
      settlementStatus = 'settled';
      settlementNotes = 'All payments received and vendor settled';
    } else if (isPartiallySettled) {
      settlementStatus = 'partial';
      settlementNotes = `Customer: ${Math.round((customerReceived / totalCustomerPayment) * 100)}% received, Vendor: ${Math.round((vendorPaid / totalVendorCost) * 100)}% paid`;
    } else {
      settlementStatus = 'unsettled';
      settlementNotes = 'No payments received yet';
    }

    return {
      bookingId: booking.bookingId,
      customerPayment: {
        total: totalCustomerPayment,
        received: customerReceived,
        pending: customerPending,
        percentage: totalCustomerPayment > 0 ? (customerReceived / totalCustomerPayment) * 100 : 0,
      },
      vendorSettlement: {
        total: totalVendorCost,
        paid: vendorPaid,
        pending: vendorPending,
        percentage: totalVendorCost > 0 ? (vendorPaid / totalVendorCost) * 100 : 0,
      },
      driverCollection: {
        collected: driverCollected,
        pending: Math.max(0, totalCustomerPayment - customerReceived - driverCollected),
      },
      tenantProfit: {
        amount: tenantProfit,
        status: tenantProfitStatus,
      },
      settlement: {
        status: settlementStatus as 'unsettled' | 'partial' | 'settled',
        notes: settlementNotes,
      },
    };
  } catch (error: any) {
    console.error(`[SETTLEMENT] Error getting breakdown:`, error?.message);
    return null;
  }
}
