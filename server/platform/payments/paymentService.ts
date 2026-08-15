// STEP 19: Payment Processing Service
// Record payments, reconciliation

import mongoose from 'mongoose';
import { PlatformPayment } from '../models/PlatformPayment';
import { PlatformInvoice } from '../models/PlatformInvoice';
import { Subscription } from '../models/Subscription';
import { AuditLog } from '../models/AuditLog';

export class PaymentService {
  // List payments
  async listPayments(filters: any = {}, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      const query: any = {};

      if (filters.status) query.status = filters.status;
      if (filters.tenantId) query.tenantId = filters.tenantId;

      const total = await PlatformPayment.countDocuments(query);
      const payments = await PlatformPayment.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ paymentDate: -1 });

      return {
        payments,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('List payments failed:', error);
      throw error;
    }
  }

  // Record payment
  async recordPayment(data: {
    tenantId: mongoose.Types.ObjectId;
    invoiceId: mongoose.Types.ObjectId;
    amount: number;
    paymentMethod: string;
    transactionId: string;
    receivedBy: string;
  }) {
    try {
      const invoice = await PlatformInvoice.findById(data.invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const payment = new PlatformPayment({
        tenantId: data.tenantId,
        invoiceId: data.invoiceId,
        subscriptionId: invoice.subscriptionId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
        status: 'received',
        paymentDate: new Date(),
        receivedDate: new Date(),
        receivedBy: data.receivedBy,
        createdAt: new Date()
      });

      await payment.save();

      // Update invoice
      invoice.paid = (invoice.paid || 0) + data.amount;
      invoice.outstanding = Math.max(0, invoice.total - invoice.paid);

      if (invoice.outstanding === 0) {
        invoice.status = 'paid';
      } else if (invoice.paid > 0) {
        invoice.status = 'partial';
      }

      await invoice.save();

      // Audit log
      await AuditLog.create({
        actor: data.receivedBy,
        action: 'PAYMENT_RECORDED',
        resource: 'payment',
        resourceId: payment._id.toString(),
        tenantId: data.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return payment;
    } catch (error) {
      console.error('Record payment failed:', error);
      throw error;
    }
  }

  // Clear payment (mark as cleared/reconciled)
  async clearPayment(paymentId: mongoose.Types.ObjectId, clearedBy: string) {
    try {
      const payment = await PlatformPayment.findById(paymentId);
      if (!payment) throw new Error('Payment not found');

      payment.status = 'cleared';
      payment.clearedAt = new Date();
      payment.modifiedAt = new Date();
      payment.modifiedBy = clearedBy;

      await payment.save();

      // Update subscription status
      const subscription = await Subscription.findById(payment.subscriptionId);
      if (subscription && subscription.status === 'payment_due') {
        subscription.status = 'active';
        await subscription.save();
      }

      // Audit log
      await AuditLog.create({
        actor: clearedBy,
        action: 'PAYMENT_CLEARED',
        resource: 'payment',
        resourceId: paymentId.toString(),
        tenantId: payment.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return payment;
    } catch (error) {
      console.error('Clear payment failed:', error);
      throw error;
    }
  }

  // Payment reconciliation (auto-clear based on bank statement)
  async reconcilePayments(reconciliationData: any[]) {
    try {
      console.log(`🔄 Reconciling ${reconciliationData.length} payments...`);

      const results = [];

      for (const data of reconciliationData) {
        // Find matching payment by transaction ID
        const payment = await PlatformPayment.findOne({
          transactionId: data.transactionId
        });

        if (!payment) {
          console.log(`  ⚠️ No matching payment for transaction ${data.transactionId}`);
          continue;
        }

        // Update payment with bank clearance
        payment.status = 'cleared';
        payment.clearedAt = new Date();
        payment.bankClearanceDate = data.clearanceDate;
        await payment.save();

        // Update subscription
        const subscription = await Subscription.findById(payment.subscriptionId);
        if (subscription && subscription.status === 'payment_due') {
          subscription.status = 'active';
          await subscription.save();
        }

        results.push(payment);
        console.log(`  ✅ Payment ${data.transactionId} reconciled`);
      }

      console.log(`✅ Reconciliation complete for ${results.length} payments`);
      return results;
    } catch (error) {
      console.error('Payment reconciliation failed:', error);
      throw error;
    }
  }

  // Get outstanding payments (overdue)
  async getOutstandingPayments() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const invoices = await PlatformInvoice.find({
        status: { $in: ['issued', 'partial', 'overdue'] },
        dueDate: { $lte: thirtyDaysAgo }
      }).populate('tenantId');

      return invoices;
    } catch (error) {
      console.error('Get outstanding payments failed:', error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
