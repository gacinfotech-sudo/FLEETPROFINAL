# FRESH SAAS PLATFORM ARCHITECTURE
**Date:** 2026-08-16  
**Status:** DESIGN COMPLETE  
**Foundation:** Tenant Integration Contract (cbfbe87) + Legacy Cleanup (40ae212)

---

## EXECUTIVE SUMMARY

This document defines the **complete architecture** for the fresh SaaS Platform Control Plane.

**Core Principle:** Platform is a **control plane above the Tenant CRM**, not a redesign of it.

**Two Separate UX:**
1. **Platform (`/platform/*`)** — Fresh SaaS management interface for Platform Root/Admin
2. **Tenant (existing `/dashboard/*`)** — Unchanged operational CRM for Tenant staff

**No Legacy Code:** All old SaaS implementations removed. Building from clean slate.

**Result:** A professional, clickable Platform that controls the golden Tenant CRM without touching it.

---

## SECTION 1: DIRECTORY STRUCTURE

### 1.1 Backend Structure

```
server/
├── index.ts                          # Main Express app (existing)
├── platform/                         # ✨ NEW PLATFORM DOMAIN
│   ├── auth/
│   │   ├── routes.ts                # Platform login, logout, refresh
│   │   ├── service.ts               # Platform authentication logic
│   │   └── __tests__/
│   ├── dashboard/
│   │   ├── routes.ts                # Platform dashboard KPIs
│   │   ├── service.ts               # Dashboard data aggregation
│   │   └── __tests__/
│   ├── tenants/
│   │   ├── routes.ts                # Tenant CRUD + Tenant 360
│   │   ├── service.ts               # Tenant provisioning logic
│   │   ├── provisioning.ts          # TenantProvisioningService
│   │   └── __tests__/
│   ├── subscriptions/
│   │   ├── routes.ts                # Subscription CRUD, plan changes
│   │   ├── service.ts               # Subscription management
│   │   └── __tests__/
│   ├── billing/
│   │   ├── routes.ts                # Billing, invoices, payments
│   │   ├── monthly-billing.ts       # Monthly invoice generation
│   │   ├── payment-processor.ts     # Payment recording & reconciliation
│   │   └── __tests__/
│   ├── support/
│   │   ├── routes.ts                # Support tickets
│   │   ├── service.ts               # Ticket management
│   │   └── __tests__/
│   ├── audit/
│   │   ├── routes.ts                # Audit log queries
│   │   ├── service.ts               # Audit recording
│   │   └── __tests__/
│   ├── admins/
│   │   ├── routes.ts                # Platform admin management
│   │   ├── service.ts               # Admin provisioning
│   │   └── __tests__/
│   ├── middleware/
│   │   ├── requirePlatformRole.ts   # Guard: requirePlatformRole
│   │   ├── platformAuth.ts          # Platform auth logic
│   │   └── __tests__/
│   ├── types.ts                     # Platform-specific types
│   ├── service.ts                   # Shared platform service base
│   └── models/
│       ├── Subscription.ts          # Mongoose Subscription model
│       ├── PlatformInvoice.ts       # Mongoose PlatformInvoice model
│       ├── PlatformPayment.ts       # Mongoose PlatformPayment model
│       ├── SupportTicket.ts         # Mongoose SupportTicket model
│       ├── PlatformAdmin.ts         # Mongoose PlatformAdmin model
│       ├── AuditLog.ts              # Mongoose AuditLog model
│       └── __tests__/
│
├── root/                            # ✓ KEEP (Platform auth types, middleware)
│   ├── types.ts                     # PlatformRole (KEEP - core auth)
│   ├── middleware/
│   │   ├── correlationId.ts         # Request correlation (KEEP)
│   │   └── __tests__/
│   └── services/
│       └── rootAccessService.ts     # Platform role checks (KEEP)
│
├── models/                          # ✓ KEEP (existing Tenant models)
│   ├── index.ts                     # Exports: ITenant, IUser, IDriver, etc.
│   └── ...
│
├── routes/                          # ✓ KEEP (existing Tenant routes)
│   ├── drivers.ts
│   ├── customers.ts
│   ├── bookings.ts
│   ├── vehicles.ts
│   └── ... (60+ existing tenant routes)
│
├── middleware/                      # ✓ KEEP (existing auth, tenant)
│   ├── auth.ts                      # authenticateUser (tenant auth)
│   ├── driverAuth.ts                # driver portal auth
│   └── __tests__/
│
├── services/                        # ✓ KEEP (existing business logic)
│   ├── booking/
│   ├── customer/
│   ├── driver/
│   └── ... (30+ existing services)
│
└── storage-mongodb.ts               # ✓ KEEP (existing DB abstraction)
```

### 1.2 Frontend Structure

```
client/src/
├── App.tsx                          # Main router (existing)
├── pages/
│   ├── login.tsx                    # ✓ KEEP (tenant login)
│   ├── dashboard.tsx                # ✓ KEEP (tenant dashboard)
│   ├── platform-login.tsx           # ✨ NEW (platform login)
│   └── platform/                    # ✨ NEW PLATFORM DOMAIN
│       ├── dashboard.tsx            # Platform dashboard
│       ├── tenants/
│       │   ├── list.tsx             # Tenant list
│       │   ├── create.tsx           # Create tenant
│       │   └── 360.tsx              # Tenant 360 detail view
│       ├── subscriptions/
│       │   ├── list.tsx             # Subscription list
│       │   ├── create.tsx           # Assign plan
│       │   └── edit.tsx             # Change plan
│       ├── billing/
│       │   ├── invoices.tsx         # Invoice list
│       │   ├── payments.tsx         # Payment recording
│       │   └── details.tsx          # Invoice detail
│       ├── support/
│       │   ├── tickets.tsx          # Support ticket list
│       │   └── detail.tsx           # Ticket detail
│       ├── admins.tsx               # Platform admin management
│       ├── audit.tsx                # Audit log viewer
│       └── settings.tsx             # Platform settings
│
├── components/
│   ├── platform/                    # ✨ NEW PLATFORM COMPONENTS
│   │   ├── PlatformLayout.tsx       # Platform-only layout
│   │   ├── PlatformSidebar.tsx      # Platform-only navigation
│   │   ├── PlatformHeader.tsx       # Platform header
│   │   ├── TenantCard.tsx           # Tenant summary card
│   │   ├── SubscriptionPanel.tsx    # Subscription display
│   │   ├── BillingPanel.tsx         # Billing summary
│   │   └── ...
│   │
│   ├── admin/                       # ✓ KEEP (tenant notification admin)
│   │   ├── Notification*.tsx        # (all tenant features)
│   │   └── ...
│   │
│   └── ... (existing tenant components)
│
├── hooks/
│   ├── use-auth.ts                  # ✓ KEEP (existing tenant auth)
│   ├── use-platform-auth.ts         # ✨ NEW (platform auth)
│   └── ... (existing tenant hooks)
│
├── lib/
│   ├── queryClient.ts               # ✓ KEEP (React Query)
│   ├── utils.ts                     # ✓ KEEP (existing utilities)
│   └── api-client.ts                # ✨ NEW (platform API client)
│
└── modules/
    └── manifest.ts                  # ✓ KEEP (tenant navigation only)
```

---

## SECTION 2: DOMAIN SEPARATION STRATEGY

### 2.1 Backend Domain Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      EXPRESS APP                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │  PLATFORM DOMAIN     │  │  TENANT CRM DOMAIN (Golden)  │  │
│  │  /api/platform/*     │  │  /api/* (existing)           │  │
│  ├──────────────────────┤  ├──────────────────────────────┤  │
│  │ Auth:                │  │ Auth:                        │  │
│  │  POST /auth/login    │  │  POST /auth/login            │  │
│  │  GET /auth/me        │  │  GET /auth/me                │  │
│  │                      │  │                              │  │
│  │ Routes (Fresh):      │  │ Routes (Existing):           │  │
│  │  GET /tenants        │  │  GET /customers              │  │
│  │  POST /tenants       │  │  GET /drivers                │  │
│  │  GET /subscriptions  │  │  GET /bookings               │  │
│  │  POST /payments      │  │  GET /vehicles               │  │
│  │  GET /invoices       │  │  GET /payments               │  │
│  │  GET /audit          │  │  ... (60+ routes)            │  │
│  │                      │  │                              │  │
│  │ Models (Fresh):      │  │ Models (Existing):           │  │
│  │  Subscription        │  │  Tenant                      │  │
│  │  PlatformInvoice     │  │  User                        │  │
│  │  PlatformPayment     │  │  Customer                    │  │
│  │  SupportTicket       │  │  Booking                     │  │
│  │  AuditLog            │  │  Driver                      │  │
│  │                      │  │  Vehicle                     │  │
│  │ Auth:                │  │ Auth:                        │  │
│  │  requirePlatformRole │  │  authenticateUser            │  │
│  │  (checks platform*)  │  │  (checks tenant role)        │  │
│  │                      │  │                              │  │
│  │ DB Isolation:        │  │ DB Isolation:                │  │
│  │  Query by platform   │  │  Query by tenantId           │  │
│  │  (cross-tenant OK)   │  │  (single tenant only)        │  │
│  │                      │  │                              │  │
│  │ Zero Legacy Code     │  │ Zero Changes                 │  │
│  └──────────────────────┘  └──────────────────────────────┘  │
│                                                               │
│              Shared Dependencies:                             │
│              - MongoDB connection                            │
│              - Logger                                        │
│              - Error handling                                │
│              - Session middleware                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Frontend Domain Boundaries

```
App.tsx
  ├─ <Switch> (wouter router)
  │
  ├─ Routes: / (landing)
  │
  ├─ TENANT ROUTES (existing, protected by tenantId)
  │  ├─ /login → LoginPage (tenant staff)
  │  ├─ /dashboard → Dashboard (tenant operations)
  │  ├─ /customers, /drivers, /vehicles, /bookings, etc.
  │  └─ Protected by: ProtectedRoute + authenticateUser (tenantId required)
  │
  ├─ PLATFORM ROUTES (fresh, protected by platformRole)
  │  ├─ /platform/login → PlatformLoginPage (platform admin)
  │  ├─ /platform/dashboard → PlatformDashboard (KPIs)
  │  ├─ /platform/tenants → TenantList
  │  ├─ /platform/tenants/:id → Tenant360
  │  ├─ /platform/subscriptions → SubscriptionList
  │  ├─ /platform/billing → BillingDashboard
  │  └─ Protected by: PlatformProtectedRoute + isPlatformRole (platformRole required)
  │
  ├─ DRIVER ROUTES (existing, separate portal)
  │  ├─ /driver-login → DriverLoginPage
  │  ├─ /driver → DriverPortal
  │  └─ Protected by: separate driver auth (sessionId-based)
  │
  └─ FALLBACK: 404 or redirect to landing
```

---

## SECTION 3: AUTHENTICATION ARCHITECTURE

### 3.1 Platform Auth Flow

```
User: Platform Root → Browser → /platform/login

1. Frontend: PlatformLoginPage
   Input: userId, password
   
2. POST /api/platform/auth/login (NEW)
   Request:
   {
     "userId": "platform_root",
     "password": "<secure>"
   }
   
3. Backend: server/platform/auth/routes.ts
   - Look up User by userId
   - Check user.platformRole is defined (not null/undefined)
   - Verify password hash matches
   - Check user.isActive = true
   - Create new session: req.session.userId = user.userId
   - Create new deviceInfo, activeSessions entry
   - Write audit log: PLATFORM_LOGIN
   
4. Response:
   {
     "userId": "platform_root",
     "platformRole": "PLATFORM_ROOT",
     "tenantId": null,
     "sessionId": "abc123xyz",
     "createdAt": "2026-08-16T12:00:00Z"
   }
   
5. Frontend: Store token (JWT or session cookie)
   
6. Redirect: /platform/dashboard
   
7. PlatformLayout renders (with PlatformSidebar, PlatformHeader)
   - Navigation: Dashboard, Tenants, Subscriptions, Billing, etc.

---

8. Protected Route: PlatformProtectedRoute
   - Check: req.user?.platformRole is truthy
   - If missing/falsy: redirect to /platform/login
   - If present: render component
```

### 3.2 Tenant Auth Flow (Unchanged)

```
User: Tenant Staff → Browser → /login

1. Frontend: LoginPage (existing)
   Input: userId, password
   
2. POST /api/auth/login (existing)
   
3. Backend: server/middleware/auth.ts (existing)
   - Look up User by userId
   - Check user.platformRole is NOT defined (null/undefined)
   - Verify password hash
   - Check user.isActive = true
   - Create session: req.session.userId = user.userId
   
4. Response:
   {
     "userId": "tenant_manager_1",
     "role": "manager",
     "tenantId": "507f1f77bcf86cd799439011",
     "sessionId": "xyz789abc"
   }
   
5. Frontend: Redirect to /dashboard
   
6. TenantLayout renders (with TenantSidebar, existing Dashboard)
   - Navigation: Customers, Bookings, Drivers, etc.
   
7. Protected Route: ProtectedRoute (existing)
   - Check: req.tenantId matches user tenantId
   - Render component
```

### 3.3 Auth Middleware Separation

```
server/middleware/auth.ts (KEEP - Tenant Auth)
├─ authenticateUser()
│  └─ Check session.userId exists
│  └─ Verify User document still active
│  └─ Verify role ∈ ['admin', 'client', 'manager']
│  └─ Extract tenantId from user.tenantId
│  └─ Set req.user, req.userId, req.tenantId
│
└─ Usage: All /api/* routes (tenant operations)

server/platform/middleware/requirePlatformRole.ts (NEW - Platform Auth)
├─ requirePlatformRole(roles: PlatformRole[])
│  └─ Check session.userId exists
│  └─ Verify User document still active
│  └─ Verify platformRole ∈ roles (PLATFORM_ROOT, PLATFORM_ADMIN, etc.)
│  └─ Verify tenantId is NULL (platform staff, not tenant staff)
│  └─ Set req.user, req.platformRole
│
└─ Usage: All /api/platform/* routes
```

---

## SECTION 4: DATA MODEL ISOLATION

### 4.1 Platform Models (Fresh)

```typescript
// server/platform/models/Subscription.ts
interface ISubscription {
  _id: ObjectId;
  tenantId: ObjectId;              // Reference to Tenant (canonical)
  planId: ObjectId;                // Reference to Plan
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  startDate: Date;                 // Subscription effective date
  nextBillingDate: Date;           // When next invoice will be generated
  periodStart: Date;               // Current billing period start
  periodEnd: Date;                 // Current billing period end
  status: 'trial' | 'active' | 'renewal_due' | 'payment_due' 
          | 'grace_period' | 'locked' | 'suspended' | 'cancelled';
  priceSnapshot: number;           // Price at time of subscription
  taxSnapshot: number;             // Tax rate at time of subscription
  features?: {                     // Optional feature overrides
    userLimit?: number;
    driverLimit?: number;
    vehicleLimit?: number;
  };
  graceUntil?: Date;               // Grace period end date (if payment_due)
  createdAt: Date;
  modifiedAt?: Date;
}

// server/platform/models/PlatformInvoice.ts
interface IPlatformInvoice {
  _id: ObjectId;
  invoiceNumber: string;           // "INV-2026-08-0001"
  tenantId: ObjectId;              // Reference to Tenant
  subscriptionId: ObjectId;        // Reference to Subscription
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subtotal: number;                // Amount before tax
  tax: number;                     // Tax amount
  total: number;                   // subtotal + tax
  paid: number;                    // Amount already paid
  outstanding: number;             // total - paid
  dueDate: Date;
  status: 'draft' | 'issued' | 'partial' | 'paid' 
          | 'overdue' | 'void' | 'cancelled';
  items?: [{                       // Line items (optional detail)
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }];
  notes?: string;
  createdAt: Date;
  issuedAt?: Date;
}

// server/platform/models/PlatformPayment.ts
interface IPlatformPayment {
  _id: ObjectId;
  invoiceId: ObjectId;
  tenantId: ObjectId;              // Denormalized for fast queries
  amount: number;
  paymentDate: Date;
  method: 'bank_transfer' | 'upi' | 'card' 
          | 'cash' | 'cheque' | 'crypto';
  reference: string;               // Transaction ID, check #, etc.
  status: 'pending' | 'cleared' | 'failed' | 'refunded';
  failureReason?: string;          // If status = failed
  reconciliationDate?: Date;       // When payment was confirmed
  createdAt: Date;
  createdBy: string;               // Platform admin who recorded it
}

// server/platform/models/SupportTicket.ts
interface ISupportTicket {
  _id: ObjectId;
  ticketNumber: string;            // "TKT-2026-08-0001"
  tenantId: ObjectId;              // Which tenant opened ticket
  createdBy: string;               // userId (tenant user or platform admin)
  subject: string;
  description: string;
  category: 'billing' | 'technical' | 'feature' 
            | 'performance' | 'security' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in_progress' 
          | 'waiting' | 'resolved' | 'reopened' | 'closed';
  assignedTo?: string;             // Platform admin userId
  attachments?: [{
    url: string;
    name: string;
    uploadedAt: Date;
  }];
  comments?: [{
    author: string;
    text: string;
    createdAt: Date;
  }];
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
}

// server/platform/models/AuditLog.ts
interface IAuditLog {
  _id: ObjectId;
  actor: string;                   // userId (platform admin)
  action: string;                  // 'TENANT_CREATED', 'PAYMENT_RECORDED', etc.
  resource: string;               // 'tenant', 'subscription', 'payment', etc.
  resourceId: string;              // _id of the resource
  changes?: {                      // What changed (optional)
    before: any;
    after: any;
  };
  status: 'success' | 'failure';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
```

### 4.2 Tenant Models (Keep Existing)

**NO CHANGES** to existing models:
- `Tenant` (no new fields added)
- `User` (already has `platformRole` optional field from Step 1)
- `Customer`, `Booking`, `Driver`, `Vehicle`, `Payment`, etc. (unchanged)

**Platform can reference but NOT modify:**
```typescript
// Platform queries canonical Tenant data
const tenant = await Tenant.findById(tenantId);  // READ-ONLY
const customers = await Customer.find({ tenantId });  // COUNT, READ-ONLY
const bookings = await Booking.find({ tenantId, createdAt: { $gte: startOfMonth } });  // ANALYTICS
```

---

## SECTION 5: API ROUTE STRUCTURE

### 5.1 Platform API Routes

```
POST   /api/platform/auth/login              ← Platform Root login
GET    /api/platform/auth/me                 ← Get current platform user
POST   /api/platform/auth/logout             ← Platform logout
POST   /api/platform/auth/refresh            ← Refresh token (if JWT)

GET    /api/platform/dashboard               ← Platform KPIs (real data)
GET    /api/platform/dashboard/stats         ← Extended stats

GET    /api/platform/tenants                 ← List all tenants (paginated)
POST   /api/platform/tenants                 ← Create new tenant
GET    /api/platform/tenants/:id             ← Tenant detail
PATCH  /api/platform/tenants/:id             ← Update tenant
DELETE /api/platform/tenants/:id             ← Soft-delete tenant
POST   /api/platform/tenants/:id/lock        ← Lock tenant (suspend)
POST   /api/platform/tenants/:id/unlock      ← Unlock tenant

GET    /api/platform/tenants/:id/users       ← List tenant users
POST   /api/platform/tenants/:id/users       ← Create tenant user/owner

GET    /api/platform/plans                   ← List plans
POST   /api/platform/plans                   ← Create plan
PATCH  /api/platform/plans/:id               ← Update plan

GET    /api/platform/subscriptions           ← List all subscriptions
GET    /api/platform/tenants/:id/subscription ← Tenant's subscription
POST   /api/platform/subscriptions           ← Create subscription
PATCH  /api/platform/subscriptions/:id       ← Update subscription (plan change)
POST   /api/platform/subscriptions/:id/renew ← Force renewal

GET    /api/platform/invoices                ← List all invoices (paginated)
GET    /api/platform/invoices/:id            ← Invoice detail (PDF downloadable)
POST   /api/platform/invoices                ← Manual invoice creation
POST   /api/platform/invoices/:id/void       ← Void invoice

POST   /api/platform/payments                ← Record payment
GET    /api/platform/payments                ← List payments (paginated)
GET    /api/platform/payments/:id            ← Payment detail
PATCH  /api/platform/payments/:id            ← Update payment (refund, etc.)

GET    /api/platform/support                 ← List support tickets
POST   /api/platform/support                 ← Create support ticket
GET    /api/platform/support/:id             ← Ticket detail
PATCH  /api/platform/support/:id             ← Update ticket (status, assign)
POST   /api/platform/support/:id/comments    ← Add comment

GET    /api/platform/audit                   ← Audit log (paginated, filtered)
GET    /api/platform/audit/:id               ← Single audit entry

GET    /api/platform/admins                  ← List platform admins
POST   /api/platform/admins                  ← Create platform admin
PATCH  /api/platform/admins/:id              ← Update admin
DELETE /api/platform/admins/:id              ← Deactivate admin

GET    /api/platform/company                 ← Platform company profile
PATCH  /api/platform/company                 ← Update company profile

POST   /api/platform/settings                ← Update settings (e.g., grace period)
GET    /api/platform/settings                ← Get current settings
```

### 5.2 Tenant API Routes (Unchanged)

All existing `/api/*` routes continue to work:
```
/api/auth/*
/api/customers/*
/api/drivers/*
/api/vehicles/*
/api/bookings/*
/api/payments/*
/api/dashboard
... (60+ existing routes, unchanged)
```

---

## SECTION 6: PLATFORM FEATURES BY PHASE

### Phase 1: Foundation (Step 4-10)
- ✅ Platform Root bootstrap
- ✅ Platform login (fresh auth)
- ✅ Database schema (Subscription, Invoice, Payment models)
- ✅ TenantProvisioningService (atomic Tenant creation)
- ✅ Tenant CRUD (create, read, update)

### Phase 2: Core Platform (Step 11-20)
- ✅ Platform Dashboard (real KPIs from Tenant data)
- ✅ Tenant 360 (detail view, users, subscription)
- ✅ Plan management (create, assign to tenants)
- ✅ Subscriptions (assign plan, change plan, renewal logic)
- ✅ Monthly billing (auto-generate invoices)
- ✅ Payment recording (update invoice status)
- ✅ Renewal engine (auto-extend subscriptions)

### Phase 3: Platform Ops (Step 21-30)
- ✅ Platform Admin provisioning
- ✅ Support Ticket system
- ✅ Error Center (cross-tenant issue aggregation)
- ✅ Audit Logging (all platform actions)
- ✅ Tenant Lock (suspend without data deletion)
- ✅ Grace Period (payment_due → locked progression)

### Phase 4: Integration & Testing (Step 31-50)
- ✅ E2E tests (create tenant → owner login → tenant CRM access)
- ✅ Subscription tests (plan assignment, billing, renewal)
- ✅ Payment tests (recording, reconciliation)
- ✅ Cross-tenant isolation tests
- ✅ Tenant CRM regression tests (no operational breakage)

---

## SECTION 7: ROUTING WIRING

### 7.1 server/index.ts Integration

```typescript
// server/index.ts

import express from 'express';
import { authenticateUser } from './middleware/auth';
import { isPlatformRole } from './root/types';

const app = express();

// Existing middleware
app.use(express.json());
app.use(session({...}));

// ✨ PLATFORM DOMAIN (Fresh)
import { registerPlatformAuthRoutes } from './platform/auth/routes';
import { registerPlatformDashboardRoutes } from './platform/dashboard/routes';
import { registerPlatformTenantRoutes } from './platform/tenants/routes';
import { registerPlatformSubscriptionRoutes } from './platform/subscriptions/routes';
import { registerPlatformBillingRoutes } from './platform/billing/routes';
import { registerPlatformSupportRoutes } from './platform/support/routes';
import { registerPlatformAuditRoutes } from './platform/audit/routes';
import { registerPlatformAdminRoutes } from './platform/admins/routes';

// Guard: requirePlatformRole
const requirePlatformRole = (roles: PlatformRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Auth required" });
    }
    // ... check isPlatformRole, verify roles
    next();
  };
};

// Platform routes (fresh)
app.use('/api/platform/auth', registerPlatformAuthRoutes());
app.use('/api/platform', 
  authenticateUser,
  (req, res, next) => requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])(req, res, next),
  registerPlatformDashboardRoutes(),
);
app.use('/api/platform/tenants',
  authenticateUser,
  (req, res, next) => requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])(req, res, next),
  registerPlatformTenantRoutes(),
);
// ... etc for other platform routes

// ✓ TENANT ROUTES (Keep existing)
import { registerCustomerRoutes } from './routes/customers';
import { registerDriverRoutes } from './routes/drivers';
// ... etc

app.use('/api/customers', authenticateUser, registerCustomerRoutes());
app.use('/api/drivers', authenticateUser, registerDriverRoutes());
// ... etc (all existing tenant routes, unchanged)

app.listen(5050);
```

### 7.2 client/src/App.tsx Integration

```typescript
// client/src/App.tsx

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const { platformUser } = usePlatformAuth();

  return (
    <Switch>
      {/* Existing Tenant Routes */}
      <Route path="/" component={LandingPage} />
      
      <Route path="/login">
        {loading ? <Spinner /> : user ? <Dashboard /> : <LoginPage />}
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/customers">
        <ProtectedRoute>
          <CustomerList />
        </ProtectedRoute>
      </Route>
      
      {/* ... (60+ existing tenant routes) */}

      {/* ✨ NEW Platform Routes */}
      <Route path="/platform/login">
        {loading ? <Spinner /> : platformUser ? <PlatformDashboard /> : <PlatformLoginPage />}
      </Route>

      <Route path="/platform/dashboard">
        <PlatformProtectedRoute>
          <PlatformDashboard />
        </PlatformProtectedRoute>
      </Route>

      <Route path="/platform/tenants">
        <PlatformProtectedRoute>
          <TenantList />
        </PlatformProtectedRoute>
      </Route>

      <Route path="/platform/tenants/:id">
        <PlatformProtectedRoute>
          <Tenant360 />
        </PlatformProtectedRoute>
      </Route>

      {/* ... (other platform routes) */}

      {/* Fallback */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}
```

---

## SECTION 8: ZERO LEGACY PRINCIPLES

This architecture enforces:

✅ **NO Duplicate Tenant Models**
- Platform does NOT create separate Tenant, User, Customer collections
- Platform references canonical collections via tenantId

✅ **NO Duplicate UI**
- Tenant UI at `/dashboard/*` (existing)
- Platform UI at `/platform/*` (fresh)
- Never mixed in same page

✅ **NO Crossed Auth**
- Tenant user cannot access `/api/platform/*` (fails requirePlatformRole)
- Platform user cannot access `/api/customers` (no tenantId, isolated from Tenant data)
- Driver has separate auth (unchanged)

✅ **NO Legacy Code**
- All `server/root/routes/*` orphaned files deleted
- All `client/src/pages/admin/HealthDashboard.tsx` deleted
- All imports cleaned in `server/routes.ts`

✅ **Fresh Platform Domain**
- `server/platform/` directory (all fresh code)
- Fresh models, fresh routes, fresh UI components
- Clean separation from existing Tenant CRM

---

## SECTION 9: EXPECTED OUTCOMES

### After Full Implementation

**Platform Root Can:**
- ✅ Login to `/platform/login`
- ✅ Access `/platform/dashboard` (see real KPIs)
- ✅ Create Tenant (provision new Tenant + Owner + first invoice)
- ✅ View all Tenants in `/platform/tenants`
- ✅ Access Tenant 360 (details, users, subscription, billing)
- ✅ Assign Plan to Tenant
- ✅ Generate monthly invoices
- ✅ Record payments
- ✅ View audit log
- ✅ Manage support tickets

**Tenant Owner Can:**
- ✅ Login to `/login` (unchanged)
- ✅ Access `/dashboard` (unchanged)
- ✅ Manage customers, bookings, drivers (unchanged)
- ✅ View their subscription status (optional read-only panel)
- ❌ Cannot access `/platform/*` (no platformRole)

**System Integrity:**
- ✅ No data loss from old SaaS removal
- ✅ No Tenant CRM regressions
- ✅ Complete cross-tenant isolation
- ✅ All 87 MongoDB collections intact
- ✅ All 1,730+ customers preserved
- ✅ All operational bookings preserved

---

## SECTION 10: IMPLEMENTATION ROADMAP

### Ready to Implement

1. **Database Schema Creation** (server/platform/models/*)
   - Subscription, PlatformInvoice, PlatformPayment, SupportTicket, AuditLog
   - All indexed for query performance

2. **Platform Auth Service** (server/platform/auth/*)
   - Fresh login flow (separate from tenant auth)
   - Requireplatform role middleware

3. **TenantProvisioningService** (server/platform/tenants/provisioning.ts)
   - Atomic creation of Tenant + Owner + initial Subscription
   - Error handling, rollback

4. **Platform Dashboard** (server/platform/dashboard/*, client/src/pages/platform/dashboard.tsx)
   - Real KPIs from canonical Tenant data
   - All cards clickable (link to detail pages)

5. **Tenant 360** (server/platform/tenants/routes.ts, client/src/pages/platform/tenants/360.tsx)
   - Tenant details, users, subscription, billing overview
   - Tabs for different sections

6. **Plans & Subscriptions** (server/platform/subscriptions/*)
   - Plan creation, assignment, change plan, renewal

7. **Monthly Billing** (server/platform/billing/monthly-billing.ts)
   - Cron job to generate invoices on subscription anniversary
   - Automatic status transitions (active → renewal_due → payment_due → grace → locked)

8. **Payments** (server/platform/billing/payment-processor.ts)
   - Record payment against invoice
   - Update subscription status upon payment

9. **Support & Audit** (server/platform/support/*, server/platform/audit/*)
   - Support ticket CRUD
   - Comprehensive audit logging

10. **Frontend Components** (client/src/pages/platform/*, client/src/components/platform/*)
    - PlatformLayout, PlatformSidebar, PlatformDashboard
    - Pages for all Platform features

---

## SIGN-OFF

**Architecture Status:** ✅ COMPLETE  
**Foundation:** Tenant Integration Contract + Legacy Cleanup  
**Ready for Implementation:** YES  

**Next Step:** Step 4 - PLATFORM-DATA-MODEL.md (detailed schema definitions and migration strategy)

