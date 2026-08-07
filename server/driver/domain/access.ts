// TASK-DRIVER-DOMAIN-02 — access-tier constants and helpers for this
// module's own routes.
//
// server/middleware/permissions.ts is a shared/Integrator-owned file (per
// the manifest: "global permissions ... new permission constants like
// DRIVER_CONTACTS_VIEW_FULL proposed via the change queue, not added
// directly"). These constants are DEFINED here, used directly with the
// EXISTING requirePermission() middleware (which only ever checks a raw
// string against storage.checkUserPermission — it does not require the
// string to be registered in the PERMISSIONS object to function), so this
// module's routes are fully functional today, before the proposed
// permissions.ts patch (in the task report) is ever applied.
export const DRIVER_CONTACTS_VIEW_FULL = 'driver_contacts_view_full';
export const DRIVER_PII_VIEW_UNMASKED = 'driver_pii_view_unmasked';

// Mirrors storage.checkUserPermission's own admin/client-bypass +
// permissions-array pattern (server/storage-mongodb.ts:1179-1196) exactly,
// so behavior here is consistent with every other permission check in the
// app rather than inventing a second access model. A "normal Executive"
// session, per the manifest's own language, is any non-admin/non-client
// user (this codebase's User.role enum is only 'admin'|'client'|'manager' —
// there is no literal 'executive' role; "Executive" describes a manager-role
// or granular-permission sub-user without the elevated grant) whose
// `permissions` array does not include this permission or the wildcard.
export function hasDriverPermission(user: { role?: string; permissions?: string[] } | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'client') return true;
  const perms = user.permissions || [];
  return perms.includes('*') || perms.includes(permission);
}

export function canViewFullDriverContacts(user: { role?: string; permissions?: string[] } | null | undefined): boolean {
  return hasDriverPermission(user, DRIVER_CONTACTS_VIEW_FULL);
}

export function canViewUnmaskedDriverPII(user: { role?: string; permissions?: string[] } | null | undefined): boolean {
  return hasDriverPermission(user, DRIVER_PII_VIEW_UNMASKED);
}
