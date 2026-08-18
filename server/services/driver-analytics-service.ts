/**
 * DRIVER ANALYTICS SERVICE
 * Track driver KPIs, performance scores, and incentive tracking
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export interface DriverMetrics {
  tenantId: string;
  driverId: string;
  bookingCount: number;
  completedCount: number;
  cancelledCount: number;
  averageRating: number;
  onTimePercentage: number;
  revenueGenerated: number;
  averageRevenuePerBooking: number;
  performanceScore: number; // 0-100
  lastUpdated: Date;
}

export class DriverAnalyticsService {
  /**
   * Calculate performance score (0-100)
   * Formula: (On-Time % * 0.3) + (Rating * 0.4) + (Revenue/Avg * 0.2) + ((100 - Cancellation %) * 0.1)
   */
  static calculatePerformanceScore(
    onTimePercentage: number,
    averageRating: number,
    revenueGenerated: number,
    averageRevenuePerBooking: number,
    cancellationRate: number
  ): number {
    const normalizedRating = (averageRating / 5) * 100;
    const normalizedRevenue = Math.min((revenueGenerated / (averageRevenuePerBooking * 100)) * 100, 100);
    const normalizedCompletion = 100 - cancellationRate;

    const score =
      onTimePercentage * 0.3 +
      normalizedRating * 0.4 +
      normalizedRevenue * 0.2 +
      normalizedCompletion * 0.1;

    return Math.round(Math.min(score, 100));
  }

  /**
   * Get driver metrics
   */
  static async getDriverMetrics(
    tenantId: string,
    driverId: string
  ): Promise<DriverMetrics | null> {
    try {
      const db = await storage.getDb();

      const metrics = await db.collection('driverMetrics').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId),
      });

      return metrics || null;
    } catch (error) {
      console.error('Error fetching driver metrics:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard (top performers)
   */
  static async getLeaderboard(
    tenantId: string,
    limit: number = 50
  ): Promise<DriverMetrics[]> {
    try {
      const db = await storage.getDb();

      const leaderboard = await db
        .collection('driverMetrics')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          bookingCount: { $gte: 10 }, // Minimum 10 bookings
        })
        .sort({ performanceScore: -1, revenueGenerated: -1 })
        .limit(limit)
        .toArray();

      return leaderboard;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get underperformers (low score)
   */
  static async getUnderperformers(
    tenantId: string,
    limit: number = 50
  ): Promise<DriverMetrics[]> {
    try {
      const db = await storage.getDb();

      const underperformers = await db
        .collection('driverMetrics')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          performanceScore: { $lt: 50 },
          bookingCount: { $gte: 10 },
        })
        .sort({ performanceScore: 1 })
        .limit(limit)
        .toArray();

      return underperformers;
    } catch (error) {
      console.error('Error fetching underperformers:', error);
      throw error;
    }
  }

  /**
   * Get performance trends
   */
  static async getPerformanceTrends(
    tenantId: string,
    driverId: string,
    days: number = 30
  ): Promise<any[]> {
    try {
      const db = await storage.getDb();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trends = await db
        .collection('bookings')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              driverId: new mongoose.Types.ObjectId(driverId),
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              bookings: { $sum: 1 },
              revenue: { $sum: '$totalAmount' },
              avgRating: { $avg: '$rating' },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      return trends;
    } catch (error) {
      console.error('Error fetching performance trends:', error);
      throw error;
    }
  }

  /**
   * Recalculate metrics for driver
   */
  static async recalculateDriverMetrics(
    tenantId: string,
    driverId: string
  ): Promise<DriverMetrics> {
    try {
      const db = await storage.getDb();

      // Get all bookings for driver
      const bookings = await db
        .collection('bookings')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
        })
        .toArray();

      const bookingCount = bookings.length;
      const completedCount = bookings.filter((b) => b.status === 'completed').length;
      const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;

      const ratings = bookings.filter((b) => b.rating).map((b) => b.rating);
      const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const revenueGenerated = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const averageRevenuePerBooking = bookingCount > 0 ? revenueGenerated / bookingCount : 0;

      // Calculate on-time percentage (simplified: assume 90% on-time by default)
      const onTimePercentage = 90;

      const cancellationRate = bookingCount > 0 ? (cancelledCount / bookingCount) * 100 : 0;

      const performanceScore = this.calculatePerformanceScore(
        onTimePercentage,
        averageRating,
        revenueGenerated,
        averageRevenuePerBooking,
        cancellationRate
      );

      // Update metrics
      const result = await db.collection('driverMetrics').findOneAndUpdate(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
        },
        {
          $set: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            driverId: new mongoose.Types.ObjectId(driverId),
            bookingCount,
            completedCount,
            cancelledCount,
            averageRating: Math.round(averageRating * 10) / 10,
            onTimePercentage,
            revenueGenerated,
            averageRevenuePerBooking,
            performanceScore,
            lastUpdated: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      return result.value;
    } catch (error) {
      console.error('Error recalculating driver metrics:', error);
      throw error;
    }
  }

  /**
   * Recalculate metrics for all drivers
   */
  static async recalculateAllMetrics(tenantId: string): Promise<number> {
    try {
      const db = await storage.getDb();
      let updated = 0;

      // Get all drivers
      const drivers = await db
        .collection('drivers')
        .find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .toArray();

      for (const driver of drivers) {
        await this.recalculateDriverMetrics(tenantId, driver._id.toString());
        updated++;
      }

      return updated;
    } catch (error) {
      console.error('Error recalculating all driver metrics:', error);
      throw error;
    }
  }
}

export default DriverAnalyticsService;
