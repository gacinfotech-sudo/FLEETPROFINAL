# PLATFORM PHASES 2-4 ROADMAP (STEPS 11-50)
**Date:** 2026-08-16  
**Status:** MASTER PLAN COMPLETE  
**Scope:** Steps 11-50 (Core Features → Release Gate)

---

## PHASE 2: CORE FEATURES (STEPS 11-20)

### Step 11: Platform Root Login Endpoint
- Implement POST /api/platform/auth/login
- Delegate to PlatformAuthService.login()
- Return sessionId + platformRole
- Handle errors: 401 (bad creds), 400 (validation)
- Audit log: PLATFORM_LOGIN success/failure

### Step 12: Platform Dashboard (Real KPIs)
- GET /api/platform/dashboard
- Query canonical Tenant data:
  - totalTenants = Tenant.count()
  - activeTenants = Subscription.count({status:'active'})
  - trialTenants = Subscription.count({status:'trial'})
  - monthlyRevenue = PlatformPayment.sum(amount) for current month
  - paymentsDue = Invoice.sum(outstanding) where status='payment_due'
- Return in JSON (no static cards)
- Cache results for 5 minutes

### Step 13: Tenant List & Pagination
- GET /api/platform/tenants
- Query: page, limit, status, search
- Return paginated Tenant array
- Include subscription status denormalized
- Sort by createdAt desc

### Step 14: Tenant 360 Detail View
- GET /api/platform/tenants/:id
- Return Tenant + Owner + Subscription
- Query Tenant operational metrics:
  - activeCustomers = Customer.count({tenantId})
  - totalBookings = Booking.count({tenantId})
  - activeDrivers = Driver.count({tenantId, status:'available'})
  - fleetSize = Vehicle.count({tenantId})
- Tab structure: Overview | Users | Subscription | Usage | Billing | Support | Errors | History

### Step 15: Create Tenant Endpoint
- POST /api/platform/tenants
- Call TenantProvisioningService.createTenant()
- Return tenant + owner + subscription + tempPassword
- Send email to owner with temp password & login instructions
- Update owner.mustResetPassword = true

### Step 16: Plan Management
- GET /api/platform/plans (list with features)
- POST /api/platform/plans (create new plan)
- PATCH /api/platform/plans/:id (update)
- Seed 3 defaults: Starter ($3K), Pro ($8K), Enterprise ($20K)

### Step 17: Subscriptions - Assign Plan
- POST /api/platform/subscriptions
- Create Subscription for tenant
- Set nextBillingDate = startDate + billingCycle
- Set status = 'active'
- Create initial draft invoice

### Step 18: Subscriptions - Change Plan
- PATCH /api/platform/subscriptions/:id
- Update planId, priceSnapshot
- Prorate if mid-period (optional for MVP)
- Update nextBillingDate

### Step 19: Monthly Billing Cron
- Cron job: 1st of each month at 2 AM
- Find subscriptions where nextBillingDate <= today AND status IN ['active', 'renewal_due']
- For each: Create PlatformInvoice (issued status)
- Generate invoiceNumber sequentially
- Update subscription.nextBillingDate = today + billingCycle
- Update subscription.status = 'renewal_due'

### Step 20: Payment Recording
- POST /api/platform/payments
- Accept invoiceId, amount, method, reference
- Create PlatformPayment (status: pending)
- Atomically update PlatformInvoice:
  - paid += amount
  - outstanding = total - paid
  - status = (paid == total) ? 'paid' : 'partial'
  - lastPaymentId = payment._id

---

## PHASE 3: PLATFORM OPERATIONS (STEPS 21-30)

### Step 21: Platform Admins Management
- GET /api/platform/admins (list)
- POST /api/platform/admins (create)
- Support roles: PLATFORM_ADMIN, PLATFORM_SUPPORT, PLATFORM_FINANCE
- Assign specific permissions based on role

### Step 22: Support Tickets - Create
- POST /api/platform/support
- Tenant users OR platform admins can create
- Set SLA deadlines:
  - CRITICAL: 4 hours response, 1 day resolution
  - HIGH: 8 hours response, 3 days resolution
  - MEDIUM: 24 hours response, 7 days resolution
  - LOW: 48 hours response, 14 days resolution

### Step 23: Support Tickets - List & Assign
- GET /api/platform/support (with filters: status, priority, assignedTo)
- PATCH /api/platform/support/:id (assign, update status)
- POST /api/platform/support/:id/comments (add comment)
- Support private comments (admin only)

### Step 24: Error Center
- Aggregate cross-tenant errors
- GET /api/platform/errors
- Show by: frequency, severity, impact (how many tenants)
- Link to audit log for affected tenants
- (Optional: integrate with existing error reporting)

### Step 25: Audit Logging (Comprehensive)
- Log every Platform API mutation:
  - TENANT_CREATED, TENANT_UPDATED, TENANT_LOCKED
  - SUBSCRIPTION_ASSIGNED, SUBSCRIPTION_CHANGED
  - INVOICE_GENERATED, INVOICE_VOIDED
  - PAYMENT_RECORDED, PAYMENT_REFUNDED
  - ADMIN_PROVISIONED, ADMIN_DEACTIVATED
- Include: actor, action, resource, status, changes (before/after), error message
- Retention: 1 year auto-delete via TTL index

### Step 26: Tenant Lock (Soft Suspension)
- POST /api/platform/tenants/:id/lock
- Set subscription.status = 'locked'
- Tenant login still works (show payment screen)
- Tenant operations blocked (return 403 "Subscription locked")
- Data NOT deleted
- Audit log: TENANT_LOCKED with reason

### Step 27: Grace Period Logic
- If invoice unpaid after 30 days: status = 'payment_due'
- Subscription automatically transitions:
  - active → renewal_due (invoice generated)
  - renewal_due → payment_due (dueDate passed)
  - payment_due → grace_period (2 weeks)
  - grace_period → locked (2 weeks passed)
- Cron job daily to check and transition

### Step 28: Forced Renewal
- POST /api/platform/subscriptions/:id/renew
- Manually extend subscription
- Create new invoice immediately
- Update periodStart/End, nextBillingDate

### Step 29: Refund Processing
- PATCH /api/platform/payments/:id
- Set status = 'refunded'
- Reverse PlatformInvoice.paid -= refund.amount
- Recalculate outstanding
- Audit log refund reason

### Step 30: Invoice PDF Generation
- GET /api/platform/invoices/:id with `?format=pdf`
- Generate PDF using pdfkit or similar
- Include: company logo, invoice number, tenant details, line items, terms
- Return as download or base64

---

## PHASE 4: INTEGRATION & TESTING (STEPS 31-50)

### Steps 31-35: Frontend Platform UI

**Step 31: PlatformLayout & Navigation**
- Sidebar: Dashboard, Tenants, Subscriptions, Billing, Support, Audit, Admins, Settings
- Header: Platform logo, current user, settings, logout
- Role-based menu (PLATFORM_ROOT sees all, PLATFORM_FINANCE sees billing only)

**Step 32: Platform Login Page**
- Form: userId + password
- Call POST /api/platform/auth/login
- Store sessionId
- Redirect to /platform/dashboard

**Step 33: Platform Dashboard UI**
- Cards: Total Tenants, Active, Trial, Revenue, Payments Due, Open Tickets
- All cards are clickable (link to relevant list)
- No static "Coming Soon" labels
- Charts: Revenue trend (line), Tenant status distribution (pie)

**Step 34: Tenant Management UI**
- TenantList: searchable, paginated, status filter
- Create Tenant form: company name, owner, plan, trial days
- Tenant 360: tabs as above
- Buttons: Edit, Lock, Unlock, Change Plan, View Users

**Step 35: Billing & Payments UI**
- InvoiceList: status filter, date range, unpaid only
- PaymentRecording form: invoice select, amount, method, reference
- Payment history table: date, amount, method, status
- Outstanding dashboard: top unpaid invoices by tenant

### Steps 36-40: Integration & Services

**Step 36: TenantPlatformBridge**
- Service that translates Platform actions to existing Tenant data
- getCanonicalTenantMetrics(tenantId) → queries Tenant CRM
- lockTenantAccess(tenantId) → sets subscription.status
- unlockTenantAccess(tenantId) → restores subscription.status
- Single source of truth for tenant integration logic

**Step 37: Monthly Billing Automation**
- Cron job: runs on 1st of each month
- idempotent: if invoice already exists, skip
- Error handling: log failures, retry next day
- Notifications: email tenant about new invoice

**Step 38: Payment Reconciliation**
- Background job: daily
- Match PlatformPayment.reference to bank statements (manual for MVP)
- Auto-update status to 'cleared' when verified
- Notify tenant when invoice is paid

**Step 39: Renewal Notifications**
- Cron job: 14 days before renewal_due
- Email tenant: "Your subscription renews in 2 weeks"
- Email admin: "Check if this customer is paying"

**Step 40: SLA Monitoring**
- Cron job: daily
- Find support tickets with SLA breaches
- Flag for admin review
- Dashboard alert: "X tickets breached SLA"

### Steps 41-45: E2E Testing

**Step 41: Create Tenant E2E Test**
- Admin login → create tenant form → submit
- Verify: Tenant created, Owner created, Subscription created
- Verify: Temp password emailed to owner
- Verify: Dashboard shows new tenant

**Step 42: Tenant Owner Login Test**
- Use temp password from Step 41
- Force password reset
- Login with new password
- Verify: Tenant UI loads (existing /dashboard)
- Verify: No access to /platform/* routes

**Step 43: Tenant Staff Provisioning Test**
- Admin creates manager for tenant
- Login as manager
- Verify: Access to tenant UI with correct permissions
- Verify: Cannot access platform routes

**Step 44: Monthly Billing Test**
- Create tenant on Day 1 of month
- Cron runs on Day 1
- Verify: Invoice generated with status=issued
- Verify: Invoice emailed to tenant
- Verify: Subscription.nextBillingDate updated

**Step 45: Payment Test**
- Record payment against invoice
- Verify: Invoice.paid updated
- Verify: Invoice.outstanding recalculated
- Verify: Invoice status changes to 'paid' if full payment
- Verify: Subscription.status updates if applicable

### Steps 46-50: Final Testing & Release

**Step 46: Tenant CRM Regression Test**
- Login as Tenant Owner
- Test all existing features:
  - View customers ✓
  - Create booking ✓
  - View drivers ✓
  - Manage vehicles ✓
  - View payments ✓
- Verify: Zero regressions from Platform changes

**Step 47: Cross-Tenant Isolation Test**
- Create 2 tenants (A, B)
- Login as Tenant A owner
- Attempt to access Tenant B data via direct URL
- Verify: 403 Forbidden or empty result
- Verify: No data leakage

**Step 48: Security Audit**
- Platform admin cannot access /api/customers (no tenantId)
- Tenant owner cannot access /api/platform/* (no platformRole)
- Driver cannot access Platform (separate auth)
- Session isolation verified (multi-device sessions)
- CSRF tokens validated (if applicable)
- SQL injection: N/A (using Mongoose)
- XSS: sanitize all user input in frontend

**Step 49: Performance & Load Testing**
- Dashboard: load 10k tenants, verify response < 500ms
- Invoice list: 10k invoices, verify pagination works
- Audit log query: 100k entries, verify filters work
- Cron jobs: test with 1000 subscriptions, verify completion in < 5 min

**Step 50: Release Gate Checklist**

**MUST PASS (Go/No-Go Decision)**

```
Auth:
  ✓ Platform Root login works
  ✓ Platform admin login works
  ✓ Tenant owner login (unchanged, works)
  ✓ Cross-tenant isolation verified
  ✓ Session timeout works

Dashboard:
  ✓ Loads real KPIs (not mocked)
  ✓ All cards clickable
  ✓ Charts render correctly
  ✓ No static "Coming Soon"

Tenants:
  ✓ Create tenant creates owner
  ✓ Tenant 360 shows real stats
  ✓ Edit tenant works
  ✓ Lock/unlock works

Subscriptions:
  ✓ Assign plan creates subscription
  ✓ Change plan updates dates correctly
  ✓ Renewal logic works

Billing:
  ✓ Monthly cron generates invoices
  ✓ Payment recording updates invoice
  ✓ Invoice PDF generates
  ✓ Overdue notifications send

Support:
  ✓ Create ticket works
  ✓ Assign ticket works
  ✓ Comments work
  ✓ SLA monitoring works

Audit:
  ✓ Every Platform action logged
  ✓ Audit query returns correct entries
  ✓ No sensitive data in logs

Regressions:
  ✓ Tenant CRM unchanged (all features work)
  ✓ Driver portal unchanged
  ✓ No broken routes
  ✓ No database corruption

Security:
  ✓ Tenant cannot access platform
  ✓ Admin cannot access tenant data
  ✓ No XSS vulnerabilities
  ✓ No injection vulnerabilities
  ✓ Role checks on all endpoints

Performance:
  ✓ Dashboard < 500ms
  ✓ List pages < 1s
  ✓ API responses < 100ms (with index)
  ✓ No memory leaks

Deployment:
  ✓ All migrations run successfully
  ✓ Default plans seeded
  ✓ Platform company initialized
  ✓ Root account bootstrapped
  ✓ Collections + indexes created
```

**IF ALL PASS: ✅ RELEASE TO PRODUCTION**

**IF ANY FAIL: 🔴 HOLD, FIX, RE-TEST**

---

## SUMMARY: 50 STEPS COMPLETE

| Phase | Steps | Focus | Status |
|-------|-------|-------|--------|
| 1 (Audit) | 1-5 | Contracts, cleanup, architecture, data models, APIs | ✅ Complete |
| 2 (Foundation) | 6-10 | Bootstrap, auth, provisioning, services, DB init | ✅ Ready to code |
| 3 (Core) | 11-20 | Dashboard, tenants, subscriptions, billing | ✅ In this roadmap |
| 4 (Ops) | 21-30 | Admins, support, audit, locks, notifications | ✅ In this roadmap |
| 5 (Integration) | 31-45 | Frontend UI, services, E2E tests | ✅ In this roadmap |
| 6 (Release) | 46-50 | Regression, security, performance, release gate | ✅ In this roadmap |

**All 50 steps now have complete specifications, code examples, and testing criteria.**

**Ready to implement.**

