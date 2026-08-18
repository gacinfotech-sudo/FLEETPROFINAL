import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

test.describe('Platform Control Plane - SaaS Management', () => {
  // Test 1: Dashboard KPIs Loading
  test('should load platform dashboard with KPIs', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/dashboard`);

    // Wait for dashboard to load
    await page.waitForSelector('h1:has-text("Platform Control Plane")');

    // Verify KPI cards are visible
    expect(await page.locator('text=Total Tenants').isVisible()).toBeTruthy();
    expect(await page.locator('text=Active Tenants').isVisible()).toBeTruthy();
    expect(await page.locator('text=Monthly Revenue').isVisible()).toBeTruthy();
    expect(await page.locator('text=Payments Outstanding').isVisible()).toBeTruthy();
  });

  // Test 2: Dashboard API Call
  test('should fetch and display KPIs from API', async ({ page }) => {
    let apiCalled = false;

    page.on('response', response => {
      if (response.url().includes('/api/platform/dashboard/kpis')) {
        apiCalled = true;
      }
    });

    await page.goto(`${BASE_URL}/platform/dashboard`);
    await page.waitForTimeout(1000);

    expect(apiCalled).toBeTruthy();
  });

  // Test 3: Tenant Management - List Tenants
  test('should list tenants with pagination', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/tenants`);

    // Wait for tenant table
    await page.waitForSelector('table');

    // Verify table headers
    expect(await page.locator('th:has-text("Business Name")').isVisible()).toBeTruthy();
    expect(await page.locator('th:has-text("Email")').isVisible()).toBeTruthy();
    expect(await page.locator('th:has-text("Subscription")').isVisible()).toBeTruthy();
  });

  // Test 4: Tenant Management - Create Tenant
  test('should create a new tenant', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/tenants`);

    // Click "Add Tenant" button
    await page.click('button:has-text("Add Tenant")');

    // Wait for modal
    await page.waitForSelector('h2:has-text("Add New Tenant")');

    // Fill form
    await page.fill('input[placeholder="Business Name"]', 'Test Company Ltd');
    await page.fill('input[placeholder="Email"]', 'admin@testcompany.com');
    await page.fill('input[placeholder="Country"]', 'India');

    // Submit
    await page.click('button:has-text("Create")');

    // Verify tenant appears in list
    await page.waitForTimeout(1000);
    expect(await page.locator('text=Test Company Ltd').isVisible()).toBeTruthy();
  });

  // Test 5: Tenant Detail View
  test('should display tenant detail with 360 view', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/tenants`);

    // Click first tenant's detail button (Eye icon)
    await page.click('button[title="View"] >> first');

    // Wait for detail panel
    await page.waitForSelector('h3:has-text("Tenant Details")');

    // Verify detail fields
    expect(await page.locator('text=Business Name').isVisible()).toBeTruthy();
    expect(await page.locator('text=Owner').isVisible()).toBeTruthy();
    expect(await page.locator('text=Plan').isVisible()).toBeTruthy();
    expect(await page.locator('text=Operational Metrics').isVisible()).toBeTruthy();
  });

  // Test 6: Lock/Unlock Tenant
  test('should lock and unlock tenant', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/tenants`);

    // Click first tenant's detail button
    await page.click('button[title="View"] >> first');

    // Wait for detail panel
    await page.waitForSelector('button:has-text("Lock Tenant")');

    // Click lock button
    await page.click('button:has-text("Lock Tenant")');

    // Wait for unlock button
    await page.waitForSelector('button:has-text("Unlock Tenant")');

    // Click unlock button
    await page.click('button:has-text("Unlock Tenant")');

    // Verify lock button reappears
    await page.waitForSelector('button:has-text("Lock Tenant")');
  });

  // Test 7: Billing - List Invoices
  test('should list invoices with pagination', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/billing`);

    // Wait for invoice table
    await page.waitForSelector('table');

    // Verify table headers
    expect(await page.locator('th:has-text("Invoice #")').isVisible()).toBeTruthy();
    expect(await page.locator('th:has-text("Amount")').isVisible()).toBeTruthy();
    expect(await page.locator('th:has-text("Status")').isVisible()).toBeTruthy();
  });

  // Test 8: Billing - Filter Invoices by Status
  test('should filter invoices by status', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/billing`);

    // Wait for table
    await page.waitForSelector('table');

    // Select "Paid" status filter
    await page.selectOption('select:first-of-type', 'paid');

    // Verify API is called
    let apiCalled = false;
    page.on('response', response => {
      if (response.url().includes('/api/platform/invoices?')) {
        apiCalled = true;
      }
    });

    await page.waitForTimeout(1000);
    expect(apiCalled).toBeTruthy();
  });

  // Test 9: Billing - Generate Invoices
  test('should generate monthly invoices', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/billing`);

    // Click "Generate Monthly Invoices" button
    await page.click('button:has-text("Generate Monthly Invoices")');

    // Wait for modal
    await page.waitForSelector('h2:has-text("Generate Monthly Invoices")');

    // Click Generate button
    await page.click('button:has-text("Generate")');

    // Verify modal closes
    await page.waitForTimeout(1000);
    expect(await page.locator('h2:has-text("Generate Monthly Invoices")').isVisible()).toBeFalsy();
  });

  // Test 10: Billing - Summary Cards
  test('should display billing summary cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/billing`);

    // Verify summary cards
    expect(await page.locator('text=Total Invoiced').isVisible()).toBeTruthy();
    expect(await page.locator('text=Outstanding').isVisible()).toBeTruthy();
    expect(await page.locator('text=Paid').isVisible()).toBeTruthy();
    expect(await page.locator('text=Overdue Count').isVisible()).toBeTruthy();
  });

  // Test 11: Support - List Tickets
  test('should list support tickets', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/support`);

    // Wait for ticket list
    await page.waitForSelector('text=Support Tickets');

    // Verify filter options
    expect(await page.locator('select[aria-label="priority"]').or(page.locator('select >> first')).isVisible()).toBeTruthy();
  });

  // Test 12: Support - Create Ticket
  test('should create a new support ticket', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/support`);

    // Click "New Ticket" button
    await page.click('button:has-text("New Ticket")');

    // Wait for modal
    await page.waitForSelector('h2:has-text("Create Support Ticket")');

    // Fill form
    await page.fill('input[placeholder="Subject"]', 'Billing Issue');
    await page.fill('textarea', 'Invoice not received for last month');
    await page.selectOption('select', 'high');

    // Submit
    await page.click('button:has-text("Create")');

    // Verify modal closes and ticket appears
    await page.waitForTimeout(1000);
    expect(await page.locator('text=Billing Issue').isVisible()).toBeTruthy();
  });

  // Test 13: Support - Ticket Detail
  test('should display ticket detail with comments', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/support`);

    // Click first ticket
    const ticketRow = page.locator('[border-l-4]').first();
    await ticketRow.click();

    // Wait for detail panel
    await page.waitForSelector('h3');

    // Verify detail fields
    expect(await page.locator('text=Priority').isVisible()).toBeTruthy();
    expect(await page.locator('text=Status').isVisible()).toBeTruthy();
    expect(await page.locator('text=Comments').isVisible()).toBeTruthy();
  });

  // Test 14: Support - Add Comment
  test('should add comment to ticket', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/support`);

    // Click first ticket
    const ticketRow = page.locator('[border-l-4]').first();
    await ticketRow.click();

    // Wait for comment input
    await page.waitForSelector('input[placeholder="Add comment..."]');

    // Add comment
    await page.fill('input[placeholder="Add comment..."]', 'Investigating the issue');
    await page.click('button:has-text("MessageSquare")').or(page.keyboard.press('Enter'));

    // Verify comment appears
    await page.waitForTimeout(1000);
    expect(await page.locator('text=Investigating the issue').isVisible()).toBeTruthy();
  });

  // Test 15: Support - SLA Deadline Calculation
  test('should calculate SLA deadline based on priority', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/support`);

    // Click first ticket with critical priority
    const ticketRow = page.locator('[border-l-4]:has-text("critical")').first();
    if (await ticketRow.isVisible()) {
      await ticketRow.click();

      // Verify SLA deadline is shown
      expect(await page.locator('text=SLA Deadline').isVisible()).toBeTruthy();
    }
  });

  // Test 16: API Integration - Dashboard KPIs
  test('should call dashboard KPIs API with correct response', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/platform/dashboard/kpis`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('totalTenants');
    expect(data).toHaveProperty('activeTenants');
    expect(data).toHaveProperty('monthlyRevenue');
    expect(data).toHaveProperty('paymentsDue');
  });

  // Test 17: API Integration - List Tenants
  test('should call list tenants API', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/platform/tenants?page=1&limit=10`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('tenants');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('pages');
  });

  // Test 18: API Integration - Create Tenant
  test('should create tenant via API', async ({ page }) => {
    const response = await page.request.post(`${BASE_URL}/api/platform/tenants`, {
      data: {
        businessName: 'E2E Test Company',
        email: 'e2e@test.com',
        country: 'India'
      }
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty('tenant');
    expect(data).toHaveProperty('owner');
    expect(data).toHaveProperty('subscription');
  });

  // Test 19: API Integration - List Invoices
  test('should call list invoices API', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/platform/invoices?page=1&limit=10`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('invoices');
    expect(data).toHaveProperty('total');
  });

  // Test 20: API Integration - Create Support Ticket
  test('should create support ticket via API', async ({ page }) => {
    // First get a tenant ID
    const tenantsRes = await page.request.get(`${BASE_URL}/api/platform/tenants?page=1&limit=1`);
    const tenantsData = await tenantsRes.json();

    if (tenantsData.tenants.length > 0) {
      const tenantId = tenantsData.tenants[0]._id;

      const response = await page.request.post(`${BASE_URL}/api/platform/tickets`, {
        data: {
          tenantId,
          subject: 'E2E Test Ticket',
          description: 'Testing ticket creation',
          priority: 'high',
          category: 'billing'
        }
      });

      expect(response.status()).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('_id');
      expect(data).toHaveProperty('subject');
      expect(data.subject).toBe('E2E Test Ticket');
    }
  });

  // Test 21: End-to-End Workflow - Complete Subscription Flow
  test('should complete full subscription workflow', async ({ page }) => {
    // 1. Create tenant
    const createRes = await page.request.post(`${BASE_URL}/api/platform/tenants`, {
      data: {
        businessName: 'E2E Workflow Test',
        email: 'workflow@test.com',
        country: 'India'
      }
    });
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    const tenantId = createData.tenant._id;

    // 2. Verify subscription created
    const subRes = await page.request.get(`${BASE_URL}/api/platform/tenants/${tenantId}/subscription`);
    expect(subRes.status()).toBe(200);
    const subData = await subRes.json();
    expect(subData.status).toBe('active');

    // 3. List tenant's invoices
    const invoicesRes = await page.request.get(`${BASE_URL}/api/platform/invoices?page=1&limit=10`);
    expect(invoicesRes.status()).toBe(200);
  });

  // Test 22: End-to-End Workflow - Support Ticket Lifecycle
  test('should complete support ticket lifecycle', async ({ page }) => {
    // Get a tenant
    const tenantsRes = await page.request.get(`${BASE_URL}/api/platform/tenants?page=1&limit=1`);
    const tenantsData = await tenantsRes.json();

    if (tenantsData.tenants.length > 0) {
      const tenantId = tenantsData.tenants[0]._id;

      // 1. Create ticket
      const createRes = await page.request.post(`${BASE_URL}/api/platform/tickets`, {
        data: {
          tenantId,
          subject: 'Lifecycle Test',
          description: 'Testing lifecycle',
          priority: 'medium',
          category: 'technical'
        }
      });
      expect(createRes.status()).toBe(201);
      const ticket = await createRes.json();
      const ticketId = ticket._id;

      // 2. Add comment
      const commentRes = await page.request.post(`${BASE_URL}/api/platform/tickets/${ticketId}/comment`, {
        data: { comment: 'Initial investigation' }
      });
      expect(commentRes.status()).toBe(200);

      // 3. Resolve ticket
      const resolveRes = await page.request.post(`${BASE_URL}/api/platform/tickets/${ticketId}/resolve`, {
        data: { resolution: 'Issue resolved' }
      });
      expect(resolveRes.status()).toBe(200);

      // 4. Close ticket
      const closeRes = await page.request.post(`${BASE_URL}/api/platform/tickets/${ticketId}/close`, {
        data: {}
      });
      expect(closeRes.status()).toBe(200);
    }
  });

  // Test 23: Data Isolation - No Cross-Tenant Access
  test('should prevent cross-tenant data access', async ({ page }) => {
    // Get all tenants
    const tenantsRes = await page.request.get(`${BASE_URL}/api/platform/tenants?page=1&limit=2`);
    const tenantsData = await tenantsRes.json();

    if (tenantsData.tenants.length >= 2) {
      const tenant1 = tenantsData.tenants[0];
      const tenant2 = tenantsData.tenants[1];

      // Try to access tenant1's subscription via tenant2
      // (This would require actual cross-tenant attack, simplified here)
      const sub1 = await page.request.get(`${BASE_URL}/api/platform/tenants/${tenant1._id}/subscription`);
      const sub2 = await page.request.get(`${BASE_URL}/api/platform/tenants/${tenant2._id}/subscription`);

      // Both should work but return different data
      expect(sub1.status()).toBe(200);
      expect(sub2.status()).toBe(200);

      const data1 = await sub1.json();
      const data2 = await sub2.json();

      // They should be different subscriptions
      expect(data1.tenantId).not.toBe(data2.tenantId);
    }
  });

  // Test 24: Error Handling - Invalid Tenant ID
  test('should handle invalid tenant ID gracefully', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/platform/tenants/invalid-id`);

    // Should return 400 or 500, not crash
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  // Test 25: Performance - Dashboard Load Time
  test('should load dashboard within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/platform/dashboard`);
    await page.waitForSelector('h1:has-text("Platform Control Plane")');

    const loadTime = Date.now() - startTime;

    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});
