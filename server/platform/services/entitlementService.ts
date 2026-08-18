// STEP 9: Entitlement Service
// Feature gating + usage tracking

import mongoose from 'mongoose';
import { Subscription } from '../models/Subscription';
import { Customer, Driver, Vehicle, User } from '../../models';

export class EntitlementService {
  async canUseFeature(tenantId: string | mongoose.Types.ObjectId, feature: string): Promise<boolean> {
    const sub = await Subscription.findOne({
      tenantId,
      status: { $in: ['trial', 'active'] }
    }).populate('planId');

    if (!sub) return false;

    const plan = sub.planId as any;
    const entitlements = plan.features || {};

    // Check specific features
    const featureMap = {
      'custom_branding': entitlements.customBranding,
      'api_access': entitlements.apiAccess,
      'mobile_app': entitlements.mobileApp,
      'gps_tracking': entitlements.gpsTracking
    };

    return !!featureMap[feature] || false;
  }

  async getLimit(tenantId: string | mongoose.Types.ObjectId, resource: string): Promise<number> {
    const sub = await Subscription.findOne({
      tenantId,
      status: { $in: ['trial', 'active'] }
    }).populate('planId');

    if (!sub) throw new Error('No active subscription');

    const plan = sub.planId as any;
    const overrides = sub.features || {};

    // Use override or plan default
    const limitMap = {
      'users': overrides.userLimit || plan.userLimit || 5,
      'drivers': overrides.driverLimit || plan.driverLimit || 50,
      'vehicles': overrides.vehicleLimit || plan.vehicleLimit || 100,
      'branches': plan.branchLimit || 1
    };

    return limitMap[resource] || 0;
  }

  async canCreate(tenantId: string | mongoose.Types.ObjectId, resource: string): Promise<boolean> {
    const usage = await this.getUsage(tenantId, resource);
    const limit = await this.getLimit(tenantId, resource);
    return usage < limit;
  }

  async getUsage(tenantId: string | mongoose.Types.ObjectId, resource: string): Promise<number> {
    // Query canonical Tenant data (read-only)
    const modelMap = {
      'users': () => User.countDocuments({ tenantId, role: { $in: ['admin', 'manager', 'client'] } }),
      'drivers': () => Driver.countDocuments({ tenantId }),
      'vehicles': () => Vehicle.countDocuments({ tenantId }),
      'customers': () => Customer.countDocuments({ tenantId })
    };

    const countFn = modelMap[resource];
    if (!countFn) return 0;

    return await countFn();
  }
}

export const entitlementService = new EntitlementService();
