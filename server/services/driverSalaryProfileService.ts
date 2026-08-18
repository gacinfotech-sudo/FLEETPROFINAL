/**
 * DRIVER SALARY PROFILE SERVICE
 * High-level integration service for Driver Salary Profile operations
 * Bridges the salary calculation engine with database operations
 *
 * RESPONSIBILITIES:
 * - Link salary masters to driver profiles
 * - Validate salary configuration status
 * - Provide audit trail for salary changes
 * - Manage salary configuration lifecycle
 * - Report configuration issues
 */

import mongoose from 'mongoose';
import {
  Driver,
  DriverSalaryMaster,
  IDriver,
  IDriverSalaryMaster
} from '../models/index';
import {
  validateSalaryMasterIsActive,
  validateSalaryMasterCompleteness,
  getActiveSalaryConfig,
  getAllSalaryConfigsForDriver,
  getSalaryConfigurationStatus
} from './salaryCalculationEngine';

/**
 * Link active salary master to driver profile
 * Creates the binding between Driver.activeSalaryMasterId and DriverSalaryMaster
 */
export async function linkActiveSalaryMasterToDriver(
  driverId: string | mongoose.Types.ObjectId,
  salaryMasterId: string | mongoose.Types.ObjectId,
  tenantId: string | mongoose.Types.ObjectId,
  linkedBy: { userId: string; role: string }
): Promise<IDriver | null> {
  try {
    const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;
    const salaryMasterObjId =
      typeof salaryMasterId === 'string' ? new mongoose.Types.ObjectId(salaryMasterId) : salaryMasterId;
    const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    // Verify salary master exists and is active
    const salaryMaster = await DriverSalaryMaster.findOne({
      _id: salaryMasterObjId,
      tenantId: tenantObjId,
      driverId: driverObjId,
      status: 'active'
    }).exec();

    if (!salaryMaster) {
      throw new Error('Active salary master not found for this driver');
    }

    // Update driver with active salary master reference
    const updatedDriver = await Driver.findByIdAndUpdate(
      driverObjId,
      {
        $set: {
          activeSalaryMasterId: salaryMasterObjId,
          baseSalary: salaryMaster.baseSalary,
          salaryStructureType: salaryMaster.salaryType,
          ctcAmount: salaryMaster.baseSalary,
          lastModifiedBy: linkedBy.userId,
          lastModifiedAt: new Date()
        }
      },
      { new: true }
    ).exec();

    return updatedDriver;
  } catch (error) {
    console.error('Error linking salary master to driver:', error);
    throw error;
  }
}

/**
 * Unlink salary master from driver profile
 * Removes the binding but does not delete the salary master
 */
export async function unlinkSalaryMasterFromDriver(
  driverId: string | mongoose.Types.ObjectId,
  unlinkedBy: { userId: string; role: string }
): Promise<IDriver | null> {
  try {
    const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

    const updatedDriver = await Driver.findByIdAndUpdate(
      driverObjId,
      {
        $unset: {
          activeSalaryMasterId: 1
        },
        $set: {
          lastModifiedBy: unlinkedBy.userId,
          lastModifiedAt: new Date()
        }
      },
      { new: true }
    ).exec();

    return updatedDriver;
  } catch (error) {
    console.error('Error unlinking salary master from driver:', error);
    throw error;
  }
}

/**
 * Get salary configuration health report for a driver
 * Comprehensive status including validation, linking, and issues
 */
export async function getSalaryConfigurationHealthReport(
  driverId: string | mongoose.Types.ObjectId,
  tenantId: string | mongoose.Types.ObjectId
): Promise<{
  driverId: string;
  driverName?: string;
  overallStatus: 'healthy' | 'warning' | 'critical';
  configurationStatus: {
    hasActiveSalary: boolean;
    activeConfigId?: string;
    configStatus: string;
    lastModified?: Date;
  };
  validationStatus: {
    isComplete: boolean;
    errors: string[];
  };
  linkingStatus: {
    linkedToDriver: boolean;
    driverHasActiveSalaryMasterId: boolean;
    mismatch: boolean;
  };
  history: {
    totalConfigurations: number;
    recentChanges: number; // Last 30 days
  };
  recommendations: string[];
}> {
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  const driver = await Driver.findById(driverObjId).exec();
  const configStatus = await getSalaryConfigurationStatus(driverObjId, tenantObjId);
  const allConfigs = await getAllSalaryConfigsForDriver(driverObjId, tenantObjId);

  const validationStatus = configStatus.activeConfig
    ? validateSalaryMasterCompleteness(configStatus.activeConfig)
    : { valid: false, errors: ['No active salary configuration'] };

  const linkedToDriver = configStatus.linkedToDriver;
  const driverHasActiveSalaryMasterId = !!driver?.activeSalaryMasterId;

  // Check for recent changes (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentChanges = allConfigs.filter((c) => c.updatedAt && c.updatedAt > thirtyDaysAgo).length;

  // Determine overall status
  const recommendations: string[] = [];
  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

  if (!configStatus.hasActiveSalary) {
    overallStatus = 'critical';
    recommendations.push('Create an active salary configuration for this driver');
  }

  if (configStatus.hasActiveSalary && !linkedToDriver) {
    overallStatus = 'warning';
    recommendations.push('Link the active salary configuration to the driver profile');
  }

  if (!validationStatus.valid) {
    overallStatus = 'critical';
    recommendations.push(`Fix configuration errors: ${validationStatus.errors.join(', ')}`);
  }

  if (configStatus.hasActiveSalary && driverHasActiveSalaryMasterId !== linkedToDriver) {
    overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
    recommendations.push('Resolve mismatch between driver profile and salary configuration');
  }

  return {
    driverId: driverObjId.toString(),
    driverName: driver?.name,
    overallStatus,
    configurationStatus: {
      hasActiveSalary: configStatus.hasActiveSalary,
      activeConfigId: configStatus.activeConfig?._id?.toString(),
      configStatus: configStatus.configurationStatus,
      lastModified: configStatus.lastModified
    },
    validationStatus: {
      isComplete: validationStatus.valid,
      errors: validationStatus.errors
    },
    linkingStatus: {
      linkedToDriver,
      driverHasActiveSalaryMasterId,
      mismatch: linkedToDriver !== driverHasActiveSalaryMasterId
    },
    history: {
      totalConfigurations: allConfigs.length,
      recentChanges
    },
    recommendations
  };
}

/**
 * Validate all drivers in a tenant for salary configuration issues
 * Returns a summary of configuration health across the tenant
 */
export async function validateTenantSalaryConfigurations(
  tenantId: string | mongoose.Types.ObjectId
): Promise<{
  tenantId: string;
  totalDrivers: number;
  driversSummary: {
    withActiveSalary: number;
    properlyLinked: number;
    withIssues: number;
  };
  criticalIssues: Array<{
    driverId: string;
    driverName?: string;
    issue: string;
  }>;
  warnings: Array<{
    driverId: string;
    driverName?: string;
    warning: string;
  }>;
}> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // Get all active drivers
  const drivers = await Driver.find({
    tenantId: tenantObjId,
    status: { $ne: 'inactive' }
  }).exec();

  const criticalIssues: Array<{ driverId: string; driverName?: string; issue: string }> = [];
  const warnings: Array<{ driverId: string; driverName?: string; warning: string }> = [];

  let withActiveSalary = 0;
  let properlyLinked = 0;

  for (const driver of drivers) {
    const healthReport = await getSalaryConfigurationHealthReport(driver._id, tenantObjId);

    if (healthReport.configurationStatus.hasActiveSalary) {
      withActiveSalary++;
    }

    if (healthReport.linkingStatus.linkedToDriver) {
      properlyLinked++;
    }

    if (healthReport.overallStatus === 'critical') {
      for (const recommendation of healthReport.recommendations) {
        criticalIssues.push({
          driverId: driver._id.toString(),
          driverName: driver.name,
          issue: recommendation
        });
      }
    }

    if (healthReport.overallStatus === 'warning') {
      for (const recommendation of healthReport.recommendations) {
        warnings.push({
          driverId: driver._id.toString(),
          driverName: driver.name,
          warning: recommendation
        });
      }
    }
  }

  return {
    tenantId: tenantObjId.toString(),
    totalDrivers: drivers.length,
    driversSummary: {
      withActiveSalary,
      properlyLinked,
      withIssues: criticalIssues.length + warnings.length
    },
    criticalIssues,
    warnings
  };
}

/**
 * Create salary configuration for a driver
 * Initializes a new active salary master with defaults
 */
export async function createDriverSalaryConfiguration(
  driverId: string | mongoose.Types.ObjectId,
  tenantId: string | mongoose.Types.ObjectId,
  config: Partial<IDriverSalaryMaster>,
  createdBy: { userId: string; role: string }
): Promise<IDriverSalaryMaster> {
  try {
    const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;
    const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    // Get driver info for default values
    const driver = await Driver.findById(driverObjId).exec();
    if (!driver) {
      throw new Error('Driver not found');
    }

    // Deactivate any existing salary masters
    await DriverSalaryMaster.updateMany(
      { driverId: driverObjId, tenantId: tenantObjId, status: 'active' },
      { status: 'inactive' }
    ).exec();

    // Create new salary master
    const salaryConfig = new DriverSalaryMaster({
      tenantId: tenantObjId,
      driverId: driverObjId,
      name: driver.name,
      mobile: driver.phone,
      status: 'active',
      salaryStartDate: new Date(),
      ...config
    });

    const saved = await salaryConfig.save();

    // Link to driver profile
    await linkActiveSalaryMasterToDriver(driverObjId, saved._id, tenantObjId, createdBy);

    return saved;
  } catch (error) {
    console.error('Error creating salary configuration:', error);
    throw error;
  }
}

/**
 * Update active salary configuration for a driver
 * Creates a new configuration rather than modifying existing one
 */
export async function updateDriverSalaryConfiguration(
  driverId: string | mongoose.Types.ObjectId,
  tenantId: string | mongoose.Types.ObjectId,
  updates: Partial<IDriverSalaryMaster>,
  updatedBy: { userId: string; role: string }
): Promise<IDriverSalaryMaster> {
  try {
    const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;
    const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    // Get current active config
    const currentConfig = await getActiveSalaryConfig(driverObjId, tenantObjId);
    if (!currentConfig) {
      throw new Error('No active salary configuration found');
    }

    // Deactivate current
    currentConfig.status = 'inactive';
    await currentConfig.save();

    // Create new configuration with updates
    const newConfig = new DriverSalaryMaster({
      ...currentConfig.toObject(),
      _id: new mongoose.Types.ObjectId(),
      ...updates,
      status: 'active',
      updatedAt: new Date()
    });

    const saved = await newConfig.save();

    // Link to driver
    await linkActiveSalaryMasterToDriver(driverObjId, saved._id, tenantObjId, updatedBy);

    return saved;
  } catch (error) {
    console.error('Error updating salary configuration:', error);
    throw error;
  }
}

/**
 * Deactivate salary configuration for a driver
 * Removes active status, useful when driver leaves or payroll pauses
 */
export async function deactivateDriverSalaryConfiguration(
  driverId: string | mongoose.Types.ObjectId,
  tenantId: string | mongoose.Types.ObjectId,
  deactivatedBy: { userId: string; role: string }
): Promise<IDriverSalaryMaster | null> {
  try {
    const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;
    const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    // Get active config
    const activeConfig = await getActiveSalaryConfig(driverObjId, tenantObjId);
    if (!activeConfig) {
      return null;
    }

    // Deactivate
    activeConfig.status = 'inactive';
    const saved = await activeConfig.save();

    // Unlink from driver
    await unlinkSalaryMasterFromDriver(driverObjId, deactivatedBy);

    return saved;
  } catch (error) {
    console.error('Error deactivating salary configuration:', error);
    throw error;
  }
}

/**
 * Export driver salary configuration as audit data
 * Includes full history for compliance and reporting
 */
export async function exportDriverSalaryConfigurationHistory(
  driverId: string | mongoose.Types.ObjectId,
  tenantId: string | mongoose.Types.ObjectId
): Promise<{
  driverId: string;
  driverName?: string;
  configurations: Array<{
    configId: string;
    status: string;
    baseSalary: number;
    salaryType: string;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  exportedAt: Date;
}> {
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  const driver = await Driver.findById(driverObjId).exec();
  const allConfigs = await getAllSalaryConfigsForDriver(driverObjId, tenantObjId);

  return {
    driverId: driverObjId.toString(),
    driverName: driver?.name,
    configurations: allConfigs.map((c) => ({
      configId: c._id?.toString() || '',
      status: c.status,
      baseSalary: c.baseSalary,
      salaryType: c.salaryType,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    })),
    exportedAt: new Date()
  };
}
