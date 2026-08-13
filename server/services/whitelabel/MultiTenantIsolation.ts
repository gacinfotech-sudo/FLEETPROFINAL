interface TenantConfig {
  tenantId: string;
  name: string;
  domain: string;
  customDomain?: string;
  status: "active" | "inactive" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

interface TenantRBAC {
  tenantId: string;
  roles: Map<string, string[]>; // role -> permissions
  users: Map<string, string>; // userId -> role
}

interface UsageQuota {
  tenantId: string;
  maxUsers: number;
  maxBookings: number;
  maxStorage: number; // GB
  maxApiCalls: number; // per day
  currentUsers: number;
  currentBookings: number;
  currentStorage: number;
  currentApiCalls: number;
  resetDate: Date;
}

interface BillingInfo {
  tenantId: string;
  plan: "starter" | "professional" | "enterprise";
  monthlyFee: number;
  usageOverageFee: number;
  invoiceEmail: string;
  paymentMethod: string;
  status: "active" | "past_due" | "cancelled";
  nextBillingDate: Date;
}

export class MultiTenantIsolation {
  private tenants: Map<string, TenantConfig> = new Map();
  private rbac: Map<string, TenantRBAC> = new Map();
  private quotas: Map<string, UsageQuota> = new Map();
  private billing: Map<string, BillingInfo> = new Map();
  private domainMap: Map<string, string> = new Map(); // domain -> tenantId

  /**
   * Create a new tenant
   */
  createTenant(tenantId: string, name: string, domain: string): TenantConfig {
    const tenant: TenantConfig = {
      tenantId,
      name,
      domain,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tenants.set(tenantId, tenant);
    this.domainMap.set(domain, tenantId);

    // Initialize RBAC
    const rbac: TenantRBAC = {
      tenantId,
      roles: new Map([
        ["admin", ["read", "write", "delete", "manage_users", "manage_billing"]],
        ["manager", ["read", "write", "delete"]],
        ["user", ["read"]],
      ]),
      users: new Map(),
    };
    this.rbac.set(tenantId, rbac);

    // Initialize quota
    const quota: UsageQuota = {
      tenantId,
      maxUsers: 100,
      maxBookings: 10000,
      maxStorage: 100,
      maxApiCalls: 100000,
      currentUsers: 0,
      currentBookings: 0,
      currentStorage: 0,
      currentApiCalls: 0,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    this.quotas.set(tenantId, quota);

    // Initialize billing
    const billingInfo: BillingInfo = {
      tenantId,
      plan: "starter",
      monthlyFee: 2999,
      usageOverageFee: 0,
      invoiceEmail: "",
      paymentMethod: "",
      status: "active",
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    this.billing.set(tenantId, billingInfo);

    return tenant;
  }

  /**
   * Get tenant by ID or domain
   */
  getTenant(identifier: string): TenantConfig | undefined {
    // Try as tenantId first
    let tenant = this.tenants.get(identifier);
    if (tenant) return tenant;

    // Try as domain
    const tenantId = this.domainMap.get(identifier);
    if (tenantId) {
      return this.tenants.get(tenantId);
    }

    return undefined;
  }

  /**
   * Set custom domain for tenant
   */
  setCustomDomain(tenantId: string, customDomain: string): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");

    // Remove old custom domain from map if exists
    if (tenant.customDomain) {
      this.domainMap.delete(tenant.customDomain);
    }

    tenant.customDomain = customDomain;
    this.domainMap.set(customDomain, tenantId);
  }

  /**
   * Add user to tenant with role
   */
  addUser(tenantId: string, userId: string, role: string): void {
    const rbac = this.rbac.get(tenantId);
    if (!rbac) throw new Error("Tenant not found");

    if (!rbac.roles.has(role)) {
      throw new Error(`Role ${role} not found`);
    }

    rbac.users.set(userId, role);

    // Update quota
    const quota = this.quotas.get(tenantId);
    if (quota) {
      quota.currentUsers++;
    }
  }

  /**
   * Remove user from tenant
   */
  removeUser(tenantId: string, userId: string): void {
    const rbac = this.rbac.get(tenantId);
    if (!rbac) throw new Error("Tenant not found");

    if (rbac.users.delete(userId)) {
      const quota = this.quotas.get(tenantId);
      if (quota) {
        quota.currentUsers--;
      }
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(tenantId: string, userId: string, permission: string): boolean {
    const rbac = this.rbac.get(tenantId);
    if (!rbac) return false;

    const role = rbac.users.get(userId);
    if (!role) return false;

    const permissions = rbac.roles.get(role);
    return permissions ? permissions.includes(permission) : false;
  }

  /**
   * Get user's role
   */
  getUserRole(tenantId: string, userId: string): string | undefined {
    const rbac = this.rbac.get(tenantId);
    return rbac ? rbac.users.get(userId) : undefined;
  }

  /**
   * Update user role
   */
  updateUserRole(tenantId: string, userId: string, newRole: string): void {
    const rbac = this.rbac.get(tenantId);
    if (!rbac) throw new Error("Tenant not found");

    if (!rbac.roles.has(newRole)) {
      throw new Error(`Role ${newRole} not found`);
    }

    rbac.users.set(userId, newRole);
  }

  /**
   * Create custom role
   */
  createRole(tenantId: string, roleName: string, permissions: string[]): void {
    const rbac = this.rbac.get(tenantId);
    if (!rbac) throw new Error("Tenant not found");

    rbac.roles.set(roleName, permissions);
  }

  /**
   * Check quota limit
   */
  checkQuota(tenantId: string, resource: keyof UsageQuota): boolean {
    const quota = this.quotas.get(tenantId);
    if (!quota) return false;

    const key = `max${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
    const currentKey = `current${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;

    const maxValue = (quota as any)[key];
    const currentValue = (quota as any)[currentKey];

    return currentValue < maxValue;
  }

  /**
   * Increment usage
   */
  incrementUsage(tenantId: string, resource: string, amount: number = 1): void {
    const quota = this.quotas.get(tenantId);
    if (!quota) return;

    const key = `current${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
    (quota as any)[key] += amount;
  }

  /**
   * Get usage quota
   */
  getQuota(tenantId: string): UsageQuota | undefined {
    return this.quotas.get(tenantId);
  }

  /**
   * Get billing info
   */
  getBillingInfo(tenantId: string): BillingInfo | undefined {
    return this.billing.get(tenantId);
  }

  /**
   * Update billing plan
   */
  updateBillingPlan(tenantId: string, plan: "starter" | "professional" | "enterprise"): void {
    const billing = this.billing.get(tenantId);
    if (!billing) throw new Error("Tenant not found");

    const planPrices = {
      starter: 2999,
      professional: 9999,
      enterprise: 29999,
    };

    billing.plan = plan;
    billing.monthlyFee = planPrices[plan];

    // Update quotas based on plan
    const quota = this.quotas.get(tenantId);
    if (quota) {
      switch (plan) {
        case "starter":
          quota.maxUsers = 100;
          quota.maxBookings = 10000;
          quota.maxApiCalls = 100000;
          break;
        case "professional":
          quota.maxUsers = 500;
          quota.maxBookings = 100000;
          quota.maxApiCalls = 1000000;
          break;
        case "enterprise":
          quota.maxUsers = 5000;
          quota.maxBookings = 1000000;
          quota.maxApiCalls = 10000000;
          break;
      }
    }
  }

  /**
   * Suspend tenant
   */
  suspendTenant(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");

    tenant.status = "suspended";
  }

  /**
   * Reactivate tenant
   */
  reactivateTenant(tenantId: string): void {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");

    tenant.status = "active";
  }

  /**
   * List all users in tenant
   */
  listUsers(tenantId: string): Array<{ userId: string; role: string }> {
    const rbac = this.rbac.get(tenantId);
    if (!rbac) return [];

    return Array.from(rbac.users.entries()).map(([userId, role]) => ({
      userId,
      role,
    }));
  }

  /**
   * List all roles in tenant
   */
  listRoles(tenantId: string): Array<{ role: string; permissions: string[] }> {
    const rbac = this.rbac.get(tenantId);
    if (!rbac) return [];

    return Array.from(rbac.roles.entries()).map(([role, permissions]) => ({
      role,
      permissions,
    }));
  }
}
