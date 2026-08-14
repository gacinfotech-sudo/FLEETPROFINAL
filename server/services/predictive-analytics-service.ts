/**
 * PREDICTIVE ANALYTICS SERVICE
 * ML models for demand forecasting, churn prediction, fraud detection, anomaly detection
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export interface DemandForecast {
  date: string;
  predictedBookings: number;
  confidence: number;
  peakHours: number[];
}

export interface ChurnPrediction {
  customerId: string;
  churnRisk: number; // 0-100
  daysUntilChurn: number;
  recommendation: string;
  retentionActions: string[];
}

export interface FraudScore {
  bookingId: string;
  fraudRisk: number; // 0-100
  redFlags: string[];
  recommendation: 'approve' | 'review' | 'block';
}

export interface AnomalyDetection {
  type: 'revenue' | 'booking_volume' | 'customer_behavior' | 'driver_behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedEntities: string[];
  timestamp: Date;
}

export class PredictiveAnalyticsService {
  /**
   * Demand forecasting: predict next 7 days booking volume
   */
  static async forecastDemand(tenantId: string): Promise<DemandForecast[]> {
    try {
      const db = await storage.getDb();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get historical booking data
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
                date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                hour: { $hour: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.date': 1 } },
        ])
        .toArray();

      // Calculate daily averages
      const dailyData = new Map<string, any>();
      for (const record of historicalData) {
        const date = record._id.date;
        if (!dailyData.has(date)) {
          dailyData.set(date, { hours: [], totalBookings: 0 });
        }
        const daily = dailyData.get(date);
        daily.hours.push({ hour: record._id.hour, bookings: record.count });
        daily.totalBookings += record.count;
      }

      // Calculate average and forecast
      const avgDaily = Array.from(dailyData.values()).reduce((sum, d) => sum + d.totalBookings, 0) / dailyData.size || 0;
      const avgHourlyData = this.calculateAverageHourly(historicalData);

      const forecast: DemandForecast[] = [];
      for (let i = 0; i < 7; i++) {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + i);
        const dateStr = forecastDate.toISOString().split('T')[0];

        // Add trend: weekends +10%, weekdays +5%
        const dayOfWeek = forecastDate.getDay();
        const growthFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 1.1 : 1.05;

        const predictedBookings = Math.round(avgDaily * growthFactor);
        const confidence = Math.min(0.95, 0.7 + (dailyData.size / 100));

        forecast.push({
          date: dateStr,
          predictedBookings,
          confidence,
          peakHours: avgHourlyData.slice(0, 3).map(h => h.hour),
        });
      }

      return forecast;
    } catch (error) {
      console.error('Error forecasting demand:', error);
      throw error;
    }
  }

  /**
   * Churn prediction: which customers likely to leave
   */
  static async predictChurn(tenantId: string): Promise<ChurnPrediction[]> {
    try {
      const db = await storage.getDb();

      const predictions: ChurnPrediction[] = [];

      // Get all customers with bookings
      const customers = await db
        .collection('customers')
        .find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .toArray();

      for (const customer of customers) {
        const bookings = await db
          .collection('bookings')
          .find({
            tenantId: new mongoose.Types.ObjectId(tenantId),
            customerId: customer._id,
          })
          .sort({ createdAt: -1 })
          .toArray();

        if (bookings.length === 0) continue;

        // Calculate churn risk factors
        const lastBookingDate = bookings[0].createdAt;
        const daysSinceLastBooking = Math.floor(
          (new Date().getTime() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Calculate booking frequency
        const bookingIntervals = [];
        for (let i = 1; i < bookings.length && i < 10; i++) {
          const interval = Math.floor(
            (new Date(bookings[i - 1].createdAt).getTime() - new Date(bookings[i].createdAt).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          bookingIntervals.push(interval);
        }
        const avgInterval = bookingIntervals.length > 0 ? bookingIntervals.reduce((a, b) => a + b, 0) / bookingIntervals.length : 30;

        // Calculate churn risk score
        const daysSinceLastFactor = Math.min(daysSinceLastBooking / avgInterval, 2);
        const bookingTrendFactor = bookings.length > 5 ? 0.7 : 1.0;
        const churnRisk = Math.min(100, Math.round(daysSinceLastFactor * bookingTrendFactor * 100));

        // Estimate days until churn (assuming no intervention)
        const daysUntilChurn = Math.max(0, Math.round(avgInterval * 2 - daysSinceLastBooking));

        // Recommendations
        let recommendation = 'Maintain engagement';
        const retentionActions = [];

        if (churnRisk > 75) {
          recommendation = 'Send win-back campaign';
          retentionActions.push('Send personalized offer', 'Offer loyalty discount', 'Schedule follow-up call');
        } else if (churnRisk > 50) {
          recommendation = 'Send engagement email';
          retentionActions.push('Send re-engagement email', 'Offer incentive', 'Check satisfaction');
        } else if (churnRisk > 25) {
          recommendation = 'Regular communication';
          retentionActions.push('Send updates', 'Offer referral bonus');
        }

        predictions.push({
          customerId: customer._id.toString(),
          churnRisk,
          daysUntilChurn,
          recommendation,
          retentionActions,
        });
      }

      return predictions.sort((a, b) => b.churnRisk - a.churnRisk);
    } catch (error) {
      console.error('Error predicting churn:', error);
      throw error;
    }
  }

  /**
   * Fraud detection: identify suspicious bookings
   */
  static async detectFraud(tenantId: string): Promise<FraudScore[]> {
    try {
      const db = await storage.getDb();

      const fraudScores: FraudScore[] = [];

      // Get recent bookings
      const recentBookings = await db
        .collection('bookings')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        })
        .toArray();

      for (const booking of recentBookings) {
        const redFlags: string[] = [];
        let fraudRisk = 0;

        // Check 1: New customer with high-value booking
        const customer = await db.collection('customers').findOne({ _id: booking.customerId });
        if (customer) {
          const customerAge = Math.floor((new Date().getTime() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          if (customerAge < 7 && booking.totalAmount > 5000) {
            redFlags.push('New customer with high-value booking');
            fraudRisk += 25;
          }
        }

        // Check 2: Unusually high amount compared to customer history
        const previousBookings = await db
          .collection('bookings')
          .find({ customerId: booking.customerId })
          .toArray();
        if (previousBookings.length > 0) {
          const avgAmount = previousBookings.reduce((sum, b) => sum + b.totalAmount, 0) / previousBookings.length;
          if (booking.totalAmount > avgAmount * 3) {
            redFlags.push('Amount significantly higher than customer average');
            fraudRisk += 20;
          }
        }

        // Check 3: Multiple bookings in short time
        const recentSameDayBookings = recentBookings.filter(
          b =>
            b.customerId.toString() === booking.customerId.toString() &&
            Math.abs(new Date(b.createdAt).getTime() - new Date(booking.createdAt).getTime()) < 60 * 60 * 1000 &&
            b._id.toString() !== booking._id.toString()
        );
        if (recentSameDayBookings.length > 0) {
          redFlags.push(`${recentSameDayBookings.length} bookings in same hour`);
          fraudRisk += 15;
        }

        // Check 4: Payment method mismatch
        if (booking.paymentMethod && booking.paymentStatus === 'pending' && booking.totalAmount > 3000) {
          redFlags.push('High-value pending payment');
          fraudRisk += 10;
        }

        // Check 5: Driver/vehicle changes after booking
        if (booking.driverChangeCount && booking.driverChangeCount > 2) {
          redFlags.push('Multiple driver changes');
          fraudRisk += 15;
        }

        const recommendation: 'approve' | 'review' | 'block' = fraudRisk >= 70 ? 'block' : fraudRisk >= 40 ? 'review' : 'approve';

        fraudScores.push({
          bookingId: booking._id.toString(),
          fraudRisk: Math.min(100, fraudRisk),
          redFlags,
          recommendation,
        });
      }

      return fraudScores.filter(f => f.fraudRisk > 0).sort((a, b) => b.fraudRisk - a.fraudRisk);
    } catch (error) {
      console.error('Error detecting fraud:', error);
      throw error;
    }
  }

  /**
   * Anomaly detection: unusual patterns in data
   */
  static async detectAnomalies(tenantId: string): Promise<AnomalyDetection[]> {
    try {
      const db = await storage.getDb();
      const anomalies: AnomalyDetection[] = [];

      // Check 1: Revenue anomaly
      const last7Days = await db
        .collection('bookings')
        .aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              revenue: { $sum: '$totalAmount' },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      if (last7Days.length > 3) {
        const revenues = last7Days.map(d => d.revenue);
        const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
        const stdDev = Math.sqrt(revenues.reduce((sum, r) => sum + Math.pow(r - avgRevenue, 2), 0) / revenues.length);

        for (const day of last7Days) {
          if (day.revenue > avgRevenue + 2 * stdDev) {
            anomalies.push({
              type: 'revenue',
              severity: 'high',
              description: `Unusually high revenue on ${day._id}: ₹${day.revenue}`,
              affectedEntities: [day._id],
              timestamp: new Date(day._id),
            });
          }
          if (day.revenue < avgRevenue - 2 * stdDev && day.revenue > 0) {
            anomalies.push({
              type: 'revenue',
              severity: 'medium',
              description: `Unusually low revenue on ${day._id}: ₹${day.revenue}`,
              affectedEntities: [day._id],
              timestamp: new Date(day._id),
            });
          }
        }
      }

      // Check 2: Booking volume anomaly
      const bookingVolumes = last7Days.map(d => d.bookings);
      if (bookingVolumes.length > 0) {
        const avgVolume = bookingVolumes.reduce((a, b) => a + b, 0) / bookingVolumes.length;
        const latestVolume = bookingVolumes[bookingVolumes.length - 1];

        if (latestVolume < avgVolume * 0.5 && latestVolume > 0) {
          anomalies.push({
            type: 'booking_volume',
            severity: 'medium',
            description: `Booking volume drop: ${latestVolume} vs average ${Math.round(avgVolume)}`,
            affectedEntities: ['all_bookings'],
            timestamp: new Date(),
          });
        }
      }

      // Check 3: Driver behavior anomaly
      const driverMetrics = await db
        .collection('driverMetrics')
        .find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .toArray();

      for (const driver of driverMetrics) {
        if (driver.performanceScore < 30 && driver.bookingCount > 10) {
          anomalies.push({
            type: 'driver_behavior',
            severity: 'high',
            description: `Driver performance below threshold: ${driver.performanceScore}%`,
            affectedEntities: [driver.driverId.toString()],
            timestamp: new Date(),
          });
        }
      }

      return anomalies;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      throw error;
    }
  }

  /**
   * Get average hourly distribution
   */
  private static calculateAverageHourly(historicalData: any[]): Array<{ hour: number; bookings: number }> {
    const hourlyMap = new Map<number, number[]>();

    for (const record of historicalData) {
      const hour = record._id.hour;
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, []);
      }
      hourlyMap.get(hour)!.push(record.count);
    }

    const result = [];
    for (let hour = 0; hour < 24; hour++) {
      const bookings = hourlyMap.get(hour) || [];
      const avgBookings = bookings.length > 0 ? bookings.reduce((a, b) => a + b, 0) / bookings.length : 0;
      result.push({ hour, bookings: Math.round(avgBookings) });
    }

    return result.sort((a, b) => b.bookings - a.bookings);
  }
}

export default PredictiveAnalyticsService;
