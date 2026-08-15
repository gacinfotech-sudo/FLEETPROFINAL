import { Router, Request, Response } from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import { RBACService, PERMISSIONS } from '../services/phase6-rbac-service';
import { Role, PermissionRequest } from '../models/phase6-rbac';

const router = Router();

// ============================================================================
// PHASE 6: RBAC API ROUTES (20+ endpoints)
// ============================================================================

// ============================================================================
// Role Management (8 endpoints)
// ============================================================================

// Create role
router.post('/api/rbac/roles', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const role = await RBACService.createRole(tenantId, {
      ...req.body,
      createdBy: req.userId
    });
    res.json({ message: 'Role created', role });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// List roles
router.get('/api/rbac/roles', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const roles = await RBACService.listRoles(tenantId);
    res.json(roles);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get role
router.get('/api/rbac/roles/:roleId', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const role = await RBACService.getRole(req.params.roleId, tenantId);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    res.json(role);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Update role
router.put('/api/rbac/roles/:roleId', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const role = await RBACService.updateRole(req.params.roleId, tenantId, req.body);
    res.json({ message: 'Role updated', role });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Delete role
router.delete('/api/rbac/roles/:roleId', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    await RBACService.deleteRole(req.params.roleId, tenantId);
    res.json({ message: 'Role deleted' });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Duplicate role
router.post('/api/rbac/roles/:roleId/duplicate', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const source = await RBACService.getRole(req.params.roleId, tenantId);
    if (!source) return res.status(404).json({ message: 'Source role not found' });

    const newRole = await RBACService.createRole(tenantId, {
      name: `${source.name} (Copy)`,
      description: source.description,
      permissions: source.permissions,
      createdBy: req.userId
    });
    res.json({ message: 'Role duplicated', role: newRole });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// User Permissions (8 endpoints)
// ============================================================================

// Assign role to user
router.post('/api/rbac/users/:userId/role', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { roleId } = req.body;
    const permission = await RBACService.assignRoleToUser(tenantId, req.params.userId, roleId, req.userId);
    res.json({ message: 'Role assigned', permission });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get user permissions
router.get('/api/rbac/users/:userId/permissions', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const permissions = await RBACService.getUserPermissions(tenantId, req.params.userId);
    res.json({ permissions });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Check permission
router.get('/api/rbac/users/:userId/has-permission/:permission', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const hasPermission = await RBACService.hasPermission(tenantId, req.params.userId, req.params.permission);
    res.json({ hasPermission });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Grant additional permissions
router.post('/api/rbac/users/:userId/grant', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { permissions } = req.body;
    const result = await RBACService.grantPermissionsToUser(tenantId, req.params.userId, permissions, req.userId);
    res.json({ message: 'Permissions granted', result });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Revoke permissions
router.post('/api/rbac/users/:userId/revoke', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { permissions } = req.body;
    const result = await RBACService.revokePermissionsFromUser(tenantId, req.params.userId, permissions, req.userId);
    res.json({ message: 'Permissions revoked', result });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Reset user permissions
router.post('/api/rbac/users/:userId/reset', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    await RBACService.resetUserPermissions(tenantId, req.params.userId, req.userId);
    res.json({ message: 'User permissions reset' });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Bulk assign role
router.post('/api/rbac/roles/:roleId/assign-bulk', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { userIds } = req.body;
    const count = await RBACService.bulkAssignRole(tenantId, userIds, req.params.roleId, req.userId);
    res.json({ message: `Role assigned to ${count} users`, count });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Permission Requests (4 endpoints)
// ============================================================================

// Create permission request
router.post('/api/rbac/requests', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { targetUserId, permissions, reason } = req.body;
    const request = await RBACService.requestPermission(tenantId, req.userId, targetUserId, permissions, reason);
    res.json({ message: 'Permission request created', request });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// List pending requests
router.get('/api/rbac/requests/pending', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const requests = await RBACService.getPendingRequests(tenantId);
    res.json(requests);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Approve request
router.put('/api/rbac/requests/:requestId/approve', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { comments } = req.body;
    const request = await RBACService.approvePermissionRequest(req.params.requestId, tenantId, req.userId, comments);
    res.json({ message: 'Request approved', request });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Reject request
router.put('/api/rbac/requests/:requestId/reject', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { comments } = req.body;
    const request = await RBACService.rejectPermissionRequest(req.params.requestId, tenantId, req.userId, comments);
    res.json({ message: 'Request rejected', request });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Role Templates (3 endpoints)
// ============================================================================

// List templates
router.get('/api/rbac/templates', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const templates = await RBACService.listRoleTemplates(tenantId);
    res.json(templates);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Create template
router.post('/api/rbac/templates', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const template = await RBACService.createRoleTemplate(tenantId, {
      ...req.body,
      createdBy: req.userId
    });
    res.json({ message: 'Template created', template });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Create role from template
router.post('/api/rbac/templates/:templateId/create-role', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { roleName } = req.body;
    const role = await RBACService.createRoleFromTemplate(tenantId, req.params.templateId, roleName, req.userId);
    res.json({ message: 'Role created from template', role });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Audit & Reporting (2 endpoints)
// ============================================================================

// Get audit log
router.get('/api/rbac/audit', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const filter = {
      userId: req.query.userId,
      targetUserId: req.query.targetUserId,
      action: req.query.action
    };
    const log = await RBACService.getAuditLog(tenantId, filter);
    res.json(log);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get permission statistics
router.get('/api/rbac/stats', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const stats = await RBACService.getPermissionStats(tenantId);
    res.json(stats);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Permission Constants (1 endpoint)
// ============================================================================

// Get available permissions
router.get('/api/rbac/permissions', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  res.json(PERMISSIONS);
});

export default router;
