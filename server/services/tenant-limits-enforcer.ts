/**
 * TENANT LIMITS ENFORCER
 * Enforces subscription limits on tenants
 * Prevents exceeding resource quotas (admins, managers, vehicles, drivers)
 */

import mongoose from 'mongoose';

export interface TenantLimitsStatus {
  tenantId: string;
  limits: {
    admins: { current: number; max: number; exceeded: boolean };
    managers: { current: number; max: number; exceeded: boolean };
    vehicles: { current: number; max: number; exceeded: boolean };
    drivers: { current: number; max: number; exceeded: boolean };
  };
  canAddAdmin: boolean;
  canAddManager: boolean;
  canAddVehicle: boolean;
  canAddDriver: boolean;
  overallStatus: 'ok' | 'warning' | 'critical';
}

export class TenantLimitsEnforcer {
  /**
   * Get current usage for a tenant
   */
  static async getUsage(tenantId: string): Promise<{
    admins: number;
    managers: number;
    vehicles: number;
    drivers: number;
  }> {
    try {
      const User = mongoose.model('User');
      const Vehicle = mongoose.model('Vehicle');
      const Driver = mongoose.model('Driver');

      const [adminCount, managerCount, vehicleCount, driverCount] = await Promise.all([
        User.countDocuments({ tenantId, role: 'admin' }),
        User.countDocuments({ tenantId, role: 'manager' }),
        Vehicle.countDocuments({ tenantId }),
        Driver.countDocuments({ tenantId })
      ]);

      return {
        admins: adminCount,
        managers: managerCount,
        vehicles: vehicleCount,
        drivers: driverCount
      };
    } catch (error: any) {
      console.error('Error getting tenant usage:', error);
      return { admins: 0, managers: 0, vehicles: 0, drivers: 0 };
    }
  }

  /**
   * Get tenant limits - Always read fresh from database
   */
  static async getTenantLimits(tenantId: string): Promise<any> {
    try {
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database not initialized');

      // Read directly from database collection (fresh, not cached)
      const tenant = await db.collection('tenants').findOne({
        _id: mongoose.Types.ObjectId.isValid(tenantId)
          ? new mongoose.Types.ObjectId(tenantId)
          : { $eq: null }
      });

      if (!tenant) {
        console.warn(`⚠️ Tenant not found: ${tenantId}, using defaults`);
        return {
          admins: 5,
          managers: 10,
          vehicles: 50,
          drivers: 100
        };
      }

      // If limits are not set, use defaults
      const limits = tenant.limits || {};

      return {
        admins: limits.admins || 5,
        managers: limits.managers || tenant.maxManagers || 10,
        vehicles: limits.vehicles || 50,
        drivers: limits.drivers || 100
      };
    } catch (error: any) {
      console.error('Error getting tenant limits:', error);
      return {
        admins: 5,
        managers: 10,
        vehicles: 50,
        drivers: 100
      };
    }
  }

  /**
   * Get complete tenant limits status
   */
  static async checkLimitsStatus(tenantId: string): Promise<TenantLimitsStatus> {
    try {
      const usage = await this.getUsage(tenantId);
      const limits = await this.getTenantLimits(tenantId);

      const adminExceeded = usage.admins >= limits.admins;
      const managerExceeded = usage.managers >= limits.managers;
      const vehicleExceeded = usage.vehicles >= limits.vehicles;
      const driverExceeded = usage.drivers >= limits.drivers;

      const status: TenantLimitsStatus = {
        tenantId,
        limits: {
          admins: {
            current: usage.admins,
            max: limits.admins,
            exceeded: adminExceeded
          },
          managers: {
            current: usage.managers,
            max: limits.managers,
            exceeded: managerExceeded
          },
          vehicles: {
            current: usage.vehicles,
            max: limits.vehicles,
            exceeded: vehicleExceeded
          },
          drivers: {
            current: usage.drivers,
            max: limits.drivers,
            exceeded: driverExceeded
          }
        },
        canAddAdmin: !adminExceeded,
        canAddManager: !managerExceeded,
        canAddVehicle: !vehicleExceeded,
        canAddDriver: !driverExceeded,
        overallStatus: adminExceeded || managerExceeded || vehicleExceeded || driverExceeded ? 'critical' : 'ok'
      };

      return status;
    } catch (error: any) {
      console.error('Error checking limits status:', error);
      throw error;
    }
  }

  /**
   * Check if admin can be added
   */
  static async canAddAdmin(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const status = await this.checkLimitsStatus(tenantId);

      if (status.limits.admins.exceeded) {
        return {
          allowed: false,
          reason: `❌ Admin limit reached (${status.limits.admins.current}/${status.limits.admins.max})`
        };
      }

      return { allowed: true };
    } catch (error: any) {
      return { allowed: false, reason: 'Error checking admin limit' };
    }
  }

  /**
   * Check if manager can be added
   */
  static async canAddManager(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const status = await this.checkLimitsStatus(tenantId);

      if (status.limits.managers.exceeded) {
        return {
          allowed: false,
          reason: `❌ Manager limit reached (${status.limits.managers.current}/${status.limits.managers.max})`
        };
      }

      return { allowed: true };
    } catch (error: any) {
      return { allowed: false, reason: 'Error checking manager limit' };
    }
  }

  /**
   * Check if vehicle can be added
   */
  static async canAddVehicle(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const status = await this.checkLimitsStatus(tenantId);

      if (status.limits.vehicles.exceeded) {
        return {
          allowed: false,
          reason: `❌ Vehicle limit reached (${status.limits.vehicles.current}/${status.limits.vehicles.max})`
        };
      }

      return { allowed: true };
    } catch (error: any) {
      return { allowed: false, reason: 'Error checking vehicle limit' };
    }
  }

  /**
   * Check if driver can be added
   */
  static async canAddDriver(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const status = await this.checkLimitsStatus(tenantId);

      if (status.limits.drivers.exceeded) {
        return {
          allowed: false,
          reason: `❌ Driver limit reached (${status.limits.drivers.current}/${status.limits.drivers.max})`
        };
      }

      return { allowed: true };
    } catch (error: any) {
      return { allowed: false, reason: 'Error checking driver limit' };
    }
  }

  /**
   * Enforce limit when creating resource
   */
  static async enforceLimit(
    tenantId: string,
    resourceType: 'admin' | 'manager' | 'vehicle' | 'driver'
  ): Promise<{ allowed: boolean; message: string }> {
    try {
      switch (resourceType) {
        case 'admin': {
          const result = await this.canAddAdmin(tenantId);
          return {
            allowed: result.allowed,
            message: result.reason || '✅ Admin can be added'
          };
        }
        case 'manager': {
          const result = await this.canAddManager(tenantId);
          return {
            allowed: result.allowed,
            message: result.reason || '✅ Manager can be added'
          };
        }
        case 'vehicle': {
          const result = await this.canAddVehicle(tenantId);
          return {
            allowed: result.allowed,
            message: result.reason || '✅ Vehicle can be added'
          };
        }
        case 'driver': {
          const result = await this.canAddDriver(tenantId);
          return {
            allowed: result.allowed,
            message: result.reason || '✅ Driver can be added'
          };
        }
        default:
          return { allowed: false, message: 'Unknown resource type' };
      }
    } catch (error: any) {
      return { allowed: false, message: 'Error enforcing limit' };
    }
  }

  /**
   * Get upgrade recommendation
   */
  static async getUpgradeRecommendation(tenantId: string): Promise<{
    needsUpgrade: boolean;
    reason?: string;
    recommendedPlan?: string;
  }> {
    try {
      const status = await this.checkLimitsStatus(tenantId);

      const exceededCount = Object.values(status.limits).filter(l => l.exceeded).length;

      if (exceededCount === 0) {
        return { needsUpgrade: false };
      }

      let plan = 'pro';
      if (exceededCount >= 3) {
        plan = 'enterprise';
      }

      return {
        needsUpgrade: true,
        reason: `${exceededCount} resource limits exceeded`,
        recommendedPlan: plan
      };
    } catch (error: any) {
      return { needsUpgrade: false };
    }
  }

  /**
   * Log limit enforcement for audit
   */
  static async logLimitEnforcement(
    tenantId: string,
    action: string,
    resourceType: string,
    allowed: boolean,
    reason?: string
  ): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      await db.collection('limit_enforcement_logs').insertOne({
        tenantId,
        action,
        resourceType,
        allowed,
        reason,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('Error logging limit enforcement:', error);
    }
  }

  /**
   * Get limit enforcement logs
   */
  static async getLimitEnforcementLogs(
    tenantId: string,
    limit = 50
  ): Promise<any[]> {
    try {
      const db = mongoose.connection.db;
      if (!db) return [];

      return await db
        .collection('limit_enforcement_logs')
        .find({ tenantId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    } catch (error: any) {
      console.error('Error getting enforcement logs:', error);
      return [];
    }
  }
}

export default TenantLimitsEnforcer;
