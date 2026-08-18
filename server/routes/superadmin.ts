/**
 * PHASE 1: Super Admin Portal Routes
 * Endpoints for PLATFORM_ROOT and PLATFORM_SUPER_ADMIN users only
 * Provides access to platform-level management and SaaS metrics
 */

import { Router, Response } from 'express';
import { authenticateUser, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage-mongodb';
import type { PlatformRole } from '../root/types';
import { isPlatformRole } from '../root/types';

const router = Router();

/**
 * Middleware: Require platform role
 * Only users with a platformRole can access super admin endpoints
 */
function requirePlatformRole(allowedRoles: PlatformRole[]) {
  return (req: AuthRequest, res: Response, next: Function) => {
    if (!req.user?.platformRole || !isPlatformRole(req.user.platformRole)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Platform role required',
      });
    }

    if (!allowedRoles.includes(req.user.platformRole)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Requires one of ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

// ============================================================================
// SUPER ADMIN DASHBOARD
// ============================================================================

/**
 * GET /api/superadmin/dashboard
 * Returns SaaS metrics: tenant count, MRR, renewal stats, ticket summary
 */
router.get(
  '/dashboard',
  authenticateUser,
  requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenants = await storage.getTenants();
      const subscriptions = await storage.listSubscriptions({ status: 'ACTIVE' });
      const invoices = await storage.listInvoices();

      // Calculate tenant metrics
      const totalTenants = tenants.length;
      const activeTenants = tenants.filter(t => t.isActive).length;
      const trialTenants = tenants.filter(t => t.trialEndsAt && t.trialEndsAt > new Date()).length;
      const inactiveTenants = tenants.filter(t => !t.isActive).length;

      // Group by subscription plan
      const byPlan: any = {};
      for (const sub of subscriptions) {
        const plan = (sub.planId as any);
        const planCode = plan?.code || 'unknown';
        byPlan[planCode] = (byPlan[planCode] || 0) + 1;
      }

      // FIXED P2-002: Calculate MRR and renewal metrics correctly
      let totalMRR = 0;
      let renewalsThisMonth = 0;
      let renewalsNextMonth = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthEnd = new Date(today);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0); // Last day of current month

      const nextMonthEnd = new Date(monthEnd);
      nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 1);

      for (const sub of subscriptions) {
        const plan = (sub.planId as any);
        if (plan?.pricing) {
          if (sub.billingCycle === 'monthly' && plan.pricing.monthly) {
            totalMRR += plan.pricing.monthly;
          } else if (sub.billingCycle === 'annual' && plan.pricing.annual) {
            totalMRR += Math.floor(plan.pricing.annual / 12);
          }
        }

        if (sub.renewalDate >= today && sub.renewalDate <= monthEnd) {
          renewalsThisMonth++;
        } else if (sub.renewalDate > monthEnd && sub.renewalDate <= nextMonthEnd) {
          renewalsNextMonth++;
        }
      }

      // Calculate outstanding payments
      let paymentsPending = 0;
      let overdueTenants = 0;

      for (const invoice of invoices) {
        if (invoice.balanceDue && invoice.balanceDue > 0) {
          paymentsPending++;

          // Check if overdue (> 30 days)
          const dueDate = new Date(invoice.invoiceDate);
          dueDate.setDate(dueDate.getDate() + 30);
          if (dueDate < today) {
            overdueTenants++;
          }
        }
      }

      res.json({
        success: true,
        data: {
          tenants: {
            total: totalTenants,
            active: activeTenants,
            trial: trialTenants,
            inactive: inactiveTenants,
          },
          byPlan,
          // FIXED P2-002: Real billing metrics from subscriptions and invoices
          metrics: {
            mrrEstimate: totalMRR,
            renewalsThisMonth,
            renewalsNextMonth,
            paymentsPending,
            overdueTenants,
          },
          // TODO: Implement when support ticket model is ready
          support: {
            openTickets: 0,
            highPriority: 0,
            slaOverdue: 0,
          },
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error fetching dashboard metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard metrics',
      });
    }
  }
);

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================

/**
 * GET /api/superadmin/tenants
 * List all tenants with summary info
 */
router.get(
  '/tenants',
  authenticateUser,
  requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenants = await storage.getTenants();

      const tenantList = tenants.map(tenant => ({
        id: tenant._id,
        name: tenant.name,
        businessName: tenant.businessName,
        email: tenant.email,
        phone: tenant.phone,
        subscriptionPlan: tenant.subscriptionPlan,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        // TODO: Add when subscription model ready
        subscription: {
          renewalDate: null,
          status: 'ACTIVE',
        },
        limits: tenant.limits,
      }));

      res.json({
        success: true,
        data: {
          count: tenantList.length,
          tenants: tenantList,
        },
      });
    } catch (error: any) {
      console.error('Error fetching tenants:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tenants',
      });
    }
  }
);

/**
 * GET /api/superadmin/tenants/:tenantId/360
 * Tenant 360 view: comprehensive tenant overview
 */
router.get(
  '/tenants/:tenantId/360',
  authenticateUser,
  requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: 'Tenant not found',
        });
      }

      // Get tenant's users, vehicles, drivers, bookings
      const users = await storage.getUsersByTenant(tenantId);
      const vehicles = await storage.getVehiclesByTenant(tenantId);
      const drivers = await storage.getDriversByTenant(tenantId);
      const bookings = await storage.getBookingsByTenant(tenantId);

      res.json({
        success: true,
        data: {
          tenant: {
            id: tenant._id,
            name: tenant.name,
            businessName: tenant.businessName,
            email: tenant.email,
            phone: tenant.phone,
            address: tenant.address,
            isActive: tenant.isActive,
            createdAt: tenant.createdAt,
          },
          subscription: {
            plan: tenant.subscriptionPlan,
            limits: tenant.limits,
            status: 'ACTIVE', // TODO: Get from subscription model
          },
          usage: {
            users: users.length,
            vehicles: vehicles.length,
            drivers: drivers.length,
            bookings: bookings.length,
            storage: '0 GB', // TODO: Implement storage calculation
          },
          // TODO: Add when billing model ready
          billing: {
            invoices: [],
            payments: [],
            outstandingAmount: 0,
          },
          // TODO: Add when support ticket model ready
          support: {
            openTickets: 0,
            resolvedTickets: 0,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching tenant 360:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tenant details',
      });
    }
  }
);

// ============================================================================
// PLATFORM COMPANY PROFILE (SaaS Platform Info)
// ============================================================================

/**
 * GET /api/superadmin/company-profile
 * Get FleetPro SaaS company profile
 */
router.get(
  '/company-profile',
  authenticateUser,
  requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const company = await storage.getPlatformCompany();

      if (!company) {
        return res.json({
          success: true,
          data: {
            company: null,
            message: 'Platform company profile not configured',
          },
        });
      }

      res.json({
        success: true,
        data: {
          company: {
            name: company.name,
            email: company.email,
            phone: company.phone,
            whatsapp: company.whatsapp,
            address: company.address,
            city: company.city,
            state: company.state,
            country: company.country,
            pincode: company.pincode,
            gst: company.gst,
            pan: company.pan,
            bankName: company.bankName,
            upiId: company.upiId,
            supportEmail: company.supportEmail,
            supportPhone: company.supportPhone,
            supportWhatsapp: company.supportWhatsapp,
            termsOfServiceUrl: company.termsOfServiceUrl,
            privacyPolicyUrl: company.privacyPolicyUrl,
            logoUrl: company.logoUrl,
            isActive: company.isActive,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching company profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch company profile',
      });
    }
  }
);

/**
 * PUT /api/superadmin/company-profile
 * Update FleetPro SaaS company profile (PLATFORM_ROOT only)
 */
router.put(
  '/company-profile',
  authenticateUser,
  requirePlatformRole(['PLATFORM_ROOT']),
  async (req: AuthRequest, res: Response) => {
    try {
      const updateData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        whatsapp: req.body.whatsapp,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        pincode: req.body.pincode,
        gst: req.body.gst,
        pan: req.body.pan,
        bankName: req.body.bankName,
        bankAccountNumber: req.body.bankAccountNumber,
        bankIfscCode: req.body.bankIfscCode,
        bankAccountHolderName: req.body.bankAccountHolderName,
        upiId: req.body.upiId,
        paymentQrUrl: req.body.paymentQrUrl,
        supportEmail: req.body.supportEmail,
        supportPhone: req.body.supportPhone,
        supportWhatsapp: req.body.supportWhatsapp,
        supportHours: req.body.supportHours,
        supportLink: req.body.supportLink,
        termsOfServiceUrl: req.body.termsOfServiceUrl,
        privacyPolicyUrl: req.body.privacyPolicyUrl,
        refundPolicyUrl: req.body.refundPolicyUrl,
        logoUrl: req.body.logoUrl,
        faviconUrl: req.body.faviconUrl,
        updatedBy: {
          userId: req.userId!,
          platformRole: req.user?.platformRole || 'UNKNOWN',
        },
      };

      const existingCompany = await storage.getPlatformCompany();
      let company;

      if (existingCompany) {
        company = await storage.updatePlatformCompany(updateData);
      } else {
        company = await storage.createPlatformCompany(updateData);
      }

      // TODO: Log to audit trail

      res.json({
        success: true,
        message: 'Company profile updated successfully',
        data: { company },
      });
    } catch (error: any) {
      console.error('Error updating company profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update company profile',
      });
    }
  }
);

// ============================================================================
// AUDIT LOG (Placeholder)
// ============================================================================

/**
 * GET /api/superadmin/audit-log
 * Get platform audit trail for admin actions
 */
router.get(
  '/audit-log',
  authenticateUser,
  requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_SECURITY_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Implement when audit log model is created
      res.json({
        success: true,
        data: {
          logs: [],
          message: 'Audit log feature coming soon',
        },
      });
    } catch (error: any) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch audit log',
      });
    }
  }
);

export default router;
