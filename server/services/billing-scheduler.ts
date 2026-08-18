/**
 * PHASE 4: Auto-Invoicing Scheduler
 * Generates monthly invoices for active subscriptions at renewal date
 * P0-001: Billing persistence fix
 */

import { storage } from '../storage-mongodb';
import cron from 'node-cron';
import { ObjectId } from 'mongodb';

export class BillingScheduler {
  /**
   * Run billing scheduler (call on server startup)
   * Checks subscriptions and creates invoices for renewals
   */
  static startScheduler() {
    // Run daily at 12:01 AM UTC
    cron.schedule('1 0 * * *', async () => {
      try {
        console.log('[Billing Scheduler] Running auto-invoicing check...');
        await BillingScheduler.processRenewals();
      } catch (error) {
        console.error('[Billing Scheduler] Error:', error);
      }
    });

    console.log('[Billing Scheduler] Started (runs daily at 00:01 UTC)');
  }

  /**
   * Process subscription renewals and create invoices
   */
  private static async processRenewals() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find subscriptions that renew today or earlier
      const subscriptionsToRenew = await storage.getSubscriptionsExpiringIn(1);

      console.log(`[Billing Scheduler] Found ${subscriptionsToRenew.length} subscriptions to renew`);

      for (const subscription of subscriptionsToRenew) {
        try {
          await BillingScheduler.createInvoiceForSubscription(subscription);
          await BillingScheduler.updateRenewalDate(subscription);
        } catch (error) {
          console.error(`[Billing Scheduler] Error processing subscription ${subscription._id}:`, error);
        }
      }

      console.log('[Billing Scheduler] Auto-invoicing complete');
    } catch (error) {
      console.error('[Billing Scheduler] Error in processRenewals:', error);
    }
  }

  /**
   * Create invoice for a subscription
   */
  private static async createInvoiceForSubscription(subscription: any) {
    try {
      // Get plan details
      const plan = subscription.planId as any;
      if (!plan) {
        throw new Error('Plan not found for subscription');
      }

      // Determine amount based on billing cycle
      let amount = 0;
      if (subscription.billingCycle === 'monthly' && plan.pricing?.monthly) {
        amount = plan.pricing.monthly;
      } else if (subscription.billingCycle === 'annual' && plan.pricing?.annual) {
        amount = plan.pricing.annual;
      } else if (plan.pricing?.monthly) {
        amount = plan.pricing.monthly; // Default to monthly
      }

      if (amount <= 0) {
        console.warn(`[Billing Scheduler] Skipping subscription ${subscription._id}: amount = ${amount}`);
        return;
      }

      // Create invoice
      const invoice = await storage.createInvoice({
        tenantId: subscription.tenantId,
        customerId: subscription.tenantId,
        documentType: 'tax_invoice',
        status: 'draft',
        serviceDescription: `${plan.name} subscription for ${subscription.billingCycle} billing cycle`,
        taxableAmount: amount,
        gstAmount: 0, // Will be calculated by invoicing service
        totalAmount: amount,
        balanceDue: amount,
        amountReceived: 0,
        invoiceDate: new Date(),
        createdBy: {
          userId: 'system-billing-scheduler',
          role: 'system',
        },
      });

      console.log(`[Billing Scheduler] Created invoice ${invoice._id} for subscription ${subscription._id}`);

      // Store subscription ID in invoice metadata for tracking
      await storage.updateInvoice(invoice._id.toString(), {
        metadata: {
          subscriptionId: subscription._id,
          planCode: plan.code,
          billingCycle: subscription.billingCycle,
        },
      } as any);

      return invoice;
    } catch (error) {
      console.error('[Billing Scheduler] Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Update subscription renewal date
   */
  private static async updateRenewalDate(subscription: any) {
    try {
      let newRenewalDate = new Date(subscription.renewalDate);

      if (subscription.billingCycle === 'monthly') {
        newRenewalDate.setMonth(newRenewalDate.getMonth() + 1);
      } else if (subscription.billingCycle === 'quarterly') {
        newRenewalDate.setMonth(newRenewalDate.getMonth() + 3);
      } else if (subscription.billingCycle === 'annual') {
        newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
      }

      await storage.updateSubscription(subscription._id.toString(), {
        renewalDate: newRenewalDate,
      });

      console.log(`[Billing Scheduler] Updated renewal date for subscription ${subscription._id}`);
    } catch (error) {
      console.error('[Billing Scheduler] Error updating renewal date:', error);
      throw error;
    }
  }

  /**
   * Manual trigger: Generate invoices for subscriptions
   * Used for testing or manual reconciliation
   */
  static async triggerManual() {
    console.log('[Billing Scheduler] Manual trigger started');
    await BillingScheduler.processRenewals();
  }

  /**
   * Get subscription renewal forecast (next 30 days)
   */
  static async getUpcomingRenewals() {
    const subscriptions = await storage.getSubscriptionsExpiringIn(30);

    return subscriptions.map(sub => ({
      subscriptionId: sub._id,
      tenantId: sub.tenantId,
      planName: (sub.planId as any)?.name || 'Unknown',
      renewalDate: sub.renewalDate,
      billingCycle: sub.billingCycle,
      amount: BillingScheduler.getAmount((sub.planId as any), sub.billingCycle),
    }));
  }

  /**
   * Helper: Get amount for plan and billing cycle
   */
  private static getAmount(plan: any, billingCycle: string): number {
    if (!plan) return 0;

    if (billingCycle === 'monthly') return plan.pricing?.monthly || 0;
    if (billingCycle === 'annual') return plan.pricing?.annual || 0;
    return plan.pricing?.monthly || 0;
  }
}

export default BillingScheduler;
