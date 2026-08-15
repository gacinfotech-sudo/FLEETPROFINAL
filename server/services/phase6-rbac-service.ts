import {
  Role, UserPermission, ResourcePermission, PermissionAudit,
  PermissionRequest, RoleTemplate, PERMISSIONS,
  IRole, IUserPermission, IResourcePermission, IPermissionAudit, IPermissionRequest
} from '../models/phase6-rbac';

// ============================================================================
// PHASE 6: RBAC SERVICES
// ============================================================================

export class RBACService {
  // =========================================================================
  // ROLE MANAGEMENT
  // =========================================================================

  static async createRole(tenantId: string, data: {
    name: string;
    description?: string;
    permissions: string[];
    createdBy: string;
  }): Promise<IRole> {
    const role = await Role.create({
      tenantId,
      ...data,
      isSystem: false
    });
    return role;
  }

  static async updateRole(roleId: string, tenantId: string, data: {
    permissions: string[];
    description?: string;
  }): Promise<IRole> {
    const role = await Role.findOneAndUpdate(
      { _id: roleId, tenantId, isSystem: false },
      { ...data, updatedAt: new Date() },
      { new: true }
    );
    if (!role) throw new Error('Role not found or is system role');
    return role;
  }

  static async deleteRole(roleId: string, tenantId: string): Promise<void> {
    const role = await Role.findOne({ _id: roleId, tenantId });
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot delete system roles');
    if (role.userCount > 0) throw new Error('Cannot delete role with assigned users');

    await Role.deleteOne({ _id: roleId });
  }

  static async getRole(roleId: string, tenantId: string): Promise<IRole | null> {
    return Role.findOne({ _id: roleId, tenantId });
  }

  static async listRoles(tenantId: string): Promise<IRole[]> {
    return Role.find({ tenantId }).sort({ isSystem: -1, createdAt: -1 });
  }

  // =========================================================================
  // USER PERMISSION MANAGEMENT
  // =========================================================================

  static async assignRoleToUser(tenantId: string, userId: string, roleId: string, assignedBy: string): Promise<IUserPermission> {
    const role = await Role.findOne({ _id: roleId, tenantId });
    if (!role) throw new Error('Role not found');

    // Remove existing role
    await UserPermission.updateMany(
      { tenantId, userId },
      { status: 'inactive' }
    );

    // Assign new role
    const permission = await UserPermission.create({
      tenantId,
      userId,
      roleId,
      status: 'active',
      validFrom: new Date(),
      assignedBy
    });

    // Update role user count
    await Role.updateOne(
      { _id: roleId },
      { $inc: { userCount: 1 } }
    );

    // Log audit
    await this.auditPermissionChange(tenantId, assignedBy, userId, 'role_change', [], roleId, 'Role assigned');

    return permission;
  }

  static async grantPermissionsToUser(tenantId: string, userId: string, permissions: string[], grantedBy: string): Promise<IUserPermission | null> {
    const userPerm = await UserPermission.findOne({ tenantId, userId, status: 'active' });
    if (!userPerm) throw new Error('User permission record not found');

    const updatedPerm = await UserPermission.findByIdAndUpdate(
      userPerm._id,
      {
        $addToSet: { additionalPermissions: { $each: permissions } },
        updatedAt: new Date()
      },
      { new: true }
    );

    await this.auditPermissionChange(tenantId, grantedBy, userId, 'grant', permissions, undefined, 'Permissions granted');

    return updatedPerm;
  }

  static async revokePermissionsFromUser(tenantId: string, userId: string, permissions: string[], revokedBy: string): Promise<IUserPermission | null> {
    const userPerm = await UserPermission.findOne({ tenantId, userId, status: 'active' });
    if (!userPerm) throw new Error('User permission record not found');

    const updatedPerm = await UserPermission.findByIdAndUpdate(
      userPerm._id,
      {
        $pull: { additionalPermissions: { $in: permissions } },
        $addToSet: { removedPermissions: { $each: permissions } },
        updatedAt: new Date()
      },
      { new: true }
    );

    await this.auditPermissionChange(tenantId, revokedBy, userId, 'revoke', permissions, undefined, 'Permissions revoked');

    return updatedPerm;
  }

  static async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    const userPerm = await UserPermission.findOne({ tenantId, userId, status: 'active' });
    if (!userPerm) return [];

    const role = await Role.findById(userPerm.roleId);
    if (!role) return [];

    // Combine role permissions + additional - removed
    let permissions = [...(role.permissions || [])];

    if (userPerm.additionalPermissions) {
      permissions.push(...userPerm.additionalPermissions);
    }

    if (userPerm.removedPermissions) {
      permissions = permissions.filter(p => !userPerm.removedPermissions?.includes(p));
    }

    return [...new Set(permissions)]; // Remove duplicates
  }

  static async hasPermission(tenantId: string, userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(tenantId, userId);
    return permissions.includes(permission) || permissions.includes('admin.access');
  }

  // =========================================================================
  // RESOURCE-LEVEL PERMISSIONS
  // =========================================================================

  static async grantResourcePermission(tenantId: string, userId: string, resourceType: string, resourceId: string, permissions: string[], grantedBy: string): Promise<IResourcePermission> {
    const resourcePerm = await ResourcePermission.create({
      tenantId,
      userId,
      resourceType: resourceType as any,
      resourceId,
      permissions,
      grantedBy,
      grantedAt: new Date()
    });

    await this.auditPermissionChange(tenantId, grantedBy, userId, 'grant', permissions, undefined, `Resource permissions granted for ${resourceType}:${resourceId}`);

    return resourcePerm;
  }

  static async revokeResourcePermission(tenantId: string, userId: string, resourceId: string, revokedBy: string): Promise<void> {
    await ResourcePermission.deleteOne({
      tenantId,
      userId,
      resourceId
    });

    await this.auditPermissionChange(tenantId, revokedBy, userId, 'revoke', [], undefined, `Resource permissions revoked for ${resourceId}`);
  }

  static async getUserResourcePermissions(tenantId: string, userId: string, resourceId: string): Promise<string[]> {
    const resourcePerm = await ResourcePermission.findOne({ tenantId, userId, resourceId });
    return resourcePerm?.permissions || [];
  }

  // =========================================================================
  // PERMISSION REQUESTS
  // =========================================================================

  static async requestPermission(tenantId: string, requesterId: string, targetUserId: string, permissions: string[], reason: string): Promise<IPermissionRequest> {
    const request = await PermissionRequest.create({
      tenantId,
      requesterId,
      targetUserId,
      requestedPermissions: permissions,
      reason,
      status: 'pending'
    });

    await this.auditPermissionChange(tenantId, requesterId, targetUserId, 'grant', permissions, undefined, `Permission request created: ${reason}`);

    return request;
  }

  static async approvePermissionRequest(requestId: string, tenantId: string, approverId: string, comments?: string): Promise<IPermissionRequest> {
    const request = await PermissionRequest.findOne({ _id: requestId, tenantId });
    if (!request) throw new Error('Request not found');

    request.status = 'approved';
    request.approverUserId = approverId;
    request.approverComments = comments;
    request.updatedAt = new Date();
    await request.save();

    // Grant the permissions
    await this.grantPermissionsToUser(tenantId, request.targetUserId, request.requestedPermissions, approverId);

    return request;
  }

  static async rejectPermissionRequest(requestId: string, tenantId: string, approverId: string, comments?: string): Promise<IPermissionRequest> {
    const request = await PermissionRequest.findOne({ _id: requestId, tenantId });
    if (!request) throw new Error('Request not found');

    request.status = 'rejected';
    request.approverUserId = approverId;
    request.approverComments = comments;
    request.updatedAt = new Date();
    await request.save();

    return request;
  }

  static async getPendingRequests(tenantId: string): Promise<IPermissionRequest[]> {
    return PermissionRequest.find({ tenantId, status: 'pending' }).sort({ createdAt: -1 });
  }

  // =========================================================================
  // ROLE TEMPLATES
  // =========================================================================

  static async createRoleTemplate(tenantId: string, data: {
    name: string;
    category: string;
    permissions: string[];
    description?: string;
    createdBy: string;
  }): Promise<IRoleTemplate> {
    const template = await RoleTemplate.create({
      tenantId,
      ...data,
      isPublic: false
    });
    return template;
  }

  static async createRoleFromTemplate(tenantId: string, templateId: string, roleName: string, createdBy: string): Promise<IRole> {
    const template = await RoleTemplate.findOne({ $or: [{ _id: templateId, tenantId }, { _id: templateId, isPublic: true }] });
    if (!template) throw new Error('Template not found');

    const role = await this.createRole(tenantId, {
      name: roleName,
      description: template.description,
      permissions: template.permissions,
      createdBy
    });

    // Increment template usage
    await RoleTemplate.updateOne({ _id: templateId }, { $inc: { usageCount: 1 } });

    return role;
  }

  static async listRoleTemplates(tenantId: string): Promise<IRoleTemplate[]> {
    return RoleTemplate.find({ $or: [{ tenantId }, { isPublic: true }] }).sort({ usageCount: -1 });
  }

  // =========================================================================
  // AUDIT & REPORTING
  // =========================================================================

  static async auditPermissionChange(tenantId: string, userId: string, targetUserId: string, action: string, permissions: string[], roleId?: string, reason?: string): Promise<IPermissionAudit> {
    const audit = await PermissionAudit.create({
      tenantId,
      userId,
      targetUserId,
      action: action as any,
      permissions,
      roleId,
      reason,
      changes: []
    });
    return audit;
  }

  static async getAuditLog(tenantId: string, filter?: { userId?: string; targetUserId?: string; action?: string }): Promise<IPermissionAudit[]> {
    const query: any = { tenantId };
    if (filter?.userId) query.userId = filter.userId;
    if (filter?.targetUserId) query.targetUserId = filter.targetUserId;
    if (filter?.action) query.action = filter.action;

    return PermissionAudit.find(query).sort({ createdAt: -1 }).limit(100);
  }

  static async getPermissionStats(tenantId: string): Promise<any> {
    const roleCount = await Role.countDocuments({ tenantId });
    const usersWithRoles = await UserPermission.countDocuments({ tenantId, status: 'active' });
    const pendingRequests = await PermissionRequest.countDocuments({ tenantId, status: 'pending' });

    const roleDistribution = await Role.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '$name', count: { $sum: 1 } } }
    ]);

    return {
      totalRoles: roleCount,
      usersWithRoles,
      pendingRequests,
      roleDistribution
    };
  }

  // =========================================================================
  // BULK OPERATIONS
  // =========================================================================

  static async bulkAssignRole(tenantId: string, userIds: string[], roleId: string, assignedBy: string): Promise<number> {
    let count = 0;

    for (const userId of userIds) {
      try {
        await this.assignRoleToUser(tenantId, userId, roleId, assignedBy);
        count++;
      } catch (error) {
        console.error(`Failed to assign role to ${userId}:`, error);
      }
    }

    return count;
  }

  static async resetUserPermissions(tenantId: string, userId: string, resetBy: string): Promise<void> {
    // Deactivate all current permissions
    await UserPermission.updateMany(
      { tenantId, userId },
      { status: 'inactive' }
    );

    // Log the reset
    await this.auditPermissionChange(tenantId, resetBy, userId, 'revoke', [], undefined, 'All permissions revoked - reset');
  }
}

// Export permission constants for use in middleware
export { PERMISSIONS };
