/**
 * LEAVE CONFIGURATION SERVICE
 * Manages tenant-level leave policies: paid leave, unpaid leave, weekly off
 */

import mongoose from 'mongoose';
import { LeaveConfiguration } from '../models/index';
import { Logger } from '../utils/logger';

const logger = new Logger('LeaveConfigService');

export interface ILeaveConfig {
  tenantId: string;
  paidLeavePolicy: {
    annualQuota: number;
    accrualType: 'fixed' | 'monthly' | 'quarterly';
    accrualValue: number;
    carryForwardAllowed: boolean;
    maxCarryForward: number;
    expiryMonths: number;
  };
  unpaidLeavePolicy: {
    allowUnpaid: boolean;
    maxConsecutiveDays: number;
    requireApproval: boolean;
    deductionType: 'full' | 'half' | 'none';
  };
  weeklyOffPolicy: {
    dayOfWeek: number; // 0-6 (Sun-Sat)
    alternateWeeklyOff: boolean;
    alternatePattern: 'first_second' | 'weekly_rotation';
    compensatoryOffAllowed: boolean;
    compOffExpiryDays: number;
  };
  medicalLeavePolicy: {
    annualQuota: number;
    requiresCertificate: boolean;
    certificateAfterDays: number;
  };
  emergencyLeavePolicy: {
    allowEmergency: boolean;
    maxConsecutiveDays: number;
    requireApproval: boolean;
  };
  holidayPolicy: {
    holidays: Array<{
      date: string; // YYYY-MM-DD
      name: string;
    }>;
    rotationalHolidays: Array<{
      name: string;
      datePattern: string;
    }>;
  };
  leaveApprovalFlow: {
    requiresManagerApproval: boolean;
    requiresHRApproval: boolean;
    approvalOrder: ('manager' | 'hr' | 'admin')[];
    maxPendingDays: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Get leave configuration for a tenant
 */
export async function getLeaveConfiguration(tenantId: string) {
  try {
    const config = await LeaveConfiguration.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!config) {
      logger.info(`No leave configuration found for tenant ${tenantId}, creating default`);
      return createDefaultConfiguration(tenantId);
    }

    return config;
  } catch (error) {
    logger.error(`Failed to get leave configuration: ${error}`);
    throw error;
  }
}

/**
 * Create default leave configuration for a new tenant
 */
export async function createDefaultConfiguration(tenantId: string) {
  try {
    const defaultConfig = new LeaveConfiguration({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      paidLeavePolicy: {
        annualQuota: 12,
        accrualType: 'monthly',
        accrualValue: 1,
        carryForwardAllowed: true,
        maxCarryForward: 5,
        expiryMonths: 18,
      },
      unpaidLeavePolicy: {
        allowUnpaid: true,
        maxConsecutiveDays: 30,
        requireApproval: true,
        deductionType: 'full',
      },
      weeklyOffPolicy: {
        dayOfWeek: 0, // Sunday
        alternateWeeklyOff: false,
        alternatePattern: 'first_second',
        compensatoryOffAllowed: true,
        compOffExpiryDays: 30,
      },
      medicalLeavePolicy: {
        annualQuota: 6,
        requiresCertificate: true,
        certificateAfterDays: 3,
      },
      emergencyLeavePolicy: {
        allowEmergency: true,
        maxConsecutiveDays: 3,
        requireApproval: false,
      },
      holidayPolicy: {
        holidays: [
          { date: '2026-01-26', name: 'Republic Day' },
          { date: '2026-03-25', name: 'Holi' },
          { date: '2026-08-15', name: 'Independence Day' },
          { date: '2026-10-02', name: "Gandhi Jayanti" },
          { date: '2026-12-25', name: 'Christmas' },
        ],
        rotationalHolidays: [],
      },
      leaveApprovalFlow: {
        requiresManagerApproval: true,
        requiresHRApproval: true,
        approvalOrder: ['manager', 'hr'],
        maxPendingDays: 7,
      },
    });

    const saved = await defaultConfig.save();
    logger.info(`Created default leave configuration for tenant ${tenantId}`);
    return saved;
  } catch (error) {
    logger.error(`Failed to create default configuration: ${error}`);
    throw error;
  }
}

/**
 * Update leave configuration for a tenant
 */
export async function updateLeaveConfiguration(
  tenantId: string,
  updates: Partial<ILeaveConfig>
) {
  try {
    const config = await LeaveConfiguration.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId) },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!config) {
      logger.warn(`Leave configuration not found for tenant ${tenantId}`);
      return createDefaultConfiguration(tenantId);
    }

    logger.info(`Updated leave configuration for tenant ${tenantId}`);
    return config;
  } catch (error) {
    logger.error(`Failed to update leave configuration: ${error}`);
    throw error;
  }
}

/**
 * Update paid leave policy
 */
export async function updatePaidLeavePolicy(
  tenantId: string,
  policy: Partial<ILeaveConfig['paidLeavePolicy']>
) {
  try {
    const config = await LeaveConfiguration.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId) },
      { $set: { paidLeavePolicy: policy, updatedAt: new Date() } },
      { new: true }
    );

    if (!config) {
      throw new Error(`Leave configuration not found for tenant ${tenantId}`);
    }

    logger.info(`Updated paid leave policy for tenant ${tenantId}`);
    return config;
  } catch (error) {
    logger.error(`Failed to update paid leave policy: ${error}`);
    throw error;
  }
}

/**
 * Update unpaid leave policy
 */
export async function updateUnpaidLeavePolicy(
  tenantId: string,
  policy: Partial<ILeaveConfig['unpaidLeavePolicy']>
) {
  try {
    const config = await LeaveConfiguration.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId) },
      { $set: { unpaidLeavePolicy: policy, updatedAt: new Date() } },
      { new: true }
    );

    if (!config) {
      throw new Error(`Leave configuration not found for tenant ${tenantId}`);
    }

    logger.info(`Updated unpaid leave policy for tenant ${tenantId}`);
    return config;
  } catch (error) {
    logger.error(`Failed to update unpaid leave policy: ${error}`);
    throw error;
  }
}

/**
 * Update weekly off policy
 */
export async function updateWeeklyOffPolicy(
  tenantId: string,
  policy: Partial<ILeaveConfig['weeklyOffPolicy']>
) {
  try {
    const config = await LeaveConfiguration.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId) },
      { $set: { weeklyOffPolicy: policy, updatedAt: new Date() } },
      { new: true }
    );

    if (!config) {
      throw new Error(`Leave configuration not found for tenant ${tenantId}`);
    }

    logger.info(`Updated weekly off policy for tenant ${tenantId}`);
    return config;
  } catch (error) {
    logger.error(`Failed to update weekly off policy: ${error}`);
    throw error;
  }
}

/**
 * Add holiday to holiday policy
 */
export async function addHoliday(
  tenantId: string,
  date: string,
  name: string
) {
  try {
    const config = await LeaveConfiguration.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId) },
      {
        $push: {
          'holidayPolicy.holidays': { date, name }
        },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    if (!config) {
      throw new Error(`Leave configuration not found for tenant ${tenantId}`);
    }

    logger.info(`Added holiday on ${date} for tenant ${tenantId}`);
    return config;
  } catch (error) {
    logger.error(`Failed to add holiday: ${error}`);
    throw error;
  }
}

/**
 * Remove holiday from holiday policy
 */
export async function removeHoliday(tenantId: string, date: string) {
  try {
    const config = await LeaveConfiguration.findOneAndUpdate(
      { tenantId: new mongoose.Types.ObjectId(tenantId) },
      {
        $pull: {
          'holidayPolicy.holidays': { date }
        },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    if (!config) {
      throw new Error(`Leave configuration not found for tenant ${tenantId}`);
    }

    logger.info(`Removed holiday on ${date} for tenant ${tenantId}`);
    return config;
  } catch (error) {
    logger.error(`Failed to remove holiday: ${error}`);
    throw error;
  }
}

/**
 * Check if a date is a holiday
 */
export async function isHoliday(tenantId: string, date: string): Promise<boolean> {
  try {
    const config = await getLeaveConfiguration(tenantId);
    return config.holidayPolicy.holidays.some(h => h.date === date);
  } catch (error) {
    logger.error(`Failed to check if date is holiday: ${error}`);
    return false;
  }
}

/**
 * Calculate remaining paid leave for a driver
 */
export async function calculateRemainingPaidLeave(
  tenantId: string,
  driverId: string,
  year: number
): Promise<number> {
  try {
    const config = await getLeaveConfiguration(tenantId);
    // This would need integration with driver leave records
    // Placeholder implementation
    return config.paidLeavePolicy.annualQuota;
  } catch (error) {
    logger.error(`Failed to calculate remaining paid leave: ${error}`);
    throw error;
  }
}

/**
 * Validate leave request against configuration
 */
export async function validateLeaveRequest(
  tenantId: string,
  leaveData: {
    leaveType: string;
    startDate: string;
    endDate: string;
    dayPart?: string;
  }
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    const config = await getLeaveConfiguration(tenantId);
    const startDate = new Date(leaveData.startDate);
    const endDate = new Date(leaveData.endDate);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (leaveData.leaveType === 'unpaid') {
      if (!config.unpaidLeavePolicy.allowUnpaid) {
        errors.push('Unpaid leave is not allowed in this organization');
      }
      if (days > config.unpaidLeavePolicy.maxConsecutiveDays) {
        errors.push(
          `Maximum consecutive unpaid leave is ${config.unpaidLeavePolicy.maxConsecutiveDays} days`
        );
      }
    }

    if (leaveData.leaveType === 'emergency') {
      if (!config.emergencyLeavePolicy.allowEmergency) {
        errors.push('Emergency leave is not allowed in this organization');
      }
      if (days > config.emergencyLeavePolicy.maxConsecutiveDays) {
        errors.push(
          `Maximum consecutive emergency leave is ${config.emergencyLeavePolicy.maxConsecutiveDays} days`
        );
      }
    }

    if (leaveData.leaveType === 'medical') {
      if (days >= config.medicalLeavePolicy.certificateAfterDays) {
        errors.push(
          `Medical certificate required for leaves of ${config.medicalLeavePolicy.certificateAfterDays} days or more`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    logger.error(`Failed to validate leave request: ${error}`);
    return { valid: false, errors: ['Configuration validation failed'] };
  }
}

export default {
  getLeaveConfiguration,
  createDefaultConfiguration,
  updateLeaveConfiguration,
  updatePaidLeavePolicy,
  updateUnpaidLeavePolicy,
  updateWeeklyOffPolicy,
  addHoliday,
  removeHoliday,
  isHoliday,
  calculateRemainingPaidLeave,
  validateLeaveRequest,
};
