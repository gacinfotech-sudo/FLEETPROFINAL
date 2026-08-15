/**
 * SAAS ADMIN MANAGEMENT ROUTES
 * APIs for managing tenants, subscriptions, billing, and analytics
 *
 * P1 SECURITY FIX: All routes now require PLATFORM_ADMIN or PLATFORM_SUPER_ADMIN role
 * Previous: Only checked tenant-scoped 'admin' role (allowed any authenticated tenant admin)
 * Now: Requires platform-level authentication (cross-tenant access control)
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';
import SaaSDataSyncService from '../services/saas-data-sync-service';
import { rootAccessService } from '../root/services/rootAccessService';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Middleware: Require platform admin role (PLATFORM_ADMIN or PLATFORM_SUPER_ADMIN)
const requirePlatformAdmin = rootAccessService.requirePlatformRole(['PLATFORM_ADMIN', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ROOT']);

// Legacy fallback: Verify tenant-scoped admin access (kept for backward compatibility)
const adminOnly = (req: any, res: Response, next: Function) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ============ DASHBOARD ENDPOINTS ============

/**
 * GET /api/saas/admin/dashboard/summary
 * Get overall SaaS platform summary
 * SECURITY: Requires PLATFORM_ADMIN+ role
 */
router.get('/admin/dashboard/summary', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const summary = await SaaSDataSyncService.getDashboardSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============ TENANT MANAGEMENT ============

/**
 * GET /api/saas/admin/tenants
 * List all tenants with metrics
 */
router.get('/admin/tenants', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const tenants = await db
      .collection('tenants')
      .find({})
      .project({
        name: 1,
        businessName: 1,
        subscriptionPlan: 1,
        isActive: 1,
        createdAt: 1,
        monthlyRevenue: 1,
        activeUsers: 1,
        bookingsThisMonth: 1,
        maxManagers: 1
      })
      .toArray();

    res.json({ tenants, total: tenants.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/saas/admin/tenants/:id
 * Get tenant details
 */
router.get('/admin/tenants/:id', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const tenant = await db.collection('tenants').findOne({
      _id: new mongoose.Types.ObjectId(req.params.id)
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    res.json({ tenant });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/saas/admin/tenants/:id
 * Update tenant (lock/unlock, change plan, etc)
 */
router.put('/admin/tenants/:id', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();
    const { isActive, subscriptionPlan, monthlyRevenue } = req.body;

    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (subscriptionPlan) updateData.subscriptionPlan = subscriptionPlan;
    if (monthlyRevenue !== undefined) updateData.monthlyRevenue = monthlyRevenue;

    const result = await db.collection('tenants').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    res.json({ success: true, tenant: result.value });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============ SUBSCRIPTION MANAGEMENT ============

/**
 * GET /api/saas/admin/subscription-plans
 * Get all subscription plans
 */
router.get('/admin/subscription-plans', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const plans = await db
      .collection('subscription_plans')
      .find({})
      .toArray();

    res.json({ plans });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/saas/admin/subscription-plans
 * Create new subscription plan
 */
router.post('/admin/subscription-plans', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();
    const { name, price, features, billingCycle } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price required' });
    }

    const plan = {
      planId: `PLAN-${Date.now()}`,
      name,
      price,
      currency: 'INR',
      features: features || [],
      billingCycle: billingCycle || 'monthly',
      createdAt: new Date()
    };

    const result = await db.collection('subscription_plans').insertOne(plan);

    res.json({ success: true, planId: result.insertedId });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============ BILLING MANAGEMENT ============

/**
 * GET /api/saas/admin/billing
 * Get billing records and revenue
 */
router.get('/admin/billing', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const billingRecords = await db
      .collection('bookingPayments')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const totalRevenue = billingRecords.reduce(
      (sum, b) => sum + (b.amount || 0),
      0
    );

    const revenueByMonth = new Map();
    for (const record of billingRecords) {
      const date = new Date(record.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth.set(
        monthKey,
        (revenueByMonth.get(monthKey) || 0) + (record.amount || 0)
      );
    }

    res.json({
      records: billingRecords,
      totalRevenue,
      revenueByMonth: Object.fromEntries(revenueByMonth)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/saas/admin/billing/tenant/:tenantId
 * Get billing records for specific tenant
 */
router.get('/admin/billing/tenant/:tenantId', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const records = await db
      .collection('bookingPayments')
      .find({ tenantId: new mongoose.Types.ObjectId(req.params.tenantId) })
      .sort({ createdAt: -1 })
      .toArray();

    const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);

    res.json({ records, totalAmount });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============ SUPPORT TICKETS ============

/**
 * GET /api/saas/admin/support-tickets
 * Get all support tickets
 */
router.get('/admin/support-tickets', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const tickets = await db
      .collection('support_tickets')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const openTickets = tickets.filter(t => t.status === 'open').length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;

    res.json({ tickets, openTickets, resolvedTickets, total: tickets.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/saas/admin/support-tickets/:id
 * Update ticket status
 */
router.put('/admin/support-tickets/:id', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();
    const { status, resolution } = req.body;

    const result = await db.collection('support_tickets').findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      {
        $set: {
          status,
          resolution,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    res.json({ success: true, ticket: result.value });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ============ ANALYTICS & SYNC ============

/**
 * POST /api/saas/admin/sync
 * Trigger full data sync
 */
router.post('/admin/sync', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const result = await SaaSDataSyncService.fullSync();
    res.json({ success: true, syncResult: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/saas/admin/metrics/revenue
 * Get revenue metrics
 */
router.get('/admin/metrics/revenue', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const payments = await db
      .collection('bookingPayments')
      .find({})
      .toArray();

    const revenueByDay = new Map();
    for (const payment of payments) {
      const date = new Date(payment.createdAt);
      const dayKey = date.toISOString().split('T')[0];
      revenueByDay.set(
        dayKey,
        (revenueByDay.get(dayKey) || 0) + (payment.amount || 0)
      );
    }

    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const avgPerTransaction =
      payments.length > 0 ? totalRevenue / payments.length : 0;

    res.json({
      totalRevenue,
      transactionCount: payments.length,
      averagePerTransaction: Math.round(avgPerTransaction),
      revenueByDay: Object.fromEntries(revenueByDay)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/saas/admin/metrics/tenants
 * Get tenant metrics
 */
router.get('/admin/metrics/tenants', authenticateUser, requirePlatformAdmin, async (req: any, res) => {
  try {
    const db = await storage.getDb();

    const tenants = await db.collection('tenants').find({}).toArray();

    const activeTenants = tenants.filter(t => t.isActive).length;
    const inactiveTenants = tenants.length - activeTenants;
    const totalBookings = tenants.reduce(
      (sum, t) => sum + (t.bookingsThisMonth || 0),
      0
    );
    const totalUsers = tenants.reduce(
      (sum, t) => sum + (t.activeUsers || 0),
      0
    );

    const planDistribution = new Map();
    for (const tenant of tenants) {
      const plan = tenant.subscriptionPlan || 'unknown';
      planDistribution.set(
        plan,
        (planDistribution.get(plan) || 0) + 1
      );
    }

    res.json({
      totalTenants: tenants.length,
      activeTenants,
      inactiveTenants,
      totalBookings,
      totalUsers,
      averageUsersPerTenant: Math.round(totalUsers / tenants.length),
      planDistribution: Object.fromEntries(planDistribution)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
