// STEP 37: Notification Service
// Email, SMS, in-app notifications for Platform events

import nodemailer from 'nodemailer';

export interface Notification {
  tenantId: string;
  type: 'invoice' | 'payment' | 'sla_breach' | 'subscription' | 'renewal';
  recipient: string;
  subject: string;
  message: string;
  metadata?: any;
}

export class NotificationService {
  private transporter: any;

  constructor() {
    // Initialize email transporter (configure with your SMTP settings)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Send invoice notification
  async notifyInvoiceGenerated(tenantEmail: string, invoiceNumber: string, amount: number) {
    try {
      const subject = `Invoice ${invoiceNumber} Generated`;
      const html = `
        <h2>Invoice Generated</h2>
        <p>Your invoice ${invoiceNumber} has been generated.</p>
        <p><strong>Amount Due: ₹${(amount / 100).toFixed(2)}</strong></p>
        <p>Please log in to your account to view details.</p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 Invoice notification sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send invoice notification failed:', error);
    }
  }

  // Send payment received notification
  async notifyPaymentReceived(tenantEmail: string, invoiceNumber: string, amount: number) {
    try {
      const subject = `Payment Received for ${invoiceNumber}`;
      const html = `
        <h2>Payment Received</h2>
        <p>We've received your payment of ₹${(amount / 100).toFixed(2)} for invoice ${invoiceNumber}.</p>
        <p>Thank you for your prompt payment.</p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 Payment notification sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send payment notification failed:', error);
    }
  }

  // Send payment overdue notification
  async notifyPaymentOverdue(tenantEmail: string, invoiceNumber: string, daysOverdue: number) {
    try {
      const subject = `Payment Overdue: ${invoiceNumber}`;
      const html = `
        <h2>Payment Overdue</h2>
        <p>Invoice ${invoiceNumber} is now ${daysOverdue} days overdue.</p>
        <p>Please pay immediately to avoid service suspension.</p>
        <p><a href="https://dashboard.fleetpro.local/billing">Pay Now</a></p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 Overdue notification sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send overdue notification failed:', error);
    }
  }

  // Send SLA breach notification
  async notifySLABreach(tenantEmail: string, ticketId: string, priority: string) {
    try {
      const subject = `SLA Breach Alert: Ticket #${ticketId}`;
      const html = `
        <h2>Support SLA Breached</h2>
        <p>Your support ticket #${ticketId} (${priority} priority) has exceeded the SLA deadline.</p>
        <p>Our support team is working on a resolution.</p>
        <p><a href="https://dashboard.fleetpro.local/support/${ticketId}">View Ticket</a></p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 SLA breach notification sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send SLA breach notification failed:', error);
    }
  }

  // Send subscription renewal reminder
  async notifySubscriptionRenewal(tenantEmail: string, planName: string, renewalDate: Date) {
    try {
      const subject = `Subscription Renewal Reminder`;
      const html = `
        <h2>Subscription Renewal</h2>
        <p>Your ${planName} subscription will renew on ${renewalDate.toLocaleDateString()}.</p>
        <p>Please ensure your payment method is up to date.</p>
        <p><a href="https://dashboard.fleetpro.local/billing">Manage Subscription</a></p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 Renewal reminder sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send renewal notification failed:', error);
    }
  }

  // Send subscription expiring soon notification
  async notifySubscriptionExpiring(tenantEmail: string, planName: string, daysRemaining: number) {
    try {
      const subject = `Subscription Expiring in ${daysRemaining} Days`;
      const html = `
        <h2>Subscription Expiring Soon</h2>
        <p>Your ${planName} subscription will expire in ${daysRemaining} days.</p>
        <p>Renew now to avoid service interruption.</p>
        <p><a href="https://dashboard.fleetpro.local/billing">Renew Subscription</a></p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 Expiration notice sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send expiration notification failed:', error);
    }
  }

  // Send welcome email to new tenant
  async notifyNewTenant(tenantEmail: string, tenantName: string, adminPassword: string) {
    try {
      const subject = `Welcome to FleetPro ${tenantName}!`;
      const html = `
        <h2>Welcome to FleetPro!</h2>
        <p>Hello ${tenantName},</p>
        <p>Your account has been created successfully.</p>
        <p><strong>Login Details:</strong></p>
        <p>Email: ${tenantEmail}</p>
        <p>Temporary Password: ${adminPassword}</p>
        <p>Please login and change your password immediately: <a href="https://dashboard.fleetpro.local/login">Login</a></p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 Welcome email sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send welcome notification failed:', error);
    }
  }

  // Send ticket update notification
  async notifyTicketUpdate(tenantEmail: string, ticketId: string, status: string) {
    try {
      const subject = `Support Ticket #${ticketId} Updated`;
      const html = `
        <h2>Ticket Update</h2>
        <p>Your support ticket #${ticketId} status has changed to: <strong>${status}</strong></p>
        <p><a href="https://dashboard.fleetpro.local/support/${ticketId}">View Ticket</a></p>
      `;

      await this.sendEmail(tenantEmail, subject, html);
      console.log(`📧 Ticket update sent to ${tenantEmail}`);
    } catch (error) {
      console.error('Send ticket update notification failed:', error);
    }
  }

  // Batch send notifications (for scheduled jobs)
  async sendBatchNotifications(notifications: Notification[]) {
    try {
      console.log(`🔄 Sending ${notifications.length} notifications...`);

      const results = await Promise.all(
        notifications.map(async (notif) => {
          try {
            const mailOptions = {
              from: process.env.SMTP_FROM || 'noreply@fleetpro.local',
              to: notif.recipient,
              subject: notif.subject,
              html: notif.message
            };

            if (this.transporter) {
              await this.transporter.sendMail(mailOptions);
            }

            return { success: true, recipient: notif.recipient };
          } catch (error) {
            console.error(`Failed to send to ${notif.recipient}:`, error);
            return { success: false, recipient: notif.recipient, error };
          }
        })
      );

      const successful = results.filter(r => r.success).length;
      console.log(`✅ Sent ${successful}/${notifications.length} notifications`);

      return results;
    } catch (error) {
      console.error('Batch send notifications failed:', error);
      throw error;
    }
  }

  private async sendEmail(to: string, subject: string, html: string) {
    try {
      if (!this.transporter) {
        console.log(`📧 [TEST MODE] Email to ${to}: ${subject}`);
        return;
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@fleetpro.local',
        to,
        subject,
        html
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error(`Email send failed to ${to}:`, error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
