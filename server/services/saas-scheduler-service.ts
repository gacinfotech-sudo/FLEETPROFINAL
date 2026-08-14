/**
 * SAAS SCHEDULER SERVICE
 * Scheduled jobs for automatic data aggregation and sync
 */

import cron from 'node-cron';
import SaaSDataSyncService from './saas-data-sync-service';

export class SaaSSchedulerService {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all scheduled jobs
   */
  static async initialize() {
    console.log('🚀 Initializing SaaS Scheduler...\n');

    // Sync tenant metrics every hour
    this.scheduleHourlySync();

    // Sync billing data every 6 hours
    this.scheduleBillingSync();

    // Daily comprehensive sync at 2 AM
    this.scheduleDailySync();

    // Real-time customer analytics every 30 minutes
    this.scheduleCustomerAnalytics();

    console.log('✅ All SaaS scheduled jobs initialized\n');
  }

  /**
   * Hourly tenant metrics sync (every hour)
   */
  private static scheduleHourlySync() {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        console.log(`⏰ [${new Date().toISOString()}] Running hourly tenant metrics sync...`);
        const result = await SaaSDataSyncService.syncTenantMetrics();
        console.log(`✅ Hourly sync complete:`, result);
      } catch (error) {
        console.error('❌ Hourly sync failed:', error);
      }
    });

    this.jobs.set('hourly-sync', job);
    console.log('📅 Scheduled: Hourly tenant metrics sync (0 * * * *)');
  }

  /**
   * Billing data sync every 6 hours
   */
  private static scheduleBillingSync() {
    const job = cron.schedule('0 */6 * * *', async () => {
      try {
        console.log(`⏰ [${new Date().toISOString()}] Running billing data sync...`);
        const result = await SaaSDataSyncService.syncBillingData();
        console.log(`✅ Billing sync complete:`, result);
      } catch (error) {
        console.error('❌ Billing sync failed:', error);
      }
    });

    this.jobs.set('billing-sync', job);
    console.log('📅 Scheduled: Billing data sync every 6 hours (0 */6 * * *)');
  }

  /**
   * Daily comprehensive sync at 2 AM
   */
  private static scheduleDailySync() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        console.log(`⏰ [${new Date().toISOString()}] Running daily comprehensive sync...`);
        const result = await SaaSDataSyncService.fullSync();
        console.log(`✅ Daily sync complete:`, result);
      } catch (error) {
        console.error('❌ Daily sync failed:', error);
      }
    });

    this.jobs.set('daily-sync', job);
    console.log('📅 Scheduled: Daily comprehensive sync at 2 AM (0 2 * * *)');
  }

  /**
   * Customer analytics refresh every 30 minutes
   */
  private static scheduleCustomerAnalytics() {
    const job = cron.schedule('*/30 * * * *', async () => {
      try {
        console.log(`⏰ [${new Date().toISOString()}] Running customer analytics update...`);
        const result = await SaaSDataSyncService.syncCustomerAnalytics();
        console.log(`✅ Customer analytics update complete:`, result);
      } catch (error) {
        console.error('❌ Customer analytics update failed:', error);
      }
    });

    this.jobs.set('customer-analytics', job);
    console.log('📅 Scheduled: Customer analytics refresh every 30 min (*/30 * * * *)');
  }

  /**
   * Stop all scheduled jobs
   */
  static async stop() {
    console.log('\n🛑 Stopping all SaaS scheduled jobs...');
    for (const [name, job] of this.jobs.entries()) {
      job.stop();
      console.log(`✅ Stopped: ${name}`);
    }
    console.log('✅ All jobs stopped\n');
  }

  /**
   * Get job status
   */
  static getStatus() {
    const status = Array.from(this.jobs.entries()).map(([name, job]) => ({
      name,
      running: job ? 'active' : 'inactive'
    }));
    return status;
  }

  /**
   * Manual trigger for any sync operation
   */
  static async manualSync(type: 'tenant' | 'billing' | 'analytics' | 'full') {
    try {
      console.log(`🔄 Manual ${type} sync triggered...`);
      let result;

      switch (type) {
        case 'tenant':
          result = await SaaSDataSyncService.syncTenantMetrics();
          break;
        case 'billing':
          result = await SaaSDataSyncService.syncBillingData();
          break;
        case 'analytics':
          result = await SaaSDataSyncService.syncCustomerAnalytics();
          break;
        case 'full':
          result = await SaaSDataSyncService.fullSync();
          break;
      }

      console.log(`✅ Manual ${type} sync complete:`, result);
      return { success: true, result };
    } catch (error: any) {
      console.error(`❌ Manual ${type} sync failed:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export default SaaSSchedulerService;
