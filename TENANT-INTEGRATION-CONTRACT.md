# TENANT INTEGRATION CONTRACT
**Date:** 2026-08-16  
**Status:** AUDIT COMPLETE — Foundation for Fresh SaaS Platform  
**Purpose:** Define canonical Tenant CRM contracts that the SaaS Platform must respect and integrate with

---

## EXECUTIVE SUMMARY

The FleetPro **Tenant CRM** is a production-grade multi-tenant operations platform serving **24 active tenants** with **87 MongoDB collections** containing:

- **1,730+ Customers**
- **1,381+ Bookings**
- **Drivers, Vehicles, Payments, Finance, WhatsApp, Notifications**
- **Full role-based access control**

The new **SaaS Platform** is a control plane that sits **above and around** this existing Tenant CRM.

The Platform will NOT redesign, duplicate, or reimport Tenant data.

The Platform WILL use the existing Tenant identity systems and query the canonical Tenant database.

---

## SECTION 1: CANONICAL TENANT IDENTITY

### 1.1 Tenant Model

**Collection:** `tenants`  
**Canonical Identity Field:** `_id` (MongoDB ObjectId, stringified: tenantId)

```typescript
interface ITenant {
  _id: ObjectId;              // tenantId (canonical)
  name: string;               // Tenant business name
  businessName: string;       // Legal business name
  email?: string;             // Tenant contact email
  phone?: string;             // Tenant contact phone
  address?: string;           // Business address
  isActive: boolean;          // Operational status
  maxManagers: number;        // User limit config
  subscriptionPlan: string;   // 'starter' | 'pro' | 'custom'
  limits: {
    vehicles: number;
    drivers: number;
    managers: number;
  };
  serviceModes?: {            // self-drive, with-driver, etc.
    selfDrive: boolean;
    withDriver: boolean;
  };
  timezone?: string;          // IANA timezone (default: Asia/Kolkata)
  operationsSettings?: {...}; // Booking end reminders, WhatsApp configs
  createdAt: Date;
  tenantCode?: string;        // (NEW) Platform reference code
  trialStartsAt?: Date;       // (NEW) Platform trial dates
  trialEndsAt?: Date;         // (NEW)
  usageCounters?: {           // (NEW) Platform usage tracking
    bookingsThisMonth: number;
    lastActivityAt?: Date;
  };
  healthRiskFlag?: string;    // (NEW) 'none' | 'watch' | 'at_risk'
  internalNotes?: [{          // (NEW) Platform support notes
    note: string;
    authorId: string;
    authorName?: string;
    createdAt: Date;
  }];
}
```

**Canonical Usage:**
- Every Platform operation references `tenantId` as MongoDB ObjectId
- Every Tenant CRM operation filters by `tenantId`
- No separate "SaaS Tenant" collection; this IS the tenant

---

### 1.2 User Model (Tenant Staff)

**Collection:** `users`  
**Canonical Identity Fields:** `userId` (string), `tenantId` (ref)

```typescript
interface IUser {
  _id: ObjectId;                    // MongoDB internal
  userId: string;                   // Canonical unique login
  name?: string;                    // User name
  password: string;                 // bcrypt hash
  role: 'admin' | 'client' | 'manager';  // Tenant staff role (NOT platform)
  platformRole?: PlatformRole;      // (NEW) Platform staff role (separate axis)
  tenantId?: ObjectId;              // Tenant this user belongs to
  sessionId?: string;               // Legacy single-device session
  activeSessions?: [{               // Multi-device sessions (new)
    sessionId: string;
    deviceInfo?: {userAgent, ip, loginTime};
    createdAt?: Date;
  }];
  lastLogin?: Date;
  isActive: boolean;                // Soft-delete status
  mustResetPassword: boolean;       // Force password change
  permissions: string[];            // Role-based permission array
  createdAt: Date;
}
```

**Canonical Usage:**
- Login via `userId` + `password` creates `sessionId`
- Session tied to both `tenantId` (tenant CRM scope) and `platformRole` (if platform staff)
- Tenant users have `role` only; no `platformRole`
- Platform users have `platformRole` only; may have `tenantId=null`

---

### 1.3 Platform Role Axis (NEW)

**Type:** `PlatformRole` (separate from tenant `role`)

```typescript
type PlatformRole = 
  | 'PLATFORM_ROOT'      // SaaS owner
  | 'PLATFORM_ADMIN'     // Platform staff
  | 'PLATFORM_SUPPORT'   // Support ticket handling
  | 'PLATFORM_FINANCE'   // Billing/invoicing
  | undefined;           // (default) Not platform staff
```

**Critical Contract:**
- `platformRole` is an **orthogonal axis** to tenant `role`
- A Platform Admin has `platformRole='PLATFORM_ADMIN'` and `tenantId=null`
- A Tenant Owner has `role='admin'` and `tenantId=<actual-tenant>`
- They are **never mixed**: if user has `platformRole`, they do NOT have tenant `role`
- Backend enforces: `isPlatformRole(user.platformRole)` guards Platform routes

---

### 1.4 Authentication Contract

**Session Storage:**
- Express session (configurable backend: memory, Redis, MongoDB)
- Session data: `{userId, sessionId, deviceInfo}`
- Routes authenticate: `authenticateUser` middleware checks session validity

**Login Flow (Tenant):**
```
POST /api/auth/login
  userId: "fleet_root_admin_1d2af76b"
  password: "Gac@#12345"
→ Lookup User by userId
→ Verify password hash
→ Create sessionId
→ Set req.session.userId
→ Return {userId, role, tenantId, token}
→ Frontend stores token (JWT refresh or bearer)
→ Protected routes check authenticateUser middleware
```

**Platform Auth Flow (NEW):**
```
POST /api/platform/auth/login
  userId: "platform_root"
  password: "<secure>"
→ Lookup User by userId
→ Verify platformRole exists
→ Create sessionId
→ Set req.session.userId
→ Return {userId, platformRole, tenantId: null}
→ Frontend stores token
→ Protected routes check isPlatformRole()
```

---

## SECTION 2: EXISTING TENANT OPERATIONALDATA

### 2.1 Core Domain Models (Do NOT duplicate)

These models are the operational heart of FleetPro. The Platform reads them; does not write/duplicate.

**Customer**
- `customerId`, `tenantId`, `name`, `phone`, `email`, `address`
- **Count:** 1,730+
- **Platform Usage:** SaaS dashboard shows total customers per tenant

**Booking**
- `bookingId`, `tenantId`, `customerId`, `vehicleId`, `status`, `startDate`, `endDate`, `amount`
- **Count:** 1,381+
- **Platform Usage:** SaaS dashboard shows monthly booking volume

**Driver**
- `driverId`, `tenantId`, `name`, `phone`, `status`, `dateOfJoining`
- **Platform Usage:** SaaS dashboard shows active drivers

**Vehicle**
- `vehicleId`, `tenantId`, `licensePlate`, `status`, `pricePerDay`, `type`
- **Platform Usage:** SaaS dashboard shows fleet size

**Payment**
- `paymentId`, `tenantId`, `bookingId`, `amount`, `status`, `method`
- **Platform Usage:** SaaS dashboard shows revenue trends

**Expense, WhatsApp, Notification, Attendance, Leave, Salary, etc.**
- All scoped to `tenantId`
- All read-only from Platform perspective
- All use canonical Tenant CRM schemas

---

### 2.2 Tenant API Conventions

**Namespace:**
- Operational tenant routes: `/api/*` (existing)
- Example: `/api/customers`, `/api/drivers`, `/api/bookings`

**Authentication:**
- `authenticateUser` middleware validates session
- `requireTenant` middleware (if present) extracts `tenantId` from session
- Role checks (admin, manager, etc.) are tenant-scoped

**Tenant Isolation:**
- Every query filters by `tenantId` from authenticated session
- Cross-tenant data access is impossible even with valid session if `tenantId` differs
- No shared "global" dashboard; each tenant sees only their own data

**Error Handling:**
- 401 = not authenticated
- 403 = authenticated but not authorized (wrong tenant, insufficient role)
- 400 = bad input
- 500 = server error

---

### 2.3 Tenant UI Conventions

**Routes:**
- `/` → public landing
- `/login` → Tenant staff login
- `/dashboard` → Tenant operational dashboard
- `/customers`, `/drivers`, `/vehicles`, `/bookings`, etc. → Tenant modules
- All protected by `ProtectedRoute` component
- Role-based sidebar navigation from manifest

**Components:**
- `Sidebar` (tenant navigation)
- `Dashboard` (tenant KPIs)
- Module pages (Customer List, Driver 360, etc.)
- All render tenant-scoped data

**No Platform UI mixed in Tenant dashboard.**

---

## SECTION 3: PLATFORM SEPARATION CONTRACT

### 3.1 Platform Domain (NEW)

**Responsibility:** SaaS lifecycle, billing, tenants, admins, support, security

**Models (Fresh, not copied):**
- `PlatformTenant` (reference to existing Tenant, plus SaaS metadata)
- `Subscription` (plan, billing cycle, status)
- `PlatformInvoice` (SaaS invoice, not operational invoice)
- `PlatformPayment` (SaaS payment, not booking payment)
- `PlatformAdmin` (staff, not tenant user)
- `SupportTicket` (cross-tenant support)
- `AuditLog` (platform actions)

**Namespace:**
- `/api/platform/*` (all platform endpoints)
- `/platform/*` (all platform routes)

**Authentication:**
- Platform Root login via `/platform/login`
- Platform Role check via `isPlatformRole()`
- No tenant scoping (platform admins see all tenants)

**Database Isolation:**
- Platform collections separate from Tenant collections
- Platform collections never mixed into Tenant queries
- Separate indexes, separate schemas

---

### 3.2 Two Separate Application Experiences

**Experience A: Platform Control Plane** (`/platform/*`)
- User: Platform Root, Platform Admin
- Roles: PLATFORM_ROOT, PLATFORM_ADMIN, PLATFORM_SUPPORT, PLATFORM_FINANCE
- Data: Tenants, Subscriptions, Invoices, Payments, Support, Audit
- UI: PlatformLayout, PlatformSidebar, PlatformDashboard
- Auth: Platform login via userId + platformRole

**Experience B: Tenant CRM** (existing `/dashboard/*`, `/customers/*`, etc.)
- User: Tenant Owner, Tenant Manager, Tenant Agent
- Roles: admin, client, manager
- Data: Customers, Bookings, Drivers, Vehicles, Finance
- UI: TenantLayout, TenantSidebar, Dashboard
- Auth: Tenant login via userId + tenantId

**Never mixed:** A Platform Admin does NOT see Tenant operationaldashboard; a Tenant user does NOT see Platform billing.

---

### 3.3 Tenant Provisioning Boundary

**Scenario:** Platform Root creates a new Tenant

```typescript
POST /api/platform/tenants
{
  companyName: "Cabify Bangalore",
  ownerName: "Arjun",
  ownerEmail: "arjun@cabify.com",
  plan: "pro",
  billingCycle: "monthly"
}
→ TenantProvisioningService.createTenant()
  → Create Tenant (existing schema)
  → Create Tenant Owner (existing User schema, tenantId=<new-id>, role='admin')
  → Create Subscription (new SaaS schema)
  → Create first PlatformInvoice (0 due for trial)
  → Write audit log
  → Return {tenantId, subscriptionId}
→ Platform Root can now access Tenant 360
→ Tenant Owner can now login via Tenant UI
  → See only their own Tenant operationaldata
  → Cannot access Platform
```

**Integration:** The Tenant Owner created here is a real `User` in the canonical database with the same identity as any Tenant staff.

---

## SECTION 4: AUTHORIZATION MATRIX

### 4.1 Platform Routes (Protected by `isPlatformRole`)

```
✓ GET  /api/platform/dashboard
✓ GET  /api/platform/tenants
✓ POST /api/platform/tenants (create new tenant)
✓ GET  /api/platform/tenants/:id
✓ GET  /api/platform/tenants/:id/users
✓ POST /api/platform/tenants/:id/users (provision tenant staff)
✓ GET  /api/platform/plans
✓ GET  /api/platform/subscriptions
✓ POST /api/platform/subscriptions/:id/change-plan
✓ GET  /api/platform/invoices
✓ GET  /api/platform/invoices/:id
✓ POST /api/platform/payments (record payment)
✓ GET  /api/platform/support
✓ POST /api/platform/audit
✗ NO CROSSOVER: Cannot query /api/customers even if platform admin
```

### 4.2 Tenant Routes (Protected by `authenticateUser + tenantId`)

```
✓ GET  /api/dashboard
✓ GET  /api/customers
✓ POST /api/customers
✓ GET  /api/drivers
✓ GET  /api/vehicles
✓ GET  /api/bookings
✓ GET  /api/payments
✗ NO CROSSOVER: Cannot query /api/platform/tenants even if tenant admin
```

### 4.3 User Role x Action Matrix

**Platform Root:**
- Create Tenant
- Manage Subscriptions
- Approve Payments
- Manage Platform Admins
- View Audit Log
- Support Escalations

**Tenant Owner (admin role in their tenant):**
- Manage Customers
- Create Bookings
- Manage Drivers
- Manage Finances
- Invite Tenant Staff
- View their own Subscription status (view-only from Tenant UI, or via Platform if granted)

**Platform support cannot directly edit Tenant data** (no override access); they can only manage support tickets and tenant status.

---

## SECTION 5: DATA CONTRACTS

### 5.1 Tenant Data (Do NOT duplicate into Platform)

Platform may **reference** but NOT **copy**:

- Customer count
- Booking volume
- Driver count
- Vehicle count
- Total revenue

**Query Pattern:**
```typescript
// Platform: readonly view of Tenant operational metrics
const metrics = {
  totalCustomers: await db.customers.countDocuments({ tenantId }),
  activeBookings: await db.bookings.countDocuments({ tenantId, status: 'active' }),
  activeDrivers: await db.drivers.countDocuments({ tenantId, status: 'available' }),
  fleetSize: await db.vehicles.countDocuments({ tenantId, status: { $ne: 'inactive' } })
};
```

---

### 5.2 Platform Data (Fresh, Owned by Platform)

**Subscription:**
```typescript
interface Subscription {
  _id: ObjectId;
  tenantId: ObjectId;           // Reference to existing Tenant
  planId: ObjectId;             // Reference to Plan
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  startDate: Date;
  nextBillingDate: Date;
  status: 'trial' | 'active' | 'renewal_due' | 'payment_due' | 'locked' | 'cancelled';
  priceSnapshot: number;        // Price at subscription time
  taxSnapshot: number;          // Tax at subscription time
  createdAt: Date;
}
```

**PlatformInvoice:**
```typescript
interface PlatformInvoice {
  _id: ObjectId;
  invoiceNumber: string;        // "INV-2026-08-0001"
  tenantId: ObjectId;           // Reference to existing Tenant
  subscriptionId: ObjectId;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: Date;
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void';
  createdAt: Date;
}
```

**PlatformPayment:**
```typescript
interface PlatformPayment {
  _id: ObjectId;
  invoiceId: ObjectId;
  tenantId: ObjectId;           // Denormalized for fast querying
  amount: number;
  paymentDate: Date;
  method: 'bank_transfer' | 'upi' | 'card' | 'cash' | 'cheque';
  reference: string;            // txn id, check number, etc.
  status: 'pending' | 'cleared' | 'failed' | 'refunded';
  createdAt: Date;
}
```

---

## SECTION 6: SECURITY CONTRACTS

### 6.1 Session Isolation

**Requirement:** A Tenant session must never gain Platform access; a Platform session must never access Tenant data.

**Enforcement:**

1. **Platform Route Guard:**
   ```typescript
   const guardPlatformRoute = (req, res, next) => {
     if (!isPlatformRole(req.user?.platformRole)) {
       return res.status(403).json({message: "Platform access required"});
     }
     next();
   };
   ```

2. **Tenant Route Guard (existing):**
   ```typescript
   const authenticateUser = (req, res, next) => {
     if (!req.session?.userId) {
       return res.status(401).json({message: "Auth required"});
     }
     // Existing logic ensures req.user and req.tenantId are populated
     next();
   };
   ```

3. **Query-Level Filtering:**
   - Tenant routes: `db.customers.find({ tenantId: req.tenantId })`
   - Platform routes: No tenant filter (cross-tenant visibility is intentional)

---

### 6.2 Credential Storage

**Root Account (First-Time Only):**
- NO hardcoded credentials in source code
- Environment variables: `FLEETPRO_PLATFORM_ROOT_INITIAL_ID`, `FLEETPRO_PLATFORM_ROOT_INITIAL_PASSWORD`
- On first run, create User with these credentials, then **lock the env var from being read again**
- Force password change on first login
- Subsequent restarts must NOT re-seed

---

### 6.3 Cross-Tenant Data Leakage Prevention

**Audit:** Every query that filters by tenantId is intentional.

**Test:** Login as Tenant A, attempt to access Tenant B customers → 403 Forbidden (or empty result).

---

## SECTION 7: EXISTING TENANT SYSTEM REFERENCE

### 7.1 Current Database

**Host:** `127.0.0.1:27017`  
**Database:** `fleetpro`  
**Collections:** 87  
**Tenants:** 24 active  
**Total Records:**
- Customers: 1,730+
- Bookings: 1,381+
- Drivers: (present)
- Vehicles: (present)
- Users: (present)

---

### 7.2 Current Frontend

**Entry:** `https://localhost:5050`  
**Login:** `/login`  
**Dashboard:** `/dashboard`  
**Modules:** `/customers`, `/drivers`, `/vehicles`, `/bookings`, `/payments`, etc.  
**Navigation:** Manifest-driven (56 items)  
**Auth Middleware:** `ProtectedRoute`, `useAuth`

---

### 7.3 Current Backend

**Server:** Express.js  
**Port:** 5050 (HTTPS)  
**Auth Middleware:** `authenticateUser`, `requireTenant` (if present)  
**API Namespace:** `/api/*`  
**Database Client:** MongoDB via Mongoose

---

## SECTION 8: PLATFORM CONTRACTS TO IMPLEMENT

### 8.1 Platform Root Identity

**Cannot be a Tenant User.**

**Must be:**
```typescript
{
  userId: string;                // e.g., "platform_root"
  password: bcrypt hash;
  platformRole: 'PLATFORM_ROOT';
  tenantId: null;                // Not associated with any tenant
  isActive: true;
  createdAt: Date;
}
```

---

### 8.2 Platform Admin Identity

**Cannot be a Tenant User.**

**May exist for dedicated SaaS staff:**
```typescript
{
  userId: string;                // e.g., "platform_admin_pradeep"
  password: bcrypt hash;
  platformRole: 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_FINANCE';
  tenantId: null;                // Not associated with any tenant
  isActive: true;
}
```

---

### 8.3 Tenant Owner Identity (Bridges Platform and Tenant)

**IS a canonical Tenant User:**
```typescript
{
  userId: string;                // e.g., "arjun_cabify_owner"
  password: bcrypt hash;
  role: 'admin';                 // Tenant role (NOT platform role)
  tenantId: <tenant-id>;         // Associated with specific tenant
  platformRole: undefined;       // NOT platform staff
  isActive: true;
}
```

**Can log into:**
- Tenant UI: `/login` → `/dashboard`
- Cannot access Platform at all

---

### 8.4 Tenant Staff Identity

**IS a canonical Tenant User:**
```typescript
{
  userId: string;                // e.g., "manager_cabify_raj"
  password: bcrypt hash;
  role: 'manager' | 'client';    // Tenant role
  tenantId: <tenant-id>;         // Associated with specific tenant
  platformRole: undefined;       // NOT platform staff
  isActive: true;
}
```

---

## SECTION 9: EXPECTED OUTCOMES

### 9.1 After SaaS Platform Implementation

**Platform Root can:**
- ✅ Login to Platform
- ✅ Create new Tenant
- ✅ View all Tenants in list
- ✅ View Tenant 360 (details, subscription, billing)
- ✅ Assign Plan to Tenant
- ✅ Generate monthly invoices
- ✅ Record payments
- ✅ View audit log
- ✅ Support tickets

**Tenant Owner can:**
- ✅ Login to Tenant UI (existing)
- ✅ See customers, bookings, drivers, vehicles (existing)
- ✅ View their subscription status (new, might be read-only panel in Tenant UI)
- ❌ Cannot access Platform `/platform/*`

**Cross-Tenant Data Leakage:**
- ❌ Tenant A cannot see Tenant B data
- ❌ Tenant A staff cannot access Platform even if granted

**Operational Data Integrity:**
- ✅ No duplicate customer/booking/driver data in Platform
- ✅ Platform reads canonical operational data, does not copy
- ✅ All operational CRUD remains in Tenant UI

---

## SECTION 10: NEXT STEPS

This contract serves as the foundation for:

1. **Step 2:** Identify Tenant's canonical fields (already done above)
2. **Step 3:** Remove legacy SaaS artifacts
3. **Step 4:** Create Platform domain structure
4. **Step 5:** Fresh Platform Root
5. ... (continuing through 50 steps)

---

## SIGN-OFF

**Contract Author:** SaaS Architecture Team  
**Review Status:** APPROVED FOR IMPLEMENTATION  
**Effective Date:** 2026-08-16  
**Last Updated:** 2026-08-16

