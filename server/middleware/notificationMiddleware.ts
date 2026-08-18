import { Request, Response, NextFunction } from "express";
import { notificationEngine } from "../services/smartNotificationEngine";
import { sendNotificationToUser, sendNotificationToTenant } from "../services/websocketNotificationService";

// Helper to attach notification methods to request
export function notificationMiddleware(
  req: Request & { notify?: any },
  res: Response,
  next: NextFunction
) {
  req.notify = {
    // Emit booking created event
    bookingCreated: async (booking: any) => {
      const notification = await notificationEngine.processEvent({
        type: "booking.created",
        userId: booking.tenantId,
        tenantId: booking.tenantId,
        data: {
          count: (booking.pendingCount || 1),
          bookingId: booking.id,
          customer: booking.customerName,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(booking.tenantId, notification);
      }
    },

    // Emit payment due event
    paymentDue: async (booking: any) => {
      const notification = await notificationEngine.processEvent({
        type: "booking.payment_due",
        userId: booking.tenantId,
        tenantId: booking.tenantId,
        data: {
          amount: booking.amount,
          customer: booking.customerName,
          bookingId: booking.id,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(booking.tenantId, notification);
      }
    },

    // Emit vehicle availability low event
    vehiclesLow: async (tenantId: string, available: number) => {
      const notification = await notificationEngine.processEvent({
        type: "vehicle.availability_low",
        userId: tenantId,
        tenantId,
        data: {
          available,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(tenantId, notification);
      }
    },

    // Emit driver offline event
    driverOffline: async (tenantId: string, driverId: string, driverName: string, pendingBookings: number) => {
      const notification = await notificationEngine.processEvent({
        type: "driver.went_offline",
        userId: tenantId,
        tenantId,
        data: {
          driverId,
          driverName,
          pendingBookings,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(tenantId, notification);
      }
    },

    // Emit completion rate low event
    completionRateLow: async (tenantId: string, rate: number) => {
      const notification = await notificationEngine.processEvent({
        type: "metrics.completion_rate_low",
        userId: tenantId,
        tenantId,
        data: {
          rate,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(tenantId, notification);
      }
    },

    // Emit booking completed event
    bookingCompleted: async (booking: any) => {
      const notification = await notificationEngine.processEvent({
        type: "booking.completed",
        userId: booking.tenantId,
        tenantId: booking.tenantId,
        data: {
          bookingId: booking.id,
          customer: booking.customerName,
          amount: booking.totalAmount,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(booking.tenantId, notification);
      }
    },

    // Emit rating received event
    ratingReceived: async (booking: any, rating: any) => {
      const notification = await notificationEngine.processEvent({
        type: "rating.received",
        userId: booking.tenantId,
        tenantId: booking.tenantId,
        data: {
          bookingId: booking.id,
          customer: booking.customerName,
          stars: rating.stars,
          comment: rating.comment || "No comment",
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(booking.tenantId, notification);
      }
    },

    // Emit maintenance due event
    maintenanceDue: async (tenantId: string, vehicleId: string, vehicleName: string, serviceType: string) => {
      const notification = await notificationEngine.processEvent({
        type: "vehicle.maintenance_due",
        userId: tenantId,
        tenantId,
        data: {
          vehicleId,
          vehicleName,
          serviceType,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(tenantId, notification);
      }
    },

    // Emit daily summary event
    dailySummary: async (tenantId: string, summary: any) => {
      const notification = await notificationEngine.processEvent({
        type: "metrics.daily_summary",
        userId: tenantId,
        tenantId,
        data: {
          bookings: summary.bookings,
          revenue: summary.revenue,
          completionRate: summary.completionRate,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(tenantId, notification);
      }
    },

    // Emit tip received event
    tipReceived: async (booking: any, tip: any) => {
      const notification = await notificationEngine.processEvent({
        type: "payment.tip_received",
        userId: booking.tenantId,
        tenantId: booking.tenantId,
        data: {
          amount: tip.amount,
          customer: booking.customerName,
        },
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(booking.tenantId, notification);
      }
    },

    // Custom event emitter
    emit: async (eventType: string, userId: string, tenantId: string, data: any) => {
      const notification = await notificationEngine.processEvent({
        type: eventType,
        userId,
        tenantId,
        data,
        timestamp: new Date(),
      });
      if (notification) {
        await sendNotificationToUser(userId, notification);
      }
    },
  };

  next();
}

export default notificationMiddleware;
