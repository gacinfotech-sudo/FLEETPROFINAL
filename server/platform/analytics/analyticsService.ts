// STEP 31: Platform Analytics Service
// Revenue trends, tenant growth, churn analysis, MRR tracking

import mongoose from 'mongoose';
import { Subscription } from '../models/Subscription';
import { PlatformPayment } from '../models/PlatformPayment';
import { PlatformInvoice } from '../models/PlatformInvoice';
import { Tenant } from '../../models';

export class AnalyticsService {
  // Monthly Recurring Revenue (MRR)
  async getMRR() {
    try {
      const activeSubscriptions = await Subscription.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            totalMRR: { $sum: '$priceSnapshot' }
          }
        }
      ]);

      return {
        mrr: activeSubscriptions[0]?.totalMRR || 0,
        count: activeSubscriptions[0]?.count || 0
      };
    } catch (error) {
      console.error('Get MRR failed:', error);
      throw error;
    }
  }

  // Annual Recurring Revenue (ARR)
  async getARR() {
    try {
      const activeSubscriptions = await Subscription.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            totalARR: { $sum: { $multiply: ['$priceSnapshot', 12] } }
          }
        }
      ]);

      return activeSubscriptions[0]?.totalARR || 0;
    } catch (error) {
      console.error('Get ARR failed:', error);
      throw error;
    }
  }

  // Revenue per tenant (ARPU)
  async getARPU() {
    try {
      const stats = await Subscription.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: null,
            totalPrice: { $sum: '$priceSnapshot' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            arpu: { $divide: ['$totalPrice', '$count'] },
            tenantCount: '$count'
          }
        }
      ]);

      return stats[0] || { arpu: 0, tenantCount: 0 };
    } catch (error) {
      console.error('Get ARPU failed:', error);
      throw error;
    }
  }

  // Tenant growth by month
  async getTenantGrowth(months: number = 12) {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const growth = await Tenant.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
            },
            newTenants: { $sum: 1 }
          }
        },
        { $sort: { '_id.month': 1 } }
      ]);

      return growth;
    } catch (error) {
      console.error('Get tenant growth failed:', error);
      throw error;
    }
  }

  // Churn analysis
  async getChurnRate() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const churned = await Subscription.countDocuments({
        status: 'cancelled',
        modifiedAt: { $gte: thirtyDaysAgo }
      });

      const active = await Subscription.countDocuments({
        status: 'active'
      });

      const churnRate = active > 0 ? (churned / (active + churned)) * 100 : 0;

      return {
        churned,
        active,
        churnRate: parseFloat(churnRate.toFixed(2))
      };
    } catch (error) {
      console.error('Get churn rate failed:', error);
      throw error;
    }
  }

  // Revenue by plan
  async getRevenueByPlan() {
    try {
      const revenue = await Subscription.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: '$planId',
            count: { $sum: 1 },
            totalRevenue: { $sum: '$priceSnapshot' }
          }
        },
        {
          $lookup: {
            from: 'plans',
            localField: '_id',
            foreignField: '_id',
            as: 'plan'
          }
        },
        { $unwind: '$plan' },
        {
          $project: {
            planName: '$plan.name',
            count: 1,
            totalRevenue: 1,
            avgPrice: { $divide: ['$totalRevenue', '$count'] }
          }
        }
      ]);

      return revenue;
    } catch (error) {
      console.error('Get revenue by plan failed:', error);
      throw error;
    }
  }

  // Payment collection rate
  async getPaymentCollectionRate() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const issued = await PlatformInvoice.countDocuments({
        issuedAt: { $gte: thirtyDaysAgo }
      });

      const paid = await PlatformInvoice.countDocuments({
        status: 'paid',
        issuedAt: { $gte: thirtyDaysAgo }
      });

      const collectionRate = issued > 0 ? (paid / issued) * 100 : 0;

      return {
        issued,
        paid,
        collectionRate: parseFloat(collectionRate.toFixed(2))
      };
    } catch (error) {
      console.error('Get collection rate failed:', error);
      throw error;
    }
  }

  // Cohort analysis (by signup month)
  async getCohortAnalysis() {
    try {
      const cohorts = await Tenant.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            tenantCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // For each cohort, get retention (active subscriptions)
      const cohortData = await Promise.all(
        cohorts.map(async (cohort) => {
          const activeCount = await Tenant.countDocuments({
            createdAt: {
              $gte: new Date(`${cohort._id}-01`),
              $lt: new Date(`${cohort._id}-31`)
            }
          });

          return {
            month: cohort._id,
            signups: cohort.tenantCount,
            retained: activeCount,
            retentionRate: parseFloat(((activeCount / cohort.tenantCount) * 100).toFixed(2))
          };
        })
      );

      return cohortData;
    } catch (error) {
      console.error('Get cohort analysis failed:', error);
      throw error;
    }
  }

  // Lifetime value (LTV) estimation
  async getLifetimeValue() {
    try {
      const avgSubscriptionMonths = 12; // Assume 1 year average
      const arpu = await this.getARPU();
      const ltv = arpu.arpu * avgSubscriptionMonths;

      return {
        arpu: parseFloat(arpu.arpu.toFixed(2)),
        avgSubscriptionMonths,
        ltv: parseFloat(ltv.toFixed(2))
      };
    } catch (error) {
      console.error('Get LTV failed:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
