/**
 * MANAGER NOTIFICATION SERVICE
 * Sends WhatsApp alerts to booking managers
 * 30-minute vehicle reporting, delays, escalations
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export class ManagerNotificationService {
  /**
   * Send booking assignment notification to manager
   */
  static async sendBookingAssignmentAlert(bookingData: any): Promise<void> {
    try {
      const managerWhatsApp = bookingData.assignedManagerWhatsApp;
      if (!managerWhatsApp) {
        console.warn('No manager WhatsApp number for booking', bookingData.bookingId);
        return;
      }

      const pickupTime = new Date(bookingData.pickupDateTime);
      const reportingTime = new Date(pickupTime.getTime() - 30 * 60000); // 30 min before

      const message = `🚕 *NEW DUTY ASSIGNED*

*Booking ID:* ${bookingData.bookingId}

*Customer:*
${bookingData.customerName}
📱 ${this.formatPhone(bookingData.customerPhone)}

*Route:*
📍 From: ${bookingData.pickupLocation}
📍 To: ${bookingData.dropoffLocation}

*Pickup Time:*
🕐 ${pickupTime.toLocaleTimeString('en-IN', {
  hour: '2-digit',
  minute: '2-digit'
})} (${pickupTime.toLocaleDateString('en-IN')})

*Vehicle:*
🚗 ${bookingData.vehicleType}
${bookingData.vehicleNumber}

*Driver:*
${bookingData.driverName}
📱 ${this.formatPhone(bookingData.driverPhone)}

*Booking Amount:*
₹ ${bookingData.totalAmount}

*Customer Balance:*
₹ ${bookingData.customerBalance || 0}

---

*YOUR RESPONSIBILITY:*
Ensure vehicle reports at pickup location *at least 30 minutes before pickup*.

*Target Vehicle Reporting Time:*
🎯 ${reportingTime.toLocaleTimeString('en-IN', {
  hour: '2-digit',
  minute: '2-digit'
})}

You will receive follow-up alerts before pickup.

Reply with any concerns or updates.`;

      // Send via WhatsApp (integrate with existing WhatsApp service)
      await this.sendWhatsAppMessage(managerWhatsApp, message);

      // Log notification
      await this.logNotification(
        bookingData.tenantId,
        'booking_assignment',
        bookingData.bookingId,
        bookingData.assignedManagerUserId,
        managerWhatsApp,
        'sent'
      );
    } catch (error) {
      console.error('Error sending booking assignment alert:', error);
    }
  }

  /**
   * Send 30-minute vehicle reporting reminder
   */
  static async send30MinReminderAlert(bookingData: any): Promise<void> {
    try {
      const managerWhatsApp = bookingData.assignedManagerWhatsApp;
      if (!managerWhatsApp) return;

      const pickupTime = new Date(bookingData.pickupDateTime);

      const message = `⏰ *VEHICLE REPORTING REMINDER*

*Booking ID:* ${bookingData.bookingId}

*Vehicle should reach pickup location in:*
⏱️ 30 MINUTES

*Pickup Location:*
${bookingData.pickupLocation}

*Customer:*
${bookingData.customerName}
📱 ${this.formatPhone(bookingData.customerPhone)}

*Scheduled Pickup:*
🕐 ${pickupTime.toLocaleTimeString('en-IN', {
  hour: '2-digit',
  minute: '2-digit'
})}

*Driver Name:*
${bookingData.driverName}

*Vehicle:*
${bookingData.vehicleNumber}

---

Please confirm vehicle is en-route or any delays.`;

      await this.sendWhatsAppMessage(managerWhatsApp, message);

      await this.logNotification(
        bookingData.tenantId,
        'vehicle_reporting_reminder',
        bookingData.bookingId,
        bookingData.assignedManagerUserId,
        managerWhatsApp,
        'sent'
      );
    } catch (error) {
      console.error('Error sending 30-min reminder:', error);
    }
  }

  /**
   * Send vehicle delayed alert
   */
  static async sendDelayAlert(
    bookingData: any,
    delayMinutes: number,
    lastReportedLocation?: string
  ): Promise<void> {
    try {
      const managerWhatsApp = bookingData.assignedManagerWhatsApp;
      if (!managerWhatsApp) return;

      const message = `⚠️ *VEHICLE DELAY ALERT*

*Booking ID:* ${bookingData.bookingId}

*DELAY:* ${delayMinutes} minutes

*Customer:*
${bookingData.customerName}
📱 ${this.formatPhone(bookingData.customerPhone)}

*Pickup Location:*
${bookingData.pickupLocation}

*Driver:*
${bookingData.driverName}
📱 ${this.formatPhone(bookingData.driverPhone)}

*Vehicle:*
${bookingData.vehicleNumber}

${lastReportedLocation ? `*Last Location:*\n${lastReportedLocation}\n\n` : ''}
---

*ACTION REQUIRED:*

1. Contact driver immediately
2. Inform customer about delay
3. Arrange alternative if delay > 15 min
4. Update customer via WhatsApp

Reply with status.`;

      await this.sendWhatsAppMessage(managerWhatsApp, message);

      await this.logNotification(
        bookingData.tenantId,
        'vehicle_delay_alert',
        bookingData.bookingId,
        bookingData.assignedManagerUserId,
        managerWhatsApp,
        'sent',
        { delayMinutes, lastReportedLocation }
      );
    } catch (error) {
      console.error('Error sending delay alert:', error);
    }
  }

  /**
   * Send customer communication request
   */
  static async sendCustomerCheckAlert(
    bookingData: any,
    alertType: string
  ): Promise<void> {
    try {
      const managerWhatsApp = bookingData.assignedManagerWhatsApp;
      if (!managerWhatsApp) return;

      const alertMessages: Record<string, string> = {
        payment_pending: `💰 *PAYMENT VERIFICATION REQUIRED*

*Booking ID:* ${bookingData.bookingId}

*Customer Balance:* ₹${bookingData.customerBalance || 0}
*Booking Amount:* ₹${bookingData.totalAmount}

Please verify payment before finalizing booking.

Customer: ${bookingData.customerName}
📱 ${this.formatPhone(bookingData.customerPhone)}`,

        customer_confirm: `✅ *CUSTOMER CONFIRMATION REQUIRED*

*Booking ID:* ${bookingData.bookingId}

Please confirm customer is ready for pickup.

Customer: ${bookingData.customerName}
📱 ${this.formatPhone(bookingData.customerPhone)}

Pickup Time: ${new Date(bookingData.pickupDateTime).toLocaleTimeString()}`,

        address_clarification: `🏠 *ADDRESS CLARIFICATION NEEDED*

*Booking ID:* ${bookingData.bookingId}

*Pickup Location:*
${bookingData.pickupLocation}

Please confirm detailed address with customer.

Customer: ${bookingData.customerName}
📱 ${this.formatPhone(bookingData.customerPhone)}`,
      };

      const message = alertMessages[alertType] || `Alert for Booking ${bookingData.bookingId}`;

      await this.sendWhatsAppMessage(managerWhatsApp, message);

      await this.logNotification(
        bookingData.tenantId,
        `customer_check_${alertType}`,
        bookingData.bookingId,
        bookingData.assignedManagerUserId,
        managerWhatsApp,
        'sent'
      );
    } catch (error) {
      console.error('Error sending customer check alert:', error);
    }
  }

  /**
   * Send WhatsApp message (integrates with existing WhatsApp service)
   */
  private static async sendWhatsAppMessage(
    phoneNumber: string,
    message: string
  ): Promise<void> {
    try {
      // Integration point: Connect with existing WhatsApp provider
      // This would use the configured WhatsApp provider (Twilio, custom, etc.)
      console.log(`[WhatsApp] Sending to ${phoneNumber}: ${message.substring(0, 50)}...`);

      // TODO: Implement actual WhatsApp send via provider
      // For now, just log the message
    } catch (error) {
      console.error('Error in sendWhatsAppMessage:', error);
    }
  }

  /**
   * Log notification event
   */
  private static async logNotification(
    tenantId: string,
    notificationType: string,
    bookingId: string,
    managerUserId: string,
    phoneNumber: string,
    status: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const db = await storage.getDb();

      await db.collection('managerNotifications').insertOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        notificationType,
        bookingId,
        managerUserId: new mongoose.Types.ObjectId(managerUserId),
        phoneNumber,
        status,
        metadata,
        sentAt: new Date(),
      });
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  /**
   * Format phone for display
   */
  private static formatPhone(phone: string): string {
    if (!phone) return 'N/A';
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length === 10) {
      return `+91 ${normalized.substring(0, 4)} ${normalized.substring(4)}`;
    }
    if (normalized.length === 12) {
      return `+${normalized.substring(0, 2)} ${normalized.substring(2, 6)} ${normalized.substring(6)}`;
    }
    return phone;
  }
}

export default ManagerNotificationService;
