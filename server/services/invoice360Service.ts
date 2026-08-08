import { Invoice } from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 8: INVOICE 360 SERVICE (Simplified)
 */

export async function getInvoice360(
  tenantId: mongoose.Types.ObjectId,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate || new Date();

  const invoices = await Invoice.find({
    tenantId,
    createdAt: { $gte: start, $lte: end }
  }).sort({ createdAt: -1 });

  const totalIssued = invoices.reduce((s: number, i: any) => s + (i.totalAmount || 0), 0);
  const outstanding = invoices.reduce((s: number, i: any) => s + (i.balanceDue || 0), 0);

  return {
    invoices: invoices.slice(0, 50),
    summary: { totalIssued, totalPaid: totalIssued - outstanding, outstanding, overdue: 0 },
    customerWiseOutstanding: [],
    paymentTrends: []
  };
}
