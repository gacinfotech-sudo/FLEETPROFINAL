/**
 * SAAS DATA SYNC SERVICE
 * Synchronizes FleetPro Customer360 data with SaaS Admin Platform
 * Handles tenant metrics, billing, and analytics aggregation
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export class SaaSDataSyncService {
  /**
   * Sync all tenant metrics to SaaS admin dashboard
   */
  static async syncTenantMetrics() {
    try {
      const db = await storage.getDb();

      // Get all tenants from FleetPro
      const tenants = await db.collection('tenants').find({}).toArray();

      for (const tenant of tenants) {
        const tenantId = tenant._id.toString();

        // Calculate tenant metrics
        const metrics = await this.calculateTenantMetrics(tenantId);

        // Update SaaS dashboard with metrics
        await db.collection('saas_tenant_metrics').updateOne(
          { tenantId: new mongoose.Types.ObjectId(tenantId) },
          {
            $set: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              tenantName: tenant.name,
              subscriptionPlan: tenant.subscriptionPlan,
              status: tenant.isActive ? 'active' : 'inactive',
              bookingsThisMonth: metrics.bookingsThisMonth,
              activeUsers: metrics.activeUsers,
              totalRevenue: metrics.totalRevenue,
              lastUpdated: new Date(),
              apiCallsUsed: metrics.apiCallsUsed,
              storageUsed: metrics.storageUsed,
              dataPoints: metrics.dataPoints
            }
          },
          { upsert: true }
        );
      }

      console.log(`✅ Synced metrics for ${tenants.length} tenants`);
      return { success: true, tenantsSync: tenants.length };
    } catch (error) {
      console.error('Error syncing tenant metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive tenant metrics
   */
  static async calculateTenantMetrics(tenantId: string) {
    try {
      const db = await storage.getDb();
      const tid = new mongoose.Types.ObjectId(tenantId);

      // Get booking statistics
      const bookings = await db
        .collection('bookings')
        .find({ tenantId: tid })
        .toArray();

      const thisMonth = new Date();
      thisMonth.setDate(1);
      const bookingsThisMonth = bookings.filter(
        b => new Date(b.createdAt) >= thisMonth
      ).length;

      // Get active users
      const users = await db
        .collection('users')
        .find({ tenantId: tid, isActive: true })
        .toArray();

      // Calculate revenue
      const totalRevenue = bookings.reduce(
        (sum, b) => sum + (b.totalAmount || 0),
        0
      );

      // Get API usage (if tracked)
      const apiLogs = await db
        .collection('api_logs')
        .find({ tenantId: tid, createdAt: { $gte: thisMonth } })
        .toArray();

      // Estimate storage
      const storageUsed = (bookings.length * 2 + users.length * 1) / 1024; // Rough estimate in MB

      return {
        bookingsThisMonth,
        activeUsers: users.length,
        totalRevenue,
        apiCallsUsed: apiLogs.length,
        storageUsed: Math.round(storageUsed),
        dataPoints: bookings.length
      };
    } catch (error) {
      console.error('Error calculating metrics:', error);
      return {
        bookingsThisMonth: 0,
        activeUsers: 0,
        totalRevenue: 0,
        apiCallsUsed: 0,
        storageUsed: 0,
        dataPoints: 0
      };
    }
  }

  /**
   * Sync billing data from FleetPro to SaaS
   */
  static async syncBillingData() {
    try {
      const db = await storage.getDb();

      // Get all payment records
      const payments = await db
        .collection('bookingPayments')
        .find({})
        .toArray();

      const billingByTenant = new Map();

      for (const payment of payments) {
        const tenantId = payment.tenantId.toString();
        if (!billingByTenant.has(tenantId)) {
          billingByTenant.set(tenantId, { amount: 0, count: 0 });
        }
        const current = billingByTenant.get(tenantId);
        current.amount += payment.amount || 0;
        current.count += 1;
      }

      // Update SaaS billing records
      for (const [tenantId, billing] of billingByTenant) {
        await db.collection('saas_billing').updateOne(
          { tenantId: new mongoose.Types.ObjectId(tenantId) },
          {
            $set: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              totalBilledAmount: billing.amount,
              paymentCount: billing.count,
              lastBilledDate: new Date(),
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          },
          { upsert: true }
        );
      }

      console.log(`✅ Synced billing data for ${billingByTenant.size} tenants`);
      return { success: true, billingRecordsSynced: billingByTenant.size };
    } catch (error) {
      console.error('Error syncing billing data:', error);
      throw error;
    }
  }

  /**
   * Sync customer analytics
   */
  static async syncCustomerAnalytics() {
    try {
      const db = await storage.getDb();

      // Get customer metrics by tenant
      const tenants = await db.collection('tenants').find({}).toArray();

      for (const tenant of tenants) {
        const tenantId = tenant._id;

        const customers = await db
          .collection('customers')
          .find({ tenantId })
          .toArray();

        const customerMetrics = await db
          .collection('customerMetrics')
          .find({ tenantId })
          .toArray();

        // Calculate churn risk
        const atRiskCount = customerMetrics.filter(
          m => m.churnRisk >= 70
        ).length;
        const avgCLV =
          customerMetrics.length > 0
            ? customerMetrics.reduce((sum, m) => sum + (m.clvScore || 0), 0) /
              customerMetrics.length
            : 0;

        await db.collection('saas_customer_analytics').updateOne(
          { tenantId },
          {
            $set: {
              tenantId,
              totalCustomers: customers.length,
              atRiskCustomers: atRiskCount,
              averageCLV: Math.round(avgCLV),
              lastUpdated: new Date()
            }
          },
          { upsert: true }
        );
      }

      console.log(
        `✅ Synced customer analytics for ${tenants.length} tenants`
      );
      return { success: true, analyticsTenantsSync: tenants.length };
    } catch (error) {
      console.error('Error syncing customer analytics:', error);
      throw error;
    }
  }

  /**
   * Full sync: run all sync operations
   */
  static async fullSync() {
    try {
      console.log('🔄 Starting full SaaS data sync...\n');

      const results = await Promise.all([
        this.syncTenantMetrics(),
        this.syncBillingData(),
        this.syncCustomerAnalytics()
      ]);

      console.log('\n✅ Full sync complete!');
      console.log('Summary:', {
        tenantMetrics: results[0],
        billingData: results[1],
        customerAnalytics: results[2]
      });

      return { success: true, results };
    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    }
  }

  /**
   * Get SaaS dashboard summary
   */
  static async getDashboardSummary() {
    try {
      const db = await storage.getDb();

      const metrics = await db
        .collection('saas_tenant_metrics')
        .find({})
        .toArray();
      const billing = await db
        .collection('saas_billing')
        .find({})
        .toArray();
      const analytics = await db
        .collection('saas_customer_analytics')
        .find({})
        .toArray();

      const totalRevenue = billing.reduce(
        (sum, b) => sum + (b.totalBilledAmount || 0),
        0
      );
      const totalCustomers = analytics.reduce(
        (sum, a) => sum + (a.totalCustomers || 0),
        0
      );
      const atRiskCustomers = analytics.reduce(
        (sum, a) => sum + (a.atRiskCustomers || 0),
        0
      );

      return {
        totalTenants: metrics.length,
        activeTenants: metrics.filter(m => m.status === 'active').length,
        totalRevenue,
        totalCustomers,
        atRiskCustomers,
        averageCLV:
          analytics.length > 0
            ? Math.round(
                analytics.reduce((sum, a) => sum + (a.averageCLV || 0), 0) /
                  analytics.length
              )
            : 0
      };
    } catch (error) {
      console.error('Error getting dashboard summary:', error);
      return {
        totalTenants: 0,
        activeTenants: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        atRiskCustomers: 0,
        averageCLV: 0
      };
    }
  }
}

export default SaaSDataSyncService;
