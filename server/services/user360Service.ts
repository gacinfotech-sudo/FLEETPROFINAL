import { User, Booking } from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 7: USER/RBAC 360 (Simplified)
 */

const ROLE_HIERARCHY = {
  admin: { displayName: 'Administrator', permissions: ['all'], subordinateRoles: ['manager', 'operations', 'accounts'] },
  manager: { displayName: 'Manager', permissions: ['manage_bookings', 'view_reports'], subordinateRoles: ['operations'] },
  operations: { displayName: 'Operations', permissions: ['manage_bookings', 'view_customers'], subordinateRoles: [] },
  accounts: { displayName: 'Accounts', permissions: ['manage_payments', 'view_invoices'], subordinateRoles: [] },
};

export async function getUser360(
  tenantId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId
): Promise<any | null> {
  const user = await User.findOne({ _id: userId, tenantId, isDeleted: { $ne: true } });
  if (!user) return null;

  const bookings = await Booking.find({ tenantId, 'assignedTo._id': userId }).limit(100);
  const roleConfig = ROLE_HIERARCHY[user.role as keyof typeof ROLE_HIERARCHY] || { displayName: user.role, permissions: [] };

  return {
    user: { id: user._id, userId: user.userId, name: user.name || user.userId, role: user.role, status: user.isActive === false ? 'inactive' : 'active' },
    roleInfo: { roleName: roleConfig.displayName, permissions: roleConfig.permissions },
    bookingsManaged: bookings.length,
    alerts: user.isActive === false ? [{ type: 'account', message: 'Account deactivated', severity: 'high' }] : []
  };
}

export async function getUserRBACConfig(role: string): Promise<any> {
  return ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || { displayName: role, permissions: [] };
}

export function getAllRoles() {
  return Object.entries(ROLE_HIERARCHY).map(([key, value]) => ({ id: key, name: value.displayName, permissions: value.permissions }));
}

export async function checkPermission(tenantId: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId, permission: string): Promise<boolean> {
  const user = await User.findOne({ _id: userId, tenantId });
  if (!user) return false;
  const role = ROLE_HIERARCHY[user.role as keyof typeof ROLE_HIERARCHY];
  return role ? role.permissions.includes(permission) || role.permissions.includes('all') : false;
}

export function getUser360QuickActions(user360: any) {
  return [
    { id: 'view_profile', label: 'View Profile', icon: 'User', action: 'view_profile', isAvailable: true },
    { id: 'view_activity', label: 'View Activity', icon: 'Activity', action: 'view_activity', isAvailable: true },
  ];
}
