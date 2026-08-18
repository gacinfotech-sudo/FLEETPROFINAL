/**
 * REVENUE OPTIMIZATION SERVICE
 * Dynamic pricing, peak-time surcharges, and revenue management
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export interface PricingRule {
  tenantId: string;
  ruleId: string;
  name: string;
  type: 'peak-time' | 'off-peak' | 'customer-segment' | 'vehicle-category' | 'custom';
  conditions: Record<string, any>;
  priceMultiplier: number; // 0.5 = 50% discount, 1.5 = 50% increase
  active: boolean;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
}

export class RevenueOptimizationService {
  /**
   * Calculate dynamic price
   * Formula: Base Price * (Demand Factor * Time Factor * Segment Factor)
   */
  static calculateDynamicPrice(
    basePrice: number,
    demandFactor: number,
    timeFactor: number,
    segmentFactor: number
  ): number {
    return Math.round(basePrice * demandFactor * timeFactor * segmentFactor);
  }

  /**
   * Get pricing rules
   */
  static async getPricingRules(
    tenantId: string,
    activeOnly: boolean = true
  ): Promise<PricingRule[]> {
    try {
      const db = await storage.getDb();

      const query: any = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
      };

      if (activeOnly) {
        query.active = true;
        query.startDate = { $lte: new Date() };
        query.$or = [
          { endDate: { $exists: false } },
          { endDate: { $gte: new Date() } },
        ];
      }

      const rules = await db.collection('pricingRules').find(query).toArray();

      return rules;
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      throw error;
    }
  }

  /**
   * Create pricing rule
   */
  static async createPricingRule(
    tenantId: string,
    rule: Omit<PricingRule, 'tenantId' | 'ruleId' | 'createdAt'>
  ): Promise<PricingRule> {
    try {
      const db = await storage.getDb();

      const ruleId = `RULE-${Date.now()}`;
      const newRule: PricingRule = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        ruleId,
        ...rule,
        createdAt: new Date(),
      };

      await db.collection('pricingRules').insertOne(newRule);

      return newRule;
    } catch (error) {
      console.error('Error creating pricing rule:', error);
      throw error;
    }
  }

  /**
   * Update pricing rule
   */
  static async updatePricingRule(
    tenantId: string,
    ruleId: string,
    updates: Partial<PricingRule>
  ): Promise<PricingRule | null> {
    try {
      const db = await storage.getDb();

      const result = await db.collection('pricingRules').findOneAndUpdate(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          ruleId,
        },
        { $set: updates },
        { returnDocument: 'after' }
      );

      return result.value || null;
    } catch (error) {
      console.error('Error updating pricing rule:', error);
      throw error;
    }
  }

  /**
   * Delete pricing rule
   */
  static async deletePricingRule(
    tenantId: string,
    ruleId: string
  ): Promise<boolean> {
    try {
      const db = await storage.getDb();

      const result = await db.collection('pricingRules').deleteOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        ruleId,
      });

      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      throw error;
    }
  }

  /**
   * Get revenue forecast
   */
  static async getRevenueForecast(
    tenantId: string,
    days: number = 7
  ): Promise<Record<string, any>> {
    try {
      const db = await storage.getDb();

      // Get historical data
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
              bookings: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      // Calculate averages
      const revenues = historicalData.map((d) => d.revenue);
      const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;

      const bookingCounts = historicalData.map((d) => d.bookings);
      const avgBookings = bookingCounts.reduce((a, b) => a + b, 0) / bookingCounts.length;

      // Generate forecast
      const forecast: Record<string, any> = {};
      for (let i = 0; i < days; i++) {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + i);
        const dateStr = forecastDate.toISOString().split('T')[0];

        // Add 5% growth for weekdays, 10% for weekends
        const dayOfWeek = forecastDate.getDay();
        const growthFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 1.1 : 1.05;

        forecast[dateStr] = {
          revenue: Math.round(avgRevenue * growthFactor),
          bookings: Math.round(avgBookings * growthFactor),
          avgPerBooking: Math.round((avgRevenue / avgBookings) * growthFactor),
        };
      }

      return forecast;
    } catch (error) {
      console.error('Error generating revenue forecast:', error);
      throw error;
    }
  }

  /**
   * Get optimization suggestions
   */
  static async getOptimizationSuggestions(
    tenantId: string
  ): Promise<Record<string, any>[]> {
    try {
      const db = await storage.getDb();
      const suggestions = [];

      // Check peak hours
      const peakHours = await db
        .collection('bookings')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              createdAt: {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
              },
            },
          },
          {
            $group: {
              _id: { $hour: '$createdAt' },
              count: { $sum: 1 },
              avgPrice: { $avg: '$totalAmount' },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 3 },
        ])
        .toArray();

      if (peakHours.length > 0) {
        suggestions.push({
          type: 'peak-time-surge',
          hours: peakHours.map((h) => h._id),
          recommendation: `Add ${20 + Math.random() * 10}% surge pricing during peak hours`,
          potentialRevenue: Math.round(peakHours[0].avgPrice * 0.2 * 100),
        });
      }

      // Check off-peak opportunity
      const offPeakHours = await db
        .collection('bookings')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              createdAt: {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          },
          {
            $group: {
              _id: { $hour: '$createdAt' },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: 1 } },
          { $limit: 3 },
        ])
        .toArray();

      if (offPeakHours.length > 0) {
        suggestions.push({
          type: 'off-peak-discount',
          hours: offPeakHours.map((h) => h._id),
          recommendation: `Offer ${10 + Math.random() * 10}% discount during off-peak hours to increase volume`,
          estimatedVolumeIncrease: Math.round(offPeakHours[0].count * 0.3),
        });
      }

      // Check customer segment opportunity
      const topCustomers = await db
        .collection('customerMetrics')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          segment: 'vip',
        })
        .limit(5)
        .toArray();

      if (topCustomers.length > 0) {
        suggestions.push({
          type: 'vip-loyalty',
          recommendation: 'Offer exclusive pricing to VIP customers',
          estimatedRetention: '15-20%',
          targetCustomers: topCustomers.length,
        });
      }

      return suggestions;
    } catch (error) {
      console.error('Error generating optimization suggestions:', error);
      throw error;
    }
  }
}

export default RevenueOptimizationService;
