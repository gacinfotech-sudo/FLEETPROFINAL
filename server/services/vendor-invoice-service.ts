/**
 * VENDOR INVOICE SERVICE
 * Auto-create vendor invoices when booking completes
 * Calculate profit for tenant
 */

import { Booking, VendorFinancialLedger, Vendor } from '../models/index';
import mongoose from 'mongoose';

export interface VendorInvoiceResult {
  success: boolean;
  invoiceId?: string;
  vendorPayment?: number;
  tenantProfit?: number;
  error?: string;
}

/**
 * Create vendor invoice when booking completes
 * Called when booking status changes to 'completed' or 'closed'
 */
export async function createVendorInvoiceOnBookingComplete(
  bookingId: string,
  tenantId: string
): Promise<VendorInvoiceResult> {
  try {
    console.log(`[VENDOR-INVOICE] Creating invoice for booking: ${bookingId}`);

    // Get booking with vendor details
    const booking = await Booking.findOne({ _id: bookingId, tenantId })
      .populate('fulfilmentVendorId', 'vendorName vendorContactPhone')
      .lean();

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Check if vendor is involved
    if (!booking.fulfilmentVendorId || booking.fulfilmentType !== 'vendor') {
      console.log(`[VENDOR-INVOICE] No vendor involved in booking ${bookingId}`);
      return { success: true, error: 'No vendor involved' };
    }

    // Get vendor cost (what we owe to vendor)
    const vendorCost = booking.vendorAgreedRate || 0;
    if (vendorCost === 0) {
      return { success: false, error: 'No vendor agreed rate set' };
    }

    // Calculate profit
    const customerPayment = booking.totalAmount || 0;
    const tenantProfit = customerPayment - vendorCost;

    console.log(`[VENDOR-INVOICE] Booking: ${booking.bookingId}, Customer: ₹${customerPayment}, Vendor: ₹${vendorCost}, Profit: ₹${tenantProfit}`);

    // Create financial ledger entry for vendor payment
    const ledgerEntry = await VendorFinancialLedger.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      vendorId: booking.fulfilmentVendorId,
      transactionType: 'service_charge',
      amount: vendorCost,
      bookingId: new mongoose.Types.ObjectId(bookingId),
      status: 'pending', // Will be marked 'completed' when payment is made
      notes: `Invoice for booking ${booking.bookingId} - ${booking.pickupLocation} to ${booking.dropoffLocation || 'Local'}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[VENDOR-INVOICE] ✅ Invoice created: ${ledgerEntry._id}`);

    return {
      success: true,
      invoiceId: ledgerEntry._id.toString(),
      vendorPayment: vendorCost,
      tenantProfit: tenantProfit,
    };
  } catch (error: any) {
    console.error(`[VENDOR-INVOICE] Error creating invoice:`, error?.message);
    return { success: false, error: error?.message || 'Failed to create invoice' };
  }
}

/**
 * Get vendor financial summary
 * Vendor sees only their invoices
 * Tenant sees all invoices and profit calculation
 */
export async function getVendorFinancialSummary(
  tenantId: string,
  vendorId?: string
) {
  try {
    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    // If vendorId provided, filter to that vendor (vendor viewing own invoices)
    if (vendorId) {
      query.vendorId = new mongoose.Types.ObjectId(vendorId);
    }

    const ledgers = await VendorFinancialLedger.find(query)
      .populate('vendorId', 'vendorName')
      .sort({ createdAt: -1 })
      .lean();

    const summary = {
      totalInvoices: ledgers.length,
      pendingPayment: ledgers
        .filter((l) => l.status === 'pending')
        .reduce((sum, l) => sum + l.amount, 0),
      completedPayment: ledgers
        .filter((l) => l.status === 'completed')
        .reduce((sum, l) => sum + l.amount, 0),
      invoices: ledgers,
    };

    return summary;
  } catch (error: any) {
    console.error(`[VENDOR-INVOICE] Error getting summary:`, error?.message);
    throw error;
  }
}

/**
 * Get booking profit breakdown
 * Tenant sees: Customer Payment - Vendor Cost = Profit
 */
export async function getBookingProfitBreakdown(
  bookingId: string,
  tenantId: string
) {
  try {
    const booking = await Booking.findOne({ _id: bookingId, tenantId })
      .populate('fulfilmentVendorId', 'vendorName')
      .lean();

    if (!booking) {
      return null;
    }

    const customerPayment = booking.totalAmount || 0;
    const vendorCost = booking.vendorAgreedRate || 0;
    const profit = customerPayment - vendorCost;

    return {
      bookingId: booking.bookingId,
      customerPayment,
      vendorCost,
      profit,
      vendorName: booking.fulfilmentVendorId
        ? (booking.fulfilmentVendorId as any).vendorName
        : null,
      profitMarginPercent:
        customerPayment > 0 ? ((profit / customerPayment) * 100).toFixed(2) : 0,
    };
  } catch (error: any) {
    console.error(`[VENDOR-INVOICE] Error getting profit:`, error?.message);
    throw error;
  }
}
