/**
 * PHASE 4: Entitlement Service
 * Central decision point for "can this tenant do this action?"
 * All limit checks route through this service (not scattered in routes)
 */

import { storage } from '../storage-mongodb';

interface UsageCheck {
  current: number;
  max: number;
  exceeded: boolean;
  remaining: number;
}

export class EntitlementService {
  /**
   * Can tenant add a new vehicle?
   */
  static async canAddVehicle(tenantId: string): Promise<boolean> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return false;

    const plan = subscription.planId as any;
    if (!plan || !plan.limits) return false;

    const vehicles = await storage.getVehiclesByTenant(tenantId);
    return vehicles.length < plan.limits.vehicles;
  }

  /**
   * Can tenant add a new driver?
   */
  static async canAddDriver(tenantId: string): Promise<boolean> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return false;

    const plan = subscription.planId as any;
    if (!plan || !plan.limits) return false;

    const drivers = await storage.getDriversByTenant(tenantId);
    return drivers.length < plan.limits.drivers;
  }

  /**
   * Can tenant add a new user?
   */
  static async canAddUser(tenantId: string): Promise<boolean> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return false;

    const plan = subscription.planId as any;
    if (!plan || !plan.limits) return false;

    const users = await storage.getUsersByTenant(tenantId);
    return users.length < plan.limits.users;
  }

  /**
   * Does tenant have feature enabled?
   */
  static async hasFeature(tenantId: string, featureName: string): Promise<boolean> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return false;

    const plan = subscription.planId as any;
    if (!plan || !plan.features) return false;

    return plan.features.includes(featureName);
  }

  /**
   * Get usage for vehicle limit
   */
  static async getVehicleUsage(tenantId: string): Promise<UsageCheck> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return { current: 0, max: 0, exceeded: true, remaining: 0 };

    const plan = subscription.planId as any;
    const max = plan?.limits?.vehicles || 0;
    const vehicles = await storage.getVehiclesByTenant(tenantId);
    const current = vehicles.length;

    return {
      current,
      max,
      exceeded: current >= max,
      remaining: Math.max(0, max - current),
    };
  }

  /**
   * Get usage for driver limit
   */
  static async getDriverUsage(tenantId: string): Promise<UsageCheck> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return { current: 0, max: 0, exceeded: true, remaining: 0 };

    const plan = subscription.planId as any;
    const max = plan?.limits?.drivers || 0;
    const drivers = await storage.getDriversByTenant(tenantId);
    const current = drivers.length;

    return {
      current,
      max,
      exceeded: current >= max,
      remaining: Math.max(0, max - current),
    };
  }

  /**
   * Get usage for user limit
   */
  static async getUserUsage(tenantId: string): Promise<UsageCheck> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) return { current: 0, max: 0, exceeded: true, remaining: 0 };

    const plan = subscription.planId as any;
    const max = plan?.limits?.users || 0;
    const users = await storage.getUsersByTenant(tenantId);
    const current = users.length;

    return {
      current,
      max,
      exceeded: current >= max,
      remaining: Math.max(0, max - current),
    };
  }

  /**
   * Get subscription status
   */
  static async getSubscriptionStatus(tenantId: string): Promise<{
    active: boolean;
    status: string;
    planName: string;
  }> {
    const subscription = await storage.getSubscriptionByTenant(tenantId);
    if (!subscription) {
      return { active: false, status: 'NONE', planName: '' };
    }

    const plan = subscription.planId as any;
    return {
      active: ['ACTIVE', 'TRIAL'].includes(subscription.status),
      status: subscription.status,
      planName: plan?.name || 'Unknown',
    };
  }
}
