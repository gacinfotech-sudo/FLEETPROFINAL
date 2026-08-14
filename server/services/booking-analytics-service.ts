/**
 * BOOKING ANALYTICS SERVICE
 * Real-time metrics for booking performance, revenue, and trends
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export interface BookingMetrics {
  tenantId: string;
  date: Date;
  hour?: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  bookingsByVehicleType: Record<string, number>;
  bookingsByStatus: Record<string, number>;
  peakHour?: number;
  averageRating?: number;
}

export class BookingAnalyticsService {
  /**
   * Get daily booking metrics
   */
  static async getDailyMetrics(
    tenantId: string,
    date: Date
  ): Promise<BookingMetrics | null> {
    try {
      const db = await storage.getDb();
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const result = await db.collection('bookingAnalytics').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        date: { $gte: startDate, $lte: endDate },
      });

      return result || null;
    } catch (error) {
      console.error('Error fetching daily metrics:', error);
      throw error;
    }
  }

  /**
   * Get hourly booking metrics
   */
  static async getHourlyMetrics(
    tenantId: string,
    date: Date,
    hour: number
  ): Promise<BookingMetrics | null> {
    try {
      const db = await storage.getDb();
      const startTime = new Date(date);
      startTime.setHours(hour, 0, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(hour, 59, 59, 999);

      const result = await db.collection('bookingAnalytics').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        date: { $gte: startTime, $lte: endTime },
        hour,
      });

      return result || null;
    } catch (error) {
      console.error('Error fetching hourly metrics:', error);
      throw error;
    }
  }

  /**
   * Get metrics timeline (last N days)
   */
  static async getTimeline(
    tenantId: string,
    days: number = 30
  ): Promise<BookingMetrics[]> {
    try {
      const db = await storage.getDb();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const metrics = await db
        .collection('bookingAnalytics')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          date: { $gte: startDate },
          hour: { $exists: false }, // Daily metrics only
        })
        .sort({ date: 1 })
        .toArray();

      return metrics;
    } catch (error) {
      console.error('Error fetching timeline:', error);
      throw error;
    }
  }

  /**
   * Get metrics by vehicle type
   */
  static async getByVehicleType(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    try {
      const db = await storage.getDb();

      const results = await db
        .collection('bookings')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: '$vehicleCategory',
              count: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
              averageRevenue: { $avg: '$totalAmount' },
            },
          },
          { $sort: { count: -1 } },
        ])
        .toArray();

      return Object.fromEntries(
        results.map((r) => [
          r._id,
          {
            bookings: r.count,
            revenue: r.totalRevenue,
            average: r.averageRevenue,
          },
        ])
      );
    } catch (error) {
      console.error('Error fetching vehicle type metrics:', error);
      throw error;
    }
  }

  /**
   * Get peak hours analysis
   */
  static async getPeakHours(
    tenantId: string,
    date: Date
  ): Promise<Record<number, number>> {
    try {
      const db = await storage.getDb();
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const results = await db
        .collection('bookings')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: { $hour: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .toArray();

      return Object.fromEntries(
        results.map((r) => [r._id, r.count])
      );
    } catch (error) {
      console.error('Error fetching peak hours:', error);
      throw error;
    }
  }

  /**
   * Calculate revenue forecast
   */
  static async getForecast(
    tenantId: string,
    days: number = 7
  ): Promise<Record<string, number>> {
    try {
      const db = await storage.getDb();

      // Get last 30 days of data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const historicalData = await db
        .collection('bookings')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              createdAt: { $gte: thirtyDaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              revenue: { $sum: '$totalAmount' },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      // Calculate average and trend
      const revenues = historicalData.map((d) => d.revenue);
      const average = revenues.reduce((a, b) => a + b, 0) / revenues.length;

      // Simple forecast: average + trend
      const forecast: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + i);
        const dateStr = forecastDate.toISOString().split('T')[0];
        forecast[dateStr] = Math.round(average * 1.05); // +5% growth assumption
      }

      return forecast;
    } catch (error) {
      console.error('Error calculating forecast:', error);
      throw error;
    }
  }

  /**
   * Record booking metric
   */
  static async recordMetric(
    tenantId: string,
    booking: any
  ): Promise<void> {
    try {
      const db = await storage.getDb();
      const bookingDate = new Date(booking.createdAt);
      const hour = bookingDate.getHours();

      // Update daily metrics
      await db.collection('bookingAnalytics').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          date: {
            $gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
            $lt: new Date(bookingDate.setHours(23, 59, 59, 999)),
          },
        },
        {
          $inc: {
            totalBookings: 1,
            ...(booking.status === 'completed' && { completedBookings: 1 }),
            ...(booking.status === 'cancelled' && { cancelledBookings: 1 }),
            totalRevenue: booking.totalAmount || 0,
          },
          $set: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      // Update hourly metrics
      await db.collection('bookingAnalytics').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          date: {
            $gte: new Date(bookingDate.setHours(hour, 0, 0, 0)),
            $lt: new Date(bookingDate.setHours(hour, 59, 59, 999)),
          },
          hour,
        },
        {
          $inc: { totalBookings: 1, totalRevenue: booking.totalAmount || 0 },
          $set: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }
}

export default BookingAnalyticsService;
