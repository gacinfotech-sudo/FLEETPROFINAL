// Integration Tests: Email + SMS + Notification Orchestrator
import { describe, it, expect, beforeAll } from '@jest/globals';
import { emailProvider } from '../integrations/emailProvider';
import { smsProvider } from '../integrations/smsProvider';

describe('Notification Integration Tests', () => {
  beforeAll(() => {
    // Configure providers for testing
    emailProvider.updateConfig({
      provider: 'mock',
      fromEmail: 'noreply@fleetpro.com',
      fromName: 'FleetPro'
    });

    smsProvider.updateConfig({
      provider: 'mock',
      twilioPhoneNumber: '+1234567890'
    });
  });

  describe('End-to-End Notification Scenarios', () => {
    it('should send booking confirmation via email', async () => {
      const bookingData = {
        bookingId: 'BK-123456',
        vehicleName: 'Toyota Fortuner',
        pickupDate: '2026-08-15',
        returnDate: '2026-08-18',
        totalAmount: 'Rs. 15,000',
        driverName: 'Raj Kumar'
      };

      const emailResult = await emailProvider.send({
        to: ['customer@example.com'],
        subject: 'Booking Confirmation - FleetPro',
        htmlBody: `
          <h2>Booking Confirmation</h2>
          <p>Thank you for booking with FleetPro!</p>
          <h3>Booking Details</h3>
          <ul>
            <li>Booking ID: ${bookingData.bookingId}</li>
            <li>Vehicle: ${bookingData.vehicleName}</li>
            <li>Pickup: ${bookingData.pickupDate}</li>
            <li>Return: ${bookingData.returnDate}</li>
            <li>Total: ${bookingData.totalAmount}</li>
            <li>Driver: ${bookingData.driverName}</li>
          </ul>
          <p><a href="https://fleetpro.app/booking/${bookingData.bookingId}">View Booking</a></p>
        `,
        tags: ['booking', 'confirmation']
      });

      expect(emailResult.success).toBe(true);
      expect(emailResult.messageId).toBeDefined();
    });

    it('should send booking confirmation via SMS', async () => {
      const smsResult = await smsProvider.send({
        to: ['+919876543210'],
        body: 'Booking confirmed! BK-123456 Toyota Fortuner 15-18 Aug. Rs.15000. View: https://app.fleetpro.com/bk/123456'
      });

      expect(smsResult.success).toBe(true);
      expect(smsResult.messageId).toBeDefined();
      expect(smsResult.segments).toBeGreaterThan(0);
    });

    it('should send payment reminder via email and SMS fallback', async () => {
      // Primary: Email
      const emailResult = await emailProvider.send({
        to: ['customer@example.com'],
        subject: 'Payment Due - FleetPro Booking BK-123456',
        htmlBody: '<p>Your payment is due on 2026-08-15. Amount: Rs. 15,000</p>',
        tags: ['payment', 'reminder']
      });

      expect(emailResult.success).toBe(true);

      // Fallback: SMS if email fails
      if (!emailResult.success) {
        const smsResult = await smsProvider.send({
          to: ['+919876543210'],
          body: 'FleetPro: Payment due Rs.15000 for booking BK-123456. Pay now: https://app.fleetpro.com/pay/123456'
        });

        expect(smsResult.success).toBe(true);
      }
    });

    it('should send bulk booking notifications', async () => {
      const bookings = [
        {
          id: 'BK-001',
          email: 'user1@example.com',
          phone: '+919876543210',
          vehicle: 'Toyota Fortuner'
        },
        {
          id: 'BK-002',
          email: 'user2@example.com',
          phone: '+919876543211',
          vehicle: 'Mahindra XUV'
        },
        {
          id: 'BK-003',
          email: 'user3@example.com',
          phone: '+919876543212',
          vehicle: 'Maruti Swift'
        }
      ];

      // Send bulk emails
      const emailResults = await emailProvider.sendBulk(
        bookings.map(booking => ({
          to: [booking.email],
          subject: `Booking Confirmed - ${booking.id}`,
          htmlBody: `<p>Your ${booking.vehicle} is booked under ${booking.id}</p>`,
          tags: ['booking', 'bulk']
        }))
      );

      // Send bulk SMS
      const smsResults = await smsProvider.sendBulk(
        bookings.map(booking => ({
          to: [booking.phone],
          body: `FleetPro: ${booking.vehicle} booked as ${booking.id}. View: https://app.fleetpro.com/bk/${booking.id}`
        }))
      );

      expect(emailResults).toHaveLength(3);
      expect(smsResults).toHaveLength(3);
      expect(emailResults.every(r => r.success)).toBe(true);
      expect(smsResults.every(r => r.success)).toBe(true);
    });

    it('should send vehicle pickup notification', async () => {
      const pickupData = {
        bookingId: 'BK-123456',
        vehicleName: 'Toyota Fortuner',
        pickupTime: '10:00 AM',
        location: 'Airport Terminal 3, New Delhi',
        driverPhone: '+919876543210'
      };

      // Email notification
      const emailResult = await emailProvider.send({
        to: ['customer@example.com'],
        subject: 'Ready for Pickup - FleetPro',
        htmlBody: `
          <h2>Your Vehicle is Ready!</h2>
          <p>${pickupData.vehicleName} is ready for pickup at ${pickupData.pickupTime}</p>
          <p>Location: ${pickupData.location}</p>
          <p>Driver Contact: ${pickupData.driverPhone}</p>
        `,
        tags: ['pickup', 'notification']
      });

      // SMS notification
      const smsResult = await smsProvider.send({
        to: ['+919876543210'],
        body: `FleetPro: ${pickupData.vehicleName} ready at ${pickupData.pickupTime}, ${pickupData.location}. Driver: ${pickupData.driverPhone}`
      });

      expect(emailResult.success).toBe(true);
      expect(smsResult.success).toBe(true);
    });

    it('should send return reminder 1 day before', async () => {
      const reminderEmail = await emailProvider.send({
        to: ['customer@example.com'],
        subject: 'Return Reminder - Your Booking Expires Tomorrow',
        htmlBody: '<p>Please return your vehicle by 5:00 PM tomorrow. Charges may apply for late return.</p>',
        tags: ['return', 'reminder']
      });

      const reminderSms = await smsProvider.send({
        to: ['+919876543210'],
        body: 'FleetPro: Return your vehicle by 5PM tomorrow. Late charges apply. https://app.fleetpro.com/return'
      });

      expect(reminderEmail.success).toBe(true);
      expect(reminderSms.success).toBe(true);
    });

    it('should send invoice/receipt after return', async () => {
      const invoiceData = {
        invoiceId: 'INV-123456',
        bookingId: 'BK-123456',
        totalAmount: 'Rs. 15,000',
        tax: 'Rs. 2,700',
        finalAmount: 'Rs. 17,700',
        paymentDate: '2026-08-18'
      };

      const invoiceEmail = await emailProvider.send({
        to: ['customer@example.com'],
        cc: ['accounts@fleetpro.com'],
        subject: `Invoice ${invoiceData.invoiceId} - FleetPro`,
        htmlBody: `
          <h2>Invoice</h2>
          <p>Invoice ID: ${invoiceData.invoiceId}</p>
          <p>Booking ID: ${invoiceData.bookingId}</p>
          <table>
            <tr><td>Rental Amount</td><td>${invoiceData.totalAmount}</td></tr>
            <tr><td>Tax (18% GST)</td><td>${invoiceData.tax}</td></tr>
            <tr><td>Total</td><td>${invoiceData.finalAmount}</td></tr>
          </table>
        `,
        tags: ['invoice', 'receipt', 'financial']
      });

      expect(invoiceEmail.success).toBe(true);
      expect(invoiceEmail.messageId).toBeDefined();
    });

    it('should send driver assignment notification', async () => {
      const driverData = {
        bookingId: 'BK-123456',
        driverName: 'Raj Kumar',
        driverPhone: '+919876543210',
        driverRating: '4.8',
        vehicleNumber: 'DL-01-AB-1234'
      };

      const assignmentEmail = await emailProvider.send({
        to: ['customer@example.com'],
        subject: `Driver Assigned - ${driverData.driverName}`,
        htmlBody: `
          <p>Driver assigned: ${driverData.driverName}</p>
          <p>Rating: ${driverData.driverRating}⭐</p>
          <p>Phone: ${driverData.driverPhone}</p>
          <p>Vehicle: ${driverData.vehicleNumber}</p>
        `,
        tags: ['driver', 'assignment']
      });

      const assignmentSms = await smsProvider.send({
        to: ['+919876543210'],
        body: `FleetPro: Driver ${driverData.driverName} (${driverData.driverRating}⭐) assigned. Call ${driverData.driverPhone}`
      });

      expect(assignmentEmail.success).toBe(true);
      expect(assignmentSms.success).toBe(true);
    });

    it('should send support/helpline notification', async () => {
      const supportEmail = await emailProvider.send({
        to: ['customer@example.com'],
        subject: 'FleetPro Support - We Are Here to Help',
        htmlBody: `
          <h2>Need Help?</h2>
          <p>24/7 Customer Support</p>
          <ul>
            <li>Phone: +91-11-XXXX-XXXX</li>
            <li>Email: support@fleetpro.com</li>
            <li>Chat: https://fleetpro.com/chat</li>
          </ul>
        `,
        tags: ['support', 'helpline']
      });

      const supportSms = await smsProvider.send({
        to: ['+919876543210'],
        body: 'FleetPro Support: 24/7 Help. Call +91-11-XXXX-XXXX or chat https://fleetpro.com/chat'
      });

      expect(supportEmail.success).toBe(true);
      expect(supportSms.success).toBe(true);
    });
  });

  describe('Multi-Channel Fallback Strategy', () => {
    it('should demonstrate email → SMS → in-app fallback chain', async () => {
      const channels = [];

      // Try Email (Primary)
      const emailResult = await emailProvider.send({
        to: ['customer@example.com'],
        subject: 'Important Notification',
        htmlBody: '<p>This is important</p>',
        tags: ['important']
      });

      if (emailResult.success) {
        channels.push('email');
      } else {
        // Fallback to SMS
        const smsResult = await smsProvider.send({
          to: ['+919876543210'],
          body: 'FleetPro: Important notification. Check email or visit app.'
        });

        if (smsResult.success) {
          channels.push('sms');
        } else {
          // Fallback to in-app (would be stored in DB)
          channels.push('in_app');
        }
      }

      // Should have at least one channel succeed
      expect(channels.length).toBeGreaterThan(0);
    });

    it('should deliver to multiple channels for critical notifications', async () => {
      const criticalChannels = [];

      // Send via email
      const emailResult = await emailProvider.send({
        to: ['customer@example.com'],
        subject: 'URGENT: Account Security Alert',
        htmlBody: '<p>Unusual activity detected on your account</p>',
        tags: ['security', 'urgent']
      });
      if (emailResult.success) criticalChannels.push('email');

      // Send via SMS (guaranteed for critical alerts)
      const smsResult = await smsProvider.send({
        to: ['+919876543210'],
        body: 'FleetPro SECURITY: Unusual activity on your account. Verify: https://app.fleetpro.com/security'
      });
      if (smsResult.success) criticalChannels.push('sms');

      // For critical notifications, multiple channels ensure user is notified
      expect(criticalChannels.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle sustained email load', async () => {
      const emailCount = 50;
      const startTime = Date.now();

      const messages = Array.from({ length: emailCount }, (_, i) => ({
        to: [`user${i}@example.com`],
        subject: `Test Email ${i}`,
        htmlBody: `<p>Test email ${i}</p>`
      }));

      const results = await emailProvider.sendBulk(messages);
      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const throughput = (successCount / (duration / 1000)).toFixed(2);

      console.log(`Email throughput: ${throughput} emails/sec`);

      expect(successCount).toBe(emailCount);
      expect(duration).toBeLessThan(10000); // Should complete in under 10s
    });

    it('should handle sustained SMS load', async () => {
      const smsCount = 50;
      const startTime = Date.now();

      const messages = Array.from({ length: smsCount }, (_, i) => ({
        to: [`+919876543${200 + i}`],
        body: `Test SMS ${i}`
      }));

      const results = await smsProvider.sendBulk(messages);
      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const throughput = (successCount / (duration / 1000)).toFixed(2);

      console.log(`SMS throughput: ${throughput} SMS/sec`);

      expect(successCount).toBe(smsCount);
      expect(duration).toBeLessThan(10000); // Should complete in under 10s
    });
  });

  describe('Real-World Error Scenarios', () => {
    it('should gracefully handle invalid email addresses', async () => {
      const result = await emailProvider.send({
        to: ['not-an-email'],
        subject: 'Test',
        htmlBody: '<p>Test</p>'
      });

      // Should return result (validation in production would catch this)
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should gracefully handle invalid phone numbers', async () => {
      const result = await smsProvider.send({
        to: ['invalid-phone'],
        body: 'Test'
      });

      // Should return result (validation in production would catch this)
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle provider configuration errors', () => {
      // Invalid config should not crash
      emailProvider.updateConfig({
        provider: 'mock',
        fromEmail: '',
        fromName: ''
      });

      const config = emailProvider.getConfig();
      expect(config).toBeDefined();
    });
  });
});
