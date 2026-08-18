/**
 * CUSTOMER LIFETIME VALUE SERVICE
 * Track and predict customer value, churn risk, and retention
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export interface CustomerMetrics {
  tenantId: string;
  customerId: string;
  totalSpending: number;
  bookingCount: number;
  averageBookingValue: number;
  lastBookingDate?: Date;
  daysSinceLastBooking?: number;
  repeatBookingRate?: number;
  clvScore: number; // 0-100
  churnRisk: number; // 0-100
  segment: 'vip' | 'loyal' | 'regular' | 'at-risk' | 'churned';
  lastUpdated: Date;
}

export class CustomerLTVService {
  /**
   * Calculate CLV score (0-100)
   */
  static calculateCLVScore(
    totalSpending: number,
    bookingCount: number,
    daysSinceLastBooking: number,
    daysSinceFirstBooking: number
  ): number {
    // Formula: (Total Spending * Booking Count) / Days / 10
    // Normalized to 0-100 scale
    if (daysSinceFirstBooking === 0) return 0;

    const spendingScore = Math.min((totalSpending / 100000) * 100, 100); // Normalize to 100k
    const bookingScore = Math.min((bookingCount / 50) * 100, 100); // Normalize to 50 bookings
    const recencyScore = Math.max(0, 100 - (daysSinceLastBooking / 365) * 100); // Recent activity

    return Math.round((spendingScore * 0.4 + bookingScore * 0.3 + recencyScore * 0.3));
  }

  /**
   * Calculate churn risk (0-100)
   */
  static calculateChurnRisk(
    daysSinceLastBooking: number,
    averageIntervalDays: number
  ): number {
    if (averageIntervalDays === 0) return 0;

    const riskRatio = daysSinceLastBooking / averageIntervalDays;
    return Math.min(Math.round(riskRatio * 100), 100);
  }

  /**
   * Get customer LTV metrics
   */
  static async getCustomerMetrics(
    tenantId: string,
    customerId: string
  ): Promise<CustomerMetrics | null> {
    try {
      const db = await storage.getDb();

      const metrics = await db.collection('customerMetrics').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        customerId: new mongoose.Types.ObjectId(customerId),
      });

      return metrics || null;
    } catch (error) {
      console.error('Error fetching customer metrics:', error);
      throw error;
    }
  }

  /**
   * Get high-value customers
   */
  static async getHighValueCustomers(
    tenantId: string,
    limit: number = 100
  ): Promise<CustomerMetrics[]> {
    try {
      const db = await storage.getDb();

      const customers = await db
        .collection('customerMetrics')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          clvScore: { $gte: 80 },
        })
        .sort({ clvScore: -1, totalSpending: -1 })
        .limit(limit)
        .toArray();

      return customers;
    } catch (error) {
      console.error('Error fetching high-value customers:', error);
      throw error;
    }
  }

  /**
   * Get at-risk customers (churn prediction)
   */
  static async getAtRiskCustomers(
    tenantId: string,
    limit: number = 100
  ): Promise<CustomerMetrics[]> {
    try {
      const db = await storage.getDb();

      const customers = await db
        .collection('customerMetrics')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          churnRisk: { $gte: 70 },
          segment: { $ne: 'churned' },
        })
        .sort({ churnRisk: -1 })
        .limit(limit)
        .toArray();

      return customers;
    } catch (error) {
      console.error('Error fetching at-risk customers:', error);
      throw error;
    }
  }

  /**
   * Get CLV distribution
   */
  static async getCLVDistribution(
    tenantId: string
  ): Promise<Record<string, number>> {
    try {
      const db = await storage.getDb();

      const distribution = await db
        .collection('customerMetrics')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
            },
          },
          {
            $group: {
              _id: '$segment',
              count: { $sum: 1 },
              avgClv: { $avg: '$clvScore' },
              totalSpending: { $sum: '$totalSpending' },
            },
          },
          { $sort: { avgClv: -1 } },
        ])
        .toArray();

      return Object.fromEntries(
        distribution.map((d) => [
          d._id,
          {
            count: d.count,
            avgClv: Math.round(d.avgClv),
            totalSpending: Math.round(d.totalSpending),
          },
        ])
      );
    } catch (error) {
      console.error('Error fetching CLV distribution:', error);
      throw error;
    }
  }

  /**
   * Recalculate metrics for all customers
   */
  static async recalculateAllMetrics(tenantId: string): Promise<number> {
    try {
      const db = await storage.getDb();
      let updated = 0;

      // Get all customers
      const customers = await db
        .collection('customers')
        .find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .toArray();

      for (const customer of customers) {
        // Get booking data
        const bookings = await db
          .collection('bookings')
          .find({
            tenantId: new mongoose.Types.ObjectId(tenantId),
            customerId: customer._id,
          })
          .toArray();

        const totalSpending = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const bookingCount = bookings.length;
        const averageBookingValue = bookingCount > 0 ? totalSpending / bookingCount : 0;

        const bookingDates = bookings.map((b) => new Date(b.createdAt).getTime()).sort();
        const lastBookingDate = bookingDates.length > 0 ? new Date(bookingDates[bookingDates.length - 1]) : null;
        const firstBookingDate = bookingDates.length > 0 ? new Date(bookingDates[0]) : null;

        const now = new Date().getTime();
        const daysSinceLastBooking = lastBookingDate ? Math.floor((now - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        const daysSinceFirstBooking = firstBookingDate ? Math.floor((now - firstBookingDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        // Calculate intervals
        let averageIntervalDays = 0;
        if (bookingDates.length > 1) {
          const intervals = [];
          for (let i = 1; i < bookingDates.length; i++) {
            intervals.push((bookingDates[i] - bookingDates[i - 1]) / (1000 * 60 * 60 * 24));
          }
          averageIntervalDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        }

        // Calculate scores
        const clvScore = this.calculateCLVScore(totalSpending, bookingCount, daysSinceLastBooking, daysSinceFirstBooking);
        const churnRisk = this.calculateChurnRisk(daysSinceLastBooking, averageIntervalDays);

        // Determine segment
        let segment: 'vip' | 'loyal' | 'regular' | 'at-risk' | 'churned';
        if (daysSinceLastBooking > 180) {
          segment = 'churned';
        } else if (churnRisk >= 70) {
          segment = 'at-risk';
        } else if (clvScore >= 80) {
          segment = 'vip';
        } else if (clvScore >= 50) {
          segment = 'loyal';
        } else {
          segment = 'regular';
        }

        // Update metrics
        await db.collection('customerMetrics').updateOne(
          {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            customerId: customer._id,
          },
          {
            $set: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              customerId: customer._id,
              totalSpending,
              bookingCount,
              averageBookingValue,
              lastBookingDate,
              daysSinceLastBooking,
              repeatBookingRate: bookingCount > 0 ? Math.round((bookingCount - 1) / daysSinceFirstBooking * 30 * 100) / 100 : 0,
              clvScore,
              churnRisk,
              segment,
              lastUpdated: new Date(),
            },
          },
          { upsert: true }
        );

        updated++;
      }

      return updated;
    } catch (error) {
      console.error('Error recalculating metrics:', error);
      throw error;
    }
  }
}

export default CustomerLTVService;
