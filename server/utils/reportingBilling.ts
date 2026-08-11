// Reporting Billing - Usage-Based Billing Calculation & Invoicing
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('ReportingBilling');

export interface BillingPriceModel {
  messagePerUnit: number;
  callPerMinute: number;
  apiCallPerRequest: number;
  volumeDiscounts: Array<{
    minVolume: number;
    maxVolume: number;
    discountPercentage: number;
  }>;
}

export interface BillingCalculation {
  tenantId: string;
  month: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  usage: {
    messages: number;
    calls: {
      totalMinutes: number;
      totalCount: number;
    };
    apiRequests: number;
  };
  unitCosts: {
    messages: number;
    calls: number;
    apiRequests: number;
  };
  subtotal: number;
  volumeDiscount: {
    percentage: number;
    amount: number;
  };
  taxes: {
    gst: number;
    rate: number;
  };
  totalCost: number;
  costTrend: {
    previousMonth: number;
    percentageChange: number;
  };
}

export interface InvoiceData {
  invoiceId: string;
  tenantId: string;
  tenantName: string;
  month: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  billing: BillingCalculation;
  payment: {
    status: 'unpaid' | 'paid' | 'overdue';
    dueDate: Date;
    paidDate?: Date;
  };
  generatedAt: Date;
}

export class ReportingBilling {
  private db: mongoose.Connection;

  private defaultPrices: BillingPriceModel = {
    messagePerUnit: 0.01,
    callPerMinute: 0.5,
    apiCallPerRequest: 0.001,
    volumeDiscounts: [
      { minVolume: 0, maxVolume: 10000, discountPercentage: 0 },
      { minVolume: 10001, maxVolume: 50000, discountPercentage: 5 },
      { minVolume: 50001, maxVolume: 100000, discountPercentage: 10 },
      { minVolume: 100001, maxVolume: 500000, discountPercentage: 15 },
      { minVolume: 500001, maxVolume: Infinity, discountPercentage: 20 },
    ],
  };

  constructor() {
    this.db = mongoose.connection;
  }

  async calculateUsageBasedBilling(
    tenantId: string,
    month: string,
    priceModel?: BillingPriceModel
  ): Promise<BillingCalculation> {
    const prices = priceModel || this.defaultPrices;

    // Parse month (YYYY-MM format)
    const [year, monthNum] = month.split('-');
    const startDate = new Date(`${year}-${monthNum}-01`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    // Get usage data
    const usagePipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $facet: {
          messages: [
            { $match: { eventType: { $regex: 'message', $options: 'i' } } },
            { $count: 'count' },
          ],
          calls: [
            { $match: { eventType: { $regex: 'call', $options: 'i' } } },
            {
              $group: {
                _id: null,
                totalCount: { $sum: 1 },
                totalMinutes: { $sum: { $cond: [{ $field: 'duration' }, '$duration', 0] } },
              },
            },
          ],
          apiRequests: [
            { $match: { eventType: 'api_request' } },
            { $count: 'count' },
          ],
        },
      },
    ];

    const usageData = await notificationLogs.aggregate(usagePipeline).toArray();
    const usage = usageData[0];

    const messageCount = usage.messages[0]?.count || 0;
    const callData = usage.calls[0] || { totalCount: 0, totalMinutes: 0 };
    const apiRequestCount = usage.apiRequests[0]?.count || 0;

    // Calculate costs
    const messageCost = messageCount * prices.messagePerUnit;
    const callCost = callData.totalMinutes * prices.callPerMinute;
    const apiCost = apiRequestCount * prices.apiCallPerRequest;
    const subtotal = messageCost + callCost + apiCost;

    // Calculate volume discount
    const totalVolume = messageCount + callData.totalCount + apiRequestCount;
    const discount = this.calculateVolumeDiscount(totalVolume, prices);

    // Get previous month's cost for comparison
    const previousMonth = new Date(startDate);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const previousMonthCost = await this.calculateMonthlyUsageCost(
      tenantId,
      previousMonth,
      prices
    );

    const discountAmount = subtotal * (discount / 100);
    const taxableAmount = subtotal - discountAmount;
    const gstRate = 0.18; // 18% GST
    const gstAmount = taxableAmount * gstRate;
    const totalCost = taxableAmount + gstAmount;

    const percentageChange =
      previousMonthCost > 0
        ? ((totalCost - previousMonthCost) / previousMonthCost) * 100
        : 0;

    return {
      tenantId,
      month,
      period: { startDate, endDate },
      usage: {
        messages: messageCount,
        calls: {
          totalMinutes: callData.totalMinutes,
          totalCount: callData.totalCount,
        },
        apiRequests: apiRequestCount,
      },
      unitCosts: {
        messages: messageCost,
        calls: callCost,
        apiRequests: apiCost,
      },
      subtotal,
      volumeDiscount: {
        percentage: discount,
        amount: discountAmount,
      },
      taxes: {
        gst: gstAmount,
        rate: gstRate * 100,
      },
      totalCost,
      costTrend: {
        previousMonth: previousMonthCost,
        percentageChange: parseFloat(percentageChange.toFixed(2)),
      },
    };
  }

  private calculateVolumeDiscount(volume: number, priceModel: BillingPriceModel): number {
    for (const tier of priceModel.volumeDiscounts) {
      if (volume >= tier.minVolume && volume <= tier.maxVolume) {
        return tier.discountPercentage;
      }
    }
    return 0;
  }

  private async calculateMonthlyUsageCost(
    tenantId: string,
    month: Date,
    priceModel: BillingPriceModel
  ): Promise<number> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const usagePipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $facet: {
          messages: [
            { $match: { eventType: { $regex: 'message', $options: 'i' } } },
            { $count: 'count' },
          ],
          calls: [
            { $match: { eventType: { $regex: 'call', $options: 'i' } } },
            {
              $group: {
                _id: null,
                totalMinutes: { $sum: { $cond: [{ $field: 'duration' }, '$duration', 0] } },
              },
            },
          ],
          apiRequests: [
            { $match: { eventType: 'api_request' } },
            { $count: 'count' },
          ],
        },
      },
    ];

    const usageData = await notificationLogs.aggregate(usagePipeline).toArray();
    const usage = usageData[0];

    const messageCount = usage.messages[0]?.count || 0;
    const callMinutes = usage.calls[0]?.totalMinutes || 0;
    const apiRequestCount = usage.apiRequests[0]?.count || 0;

    const messageCost = messageCount * priceModel.messagePerUnit;
    const callCost = callMinutes * priceModel.callPerMinute;
    const apiCost = apiRequestCount * priceModel.apiCallPerRequest;

    const subtotal = messageCost + callCost + apiCost;
    const discount = this.calculateVolumeDiscount(
      messageCount + apiRequestCount,
      priceModel
    );
    const discountAmount = subtotal * (discount / 100);
    const taxableAmount = subtotal - discountAmount;
    const gstAmount = taxableAmount * 0.18;

    return taxableAmount + gstAmount;
  }

  async generateInvoice(
    tenantId: string,
    month: string,
    priceModel?: BillingPriceModel
  ): Promise<InvoiceData> {
    const billing = await this.calculateUsageBasedBilling(tenantId, month, priceModel);

    const [year, monthNum] = month.split('-');
    const dueDate = new Date(parseInt(year), parseInt(monthNum), 30);

    const invoiceId = `INV-${tenantId}-${month}-${Date.now()}`;

    return {
      invoiceId,
      tenantId,
      tenantName: '', // Would be populated from tenant collection
      month,
      period: billing.period,
      billing,
      payment: {
        status: 'unpaid',
        dueDate,
      },
      generatedAt: new Date(),
    };
  }

  async calculateCostTrend(
    tenantId: string,
    months: number = 12
  ): Promise<
    Array<{
      month: string;
      totalCost: number;
      messagesCost: number;
      callsCost: number;
      apiCost: number;
    }>
  > {
    const trend = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const billing = await this.calculateUsageBasedBilling(tenantId, monthStr);

      trend.push({
        month: monthStr,
        totalCost: billing.totalCost,
        messagesCost: billing.unitCosts.messages,
        callsCost: billing.unitCosts.calls,
        apiCost: billing.unitCosts.apiRequests,
      });
    }

    return trend;
  }

  async identifyHighValueUsagePatterns(
    tenantId: string,
    months: number = 3
  ): Promise<
    Array<{
      pattern: string;
      description: string;
      recommendedOptimization: string;
      potentialSavings: number;
    }>
  > {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Analyze usage patterns
    const patterns = [];

    // Pattern 1: High message volume
    const messagePipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $gte: startDate },
          eventType: { $regex: 'message', $options: 'i' },
        },
      },
      { $count: 'count' },
    ];

    const messageCount = (await notificationLogs.aggregate(messagePipeline).toArray())[0];

    if (messageCount && messageCount.count > 100000) {
      patterns.push({
        pattern: 'High Message Volume',
        description: `Sending ${messageCount.count} messages over ${months} months`,
        recommendedOptimization:
          'Implement message batching and compression. Consider bulk API endpoints.',
        potentialSavings: messageCount.count * 0.001 * 0.1, // 10% savings
      });
    }

    // Pattern 2: High API call volume
    const apiPipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $gte: startDate },
          eventType: 'api_request',
        },
      },
      { $count: 'count' },
    ];

    const apiCount = (await notificationLogs.aggregate(apiPipeline).toArray())[0];

    if (apiCount && apiCount.count > 50000) {
      patterns.push({
        pattern: 'High API Call Volume',
        description: `Making ${apiCount.count} API requests over ${months} months`,
        recommendedOptimization:
          'Implement caching and webhook subscriptions to reduce polling.',
        potentialSavings: apiCount.count * 0.001 * 0.2, // 20% savings
      });
    }

    // Pattern 3: Off-peak usage
    const offPeakPipeline = [
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $gte: startDate },
          $expr: {
            $or: [
              { $gte: [{ $hour: '$createdAt' }, 22] },
              { $lte: [{ $hour: '$createdAt' }, 6] },
            ],
          },
        },
      },
      { $count: 'count' },
    ];

    const offPeakCount = (await notificationLogs.aggregate(offPeakPipeline).toArray())[0];

    if (offPeakCount && offPeakCount.count > 10000) {
      patterns.push({
        pattern: 'Off-Peak Usage',
        description: `${offPeakCount.count} operations during off-peak hours`,
        recommendedOptimization: 'Batch non-urgent operations during off-peak hours for better rates.',
        potentialSavings: offPeakCount.count * 0.001 * 0.15, // 15% savings
      });
    }

    return patterns;
  }
}

export default new ReportingBilling();
