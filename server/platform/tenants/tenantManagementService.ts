// STEPS 12-14: Tenant Management Service
// List, Detail, Create tenants

import mongoose from 'mongoose';
import { Tenant, User, Customer, Driver, Vehicle, Booking } from '../../models';
import { Subscription } from '../models/Subscription';

export class TenantManagementService {
  // STEP 12: List tenants (paginated)
  async listTenants(page: number = 1, limit: number = 20, filters: any = {}) {
    try {
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};
      if (filters.status) {
        query.isActive = filters.status === 'active';
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { businessName: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const total = await Tenant.countDocuments(query);
      const tenants = await Tenant.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      // Enrich with subscription status
      const enriched = await Promise.all(
        tenants.map(async (tenant) => {
          const sub = await Subscription.findOne({ tenantId: tenant._id });
          return {
            ...tenant.toObject(),
            subscriptionStatus: sub?.status || 'none'
          };
        })
      );

      return {
        tenants: enriched,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('List tenants failed:', error);
      throw error;
    }
  }

  // STEP 13: Get tenant 360 detail
  async getTenant360(tenantId: string | mongoose.Types.ObjectId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) throw new Error('Tenant not found');

      const owner = await User.findOne({ tenantId, role: 'admin' });
      const subscription = await Subscription.findOne({ tenantId }).populate('planId');

      // Query Tenant operational metrics (read-only)
      const [activeCustomers, totalBookings, activeDrivers, fleetSize] = await Promise.all([
        Customer.countDocuments({ tenantId }),
        Booking.countDocuments({ tenantId }),
        Driver.countDocuments({ tenantId, status: 'available' }),
        Vehicle.countDocuments({ tenantId })
      ]);

      return {
        tenant,
        owner: owner ? { userId: owner.userId, name: owner.name, email: owner.email } : null,
        subscription,
        stats: {
          activeCustomers,
          totalBookings,
          activeDrivers,
          fleetSize
        }
      };
    } catch (error) {
      console.error('Get tenant 360 failed:', error);
      throw error;
    }
  }

  // STEP 14: Update tenant
  async updateTenant(tenantId: string | mongoose.Types.ObjectId, updates: any) {
    try {
      const updated = await Tenant.findByIdAndUpdate(
        tenantId,
        updates,
        { new: true }
      );

      if (!updated) throw new Error('Tenant not found');
      return updated;
    } catch (error) {
      console.error('Update tenant failed:', error);
      throw error;
    }
  }

  // Lock tenant (soft suspension)
  async lockTenant(tenantId: string | mongoose.Types.ObjectId, reason: string) {
    try {
      const updated = await Subscription.findOneAndUpdate(
        { tenantId },
        {
          status: 'locked',
          lockedReason: reason,
          modifiedAt: new Date()
        },
        { new: true }
      );

      if (!updated) throw new Error('Subscription not found');
      return updated;
    } catch (error) {
      console.error('Lock tenant failed:', error);
      throw error;
    }
  }

  // Unlock tenant
  async unlockTenant(tenantId: string | mongoose.Types.ObjectId) {
    try {
      const updated = await Subscription.findOneAndUpdate(
        { tenantId },
        {
          status: 'active',
          lockedReason: null,
          modifiedAt: new Date()
        },
        { new: true }
      );

      if (!updated) throw new Error('Subscription not found');
      return updated;
    } catch (error) {
      console.error('Unlock tenant failed:', error);
      throw error;
    }
  }
}

export const tenantManagementService = new TenantManagementService();
