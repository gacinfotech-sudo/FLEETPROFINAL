// STEP 43: Email Template Scheduler
// Scheduled email notifications based on events

import { notificationService } from '../notifications/notificationService';
import { subscriptionService } from '../subscriptions/subscriptionService';
import { supportService } from '../support/supportService';
import mongoose from 'mongoose';

const Subscription = mongoose.model('Subscription');
const Tenant = mongoose.model('Tenant');
const SupportTicket = mongoose.model('SupportTicket');

export class EmailTemplateScheduler {
  // Run every hour
  async runHourlySchedule() {
    try {
      console.log('📧 Running hourly email schedule...');

      await this.sendSubscriptionExpiringNotifications();
      await this.sendPaymentOverdueNotifications();
      await this.sendSLABreachNotifications();

      console.log('✅ Hourly email schedule complete');
    } catch (error) {
      console.error('Hourly email schedule failed:', error);
    }
  }

  // Send subscription expiring soon notifications (7 days before expiry)
  private async sendSubscriptionExpiringNotifications() {
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const expiringSubscriptions = await Subscription.find({
        nextBillingDate: { $lte: sevenDaysFromNow, $gte: new Date() },
        status: { $in: ['active', 'renewal_due'] }
      }).populate('tenantId');

      console.log(`📧 Found ${expiringSubscriptions.length} subscriptions expiring soon`);

      for (const sub of expiringSubscriptions) {
        const tenant = sub.tenantId as any;
        const daysRemaining = Math.ceil(
          (sub.nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
          await notificationService.notifySubscriptionExpiring(
            tenant.email,
            `${sub.billingCycle} Subscription`,
            daysRemaining
          );
        }
      }
    } catch (error) {
      console.error('Send subscription expiring notifications failed:', error);
    }
  }

  // Send payment overdue notifications (5+ days overdue)
  private async sendPaymentOverdueNotifications() {
    try {
      const PlatformInvoice = mongoose.model('PlatformInvoice');

      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const overdueInvoices = await PlatformInvoice.find({
        status: { $in: ['issued', 'partial', 'overdue'] },
        dueDate: { $lte: fiveDaysAgo }
      }).populate('tenantId');

      console.log(`📧 Found ${overdueInvoices.length} overdue invoices`);

      for (const invoice of overdueInvoices) {
        const tenant = invoice.tenantId as any;
        const daysOverdue = Math.ceil(
          (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Send reminders at 7 days and 30 days overdue
        if (daysOverdue === 7 || daysOverdue === 30) {
          await notificationService.notifyPaymentOverdue(
            tenant.email,
            invoice.invoiceNumber,
            daysOverdue
          );
        }
      }
    } catch (error) {
      console.error('Send payment overdue notifications failed:', error);
    }
  }

  // Send SLA breach notifications
  private async sendSLABreachNotifications() {
    try {
      const breachedSLAs = await supportService.getOverdueTickets();

      console.log(`📧 Found ${breachedSLAs.length} breached SLA tickets`);

      for (const ticket of breachedSLAs) {
        const tenant = ticket.tenantId as any;
        await notificationService.notifySLABreach(
          tenant.email,
          ticket._id.toString(),
          ticket.priority
        );
      }
    } catch (error) {
      console.error('Send SLA breach notifications failed:', error);
    }
  }

  // Send daily summary emails to admins
  async sendDailySummaryEmails() {
    try {
      console.log('📧 Sending daily summary emails...');

      // Get all active tenants
      const tenants = await Tenant.find({ isActive: true });

      const summaries = await Promise.all(
        tenants.map(async (tenant) => {
          const sub = await Subscription.findOne({ tenantId: tenant._id });
          const openTickets = await SupportTicket.countDocuments({
            tenantId: tenant._id,
            status: { $ne: 'closed' }
          });

          return {
            tenantEmail: tenant.email,
            tenantName: tenant.businessName,
            subscriptionStatus: sub?.status,
            openTickets,
            nextBillingDate: sub?.nextBillingDate
          };
        })
      );

      console.log(`✅ Prepared ${summaries.length} daily summaries`);
      return summaries;
    } catch (error) {
      console.error('Send daily summary emails failed:', error);
      throw error;
    }
  }

  // Send monthly revenue report to platform admin
  async sendMonthlyRevenueReport() {
    try {
      console.log('📧 Sending monthly revenue report...');

      const { analyticsService } = await import('../analytics/analyticsService');

      const [mrr, arr, churn] = await Promise.all([
        analyticsService.getMRR(),
        analyticsService.getARR(),
        analyticsService.getChurnRate()
      ]);

      const reportHtml = `
        <h2>Monthly Revenue Report</h2>
        <table>
          <tr><td>MRR</td><td>₹${(mrr.mrr / 100).toFixed(2)}</td></tr>
          <tr><td>ARR</td><td>₹${(arr / 100).toFixed(2)}</td></tr>
          <tr><td>Active Tenants</td><td>${mrr.count}</td></tr>
          <tr><td>Churn Rate</td><td>${churn.churnRate}%</td></tr>
        </table>
      `;

      const adminEmail = process.env.ADMIN_EMAIL || 'admin@fleetpro.local';
      await notificationService['sendEmail'](
        adminEmail,
        'Monthly Revenue Report',
        reportHtml
      );

      console.log('✅ Monthly revenue report sent');
    } catch (error) {
      console.error('Send monthly revenue report failed:', error);
    }
  }

  // Initialize scheduler (run on server start)
  static initializeScheduler() {
    const scheduler = new EmailTemplateScheduler();

    // Run hourly
    setInterval(() => {
      scheduler.runHourlySchedule();
    }, 60 * 60 * 1000); // 1 hour

    // Run daily at 9 AM
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(9, 0, 0, 0);

    const msUntilNextRun = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
      scheduler.sendDailySummaryEmails();
      setInterval(() => {
        scheduler.sendDailySummaryEmails();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilNextRun);

    // Run monthly on 1st at 6 AM
    const today = new Date();
    const nextMonth = today.getMonth() === 11 ?
      new Date(today.getFullYear() + 1, 0, 1) :
      new Date(today.getFullYear(), today.getMonth() + 1, 1);
    nextMonth.setHours(6, 0, 0, 0);

    const msUntilMonthly = nextMonth.getTime() - now.getTime();
    setTimeout(() => {
      scheduler.sendMonthlyRevenueReport();
      setInterval(() => {
        scheduler.sendMonthlyRevenueReport();
      }, 30 * 24 * 60 * 60 * 1000); // 30 days
    }, msUntilMonthly);

    console.log('✅ Email template scheduler initialized');
  }
}

export const emailTemplateScheduler = new EmailTemplateScheduler();
