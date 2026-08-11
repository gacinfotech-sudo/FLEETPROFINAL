/**
 * PHASE 14: Multi-Tenant Admin - Routes
 * Comprehensive admin API endpoints for tenant management
 */

import express, { Router, Request, Response } from 'express';
import { authenticateUser, requireAdmin, AuthRequest } from '../middleware/auth';
import TenantManager from './TenantManager';
import AuditLog from './AuditLog';
import { storage } from '../storage-mongodb';

const router = Router();

/**
 * Middleware: Require admin authentication
 */
const requireAdminAuth = [authenticateUser, requireAdmin];

/**
 * Helper: Get client IP
 */
function getClientIP(req: Request): string | undefined {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
}

/**
 * Helper: Get user agent
 */
function getUserAgent(req: Request): string | undefined {
  return req.headers['user-agent'] as string;
}

// ============================================================================
// TENANT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/admin/tenants - Create new tenant
 */
router.post('/tenants', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, businessName, email, phone, address, subscriptionPlan, timezone } = req.body;

    if (!name || !businessName || !email || !subscriptionPlan) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const result = await TenantManager.createTenant({
      name,
      businessName,
      email,
      phone,
      address,
      subscriptionPlan,
      timezone,
    });

    // Log the action
    AuditLog.logTenantCreation(
      req.userId!,
      result.tenant._id.toString(),
      result.tenant.name,
      { name, businessName, email, subscriptionPlan },
      getClientIP(req),
      getUserAgent(req)
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error creating tenant:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create tenant',
    });
  }
});

/**
 * GET /api/admin/tenants - List all tenants
 */
router.get('/tenants', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, status, search } = req.query;

    const result = await TenantManager.listTenants({
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      status: (status as any) || 'all',
      search: search as string,
    });

    res.json({
      success: true,
      data: result.tenants,
      pagination: {
        page: result.page,
        pages: result.pages,
        total: result.total,
      },
    });
  } catch (error: any) {
    console.error('Error listing tenants:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list tenants',
    });
  }
});

/**
 * GET /api/admin/tenants/:tenantId - Get tenant details
 */
router.get('/tenants/:tenantId', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;

    const result = await TenantManager.getTenant(tenantId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error getting tenant:', error);
    res.status(error.message?.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message || 'Failed to get tenant',
    });
  }
});

/**
 * PUT /api/admin/tenants/:tenantId - Update tenant
 */
router.put('/tenants/:tenantId', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const updates = req.body;

    // Get current tenant for audit logging
    const currentTenant = await storage.getTenant(tenantId);
    if (!currentTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    const updated = await TenantManager.updateTenant(tenantId, updates);

    // Log the action
    AuditLog.logTenantUpdate(
      req.userId!,
      tenantId,
      currentTenant.name,
      {
        before: {
          name: currentTenant.name,
          email: currentTenant.email,
          ...Object.keys(updates).reduce((acc, key) => {
            acc[key] = (currentTenant as any)[key];
            return acc;
          }, {} as Record<string, any>),
        },
        after: {
          name: updated.name,
          email: updated.email,
          ...updates,
        },
      },
      getClientIP(req),
      getUserAgent(req)
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating tenant:', error);
    res.status(error.message?.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message || 'Failed to update tenant',
    });
  }
});

/**
 * PATCH /api/admin/tenants/:tenantId/status - Activate/Deactivate tenant
 */
router.patch('/tenants/:tenantId/status', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { isActive, reason } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        error: 'isActive status is required',
      });
    }

    const currentTenant = await storage.getTenant(tenantId);
    if (!currentTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    const updated = await TenantManager.setTenantStatus(tenantId, isActive);

    // Log the action
    AuditLog.logTenantStatusChange(
      req.userId!,
      tenantId,
      currentTenant.name,
      isActive,
      reason,
      getClientIP(req),
      getUserAgent(req)
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating tenant status:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update tenant status',
    });
  }
});

/**
 * PATCH /api/admin/tenants/:tenantId/plan - Update subscription plan
 */
router.patch('/tenants/:tenantId/plan', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { plan, customLimits } = req.body;

    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Subscription plan is required',
      });
    }

    const currentTenant = await storage.getTenant(tenantId);
    if (!currentTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    const updated = await TenantManager.updateSubscriptionPlan(tenantId, plan, customLimits);

    // Log the action
    AuditLog.logQuotaUpdate(
      req.userId!,
      tenantId,
      currentTenant.name,
      {
        before: { plan: currentTenant.subscriptionPlan, limits: currentTenant.limits },
        after: { plan, limits: updated.limits },
      },
      getClientIP(req),
      getUserAgent(req)
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating subscription plan:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update subscription plan',
    });
  }
});

/**
 * DELETE /api/admin/tenants/:tenantId - Delete tenant
 */
router.delete('/tenants/:tenantId', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { reason } = req.body;

    const currentTenant = await storage.getTenant(tenantId);
    if (!currentTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    await TenantManager.deleteTenant(tenantId);

    // Log the action
    AuditLog.logTenantDeletion(
      req.userId!,
      tenantId,
      currentTenant.name,
      reason,
      getClientIP(req),
      getUserAgent(req)
    );

    res.json({
      success: true,
      message: 'Tenant deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting tenant:', error);
    res.status(error.message?.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message || 'Failed to delete tenant',
    });
  }
});

// ============================================================================
// ISOLATION VERIFICATION ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/tenants/:tenantId/isolation - Verify tenant isolation
 */
router.get('/tenants/:tenantId/isolation', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;

    const result = await TenantManager.verifyTenantIsolation(tenantId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error verifying isolation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify isolation',
    });
  }
});

/**
 * GET /api/admin/tenants/:tenantId/resources - Check resource limits
 */
router.get('/tenants/:tenantId/resources/:resourceType', requireAdminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, resourceType } = req.params;

    if (!['vehicles', 'drivers', 'managers'].includes(resourceType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resource type',
      });
    }

    const result = await TenantManager.checkResourceLimit(tenantId, resourceType as any);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error checking resource limit:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check resource limit',
    });
  }
});

// ============================================================================
// AUDIT LOG ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/audit-logs - Get audit logs
 */
router.get('/audit-logs', requireAdminAuth, (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, adminUserId, action, startDate, endDate, limit, offset } = req.query;

    const logs = AuditLog.getLogs({
      tenantId: tenantId as string,
      adminUserId: adminUserId as string,
      action: action as any,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 100,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch audit logs',
    });
  }
});

/**
 * GET /api/admin/audit-summary - Get audit summary
 */
router.get('/audit-summary', requireAdminAuth, (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const summary = AuditLog.getAuditSummary(start, end);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch audit summary',
    });
  }
});

/**
 * GET /api/admin/compliance-report/:tenantId - Get compliance report
 */
router.get('/compliance-report/:tenantId', requireAdminAuth, (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.params;

    const report = AuditLog.getComplianceReport(tenantId);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('Error fetching compliance report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch compliance report',
    });
  }
});

/**
 * GET /api/admin/audit-logs/export - Export audit logs
 */
router.get('/audit-logs/export', requireAdminAuth, (req: AuthRequest, res: Response) => {
  try {
    const { format, tenantId } = req.query;

    const csvData = AuditLog.exportLogsAsCSV({ tenantId });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
    res.send(csvData);

    // Log the export action
    AuditLog.logExport(
      req.userId!,
      req.user?.name || 'Unknown',
      tenantId as string,
      'csv',
      csvData.split('\n').length - 1,
      getClientIP(req),
      getUserAgent(req)
    );
  } catch (error: any) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export audit logs',
    });
  }
});

// ============================================================================
// HEALTH AND STATUS ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/health - Admin panel health check
 */
router.get('/health', requireAdminAuth, (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date(),
    authenticated: true,
  });
});

export default router;
