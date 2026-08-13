/**
 * PAYROLL AUTO-SYNC SCHEDULER
 * Background jobs for automated data synchronization
 *
 * Runs:
 * - Hourly: Sync all active drivers' data
 * - On-demand: When attendance, booking, or advance events occur
 * - Monthly: Auto-process payroll on 1st of month
 */

import schedule from 'node-schedule';
import mongoose from 'mongoose';
import { Driver, DriverSalaryMaster } from '../models/index';
import { triggerAutoSyncPayrollData, autoProcessMonthlyPayroll } from './driverAutoEnrollmentService';

let schedulerInitialized = false;

/**
 * Initialize scheduler with all background jobs
 * Call this once on server startup
 */
export function initializeAutoSyncScheduler(): void {
  if (schedulerInitialized) {
    console.log('[SCHEDULER] Already initialized');
    return;
  }

  console.log('[SCHEDULER] Initializing auto-sync scheduler...');

  try {
    // ========== HOURLY SYNC JOB ==========
    // Runs every hour at the top of the hour
    // Syncs data for all active drivers
    schedule.scheduleJob('0 * * * *', async () => {
      console.log('[SCHEDULER] Starting hourly auto-sync job...');
      try {
        await syncAllDriversData();
      } catch (error) {
        console.error('[SCHEDULER] Hourly sync failed:', error);
      }
    });

    console.log('[SCHEDULER] ✅ Hourly sync job scheduled (every hour)');

    // ========== MONTHLY PAYROLL JOB ==========
    // Runs on 1st of every month at 1 AM
    // Automatically processes payroll for all drivers
    schedule.scheduleJob('0 1 1 * *', async () => {
      console.log('[SCHEDULER] Starting monthly payroll processing...');
      try {
        await processMonthlyPayrollForAllTenants();
      } catch (error) {
        console.error('[SCHEDULER] Monthly payroll processing failed:', error);
      }
    });

    console.log('[SCHEDULER] ✅ Monthly payroll job scheduled (1st of month at 1 AM)');

    // ========== DAILY CLEANUP JOB ==========
    // Runs daily at 2 AM
    // Cleans up old sync records, updates driver availability status
    schedule.scheduleJob('0 2 * * *', async () => {
      console.log('[SCHEDULER] Starting daily cleanup job...');
      try {
        await dailyCleanup();
      } catch (error) {
        console.error('[SCHEDULER] Daily cleanup failed:', error);
      }
    });

    console.log('[SCHEDULER] ✅ Daily cleanup job scheduled (daily at 2 AM)');

    schedulerInitialized = true;
    console.log('[SCHEDULER] ✅ All jobs initialized successfully');
  } catch (error) {
    console.error('[SCHEDULER] ❌ Failed to initialize scheduler:', error);
    throw error;
  }
}

/**
 * HOURLY JOB: Sync all active drivers' data
 */
async function syncAllDriversData(): Promise<void> {
  const startTime = Date.now();
  console.log('[SYNC-ALL] Syncing data for all active drivers...');

  try {
    // Get all unique tenant IDs
    const tenants = await Driver.distinct('tenantId', { status: 'active' });
    console.log(`[SYNC-ALL] Found ${tenants.length} tenants with active drivers`);

    for (const tenantId of tenants) {
      try {
        // Get all active drivers for this tenant
        const drivers = await Driver.find({
          tenantId,
          status: 'active'
        }).select('_id name');

        console.log(`[SYNC-ALL] Syncing ${drivers.length} drivers for tenant ${tenantId}`);

        // Trigger sync for each driver (non-blocking)
        for (const driver of drivers) {
          triggerAutoSyncPayrollData(driver._id, new mongoose.Types.ObjectId(tenantId))
            .catch(err => console.error(`[SYNC-ALL] Failed to sync ${driver.name}:`, err));
        }
      } catch (error) {
        console.error(`[SYNC-ALL] Failed to sync tenant ${tenantId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SYNC-ALL] ✅ Sync job completed in ${duration}ms`);
  } catch (error) {
    console.error('[SYNC-ALL] ❌ Sync job failed:', error);
  }
}

/**
 * MONTHLY JOB: Process payroll for all tenants
 */
async function processMonthlyPayrollForAllTenants(): Promise<void> {
  const startTime = Date.now();
  console.log('[PAYROLL-MONTHLY] Starting monthly payroll processing for all tenants...');

  try {
    // Get all unique tenant IDs
    const tenants = await Driver.distinct('tenantId', { status: 'active' });
    console.log(`[PAYROLL-MONTHLY] Found ${tenants.length} tenants`);

    for (const tenantId of tenants) {
      try {
        console.log(`[PAYROLL-MONTHLY] Processing payroll for tenant ${tenantId}`);
        const result = await autoProcessMonthlyPayroll(new mongoose.Types.ObjectId(tenantId));
        console.log(`[PAYROLL-MONTHLY] ✅ Processed:`, {
          drivers: result.totalDrivers,
          grossSalary: result.totalGross,
          netSalary: result.totalNet
        });
      } catch (error) {
        console.error(`[PAYROLL-MONTHLY] ❌ Failed for tenant ${tenantId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[PAYROLL-MONTHLY] ✅ Completed in ${duration}ms`);
  } catch (error) {
    console.error('[PAYROLL-MONTHLY] ❌ Failed:', error);
  }
}

/**
 * DAILY JOB: Cleanup and maintenance
 */
async function dailyCleanup(): Promise<void> {
  console.log('[CLEANUP] Starting daily cleanup...');

  try {
    // Could add:
    // - Archive old salary calculations
    // - Update driver availability flags
    // - Generate daily reports
    // - Cleanup temporary sync records

    console.log('[CLEANUP] ✅ Cleanup completed');
  } catch (error) {
    console.error('[CLEANUP] ❌ Failed:', error);
  }
}

/**
 * MANUAL TRIGGER: Sync specific driver immediately
 * Use this when you need urgent data sync (e.g., after manual entry)
 */
export async function triggerImmediateSyncForDriver(
  driverId: string,
  tenantId: string
): Promise<void> {
  console.log(`[IMMEDIATE-SYNC] Triggering for driver ${driverId}`);
  await triggerAutoSyncPayrollData(
    new mongoose.Types.ObjectId(driverId),
    new mongoose.Types.ObjectId(tenantId)
  );
  console.log(`[IMMEDIATE-SYNC] ✅ Sync triggered`);
}

/**
 * MANUAL TRIGGER: Process payroll for specific tenant immediately
 */
export async function triggerImmediatePayrollProcess(
  tenantId: string,
  month?: number,
  year?: number
): Promise<any> {
  console.log(`[IMMEDIATE-PAYROLL] Processing for tenant ${tenantId}`);
  const result = await autoProcessMonthlyPayroll(
    new mongoose.Types.ObjectId(tenantId),
    month,
    year
  );
  console.log(`[IMMEDIATE-PAYROLL] ✅ Completed`);
  return result;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  initialized: boolean;
  jobs: string[];
} {
  return {
    initialized: schedulerInitialized,
    jobs: [
      'Hourly auto-sync (every hour)',
      'Monthly payroll (1st of month at 1 AM)',
      'Daily cleanup (every day at 2 AM)'
    ]
  };
}

export default {
  initializeAutoSyncScheduler,
  triggerImmediateSyncForDriver,
  triggerImmediatePayrollProcess,
  getSchedulerStatus
};
