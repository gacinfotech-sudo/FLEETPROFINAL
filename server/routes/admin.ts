/**
 * ADMIN PANEL ROUTES
 * Endpoints for root/super admin tenant management
 * Used by the Simple Root Admin Panel UI
 */

import { Router, Response } from 'express';
import { authenticateUser, requireAdmin, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage-mongodb';
import { isPlatformRole } from '../root/types';
import bcrypt from 'bcrypt';

const router = Router();

/**
 * Middleware: Require platform role
 * Only users with PLATFORM_ROOT can access admin endpoints
 */
function requirePlatformRoot(req: AuthRequest, res: Response, next: Function) {
  if (!req.user?.platformRole || !isPlatformRole(req.user.platformRole)) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  if (req.user.platformRole !== 'PLATFORM_ROOT') {
    return res.status(403).json({ message: 'PLATFORM_ROOT role required' });
  }

  next();
}

// ============================================================================
// TENANT STATISTICS
// ============================================================================

/**
 * GET /api/admin/tenants/stats
 * Get tenant statistics (total, active, inactive)
 */
router.get('/tenants/stats', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
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

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/tenants
 * List all tenants
 */
router.get('/tenants', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
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
router.get('/tenants/:id', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
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
router.post('/tenants', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
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
      role: 'admin', // Tenant admin role
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
        note: 'Share these credentials with the tenant owner. They can change the password on first login.',
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
router.put('/tenants/:id', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
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
 * Deactivate/Delete tenant (soft delete)
 */
router.delete('/tenants/:id', authenticateUser, requirePlatformRoot, async (req: AuthRequest, res: Response) => {
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

export default router;
