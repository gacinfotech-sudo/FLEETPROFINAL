import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// PHASE 6: RBAC (ROLE-BASED ACCESS CONTROL) - SCHEMAS
// ============================================================================

// Permission types and actions
export const PERMISSIONS = {
  DRIVER: {
    CREATE: 'driver.create',
    READ: 'driver.read',
    UPDATE: 'driver.update',
    DELETE: 'driver.delete',
    MANAGE: 'driver.manage'
  },
  VEHICLE: {
    CREATE: 'vehicle.create',
    READ: 'vehicle.read',
    UPDATE: 'vehicle.update',
    DELETE: 'vehicle.delete',
    MANAGE: 'vehicle.manage'
  },
  BOOKING: {
    CREATE: 'booking.create',
    READ: 'booking.read',
    UPDATE: 'booking.update',
    DELETE: 'booking.delete',
    MANAGE: 'booking.manage',
    APPROVE: 'booking.approve'
  },
  FINANCIAL: {
    READ: 'financial.read',
    CREATE: 'financial.create',
    APPROVE: 'financial.approve',
    EXPORT: 'financial.export'
  },
  USER: {
    CREATE: 'user.create',
    READ: 'user.read',
    UPDATE: 'user.update',
    DELETE: 'user.delete',
    MANAGE: 'user.manage'
  },
  ROLE: {
    CREATE: 'role.create',
    READ: 'role.read',
    UPDATE: 'role.update',
    DELETE: 'role.delete',
    MANAGE: 'role.manage'
  },
  DASHBOARD: {
    READ: 'dashboard.read',
    EXPORT: 'dashboard.export'
  },
  SETTINGS: {
    READ: 'settings.read',
    UPDATE: 'settings.update'
  },
  ADMIN: {
    ACCESS: 'admin.access',
    MANAGE_TENANT: 'admin.manage_tenant'
  }
};

// 1. Custom Role Definition
export interface IRole extends Document {
  tenantId: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean; // System roles can't be deleted
  userCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const RoleSchema = new Schema<IRole>({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true, index: true },
  description: String,
  permissions: [{ type: String, index: true }],
  isSystem: { type: Boolean, default: false },
  userCount: { type: Number, default: 0 },
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 2. User Permission Assignment
export interface IUserPermission extends Document {
  tenantId: string;
  userId: string;
  roleId: string;
  additionalPermissions?: string[];
  removedPermissions?: string[];
  status: 'active' | 'inactive';
  validFrom: Date;
  validUntil?: Date;
  assignedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserPermissionSchema = new Schema<IUserPermission>({
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  roleId: { type: String, required: true },
  additionalPermissions: [String],
  removedPermissions: [String],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  validFrom: { type: Date, default: Date.now },
  validUntil: Date,
  assignedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 3. Resource-Level Permissions
export interface IResourcePermission extends Document {
  tenantId: string;
  userId: string;
  resourceType: 'driver' | 'vehicle' | 'booking' | 'team';
  resourceId: string;
  permissions: string[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export const ResourcePermissionSchema = new Schema<IResourcePermission>({
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  resourceType: { type: String, enum: ['driver', 'vehicle', 'booking', 'team'], required: true },
  resourceId: { type: String, required: true },
  permissions: [String],
  grantedBy: String,
  grantedAt: { type: Date, default: Date.now },
  expiresAt: Date
});

// 4. Permission Audit Log
export interface IPermissionAudit extends Document {
  tenantId: string;
  userId: string;
  targetUserId: string;
  action: 'grant' | 'revoke' | 'modify' | 'role_change';
  permissions: string[];
  roleId?: string;
  reason?: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export const PermissionAuditSchema = new Schema<IPermissionAudit>({
  tenantId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  targetUserId: { type: String, required: true, index: true },
  action: { type: String, enum: ['grant', 'revoke', 'modify', 'role_change'], required: true },
  permissions: [String],
  roleId: String,
  reason: String,
  changes: [{
    field: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed
  }],
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

// 5. Permission Request (for approval flow)
export interface IPermissionRequest extends Document {
  tenantId: string;
  requesterId: string;
  targetUserId: string;
  requestedPermissions: string[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approverUserId?: string;
  approverComments?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const PermissionRequestSchema = new Schema<IPermissionRequest>({
  tenantId: { type: String, required: true, index: true },
  requesterId: { type: String, required: true },
  targetUserId: { type: String, required: true, index: true },
  requestedPermissions: [String],
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  approverUserId: String,
  approverComments: String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 6. Role Template (for quick role creation)
export interface IRoleTemplate extends Document {
  tenantId: string;
  name: string;
  category: 'management' | 'operations' | 'support' | 'finance' | 'custom';
  permissions: string[];
  description?: string;
  isPublic: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
}

export const RoleTemplateSchema = new Schema<IRoleTemplate>({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  category: { type: String, enum: ['management', 'operations', 'support', 'finance', 'custom'], required: true },
  permissions: [String],
  description: String,
  isPublic: { type: Boolean, default: false },
  usageCount: { type: Number, default: 0 },
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});

// Create models
export const Role = mongoose.model<IRole>('Role', RoleSchema);
export const UserPermission = mongoose.model<IUserPermission>('UserPermission', UserPermissionSchema);
export const ResourcePermission = mongoose.model<IResourcePermission>('ResourcePermission', ResourcePermissionSchema);
export const PermissionAudit = mongoose.model<IPermissionAudit>('PermissionAudit', PermissionAuditSchema);
export const PermissionRequest = mongoose.model<IPermissionRequest>('PermissionRequest', PermissionRequestSchema);
export const RoleTemplate = mongoose.model<IRoleTemplate>('RoleTemplate', RoleTemplateSchema);
