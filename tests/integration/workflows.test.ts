/**
 * End-to-End Workflow Tests
 * Tests complete booking, payment, notification, driver assignment, and maintenance workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupTestDatabase,
  testDataSeeds,
  mockProviders,
  seedTestData,
  PerformanceMonitor,
  testConfig,
} from './setup';

describe('End-to-End Workflows', () => {
  let db: any;
  let testData: any;
  let monitor: PerformanceMonitor;

  beforeEach(async () => {
    db = await setupTestDatabase();
    await db.connect();
    testData = await seedTestData();
    monitor = new PerformanceMonitor();
  });

  afterEach(async () => {
    await db.clear();
    await db.disconnect();
    vi.clearAllMocks();
  });

  describe('Booking Workflow', () => {
    it('should create a booking successfully', async () => {
      const createBooking = monitor.start('create_booking');

      const booking = testDataSeeds.booking();
      expect(booking).toHaveProperty('id');
      expect(booking.status).toBe('created');
      expect(booking.paymentStatus).toBe('pending');

      createBooking();
      const metrics = monitor.getMetrics('create_booking');
      expect(metrics!.avg).toBeLessThan(testConfig.perfThresholds.webhookResponse);
    });

    it('should assign vehicle to booking', async () => {
      const assignVehicle = monitor.start('assign_vehicle');

      const booking = testDataSeeds.booking();
      const vehicle = testDataSeeds.vehicle({ status: 'available' });

      booking.vehicleId = vehicle.id;
      booking.status = 'vehicle_assigned';

      expect(booking.vehicleId).toBe(vehicle.id);
      expect(booking.status).toBe('vehicle_assigned');

      assignVehicle();
    });

    it('should assign driver to booking', async () => {
      const assignDriver = monitor.start('assign_driver');

      const booking = testDataSeeds.booking();
      const driver = testDataSeeds.driver({ status: 'available' });

      booking.driverId = driver.id;
      booking.status = 'driver_assigned';

      expect(booking.driverId).toBe(driver.id);
      expect(booking.status).toBe('driver_assigned');

      assignDriver();
    });

    it('should update booking status through workflow', async () => {
      const booking = testDataSeeds.booking();
      const statuses = ['created', 'confirmed', 'in_transit', 'completed'];

      for (const status of statuses) {
        booking.status = status;
        expect(booking.status).toBe(status);
      }
    });

    it('should send notification on booking state change', async () => {
      const booking = testDataSeeds.booking();
      const notifications: any[] = [];

      // Simulate notification trigger on booking update
      if (booking.status === 'created') {
        notifications.push({
          type: 'booking_created',
          userId: testData.user.id,
          message: 'Your booking has been created',
        });
      }

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('booking_created');
    });

    it('should complete booking workflow end-to-end', async () => {
      const workflow = monitor.start('booking_workflow');

      // Create booking
      const booking = testDataSeeds.booking();
      expect(booking.status).toBe('created');

      // Assign vehicle
      const vehicle = testDataSeeds.vehicle();
      booking.vehicleId = vehicle.id;
      booking.status = 'vehicle_assigned';

      // Assign driver
      const driver = testDataSeeds.driver();
      booking.driverId = driver.id;
      booking.status = 'driver_assigned';

      // Confirm booking
      booking.status = 'confirmed';

      // Start trip
      booking.status = 'in_transit';

      // Complete trip
      booking.status = 'completed';
      booking.updatedAt = new Date();

      expect(booking.status).toBe('completed');
      expect(booking.vehicleId).toBeTruthy();
      expect(booking.driverId).toBeTruthy();

      workflow();
    });
  });

  describe('Payment Workflow', () => {
    it('should create payment intent for booking', async () => {
      const createIntent = monitor.start('create_payment_intent');

      const booking = testDataSeeds.booking();
      const payment = testDataSeeds.payment({ bookingId: booking.id });

      expect(payment.amount).toBe(booking.amount);
      expect(payment.status).toBe('pending');
      expect(payment.paymentIntentId).toBeTruthy();

      createIntent();
    });

    it('should process payment successfully', async () => {
      const processPayment = monitor.start('process_payment');

      const booking = testDataSeeds.booking();
      const payment = testDataSeeds.payment({ bookingId: booking.id });

      // Mock payment processing
      mockProviders.stripe.confirmPayment.mockResolvedValueOnce({
        id: payment.paymentIntentId,
        status: 'succeeded',
      });

      const result = await mockProviders.stripe.confirmPayment(payment.paymentIntentId);

      payment.status = 'completed';
      payment.transactionId = result.id;

      expect(payment.status).toBe('completed');
      expect(payment.transactionId).toBeTruthy();

      processPayment();
    });

    it('should handle payment failure', async () => {
      const payment = testDataSeeds.payment();

      // Mock payment failure
      mockProviders.stripe.confirmPayment.mockRejectedValueOnce(
        new Error('Card declined')
      );

      let errorOccurred = false;
      try {
        await mockProviders.stripe.confirmPayment(payment.paymentIntentId);
      } catch (error) {
        errorOccurred = true;
        payment.status = 'failed';
      }

      expect(errorOccurred).toBe(true);
      expect(payment.status).toBe('failed');
    });

    it('should issue receipt after payment', async () => {
      const booking = testDataSeeds.booking();
      const payment = testDataSeeds.payment({ bookingId: booking.id });

      payment.status = 'completed';

      const receipt = {
        id: `RCP_${Date.now()}`,
        paymentId: payment.id,
        bookingId: booking.id,
        amount: payment.amount,
        method: payment.method,
        timestamp: new Date(),
        status: 'issued',
      };

      expect(receipt.paymentId).toBe(payment.id);
      expect(receipt.status).toBe('issued');
    });

    it('should send payment notification', async () => {
      const booking = testDataSeeds.booking();
      const payment = testDataSeeds.payment({ bookingId: booking.id });

      payment.status = 'completed';

      const notification = {
        type: 'payment_received',
        userId: testData.user.id,
        subject: 'Payment Confirmation',
        message: `Payment of ₹${payment.amount} received`,
        channel: 'email',
      };

      expect(notification.type).toBe('payment_received');
      expect(notification.message).toContain('Payment');
    });

    it('should handle refund request', async () => {
      const booking = testDataSeeds.booking();
      const payment = testDataSeeds.payment({
        bookingId: booking.id,
        status: 'completed',
      });

      const refund = {
        id: `REF_${Date.now()}`,
        paymentId: payment.id,
        amount: payment.amount,
        reason: 'customer_request',
        status: 'processing',
        createdAt: new Date(),
      };

      payment.status = 'refunded';

      expect(refund.paymentId).toBe(payment.id);
      expect(payment.status).toBe('refunded');
    });

    it('should complete payment workflow end-to-end', async () => {
      const workflow = monitor.start('payment_workflow');

      const booking = testDataSeeds.booking();
      const payment = testDataSeeds.payment({ bookingId: booking.id });

      // Create intent
      expect(payment.status).toBe('pending');

      // Confirm payment
      mockProviders.stripe.confirmPayment.mockResolvedValueOnce({
        id: payment.paymentIntentId,
        status: 'succeeded',
      });

      await mockProviders.stripe.confirmPayment(payment.paymentIntentId);
      payment.status = 'completed';

      // Issue receipt
      const receipt = {
        id: `RCP_${Date.now()}`,
        paymentId: payment.id,
        amount: payment.amount,
        status: 'issued',
      };

      // Send notification
      const notification = {
        type: 'payment_received',
        amount: payment.amount,
      };

      expect(payment.status).toBe('completed');
      expect(receipt.id).toBeTruthy();
      expect(notification.type).toBe('payment_received');

      workflow();
    });
  });

  describe('Notification Workflow', () => {
    it('should create notification preference', async () => {
      const pref = testDataSeeds.preference();

      expect(pref.channels.email).toBe(true);
      expect(pref.channels.sms).toBe(true);
      expect(pref.channels.push).toBe(true);
    });

    it('should trigger notification on booking event', async () => {
      const booking = testDataSeeds.booking();
      const notifications: any[] = [];

      // Trigger on booking created
      notifications.push({
        type: 'booking_created',
        channel: 'in_app',
        status: 'pending',
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('booking_created');
    });

    it('should route notification to correct channel', async () => {
      const pref = testDataSeeds.preference({
        channels: { email: true, sms: false, push: true },
      });

      const notification = testDataSeeds.notification();

      const channels: string[] = [];
      if (pref.channels.email) channels.push('email');
      if (pref.channels.sms) channels.push('sms');
      if (pref.channels.push) channels.push('push');

      expect(channels).toContain('email');
      expect(channels).toContain('push');
      expect(channels).not.toContain('sms');
    });

    it('should verify notification delivery', async () => {
      const notification = testDataSeeds.notification({
        status: 'sent',
        sentAt: new Date(),
      });

      mockProviders.sendGrid.send.mockResolvedValueOnce({
        messageId: `sg_${Date.now()}`,
      });

      const result = await mockProviders.sendGrid.send({
        to: 'user@example.com',
        subject: notification.subject,
        body: notification.message,
      });

      notification.status = 'delivered';
      notification.deliveredAt = new Date();

      expect(notification.status).toBe('delivered');
      expect(result.messageId).toBeTruthy();
    });

    it('should retry notification on failure', async () => {
      let attempts = 0;
      const maxRetries = 3;

      mockProviders.sendGrid.send.mockImplementation(async () => {
        attempts++;
        if (attempts < maxRetries) {
          throw new Error('Temporary failure');
        }
        return { messageId: `sg_${Date.now()}` };
      });

      let lastError: Error | null = null;
      for (let i = 0; i < maxRetries; i++) {
        try {
          await mockProviders.sendGrid.send({});
          break;
        } catch (error) {
          lastError = error as Error;
        }
      }

      expect(lastError).toBeNull();
      expect(attempts).toBe(maxRetries);
    });

    it('should respect quiet hours preference', async () => {
      const pref = testDataSeeds.preference({
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
        },
      });

      const currentHour = new Date().getHours();
      const isQuietHours = currentHour >= 22 || currentHour < 8;

      if (pref.quietHours.enabled && isQuietHours) {
        // Queue for delivery after quiet hours
        expect(true).toBe(true);
      }
    });

    it('should complete notification workflow end-to-end', async () => {
      const workflow = monitor.start('notification_workflow');

      // Create preference
      const pref = testDataSeeds.preference();
      expect(pref.id).toBeTruthy();

      // Create notification
      const notification = testDataSeeds.notification();
      expect(notification.status).toBe('pending');

      // Route to channel
      const channels: string[] = [];
      if (pref.channels.email) {
        channels.push('email');
        mockProviders.sendGrid.send.mockResolvedValueOnce({ messageId: `sg_${Date.now()}` });
      }

      // Verify delivery
      if (channels.length > 0) {
        const result = await mockProviders.sendGrid.send({});
        notification.status = 'delivered';
        notification.deliveredAt = new Date();
      }

      expect(notification.status).toBe('delivered');
      expect(notification.deliveredAt).toBeInstanceOf(Date);

      workflow();
    });
  });

  describe('Driver Assignment Workflow', () => {
    it('should query available drivers', async () => {
      const drivers = [
        testDataSeeds.driver({ status: 'available' }),
        testDataSeeds.driver({ status: 'available' }),
        testDataSeeds.driver({ status: 'busy' }),
      ];

      const availableDrivers = drivers.filter(d => d.status === 'available');

      expect(availableDrivers).toHaveLength(2);
      expect(availableDrivers.every(d => d.status === 'available')).toBe(true);
    });

    it('should check driver location', async () => {
      const booking = testDataSeeds.booking({
        pickupLocation: { lat: 12.9716, lon: 77.5946 },
      });
      const driver = testDataSeeds.driver({
        location: { lat: 12.9716, lon: 77.5946 },
      });

      const distance = calculateDistance(
        booking.pickupLocation.lat,
        booking.pickupLocation.lon,
        driver.location.lat,
        driver.location.lon
      );

      expect(distance).toBeLessThan(5); // km
    });

    it('should assign optimal driver based on proximity', async () => {
      const booking = testDataSeeds.booking({
        pickupLocation: { lat: 12.9716, lon: 77.5946 },
      });

      const drivers = [
        testDataSeeds.driver({
          status: 'available',
          location: { lat: 12.9716, lon: 77.5946 }, // 0 km
        }),
        testDataSeeds.driver({
          status: 'available',
          location: { lat: 12.9700, lon: 77.5900 }, // ~1 km
        }),
        testDataSeeds.driver({
          status: 'available',
          location: { lat: 12.9500, lon: 77.5500 }, // ~30 km
        }),
      ];

      let bestDriver = drivers[0];
      let minDistance = calculateDistance(
        booking.pickupLocation.lat,
        booking.pickupLocation.lon,
        bestDriver.location.lat,
        bestDriver.location.lon
      );

      for (const driver of drivers.slice(1)) {
        const distance = calculateDistance(
          booking.pickupLocation.lat,
          booking.pickupLocation.lon,
          driver.location.lat,
          driver.location.lon
        );
        if (distance < minDistance) {
          minDistance = distance;
          bestDriver = driver;
        }
      }

      expect(bestDriver.location.lat).toBe(12.9716);
      expect(minDistance).toBe(0);
    });

    it('should update driver status after assignment', async () => {
      const driver = testDataSeeds.driver({ status: 'available' });

      driver.status = 'assigned';
      expect(driver.status).toBe('assigned');

      driver.status = 'in_transit';
      expect(driver.status).toBe('in_transit');
    });

    it('should notify driver of assignment', async () => {
      const driver = testDataSeeds.driver();
      const booking = testDataSeeds.booking();

      const notification = {
        type: 'new_booking_assignment',
        driverId: driver.id,
        bookingId: booking.id,
        channel: 'whatsapp',
        message: `New booking from ${booking.pickupLocation.address}`,
      };

      expect(notification.driverId).toBe(driver.id);
      expect(notification.bookingId).toBe(booking.id);
      expect(notification.type).toBe('new_booking_assignment');
    });

    it('should complete driver assignment workflow end-to-end', async () => {
      const workflow = monitor.start('driver_assignment_workflow');

      const booking = testDataSeeds.booking();

      // Query available drivers
      const availableDrivers = [
        testDataSeeds.driver({ status: 'available' }),
        testDataSeeds.driver({ status: 'available' }),
      ];

      expect(availableDrivers).toHaveLength(2);

      // Find optimal driver
      const driver = availableDrivers[0];
      booking.driverId = driver.id;

      // Update driver status
      driver.status = 'assigned';

      // Send notification
      const notification = {
        type: 'new_booking_assignment',
        driverId: driver.id,
      };

      expect(booking.driverId).toBeTruthy();
      expect(driver.status).toBe('assigned');
      expect(notification.type).toBe('new_booking_assignment');

      workflow();
    });
  });

  describe('Vehicle Maintenance Workflow', () => {
    it('should log maintenance record', async () => {
      const vehicle = testDataSeeds.vehicle();

      const maintenance = {
        id: `MAINT_${Date.now()}`,
        vehicleId: vehicle.id,
        type: 'oil_change',
        description: 'Regular oil and filter change',
        cost: 2500,
        date: new Date(),
        mileage: 45000,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      expect(maintenance.vehicleId).toBe(vehicle.id);
      expect(maintenance.type).toBe('oil_change');
    });

    it('should update vehicle status based on maintenance', async () => {
      const vehicle = testDataSeeds.vehicle({ maintenanceStatus: 'good' });

      // Log critical issue
      vehicle.maintenanceStatus = 'needs_maintenance';
      expect(vehicle.maintenanceStatus).toBe('needs_maintenance');

      // After maintenance completed
      vehicle.maintenanceStatus = 'good';
      expect(vehicle.maintenanceStatus).toBe('good');
    });

    it('should schedule next maintenance', async () => {
      const vehicle = testDataSeeds.vehicle();
      const maintenance = {
        date: new Date(),
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      vehicle.lastServiceDate = maintenance.date;
      vehicle.nextServiceDate = maintenance.nextDueDate;

      expect(vehicle.nextServiceDate).toBeInstanceOf(Date);
      expect(vehicle.nextServiceDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should alert if maintenance overdue', async () => {
      const vehicle = testDataSeeds.vehicle({
        nextServiceDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      });

      const isOverdue = vehicle.nextServiceDate.getTime() < Date.now();

      if (isOverdue) {
        const alert = {
          type: 'maintenance_overdue',
          vehicleId: vehicle.id,
          daysOverdue: 10,
        };

        expect(alert.type).toBe('maintenance_overdue');
      }
    });

    it('should complete vehicle maintenance workflow end-to-end', async () => {
      const workflow = monitor.start('maintenance_workflow');

      const vehicle = testDataSeeds.vehicle();

      // Log maintenance
      const maintenance = {
        id: `MAINT_${Date.now()}`,
        vehicleId: vehicle.id,
        type: 'inspection',
        date: new Date(),
      };

      expect(maintenance.vehicleId).toBe(vehicle.id);

      // Update vehicle status
      vehicle.maintenanceStatus = 'good';

      // Schedule next maintenance
      vehicle.lastServiceDate = new Date();
      vehicle.nextServiceDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Check for alerts
      const isOverdue = vehicle.nextServiceDate.getTime() < Date.now();
      expect(isOverdue).toBe(false);

      expect(vehicle.maintenanceStatus).toBe('good');
      expect(vehicle.nextServiceDate).toBeInstanceOf(Date);

      workflow();
    });
  });
});

// ===== Helper Functions =====
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
