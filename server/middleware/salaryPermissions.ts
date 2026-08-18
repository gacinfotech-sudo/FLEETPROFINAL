/**
 * PHASE 12: RBAC & SECURITY
 * Driver Salary Module Permissions and Access Control
 */

export enum SalaryPermissions {
  // View permissions
  VIEW_SALARY = 'driver.salary.view',
  VIEW_SALARY_SLIP = 'driver.salary.view_slip',
  VIEW_LEDGER = 'driver.salary.view_ledger',
  VIEW_REPORTS = 'driver.salary.view_reports',

  // Management permissions
  GENERATE_SALARY = 'driver.salary.generate',
  EDIT_SALARY = 'driver.salary.edit',
  APPROVE_SALARY = 'driver.salary.approve',
  PAY_SALARY = 'driver.salary.pay',

  // Advance permissions
  CREATE_ADVANCE = 'driver.advance.create',
  APPROVE_ADVANCE = 'driver.advance.approve',
  VIEW_ADVANCES = 'driver.advance.view',

  // Recovery permissions
  CREATE_RECOVERY = 'driver.recovery.create',
  APPROVE_RECOVERY = 'driver.recovery.approve',
  VIEW_RECOVERIES = 'driver.recovery.view',

  // Override permissions
  OVERRIDE_DAYWISE = 'driver.salary.override',
  OVERRIDE_CALCULATIONS = 'driver.salary.override_calc',

  // Export permissions
  EXPORT_SLIP = 'driver.salary.export_slip',
  EXPORT_REPORTS = 'driver.salary.export_reports',

  // Finance permissions
  VIEW_FINANCE_DASHBOARD = 'finance.salary.dashboard',
  VIEW_FINANCE_REPORTS = 'finance.salary.reports'
}

/**
 * Default role-based permissions
 */
export const defaultRolePermissions: Record<string, SalaryPermissions[]> = {
  admin: [
    SalaryPermissions.VIEW_SALARY,
    SalaryPermissions.VIEW_SALARY_SLIP,
    SalaryPermissions.VIEW_LEDGER,
    SalaryPermissions.VIEW_REPORTS,
    SalaryPermissions.GENERATE_SALARY,
    SalaryPermissions.EDIT_SALARY,
    SalaryPermissions.APPROVE_SALARY,
    SalaryPermissions.PAY_SALARY,
    SalaryPermissions.CREATE_ADVANCE,
    SalaryPermissions.APPROVE_ADVANCE,
    SalaryPermissions.VIEW_ADVANCES,
    SalaryPermissions.CREATE_RECOVERY,
    SalaryPermissions.APPROVE_RECOVERY,
    SalaryPermissions.VIEW_RECOVERIES,
    SalaryPermissions.OVERRIDE_DAYWISE,
    SalaryPermissions.OVERRIDE_CALCULATIONS,
    SalaryPermissions.EXPORT_SLIP,
    SalaryPermissions.EXPORT_REPORTS,
    SalaryPermissions.VIEW_FINANCE_DASHBOARD,
    SalaryPermissions.VIEW_FINANCE_REPORTS
  ],
  client: [
    SalaryPermissions.VIEW_SALARY,
    SalaryPermissions.VIEW_SALARY_SLIP,
    SalaryPermissions.VIEW_LEDGER,
    SalaryPermissions.VIEW_REPORTS,
    SalaryPermissions.GENERATE_SALARY,
    SalaryPermissions.EDIT_SALARY,
    SalaryPermissions.APPROVE_SALARY,
    SalaryPermissions.PAY_SALARY,
    SalaryPermissions.VIEW_ADVANCES,
    SalaryPermissions.VIEW_RECOVERIES,
    SalaryPermissions.EXPORT_SLIP,
    SalaryPermissions.EXPORT_REPORTS,
    SalaryPermissions.VIEW_FINANCE_DASHBOARD
  ],
  manager: [
    SalaryPermissions.VIEW_SALARY,
    SalaryPermissions.VIEW_SALARY_SLIP,
    SalaryPermissions.VIEW_LEDGER,
    SalaryPermissions.VIEW_REPORTS,
    SalaryPermissions.GENERATE_SALARY,
    SalaryPermissions.EDIT_SALARY,
    SalaryPermissions.VIEW_ADVANCES,
    SalaryPermissions.VIEW_RECOVERIES,
    SalaryPermissions.EXPORT_SLIP
  ],
  driver: [
    SalaryPermissions.VIEW_SALARY,
    SalaryPermissions.VIEW_SALARY_SLIP
  ]
};

/**
 * Check if user has required permission
 */
export function hasPermission(userPermissions: string[], requiredPermission: SalaryPermissions): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(userPermissions: string[], requiredPermissions: SalaryPermissions[]): boolean {
  return requiredPermissions.some(perm => userPermissions.includes(perm));
}

/**
 * Check if user has all of the required permissions
 */
export function hasAllPermissions(userPermissions: string[], requiredPermissions: SalaryPermissions[]): boolean {
  return requiredPermissions.every(perm => userPermissions.includes(perm));
}

/**
 * Middleware to check salary permissions
 */
export function requireSalaryPermission(permission: SalaryPermissions) {
  return (req: any, res: any, next: any) => {
    const userPermissions = req.user?.permissions || [];

    if (!hasPermission(userPermissions, permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission
      });
    }

    next();
  };
}

/**
 * Middleware to check multiple permissions (any)
 */
export function requireAnySalaryPermission(permissions: SalaryPermissions[]) {
  return (req: any, res: any, next: any) => {
    const userPermissions = req.user?.permissions || [];

    if (!hasAnyPermission(userPermissions, permissions)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions
      });
    }

    next();
  };
}

/**
 * Audit log entry for salary operations
 */
export interface SalaryAuditEntry {
  tenantId: string;
  userId: string;
  userRole: string;
  action: string;
  resourceType: 'salary' | 'advance' | 'recovery' | 'payment';
  resourceId: string;
  changes?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create audit log entry
 */
export function createAuditEntry(
  tenantId: string,
  userId: string,
  userRole: string,
  action: string,
  resourceType: 'salary' | 'advance' | 'recovery' | 'payment',
  resourceId: string,
  changes?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): SalaryAuditEntry {
  return {
    tenantId,
    userId,
    userRole,
    action,
    resourceType,
    resourceId,
    changes,
    timestamp: new Date(),
    ipAddress,
    userAgent
  };
}

/**
 * Restricted operations that require specific permissions
 */
export const restrictedOperations = {
  generateSalary: [SalaryPermissions.GENERATE_SALARY],
  approveSalary: [SalaryPermissions.APPROVE_SALARY],
  paySalary: [SalaryPermissions.PAY_SALARY],
  editSalary: [SalaryPermissions.EDIT_SALARY],
  overrideDaywise: [SalaryPermissions.OVERRIDE_DAYWISE],
  createAdvance: [SalaryPermissions.CREATE_ADVANCE],
  approveAdvance: [SalaryPermissions.APPROVE_ADVANCE],
  createRecovery: [SalaryPermissions.CREATE_RECOVERY],
  approveRecovery: [SalaryPermissions.APPROVE_RECOVERY],
  viewFinanceDashboard: [SalaryPermissions.VIEW_FINANCE_DASHBOARD],
  exportReports: [SalaryPermissions.EXPORT_REPORTS]
};
