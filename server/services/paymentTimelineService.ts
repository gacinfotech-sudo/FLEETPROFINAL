import { Booking, Invoice } from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 11: PAYMENT TIMELINE (Simplified)
 */

export async function getPaymentTimeline(
  tenantId: string | mongoose.Types.ObjectId,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  const start = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate || new Date();

  const invoices = await Invoice.find({
    tenantId,
    createdAt: { $gte: start, $lte: end }
  }).sort({ createdAt: -1 });

  const timeline = invoices.map(i => ({
    type: 'invoice',
    date: i.createdAt,
    description: `Invoice to ${(i as any).customerSnapshot?.name ?? 'customer'}`,
    amount: i.totalAmount,
    reference: i.invoiceNumber
  }));

  const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.totalAmount || 0), 0);
  const outstanding = invoices.reduce((s: number, i: any) => s + (i.balanceDue || 0), 0);

  return {
    timeline: timeline.slice(0, 100),
    summary: { totalReceived: totalInvoiced - outstanding, totalInvoiced, outstanding, collectionPercentage: totalInvoiced > 0 ? Math.round(((totalInvoiced - outstanding) / totalInvoiced) * 100) : 0 }
  };
}

export async function getCustomerPaymentStatus(
  tenantId: string | mongoose.Types.ObjectId,
  customerId: string | mongoose.Types.ObjectId
): Promise<any> {
  const invoices = await Invoice.find({ tenantId, customerId });
  const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.totalAmount || 0), 0);
  const outstanding = invoices.reduce((s: number, i: any) => s + (i.balanceDue || 0), 0);

  return { totalInvoiced, totalPaid: totalInvoiced - outstanding, outstanding, invoices };
}
