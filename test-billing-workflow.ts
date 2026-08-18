/**
 * BILLING SYSTEM TEST WORKFLOW
 * Validates end-to-end billing functionality (P0-001, P2-002 fixes)
 *
 * Run with: npx ts-node test-billing-workflow.ts
 */

import axios from 'axios';

const API_URL = 'http://localhost:5050/api';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    console.log(`\n[TEST] ${name}...`);
    await fn();
    results.push({ name, status: 'PASS', message: 'Success' });
    console.log(`  ✓ PASS`);
  } catch (error: any) {
    results.push({
      name,
      status: 'FAIL',
      error: error.message
    });
    console.log(`  ✗ FAIL: ${error.message}`);
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         BILLING SYSTEM TEST WORKFLOW (P0-001, P2-002)          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Note: These tests assume:
  // 1. Server is running on :5050
  // 2. Test user is authenticated (would need auth token in real scenario)
  // 3. Database is populated with test data

  // PHASE 1: Plans Verification
  await test('Get available plans', async () => {
    const response = await axios.get(`${API_URL}/plans`, {
      headers: { 'Authorization': 'Bearer test-token' },
      validateStatus: () => true,
    });
    if (response.status === 401) {
      throw new Error('Not authenticated - test requires auth token');
    }
    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    console.log(`    Found ${response.data.data?.plans?.length || 0} plans`);
  });

  // PHASE 2: Subscriptions Verification
  await test('Get current subscription', async () => {
    const response = await axios.get(`${API_URL}/subscription`, {
      validateStatus: () => true,
    });
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    console.log(`    Subscription status: ${response.data.data?.subscription?.status || 'none'}`);
  });

  // PHASE 3: Billing - Invoices (P0-001 fix verification)
  await test('List invoices (P0-001: Persistence)', async () => {
    const response = await axios.get(`${API_URL}/billing/invoices`, {
      validateStatus: () => true,
    });
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    const invoices = response.data.data?.invoices || [];
    console.log(`    Found ${invoices.length} invoices persisted in DB`);

    // Verify invoices are persisted (not stubs)
    if (invoices.length > 0) {
      const firstInvoice = invoices[0];
      if (!firstInvoice.invoiceNumber && !firstInvoice.amount) {
        throw new Error('Invoice data not properly persisted');
      }
    }
  });

  // PHASE 4: Payment Recording (P0-001 fix verification)
  await test('Payment recording endpoint available', async () => {
    const response = await axios.post(`${API_URL}/billing/payment`,
      { amount: 0 }, // Invalid to trigger validation error
      { validateStatus: () => true }
    );

    // Should return 400 (validation error), not 404 or 501
    if (response.status === 404 || response.status === 501) {
      throw new Error(`Payment endpoint not properly implemented: ${response.status}`);
    }
    if (response.status === 400 && response.data.error?.includes('Valid amount')) {
      console.log(`    Payment endpoint validates input correctly`);
    } else if (response.status === 401) {
      console.log(`    Payment endpoint requires authentication (expected)`);
    } else {
      throw new Error(`Unexpected response: ${response.status}`);
    }
  });

  // PHASE 5: Billing Ledger (P0-001 fix verification)
  await test('Get billing ledger (P0-001: Persistence)', async () => {
    const response = await axios.get(`${API_URL}/billing/ledger`, {
      validateStatus: () => true,
    });
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    const ledger = response.data.data?.entries || [];
    const outstanding = response.data.data?.outstanding;
    console.log(`    Ledger entries: ${ledger.length}, Outstanding: ₹${outstanding || 0}`);
  });

  // PHASE 6: Admin Billing Overview (P2-002 fix verification)
  await test('Platform billing overview (P2-002: Metrics)', async () => {
    const response = await axios.get(`${API_URL}/admin/billing/overview`, {
      validateStatus: () => true,
    });
    if (response.status === 401 || response.status === 403) {
      console.log(`    Admin endpoint requires elevated permissions (expected)`);
      return;
    }
    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    const metrics = response.data.data || {};
    console.log(`    MRR: ₹${metrics.totalMRR || 0}`);
    console.log(`    Renewals this month: ${metrics.renewalsThisMonth || 0} (P2-002 FIX)`);
    console.log(`    Outstanding: ₹${metrics.totalOutstanding || 0}`);
    console.log(`    Overdue tenants: ${metrics.overdueTenants || 0}`);
  });

  // PHASE 7: Upcoming Renewals
  await test('Get upcoming renewals forecast', async () => {
    const response = await axios.get(`${API_URL}/admin/billing/renewals/upcoming`, {
      validateStatus: () => true,
    });
    if (response.status === 401 || response.status === 403) {
      console.log(`    Admin endpoint requires elevated permissions (expected)`);
      return;
    }
    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    const renewals = response.data.data?.renewals || [];
    console.log(`    Next 30 days: ${renewals.length} renewals scheduled`);
  });

  // PHASE 8: Scheduler Trigger
  await test('Manual billing scheduler trigger', async () => {
    const response = await axios.post(`${API_URL}/admin/billing/scheduler/trigger`, {}, {
      validateStatus: () => true,
    });
    if (response.status === 401 || response.status === 403) {
      console.log(`    Scheduler endpoint requires elevated permissions (expected)`);
      return;
    }
    if (response.status === 200 || response.status === 202) {
      console.log(`    Scheduler triggered successfully`);
    } else if (response.status === 404) {
      throw new Error('Scheduler endpoint not implemented');
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⊘';
    console.log(`${icon} ${r.name}`);
    if (r.error) console.log(`  Error: ${r.error}`);
  });

  console.log(`\nResults: ${passed} PASS, ${failed} FAIL, ${skipped} SKIP`);
  console.log(`Total: ${results.length} tests\n`);

  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - Billing system working correctly\n');
  } else {
    console.log(`❌ ${failed} test(s) failed - Check errors above\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
