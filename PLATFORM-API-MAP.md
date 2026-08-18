# PLATFORM API MAP
**Date:** 2026-08-16  
**Status:** SPECIFICATION COMPLETE  
**Version:** 1.0

---

## COMPLETE API REFERENCE

### AUTH ENDPOINTS

**POST /api/platform/auth/login**
- **Purpose:** Platform user authentication
- **Auth:** None (public)
- **Request:**
  ```json
  {
    "userId": "platform_root",
    "password": "secure_password"
  }
  ```
- **Response (200):**
  ```json
  {
    "userId": "platform_root",
    "platformRole": "PLATFORM_ROOT",
    "tenantId": null,
    "sessionId": "session_abc123",
    "createdAt": "2026-08-16T12:00:00Z"
  }
  ```
- **Errors:** 401 (bad credentials), 400 (missing fields)

**GET /api/platform/auth/me**
- **Purpose:** Get current platform user
- **Auth:** requirePlatformRole
- **Response (200):** Current user object with platformRole
- **Errors:** 401 (not authenticated)

**POST /api/platform/auth/logout**
- **Purpose:** Logout platform user
- **Auth:** requirePlatformRole
- **Response (200):** `{ "message": "Logged out" }`

---

### DASHBOARD ENDPOINTS

**GET /api/platform/dashboard**
- **Purpose:** Platform dashboard KPIs (real-time)
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])
- **Response (200):**
  ```json
  {
    "totalTenants": 24,
    "activeTenants": 22,
    "trialTenants": 2,
    "tenantsByStatus": {
      "active": 22,
      "locked": 1,
      "suspended": 1
    },
    "monthlyRevenue": 145000,
    "paymentsDue": 8500,
    "invoicesPending": 3,
    "supportTicketsOpen": 5,
    "lastInvoiceDate": "2026-08-15T00:00:00Z",
    "systemHealth": "healthy"
  }
  ```

**GET /api/platform/dashboard/stats**
- **Purpose:** Extended dashboard statistics
- **Auth:** requirePlatformRole
- **Query Params:** `?period=month|quarter|year`
- **Response (200):** Extended stats with trends

---

### TENANT MANAGEMENT ENDPOINTS

**GET /api/platform/tenants**
- **Purpose:** List all tenants (paginated)
- **Auth:** requirePlatformRole
- **Query Params:** `?page=1&limit=20&status=active&search=name`
- **Response (200):**
  ```json
  {
    "tenants": [...],
    "total": 24,
    "page": 1,
    "pages": 2
  }
  ```

**POST /api/platform/tenants**
- **Purpose:** Create new tenant
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Request:**
  ```json
  {
    "companyName": "Cabify Bangalore",
    "legalName": "Cabify India Pvt Ltd",
    "ownerName": "Arjun Singh",
    "ownerEmail": "arjun@cabify.com",
    "ownerMobile": "+91-98765-43210",
    "address": "Bangalore, India",
    "planId": "<plan-id>",
    "trialDays": 30
  }
  ```
- **Response (201):** New tenant + owner + subscription
- **Errors:** 400 (validation), 409 (duplicate email)

**GET /api/platform/tenants/:id**
- **Purpose:** Get tenant 360 details
- **Auth:** requirePlatformRole
- **Response (200):**
  ```json
  {
    "tenant": {...},
    "owner": {...},
    "subscription": {...},
    "stats": {
      "activeCustomers": 1230,
      "totalBookings": 1381,
      "activeDrivers": 45,
      "fleetSize": 67
    }
  }
  ```

**GET /api/platform/tenants/:id/users**
- **Purpose:** List tenant users
- **Auth:** requirePlatformRole
- **Response (200):** Array of users in tenant

**POST /api/platform/tenants/:id/users**
- **Purpose:** Create tenant staff (admin, manager, agent)
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])
- **Request:**
  ```json
  {
    "name": "Rajesh Kumar",
    "email": "rajesh@cabify.com",
    "role": "manager",
    "mobile": "+91-98765-43211"
  }
  ```
- **Response (201):** New user + temporary password

**PATCH /api/platform/tenants/:id**
- **Purpose:** Update tenant details
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Request:** Fields to update
- **Response (200):** Updated tenant

**POST /api/platform/tenants/:id/lock**
- **Purpose:** Lock/suspend tenant (operations blocked)
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Request:** `{ "reason": "Payment overdue", "duration": "indefinite" }`
- **Response (200):** Updated subscription (status: locked)

**POST /api/platform/tenants/:id/unlock**
- **Purpose:** Unlock tenant
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Updated subscription (status: active)

---

### SUBSCRIPTION ENDPOINTS

**GET /api/platform/subscriptions**
- **Purpose:** List all subscriptions (paginated)
- **Auth:** requirePlatformRole
- **Query Params:** `?status=active&page=1&limit=20`
- **Response (200):** Array of subscriptions

**GET /api/platform/tenants/:id/subscription**
- **Purpose:** Get tenant's current subscription
- **Auth:** requirePlatformRole
- **Response (200):** Tenant's subscription with plan details

**POST /api/platform/subscriptions**
- **Purpose:** Create/assign subscription to tenant
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Request:**
  ```json
  {
    "tenantId": "<tenant-id>",
    "planId": "<plan-id>",
    "billingCycle": "monthly"
  }
  ```
- **Response (201):** New subscription

**PATCH /api/platform/subscriptions/:id**
- **Purpose:** Update subscription (change plan, etc.)
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])
- **Request:** `{ "planId": "<new-plan-id>", "nextBillingDate": "..." }`
- **Response (200):** Updated subscription

**POST /api/platform/subscriptions/:id/renew**
- **Purpose:** Force subscription renewal
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])
- **Response (200):** Renewed subscription

---

### PLAN ENDPOINTS

**GET /api/platform/plans**
- **Purpose:** List available plans
- **Auth:** requirePlatformRole
- **Response (200):**
  ```json
  {
    "plans": [
      {
        "_id": "...",
        "name": "Pro",
        "monthlyPrice": 5000,
        "features": {...}
      }
    ]
  }
  ```

**POST /api/platform/plans**
- **Purpose:** Create new plan
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Request:**
  ```json
  {
    "name": "Premium",
    "description": "...",
    "monthlyPrice": 10000,
    "features": {
      "userLimit": 50,
      "driverLimit": 200,
      "vehicleLimit": 100
    }
  }
  ```
- **Response (201):** New plan

**PATCH /api/platform/plans/:id**
- **Purpose:** Update plan (price, features)
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Updated plan

---

### BILLING ENDPOINTS

**GET /api/platform/invoices**
- **Purpose:** List all invoices (paginated)
- **Auth:** requirePlatformRole
- **Query Params:** `?status=unpaid&page=1`
- **Response (200):** Array of invoices

**GET /api/platform/invoices/:id**
- **Purpose:** Get invoice detail
- **Auth:** requirePlatformRole
- **Response (200):** Invoice with line items, PDF downloadable

**POST /api/platform/invoices**
- **Purpose:** Manually create invoice
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])
- **Request:**
  ```json
  {
    "tenantId": "...",
    "subscriptionId": "...",
    "amount": 5000
  }
  ```
- **Response (201):** New invoice

**POST /api/platform/invoices/:id/void**
- **Purpose:** Void an invoice
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Voided invoice

---

### PAYMENT ENDPOINTS

**POST /api/platform/payments**
- **Purpose:** Record payment
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN', 'PLATFORM_FINANCE'])
- **Request:**
  ```json
  {
    "invoiceId": "...",
    "tenantId": "...",
    "amount": 5000,
    "method": "bank_transfer",
    "reference": "TXN123456789"
  }
  ```
- **Response (201):** New payment (status: pending)
- **Side Effect:** Updates invoice paid/outstanding amounts

**GET /api/platform/payments**
- **Purpose:** List payments (paginated)
- **Auth:** requirePlatformRole
- **Query Params:** `?status=cleared&startDate=...&endDate=...`
- **Response (200):** Array of payments

**PATCH /api/platform/payments/:id**
- **Purpose:** Update payment status (reconcile, refund)
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_FINANCE'])
- **Request:** `{ "status": "cleared" }` or `{ "status": "refunded", "reason": "..." }`
- **Response (200):** Updated payment

---

### SUPPORT ENDPOINTS

**GET /api/platform/support**
- **Purpose:** List support tickets (paginated)
- **Auth:** requirePlatformRole
- **Query Params:** `?status=open&priority=high&assignedTo=...`
- **Response (200):** Array of tickets

**POST /api/platform/support**
- **Purpose:** Create support ticket
- **Auth:** requirePlatformRole OR authenticated tenant user
- **Request:**
  ```json
  {
    "tenantId": "...",
    "subject": "Invoice calculation error",
    "description": "...",
    "category": "billing",
    "priority": "high"
  }
  ```
- **Response (201):** New ticket

**GET /api/platform/support/:id**
- **Purpose:** Get ticket detail with comments
- **Auth:** requirePlatformRole OR ticket creator
- **Response (200):** Ticket with full history

**PATCH /api/platform/support/:id**
- **Purpose:** Update ticket (assign, status, comment)
- **Auth:** requirePlatformRole
- **Request:**
  ```json
  {
    "status": "in_progress",
    "assignedTo": "<admin-id>",
    "comment": "Working on this issue..."
  }
  ```
- **Response (200):** Updated ticket

**POST /api/platform/support/:id/comments**
- **Purpose:** Add comment to ticket
- **Auth:** requirePlatformRole OR ticket creator
- **Request:** `{ "text": "..." }`
- **Response (201):** New comment

---

### AUDIT ENDPOINTS

**GET /api/platform/audit**
- **Purpose:** List audit logs (paginated)
- **Auth:** requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_ADMIN'])
- **Query Params:** `?actor=...&resource=...&status=failure&startDate=...`
- **Response (200):** Array of audit entries

**GET /api/platform/audit/:id**
- **Purpose:** Get single audit entry
- **Auth:** requirePlatformRole
- **Response (200):** Audit entry details

---

### ADMIN ENDPOINTS

**GET /api/platform/admins**
- **Purpose:** List platform admins
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Array of platform staff users

**POST /api/platform/admins**
- **Purpose:** Create platform admin
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Request:**
  ```json
  {
    "name": "Pradeep",
    "email": "pradeep@platform.com",
    "platformRole": "PLATFORM_ADMIN"
  }
  ```
- **Response (201):** New admin user

**PATCH /api/platform/admins/:id**
- **Purpose:** Update admin
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Updated admin

**DELETE /api/platform/admins/:id**
- **Purpose:** Deactivate admin
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (204):** No content

---

### SETTINGS ENDPOINTS

**GET /api/platform/company**
- **Purpose:** Get platform company profile
- **Auth:** requirePlatformRole
- **Response (200):** Company details

**PATCH /api/platform/company**
- **Purpose:** Update company profile
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Updated company

**GET /api/platform/settings**
- **Purpose:** Get platform settings
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Settings (grace period, SLA, etc.)

**PATCH /api/platform/settings**
- **Purpose:** Update settings
- **Auth:** requirePlatformRole(['PLATFORM_ROOT'])
- **Response (200):** Updated settings

---

## ERROR HANDLING

**All endpoints return:**

- **200/201:** Success
- **204:** No content (for DELETE)
- **400:** Bad request (validation error)
  ```json
  { "error": "companyName is required" }
  ```
- **401:** Unauthorized
  ```json
  { "error": "Authentication required" }
  ```
- **403:** Forbidden (insufficient role)
  ```json
  { "error": "PLATFORM_ROOT role required" }
  ```
- **404:** Not found
  ```json
  { "error": "Tenant not found" }
  ```
- **409:** Conflict (duplicate, invalid state)
  ```json
  { "error": "Tenant already exists" }
  ```
- **500:** Server error
  ```json
  { "error": "Internal server error" }
  ```

---

## ENDPOINT STATISTICS

| Category | Count |
|----------|-------|
| Auth | 3 |
| Dashboard | 2 |
| Tenants | 8 |
| Subscriptions | 5 |
| Plans | 3 |
| Billing | 4 |
| Payments | 3 |
| Support | 5 |
| Audit | 2 |
| Admins | 4 |
| Settings | 4 |
| **TOTAL** | **43** |

---

**All 43 endpoints fully specified and ready for implementation.**

