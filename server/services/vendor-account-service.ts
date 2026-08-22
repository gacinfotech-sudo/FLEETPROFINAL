/**
 * VENDOR ACCOUNT SERVICE
 * Manages vendor-collected payments and balance tracking
 */

import { Booking, VendorAccount, VendorFinancialLedger } from '../models/index';
import mongoose from 'mongoose';

/**
 * Record when vendor collects payment from customer
 */
export async function recordVendorCollection(
  tenantId: string,
  vendorId: string,
  bookingId: string,
  amount: number,
  collectionMode: 'cash' | 'bank_transfer' | 'upi' | 'wallet',
  collectedBy?: string // Driver name or vendor contact
) {
  try {
    const booking = await Booking.findOne({ _id: bookingId, tenantId });
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    const Vendor = require('../models').Vendor;
    const vendor = await Vendor.findOne({ _id: vendorId, tenantId });
    if (!vendor) {
      return { success: false, error: 'Vendor not found or does not belong to this tenant' };
    }

    // Update vendor account - credit their collection
    const vendorAccount = await VendorAccount.findOneAndUpdate(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vendorId: new mongoose.Types.ObjectId(vendorId),
      },
      {
        $inc: {
          currentBalance: amount,
          totalCollected: amount,
        },
        $set: {
          lastCollectionDate: new Date(),
          vendorName: booking.fulfilmentVendorName || booking.vendorName,
        },
      },
      { new: true, upsert: true }
    );

    // Log to VendorFinancialLedger for audit trail
    await VendorFinancialLedger.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      vendorId: new mongoose.Types.ObjectId(vendorId),
      bookingId: new mongoose.Types.ObjectId(bookingId),
      transactionType: 'payment',
      amount,
      paymentMethod: collectionMode,
      status: 'completed',
      notes: `Vendor collection via ${collectionMode}${collectedBy ? ` by ${collectedBy}` : ''}. Customer: ${booking.customerName}, Amount: ₹${amount}`,
    });

    console.log(`[VENDOR-ACCOUNT] Collection recorded: ₹${amount} from ${booking.customerName} for booking ${booking.bookingId}`);

    return {
      success: true,
      bookingId: booking.bookingId,
      vendorId,
      amountCollected: amount,
      vendorBalance: vendorAccount?.currentBalance || amount,
      collectedBy: collectedBy || 'vendor',
    };
  } catch (error: any) {
    console.error(`[VENDOR-ACCOUNT] Error recording collection:`, error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Get vendor account balance and summary
 */
export async function getVendorAccount(
  tenantId: string,
  vendorId: string
) {
  try {
    const account = await VendorAccount.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      vendorId: new mongoose.Types.ObjectId(vendorId),
    }).lean();

    if (!account) {
      return {
        success: true,
        vendorId,
        currentBalance: 0,
        totalCollected: 0,
        totalSettled: 0,
        lastCollectionDate: null,
        lastSettlementDate: null,
      };
    }

    return {
      success: true,
      vendorId,
      vendorName: account.vendorName,
      currentBalance: account.currentBalance,
      totalCollected: account.totalCollected,
      totalSettled: account.totalSettled,
      amountDueToCompany: account.currentBalance, // Vendor owes company this much
      lastCollectionDate: account.lastCollectionDate,
      lastSettlementDate: account.lastSettlementDate,
      collectionNotes: account.collectionNotes,
    };
  } catch (error: any) {
    console.error(`[VENDOR-ACCOUNT] Error getting account:`, error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Record vendor settlement - vendor/company settles the collected amount
 */
export async function settleVendorAccount(
  tenantId: string,
  vendorId: string,
  settlementAmount: number,
  settlementMethod: 'cash' | 'bank_transfer' | 'wallet' | 'deduction',
  notes?: string
) {
  try {
    const Vendor = require('../models').Vendor;
    const vendor = await Vendor.findOne({ _id: vendorId, tenantId });
    if (!vendor) {
      return { success: false, error: 'Vendor not found or does not belong to this tenant' };
    }

    const account = await VendorAccount.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      vendorId: new mongoose.Types.ObjectId(vendorId),
    });

    if (!account) {
      return { success: false, error: 'Vendor account not found' };
    }

    if (settlementAmount > account.currentBalance) {
      return { success: false, error: `Cannot settle ₹${settlementAmount} - vendor only has ₹${account.currentBalance} in account` };
    }

    // Update account
    const updatedAccount = await VendorAccount.findOneAndUpdate(
      {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vendorId: new mongoose.Types.ObjectId(vendorId),
      },
      {
        $inc: {
          currentBalance: -settlementAmount,
          totalSettled: settlementAmount,
        },
        $set: {
          lastSettlementDate: new Date(),
        },
      },
      { new: true }
    );

    // Log settlement to ledger
    await VendorFinancialLedger.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      vendorId: new mongoose.Types.ObjectId(vendorId),
      transactionType: settlementMethod === 'deduction' ? 'commission' : 'payment',
      amount: settlementAmount,
      paymentMethod: settlementMethod as any,
      status: 'completed',
      notes: `Vendor settlement via ${settlementMethod}: ₹${settlementAmount}${notes ? ` - ${notes}` : ''}`,
    });

    console.log(`[VENDOR-ACCOUNT] Settlement recorded: ₹${settlementAmount} for vendor ${vendorId}`);

    return {
      success: true,
      vendorId,
      settlementAmount,
      remainingBalance: updatedAccount?.currentBalance || 0,
      settlementMethod,
      settledAt: new Date(),
    };
  } catch (error: any) {
    console.error(`[VENDOR-ACCOUNT] Error settling account:`, error?.message);
    return { success: false, error: error?.message };
  }
}

/**
 * Get vendor collection/settlement history
 */
export async function getVendorTransactionHistory(
  tenantId: string,
  vendorId: string,
  limit: number = 50
) {
  try {
    const transactions = await VendorFinancialLedger.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      vendorId: new mongoose.Types.ObjectId(vendorId),
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Separate collections and settlements
    const collections = transactions.filter(t => t.transactionType === 'payment' && t.status === 'completed');
    const settlements = transactions.filter(t => (t.transactionType === 'commission' || t.transactionType === 'payment') && t.paymentMethod === 'deduction');

    return {
      success: true,
      vendorId,
      totalTransactions: transactions.length,
      collections: collections.map(c => ({
        date: c.createdAt,
        amount: c.amount,
        method: c.paymentMethod,
        notes: c.notes,
        type: 'collection',
      })),
      settlements: settlements.map(s => ({
        date: s.createdAt,
        amount: s.amount,
        method: s.paymentMethod,
        notes: s.notes,
        type: 'settlement',
      })),
      transactions: transactions.map(t => ({
        date: t.createdAt,
        amount: t.amount,
        type: t.transactionType,
        method: t.paymentMethod,
        status: t.status,
        notes: t.notes,
      })),
    };
  } catch (error: any) {
    console.error(`[VENDOR-ACCOUNT] Error getting history:`, error?.message);
    return { success: false, error: error?.message };
  }
}
