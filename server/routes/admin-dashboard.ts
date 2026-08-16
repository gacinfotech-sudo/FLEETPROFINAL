import express from "express";
import { adminDashboardEngine } from "../services/adminDashboardEngine";
import { authenticateUser, requireTenant, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage-mongodb";
import { isPlatformRole } from "../root/types";
import bcrypt from "bcrypt";

const router = express.Router();

// GET /api/admin/metrics - Get system metrics
router.get("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const metrics = adminDashboardEngine.getSystemMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch metrics",
    });
  }
});

// GET /api/admin/audit-logs - Get audit logs
router.get("/audit-logs", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { adminId, entityType, limit } = req.query;
    const logs = adminDashboardEngine.getAuditLogs({
      adminId,
      entityType,
      limit: limit ? parseInt(limit) : 100,
    });

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch audit logs",
    });
  }
});

// POST /api/admin/audit-log - Log audit action
router.post("/audit-log", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { adminId, action, entityType, entityId, changes } = req.body;

    if (!adminId || !action || !entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: "Required fields missing",
      });
    }

    const log = adminDashboardEngine.logAuditAction(
      adminId,
      action,
      entityType,
      entityId,
      changes || {}
    );

    res.json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    console.error("Error logging audit:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to log audit",
    });
  }
});

// GET /api/admin/alerts - Get active alerts
router.get("/alerts", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const alerts = adminDashboardEngine.getActiveAlerts();

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error: any) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch alerts",
    });
  }
});

// POST /api/admin/alert - Create alert
router.post("/alert", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { severity, type, title, description, affectedSystem } = req.body;

    if (!severity || !type || !title || !description || !affectedSystem) {
      return res.status(400).json({
        success: false,
        error: "Required fields missing",
      });
    }

    const alert = adminDashboardEngine.createAlert(
      severity,
      type,
      title,
      description,
      affectedSystem
    );

    res.json({
      success: true,
      data: alert,
    });
  } catch (error: any) {
    console.error("Error creating alert:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create alert",
    });
  }
});

// POST /api/admin/alert/:alertId/resolve - Resolve alert
router.post("/alert/:alertId/resolve", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({
        success: false,
        error: "resolution is required",
      });
    }

    const alert = adminDashboardEngine.resolveAlert(req.params.alertId, resolution);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error: any) {
    console.error("Error resolving alert:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to resolve alert",
    });
  }
});

// GET /api/admin/config - Get all configurations
router.get("/config", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const configs = adminDashboardEngine.getAllConfigurations();

    res.json({
      success: true,
      data: configs,
      count: configs.length,
    });
  } catch (error: any) {
    console.error("Error fetching configs:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch configs",
    });
  }
});

// POST /api/admin/config - Update configuration
router.post("/config", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { category, key, value, updatedBy } = req.body;

    if (!category || !key || value === undefined || !updatedBy) {
      return res.status(400).json({
        success: false,
        error: "Required fields missing",
      });
    }

    const config = adminDashboardEngine.updateConfiguration(
      category,
      key,
      value,
      updatedBy
    );

    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error("Error updating config:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update config",
    });
  }
});

// POST /api/admin/report - Generate report
router.post("/report", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { title, type, generatedBy, periodStart, periodEnd } = req.body;

    if (!title || !type || !generatedBy || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        error: "Required fields missing",
      });
    }

    const report = adminDashboardEngine.generateReport(
      title,
      type,
      generatedBy,
      new Date(periodStart),
      new Date(periodEnd)
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate report",
    });
  }
});

// GET /api/admin/report/:reportId - Get report
router.get("/report/:reportId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const report = adminDashboardEngine.getReport(req.params.reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found",
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error fetching report:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch report",
    });
  }
});

// GET /api/admin/admins - Get all admins
router.get("/admins", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const admins = adminDashboardEngine.getAllAdmins();

    res.json({
      success: true,
      data: admins,
      count: admins.length,
    });
  } catch (error: any) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch admins",
    });
  }
});

// POST /api/admin/bulk-operation - Create bulk operation
router.post("/bulk-operation", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { type, targetCount, createdBy } = req.body;

    if (!type || !targetCount || !createdBy) {
      return res.status(400).json({
        success: false,
        error: "Required fields missing",
      });
    }

    const operation = adminDashboardEngine.createBulkOperation(
      type,
      targetCount,
      createdBy
    );

    res.json({
      success: true,
      data: operation,
    });
  } catch (error: any) {
    console.error("Error creating bulk operation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create bulk operation",
    });
  }
});

// PUT /api/admin/bulk-operation/:operationId - Update bulk operation progress
router.put("/bulk-operation/:operationId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { processed, successful, failed } = req.body;

    if (processed === undefined || successful === undefined || failed === undefined) {
      return res.status(400).json({
        success: false,
        error: "processed, successful, and failed are required",
      });
    }

    const operation = adminDashboardEngine.updateBulkOperationProgress(
      req.params.operationId,
      processed,
      successful,
      failed
    );

    if (!operation) {
      return res.status(404).json({
        success: false,
        error: "Operation not found",
      });
    }

    res.json({
      success: true,
      data: operation,
    });
  } catch (error: any) {
    console.error("Error updating operation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update operation",
    });
  }
});

// POST /api/admin/test - Test admin engine
router.post("/test", (req: any, res) => {
  try {
    // Get metrics
    const metrics = adminDashboardEngine.getSystemMetrics();

    // Create alerts
    const alert1 = adminDashboardEngine.createAlert(
      "high",
      "high_error_rate",
      "High error rate detected",
      "Error rate exceeded 1% threshold",
      "API Gateway"
    );

    const alert2 = adminDashboardEngine.createAlert(
      "medium",
      "db_performance",
      "Database performance degradation",
      "Query response time above 200ms",
      "Database"
    );

    // Log audit
    const audit = adminDashboardEngine.logAuditAction(
      "admin_001",
      "update",
      "driver",
      "driver_123",
      { suspension: { before: false, after: true } }
    );

    // Update configuration
    const config = adminDashboardEngine.updateConfiguration(
      "pricing",
      "surge_multiplier",
      1.5,
      "admin_001"
    );

    // Generate report
    const report = adminDashboardEngine.generateReport(
      "Daily Operations Report",
      "daily",
      "admin_001",
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date()
    );

    // Create bulk operation
    const bulkOp = adminDashboardEngine.createBulkOperation(
      "bulk_send_notification",
      1000,
      "admin_001"
    );

    // Update bulk operation progress
    adminDashboardEngine.updateBulkOperationProgress(
      bulkOp.operationId,
      500,
      480,
      20
    );

    // Get audit logs
    const auditLogs = adminDashboardEngine.getAuditLogs({ limit: 10 });

    res.json({
      success: true,
      metrics,
      alerts: [alert1, alert2],
      audit,
      config,
      report,
      bulkOperation: adminDashboardEngine.getBulkOperation(bulkOp.operationId),
      auditLogCount: auditLogs.length,
      summary: {
        alertsCreated: 2,
        auditLogsRecorded: 1,
        configUpdated: 1,
        reportGenerated: 1,
        bulkOperationCreated: 1,
        systemUptime: metrics.systemUptime.toFixed(2),
        activeUsers24h: metrics.activeUsers24h,
        todayRevenue: `₹${metrics.todayRevenue.toLocaleString()}`,
      },
    });
  } catch (error: any) {
    console.error("Error testing admin engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test admin engine",
    });
  }
});

// ============================================================================
// SUPERADMIN TENANT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Middleware: Require PLATFORM_ROOT role
 * Only SuperAdmin/Root can access tenant management endpoints
 */
function requirePlatformRoot(req: AuthRequest, res: any, next: Function) {
  if (!req.user?.platformRole || !isPlatformRole(req.user.platformRole)) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  if (req.user.platformRole !== 'PLATFORM_ROOT') {
    return res.status(403).json({ message: 'PLATFORM_ROOT role required' });
  }

  next();
}

/**
 * GET /api/admin/tenants/stats
 * Get tenant statistics
 */
router.get('/tenants/stats', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const tenants = await storage.getTenants();

    const stats = {
      total: tenants.length,
      active: tenants.filter((t: any) => t.status !== 'inactive').length,
      inactive: tenants.filter((t: any) => t.status === 'inactive').length,
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching tenant stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/admin/tenants
 * List all tenants
 */
router.get('/tenants', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const tenants = await storage.getTenants();

    const tenantList = tenants.map((tenant: any) => ({
      _id: tenant._id,
      tenantId: tenant.tenantId,
      name: tenant.name,
      businessName: tenant.businessName || tenant.name,
      ownerName: tenant.ownerName || '',
      ownerEmail: tenant.ownerEmail || tenant.email || '',
      ownerMobile: tenant.ownerMobile || tenant.phone || '',
      status: tenant.status || 'active',
      createdAt: tenant.createdAt,
    }));

    res.json(tenantList);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ message: 'Failed to fetch tenants' });
  }
});

/**
 * GET /api/admin/tenants/:id
 * Get single tenant details
 */
router.get('/tenants/:id', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const tenant = await storage.getTenant(req.params.id);

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    res.json({
      _id: tenant._id,
      tenantId: tenant.tenantId,
      name: tenant.name,
      businessName: tenant.businessName || tenant.name,
      ownerName: tenant.ownerName || '',
      ownerEmail: tenant.ownerEmail || tenant.email || '',
      ownerMobile: tenant.ownerMobile || tenant.phone || '',
      city: tenant.city || '',
      status: tenant.status || 'active',
      createdAt: tenant.createdAt,
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ message: 'Failed to fetch tenant' });
  }
});

/**
 * POST /api/admin/tenants
 * Create new tenant and tenant owner
 */
router.post('/tenants', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { name, businessName, ownerName, ownerEmail, ownerMobile, city, status } = req.body;

    // Validate required fields
    if (!name || !businessName || !ownerName || !ownerEmail || !ownerMobile) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if tenant email already exists
    const existingTenant = await storage.getTenantByEmail(ownerEmail);
    if (existingTenant) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Create tenant
    const tenant = await storage.createTenant({
      name: businessName || name,
      businessName: businessName || name,
      tenantId: 'TENANT_' + Date.now(),
      email: ownerEmail,
      phone: ownerMobile,
      ownerName,
      ownerEmail,
      ownerMobile,
      city,
      status: status || 'active',
    });

    if (!tenant) {
      return res.status(500).json({ message: 'Failed to create tenant' });
    }

    // Create tenant owner user account
    const ownerUser = await storage.createUser({
      userId: ownerEmail,
      email: ownerEmail,
      password: passwordHash,
      name: ownerName,
      phone: ownerMobile,
      role: 'admin',
      tenantId: tenant.tenantId || tenant._id,
      isActive: true,
      createdAt: new Date(),
    });

    if (!ownerUser) {
      return res.status(500).json({ message: 'Failed to create owner account' });
    }

    res.status(201).json({
      message: 'Tenant created successfully',
      tenantId: tenant.tenantId || tenant._id,
      tenant: {
        _id: tenant._id,
        tenantId: tenant.tenantId,
        name: tenant.name,
        businessName: tenant.businessName,
        ownerName,
        ownerEmail,
        ownerMobile,
        city,
        status: tenant.status || 'active',
        createdAt: tenant.createdAt,
      },
      ownerCredentials: {
        userId: ownerEmail,
        tempPassword: tempPassword,
        note: 'Share these credentials with the tenant owner.',
      },
    });
  } catch (error: any) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ message: error.message || 'Failed to create tenant' });
  }
});

/**
 * PUT /api/admin/tenants/:id
 * Update tenant information
 */
router.put('/tenants/:id', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { name, businessName, ownerName, ownerEmail, ownerMobile, city, status } = req.body;

    const tenant = await storage.getTenant(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const updatedTenant = await storage.updateTenant(req.params.id, {
      name: name || tenant.name,
      businessName: businessName || tenant.businessName,
      ownerName: ownerName || tenant.ownerName,
      ownerEmail: ownerEmail || tenant.ownerEmail,
      ownerMobile: ownerMobile || tenant.ownerMobile,
      city: city || tenant.city,
      status: status !== undefined ? status : tenant.status,
    });

    res.json({
      message: 'Tenant updated successfully',
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ message: 'Failed to update tenant' });
  }
});

/**
 * DELETE /api/admin/tenants/:id
 * Deactivate tenant
 */
router.delete('/tenants/:id', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const tenant = await storage.getTenant(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const updatedTenant = await storage.updateTenant(req.params.id, {
      status: 'inactive',
    });

    res.json({
      message: 'Tenant deactivated successfully',
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ message: 'Failed to delete tenant' });
  }
});

// ============================================================================
// TENANT USER MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/tenants/:id/users
 * Get all users for a tenant
 */
router.get('/tenants/:id/users', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const tenantId = req.params.id;
    const users = await storage.getUsersByTenant(tenantId);

    res.json(users || []);
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

/**
 * POST /api/admin/tenants/:id/users
 * Create new user for tenant
 */
router.post('/tenants/:id/users', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { name, email, role, password } = req.body;
    const tenantId = req.params.id;

    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate temporary password if not provided
    const tempPassword = password || Math.random().toString(36).substring(2, 15);
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.default.hash(tempPassword, 12);

    const user = await storage.createUser({
      userId: email,
      email,
      password: passwordHash,
      name,
      role: role as any,
      tenantId,
      isActive: true,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: 'User created successfully',
      user,
      tempPassword: !password ? tempPassword : undefined,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

/**
 * DELETE /api/admin/tenants/:id/users/:userId
 * Delete user from tenant
 */
router.delete('/tenants/:id/users/:userId', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { userId } = req.params;
    await storage.deleteUser(userId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

/**
 * POST /api/admin/tenants/:id/users/:userId/reset-password
 * Reset user password
 */
router.post('/tenants/:id/users/:userId/reset-password', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: any) => {
  try {
    const { userId } = req.params;

    const tempPassword = Math.random().toString(36).substring(2, 15);
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.default.hash(tempPassword, 12);

    await storage.updateUser(userId, { password: passwordHash });

    res.json({
      message: 'Password reset successfully',
      tempPassword,
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

export default router;
