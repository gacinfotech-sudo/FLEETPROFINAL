// STEP 18: Billing & Invoice Service
// Invoice generation and management

import mongoose from 'mongoose';
import { PlatformInvoice } from '../models/PlatformInvoice';
import { Subscription } from '../models/Subscription';
import { AuditLog } from '../models/AuditLog';

export class BillingService {
  private invoiceCounter = 1;

  // List invoices
  async listInvoices(filters: any = {}, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      const query: any = {};

      if (filters.status) query.status = filters.status;
      if (filters.tenantId) query.tenantId = filters.tenantId;

      const total = await PlatformInvoice.countDocuments(query);
      const invoices = await PlatformInvoice.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      return {
        invoices,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('List invoices failed:', error);
      throw error;
    }
  }

  // Get invoice detail
  async getInvoice(invoiceId: mongoose.Types.ObjectId) {
    try {
      const invoice = await PlatformInvoice.findById(invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      return invoice;
    } catch (error) {
      console.error('Get invoice failed:', error);
      throw error;
    }
  }

  // Generate monthly invoices (cron job)
  async generateMonthlyInvoices() {
    try {
      console.log('🔄 Generating monthly invoices...');

      const now = new Date();
      const subscriptions = await Subscription.find({
        nextBillingDate: { $lte: now },
        status: { $in: ['active', 'renewal_due'] }
      });

      console.log(`Found ${subscriptions.length} subscriptions due for billing`);

      const created = [];

      for (const sub of subscriptions) {
        // Check if invoice already exists for this period
        const existing = await PlatformInvoice.findOne({
          subscriptionId: sub._id,
          billingPeriodStart: sub.periodStart
        });

        if (existing) {
          console.log(`  ⏭️ Invoice already exists for subscription ${sub._id}`);
          continue;
        }

        // Create invoice
        const invoiceNumber = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(this.invoiceCounter++).padStart(5, '0')}`;

        const periodEnd = new Date(sub.periodEnd);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const invoice = new PlatformInvoice({
          invoiceNumber,
          invoiceSequence: this.invoiceCounter,
          tenantId: sub.tenantId,
          subscriptionId: sub._id,
          billingPeriodStart: sub.periodStart,
          billingPeriodEnd: sub.periodEnd,
          subtotal: sub.priceSnapshot,
          tax: sub.taxSnapshot,
          total: sub.priceSnapshot + sub.taxSnapshot,
          paid: 0,
          outstanding: sub.priceSnapshot + sub.taxSnapshot,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          status: 'issued',
          issuedAt: new Date(),
          lineItems: [{
            description: `Plan Subscription - ${sub.billingCycle}`,
            quantity: 1,
            unitPrice: sub.priceSnapshot,
            amount: sub.priceSnapshot
          }],
          createdBy: 'system',
          createdAt: new Date()
        });

        await invoice.save();

        // Update subscription dates
        sub.periodStart = sub.periodEnd;
        sub.periodEnd = periodEnd;
        sub.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        sub.status = 'renewal_due';
        sub.modifiedAt = new Date();
        await sub.save();

        // Audit log
        await AuditLog.create({
          actor: 'system',
          action: 'INVOICE_GENERATED',
          resource: 'invoice',
          resourceId: invoice._id.toString(),
          tenantId: sub.tenantId,
          status: 'success',
          createdAt: new Date()
        });

        created.push(invoice);
        console.log(`  ✅ Invoice ${invoiceNumber} created for tenant ${sub.tenantId}`);
      }

      console.log(`✅ Generated ${created.length} invoices`);
      return created;
    } catch (error) {
      console.error('Generate monthly invoices failed:', error);
      throw error;
    }
  }

  // Void invoice
  async voidInvoice(invoiceId: mongoose.Types.ObjectId, voidedBy: string) {
    try {
      const invoice = await PlatformInvoice.findById(invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      invoice.status = 'void';
      invoice.voidedAt = new Date();
      invoice.modifiedAt = new Date();
      invoice.modifiedBy = voidedBy;

      await invoice.save();

      // Audit log
      await AuditLog.create({
        actor: voidedBy,
        action: 'INVOICE_VOIDED',
        resource: 'invoice',
        resourceId: invoiceId.toString(),
        tenantId: invoice.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return invoice;
    } catch (error) {
      console.error('Void invoice failed:', error);
      throw error;
    }
  }
}

export const billingService = new BillingService();
