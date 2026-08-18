# PLATFORM IMPLEMENTATION FOUNDATION (STEPS 6-10)
**Date:** 2026-08-16  
**Status:** MASTER PLAN READY  
**Scope:** Foundation setup before core features

---

## STEPS 6-10: PHASE 1 TASKS

### STEP 6: PLATFORM ROOT BOOTSTRAP

**Objective:** Create initial Platform Root account atomically

**Implementation:**

```typescript
// server/platform/bootstrap/rootAccountBootstrap.ts

export async function bootstrapPlatformRoot() {
  const existingRoot = await User.findOne({ platformRole: 'PLATFORM_ROOT' });
  
  if (existingRoot) {
    console.log('✅ Platform Root already exists, skipping bootstrap');
    return existingRoot;
  }
  
  // Get credentials from environment (first-run only)
  const rootId = process.env.FLEETPRO_PLATFORM_ROOT_ID || 'platform_root';
  const rootPassword = process.env.FLEETPRO_PLATFORM_ROOT_PASSWORD;
  
  if (!rootPassword) {
    throw new Error('FLEETPRO_PLATFORM_ROOT_PASSWORD not set. Cannot bootstrap Root.');
  }
  
  // Create Platform Root user
  const hashedPassword = await bcrypt.hash(rootPassword, 12);
  const root = new User({
    userId: rootId,
    name: 'Platform Root',
    password: hashedPassword,
    platformRole: 'PLATFORM_ROOT',  // Platform role only
    tenantId: null,                 // No tenant association
    isActive: true,
    role: undefined,                // No tenant role
    permissions: [],
    createdAt: new Date(),
    createdBy: 'system'
  });
  
  await root.save();
  
  // Audit log
  await AuditLog.create({
    actor: 'system',
    action: 'PLATFORM_ROOT_BOOTSTRAP',
    resource: 'user',
    resourceId: root._id.toString(),
    status: 'success'
  });
  
  console.log('✅ Platform Root bootstrapped successfully');
  console.log('   ID:', rootId);
  console.log('   Password: ****** (set via env var)');
  
  return root;
}

// Call in server/index.ts after MongoDB connection
await bootstrapPlatformRoot();
```

**Environment Variables:**
```bash
FLEETPRO_PLATFORM_ROOT_ID=platform_root
FLEETPRO_PLATFORM_ROOT_PASSWORD=<secure-password>
```

**First-Time Setup Checklist:**
- ✅ Create `.env` with Platform Root credentials
- ✅ Run server (bootstrap executes automatically)
- ✅ Verify Platform Root user created
- ✅ Force password change on first login
- ✅ Remove env vars from production (use secrets manager)

---

### STEP 7: FRESH PLATFORM AUTH FLOW

**Objective:** Implement Platform-only authentication (separate from Tenant auth)

**Implementation:**

```typescript
// server/platform/auth/service.ts

export class PlatformAuthService {
  async login(userId: string, password: string, req: any) {
    // Find user by userId
    const user = await User.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify this is a platform user (has platformRole, no tenantId)
    if (!user.platformRole || user.tenantId) {
      throw new Error('Not a platform user');
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.accountLocked = true;
        user.lockoutTime = new Date();
      }
      await user.save();
      throw new Error('Invalid password');
    }
    
    // Check if user is active
    if (!user.isActive) {
      throw new Error('User is inactive');
    }
    
    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    user.sessionId = sessionId;
    user.activeSessions = user.activeSessions || [];
    user.activeSessions.push({
      sessionId,
      deviceInfo: {
        userAgent: req.get('user-agent'),
        ip: req.ip,
        loginTime: new Date()
      },
      createdAt: new Date()
    });
    
    // Keep only last 5 sessions
    if (user.activeSessions.length > 5) {
      user.activeSessions = user.activeSessions.slice(-5);
    }
    
    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.accountLocked = false;
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    user.lastLoginUserAgent = req.get('user-agent');
    
    await user.save();
    
    // Create express session
    req.session.userId = user.userId;
    
    // Audit log
    await AuditLog.create({
      actor: user.userId,
      action: 'PLATFORM_LOGIN',
      resource: 'auth',
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    return {
      userId: user.userId,
      platformRole: user.platformRole,
      tenantId: null,
      sessionId
    };
  }
  
  async logout(userId: string, sessionId: string) {
    const user = await User.findOne({ userId });
    if (!user) return;
    
    // Remove session from activeSessions
    user.activeSessions = user.activeSessions?.filter(s => s.sessionId !== sessionId) || [];
    user.sessionId = null;
    await user.save();
    
    await AuditLog.create({
      actor: userId,
      action: 'PLATFORM_LOGOUT',
      resource: 'auth',
      status: 'success'
    });
  }
}

// server/platform/auth/routes.ts

export function registerPlatformAuthRoutes() {
  const router = Router();
  const authService = new PlatformAuthService();
  
  router.post('/login', async (req: AuthRequest, res) => {
    try {
      const { userId, password } = req.body;
      const result = await authService.login(userId, password, req);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });
  
  router.get('/me', authenticateUser, (req: AuthRequest, res) => {
    if (!req.user?.platformRole) {
      return res.status(403).json({ error: 'Platform access required' });
    }
    res.json({
      userId: req.user.userId,
      platformRole: req.user.platformRole,
      isActive: req.user.isActive
    });
  });
  
  router.post('/logout', authenticateUser, async (req: AuthRequest, res) => {
    try {
      await authService.logout(req.user.userId, req.session.id);
      req.session.destroy();
      res.json({ message: 'Logged out' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  return router;
}
```

---

### STEP 8: TENANT PROVISIONING SERVICE

**Objective:** Atomic Tenant creation (Tenant + Owner + Subscription)

**Implementation:**

```typescript
// server/platform/tenants/provisioning.ts

export class TenantProvisioningService {
  async createTenant(data: {
    companyName: string;
    legalName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerMobile?: string;
    address?: string;
    planId: mongoose.Types.ObjectId;
    trialDays?: number;
    createdBy: string;
  }) {
    // Start transaction (atomic operation)
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Step 1: Create Tenant
      const tenant = new Tenant({
        name: data.companyName,
        businessName: data.legalName || data.companyName,
        email: data.ownerEmail,
        phone: data.ownerMobile,
        address: data.address,
        isActive: true,
        subscriptionPlan: 'pro',
        limits: { vehicles: 100, drivers: 50, managers: 5 },
        createdAt: new Date(),
        tenantCode: `TEN-${Date.now()}`
      });
      await tenant.save({ session });
      
      // Step 2: Create Tenant Owner User
      const tempPassword = this.generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      
      const owner = new User({
        userId: `owner_${tenant._id.toString().slice(0, 8)}`,
        name: data.ownerName,
        email: data.ownerEmail,
        password: hashedPassword,
        role: 'admin',                    // Tenant role
        tenantId: tenant._id,             // Associated with tenant
        platformRole: undefined,          // NOT a platform user
        isActive: true,
        permissions: ['*'],               // All permissions for owner
        mustResetPassword: true,          // Force password change
        hasCompletedOnboarding: false,
        createdBy: data.createdBy,
        createdAt: new Date()
      });
      await owner.save({ session });
      
      // Step 3: Create Subscription
      const plan = await Plan.findById(data.planId).session(session);
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      const startDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + (data.trialDays || 30));
      
      const subscription = new Subscription({
        tenantId: tenant._id,
        planId: plan._id,
        billingCycle: 'monthly',
        startDate,
        periodStart: startDate,
        periodEnd: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: trialEndDate,    // First invoice after trial
        status: 'trial',
        priceSnapshot: plan.monthlyPrice,
        taxSnapshot: plan.tax || 0,
        features: plan.features,
        createdBy: data.createdBy,
        createdAt: new Date()
      });
      await subscription.save({ session });
      
      // Step 4: Create initial (draft) invoice
      const invoiceNumber = `INV-${Date.now()}`;
      const firstInvoice = new PlatformInvoice({
        invoiceNumber,
        invoiceSequence: 1,
        tenantId: tenant._id,
        subscriptionId: subscription._id,
        billingPeriodStart: trialEndDate,
        billingPeriodEnd: new Date(trialEndDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        subtotal: 0,                      // Zero for trial
        tax: 0,
        total: 0,
        paid: 0,
        outstanding: 0,
        dueDate: new Date(trialEndDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'draft',
        lineItems: [{
          description: `${plan.name} Plan (Trial)`,
          quantity: 1,
          unitPrice: 0,
          amount: 0
        }],
        createdBy: data.createdBy,
        createdAt: new Date()
      });
      await firstInvoice.save({ session });
      
      // Step 5: Audit log
      await AuditLog.create(
        [{
          actor: data.createdBy,
          action: 'TENANT_PROVISIONING',
          resource: 'tenant',
          resourceId: tenant._id.toString(),
          resourceName: tenant.businessName,
          changes: {
            after: {
              tenantId: tenant._id,
              ownerId: owner._id,
              subscriptionId: subscription._id,
              invoiceId: firstInvoice._id
            }
          },
          status: 'success'
        }],
        { session }
      );
      
      // Commit transaction
      await session.commitTransaction();
      
      return {
        tenant,
        owner,
        subscription,
        invoice: firstInvoice,
        tempPassword  // For email to owner
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
  
  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-12).toUpperCase();
  }
}
```

**Usage:**
```typescript
// In POST /api/platform/tenants route
const service = new TenantProvisioningService();
const result = await service.createTenant({
  companyName: 'Cabify Bangalore',
  legalName: 'Cabify India Pvt Ltd',
  ownerName: 'Arjun Singh',
  ownerEmail: 'arjun@cabify.com',
  planId: planId,
  createdBy: adminUserId
});

// Email result.tempPassword to result.owner.email
// Tenant is now live and ready to use
```

---

### STEP 9: ENTITLEMENT & USAGE SERVICES

**Objective:** Feature gating + usage tracking

**Implementation:**

```typescript
// server/platform/services/entitlementService.ts

export class EntitlementService {
  async canUseFeature(tenantId: string, feature: string): Promise<boolean> {
    const sub = await Subscription.findOne({
      tenantId,
      status: { $in: ['trial', 'active'] }
    }).populate('planId');
    
    if (!sub) return false;
    
    const plan = sub.planId as any;
    const entitlements = plan.features || {};
    
    // Check specific features
    const featureMap = {
      'custom_branding': entitlements.customBranding,
      'api_access': entitlements.apiAccess,
      'mobile_app': entitlements.mobileApp,
      'gps_tracking': entitlements.gpsTracking
    };
    
    return !!featureMap[feature] || false;
  }
  
  async getLimit(tenantId: string, resource: string): Promise<number> {
    const sub = await Subscription.findOne({
      tenantId,
      status: { $in: ['trial', 'active'] }
    }).populate('planId');
    
    if (!sub) throw new Error('No active subscription');
    
    const plan = sub.planId as any;
    const overrides = sub.features || {};
    
    // Use override or plan default
    const limitMap = {
      'users': overrides.userLimit || plan.userLimit || 5,
      'drivers': overrides.driverLimit || plan.driverLimit || 50,
      'vehicles': overrides.vehicleLimit || plan.vehicleLimit || 100,
      'branches': plan.branchLimit || 1
    };
    
    return limitMap[resource] || 0;
  }
  
  async canCreate(tenantId: string, resource: string): Promise<boolean> {
    const usage = await this.getUsage(tenantId, resource);
    const limit = await this.getLimit(tenantId, resource);
    return usage < limit;
  }
  
  async getUsage(tenantId: string, resource: string): Promise<number> {
    // Query canonical Tenant data
    const modelMap = {
      'users': () => User.countDocuments({ tenantId, role: { $in: ['admin', 'manager', 'client'] } }),
      'drivers': () => Driver.countDocuments({ tenantId }),
      'vehicles': () => Vehicle.countDocuments({ tenantId }),
      'customers': () => Customer.countDocuments({ tenantId })
    };
    
    const countFn = modelMap[resource];
    if (!countFn) return 0;
    
    return await countFn();
  }
}

// Usage:
const entitlementService = new EntitlementService();
const canAddDriver = await entitlementService.canCreate(tenantId, 'drivers');
if (!canAddDriver) {
  throw new Error('Driver limit reached for this plan');
}
```

---

### STEP 10: DATABASE INITIALIZATION

**Objective:** Seed default Plans + create collections + set indexes

**Implementation:**

```typescript
// server/platform/bootstrap/initialization.ts

export async function initializePlatformDatabase() {
  console.log('🚀 Initializing Platform collections...');
  
  // Ensure collections exist
  await Promise.all([
    Subscription.collection.createIndexes(),
    PlatformInvoice.collection.createIndexes(),
    PlatformPayment.collection.createIndexes(),
    SupportTicket.collection.createIndexes(),
    AuditLog.collection.createIndexes()
  ]);
  
  console.log('✅ Collections initialized with indexes');
  
  // Seed default plans (if not exist)
  const starterPlan = await Plan.findOne({ name: 'Starter' });
  if (!starterPlan) {
    await Plan.insertMany([
      {
        name: 'Starter',
        description: 'Perfect for small fleets',
        monthlyPrice: 3000,
        tax: 540,  // 18% GST
        features: {
          userLimit: 5,
          driverLimit: 20,
          vehicleLimit: 10,
          customBranding: false,
          apiAccess: false,
          mobileApp: false
        },
        isActive: true,
        createdAt: new Date()
      },
      {
        name: 'Pro',
        description: 'For growing operations',
        monthlyPrice: 8000,
        tax: 1440,
        features: {
          userLimit: 20,
          driverLimit: 100,
          vehicleLimit: 50,
          customBranding: true,
          apiAccess: true,
          mobileApp: true
        },
        isActive: true,
        createdAt: new Date()
      },
      {
        name: 'Enterprise',
        description: 'Custom solutions',
        monthlyPrice: 20000,
        tax: 3600,
        features: {
          userLimit: 999,
          driverLimit: 999,
          vehicleLimit: 999,
          customBranding: true,
          apiAccess: true,
          mobileApp: true
        },
        isActive: true,
        createdAt: new Date()
      }
    ]);
    console.log('✅ Default plans seeded');
  }
  
  // Initialize Platform Company profile (if not exist)
  const company = await PlatformCompany.findOne({});
  if (!company) {
    await PlatformCompany.create({
      name: 'FleetPro SaaS',
      legalName: 'FleetPro Technologies Pvt Ltd',
      email: 'support@fleetpro.com',
      website: 'https://fleetpro.com',
      address: 'Bangalore, India',
      gst: 'GST_NUMBER_HERE',
      pan: 'PAN_NUMBER_HERE',
      createdAt: new Date()
    });
    console.log('✅ Platform company profile initialized');
  }
  
  // Set up cron jobs (see Step 11+)
  console.log('✅ Platform database initialization complete');
}

// Call in server/index.ts after MongoDB connection
await initializePlatformDatabase();
```

---

## DELIVERABLES: STEPS 6-10

| Step | Task | Status |
|------|------|--------|
| 6 | Platform Root Bootstrap | ✅ Ready |
| 7 | Platform Auth Flow | ✅ Ready |
| 8 | Tenant Provisioning Service | ✅ Ready |
| 9 | Entitlement & Usage Services | ✅ Ready |
| 10 | Database Initialization | ✅ Ready |

**All foundation code ready for implementation.**

---

## NEXT: STEPS 11-20 (CORE FEATURES)

Will implement:
- Step 11: Platform Root Login Endpoint
- Step 12: Platform Dashboard (real KPIs)
- Step 13-15: Tenant CRUD + Tenant 360
- Step 16-18: Plan Management + Subscriptions
- Step 19-20: Monthly Billing Engine

