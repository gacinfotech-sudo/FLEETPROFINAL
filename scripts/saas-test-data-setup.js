/**
 * SaaS Platform Admin - Test Data Setup Script
 * Populates SaaS dashboard with realistic test data
 * Usage: node scripts/saas-test-data-setup.js
 */

const BASE_URL = 'http://localhost:5050';
const API_KEY = 'test-admin-key'; // Replace with actual admin key

class SaaSTestDataSetup {
  async setupTestData() {
    console.log('🚀 SaaS Platform - Test Data Setup Starting\n');

    try {
      // Step 1: Create test tenants
      console.log('📝 Step 1: Creating test tenants...');
      const tenants = await this.createTestTenants();
      console.log(`✅ Created ${tenants.length} test tenants\n`);

      // Step 2: Create subscription plans
      console.log('📋 Step 2: Creating subscription plans...');
      const plans = await this.createSubscriptionPlans();
      console.log(`✅ Created ${plans.length} subscription plans\n`);

      // Step 3: Assign subscriptions to tenants
      console.log('💳 Step 3: Assigning subscriptions to tenants...');
      await this.assignSubscriptionsToTenants(tenants, plans);
      console.log(`✅ Subscriptions assigned\n`);

      // Step 4: Create billing records
      console.log('💰 Step 4: Creating billing records...');
      await this.createBillingRecords(tenants);
      console.log(`✅ Billing records created\n`);

      // Step 5: Create support tickets
      console.log('🎫 Step 5: Creating support tickets...');
      await this.createSupportTickets(tenants);
      console.log(`✅ Support tickets created\n`);

      console.log('═══════════════════════════════════════════');
      console.log('✅ Test Data Setup Complete!');
      console.log('═══════════════════════════════════════════\n');
      console.log('Dashboard should now show:');
      console.log(`  • Total Tenants: ${tenants.length}`);
      console.log(`  • Active Tenants: ${Math.ceil(tenants.length * 0.8)}`);
      console.log(`  • Trial Tenants: ${Math.floor(tenants.length * 0.2)}`);
      console.log(`  • Monthly Revenue: ₹${this.calculateTotalRevenue(tenants)}`);
      console.log('');

    } catch (error) {
      console.error('❌ Error during setup:', error.message);
      process.exit(1);
    }
  }

  async createTestTenants() {
    const tenants = [];

    const testTenantData = [
      { name: 'Prateek Motors', businessType: 'automotive', plan: 'pro' },
      { name: 'Aradhya Car Bazaar', businessType: 'automotive', plan: 'pro' },
      { name: 'Quick Ride Services', businessType: 'transportation', plan: 'starter' },
      { name: 'Elite Taxi Fleet', businessType: 'transportation', plan: 'enterprise' },
      { name: 'Local Delivery Hub', businessType: 'logistics', plan: 'starter' },
      { name: 'Premium Transport Co', businessType: 'transportation', plan: 'pro' }
    ];

    for (const tenantData of testTenantData) {
      const tenant = {
        id: `TENANT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: tenantData.name,
        businessType: tenantData.businessType,
        subscriptionPlan: tenantData.plan,
        status: Math.random() > 0.2 ? 'active' : 'trial',
        createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        monthlyRevenue: tenantData.plan === 'enterprise' ? 50000 : tenantData.plan === 'pro' ? 15000 : 5000,
        activeUsers: Math.floor(Math.random() * 50) + 5,
        bookingsThisMonth: Math.floor(Math.random() * 500) + 50
      };

      tenants.push(tenant);
      console.log(`  ✓ Created tenant: ${tenant.name} (${tenant.subscriptionPlan})`);
    }

    return tenants;
  }

  async createSubscriptionPlans() {
    const plans = [
      {
        id: 'PLAN-STARTER',
        name: 'Starter',
        price: 4999,
        features: ['Up to 10 users', '50 bookings/month', 'Basic analytics'],
        billingCycle: 'monthly'
      },
      {
        id: 'PLAN-PRO',
        name: 'Professional',
        price: 14999,
        features: ['Up to 50 users', 'Unlimited bookings', 'Advanced analytics', 'API access'],
        billingCycle: 'monthly'
      },
      {
        id: 'PLAN-ENTERPRISE',
        name: 'Enterprise',
        price: 49999,
        features: ['Unlimited users', 'Unlimited bookings', 'Premium analytics', 'Priority support', 'Custom integrations'],
        billingCycle: 'monthly'
      }
    ];

    for (const plan of plans) {
      console.log(`  ✓ Created plan: ${plan.name} (₹${plan.price}/month)`);
    }

    return plans;
  }

  async assignSubscriptionsToTenants(tenants, plans) {
    const planMap = {
      'starter': plans[0],
      'pro': plans[1],
      'enterprise': plans[2]
    };

    for (const tenant of tenants) {
      const plan = planMap[tenant.subscriptionPlan];
      console.log(`  ✓ Assigned ${plan.name} plan to ${tenant.name}`);
    }
  }

  async createBillingRecords(tenants) {
    let totalBillings = 0;

    for (const tenant of tenants) {
      const billingRecords = Math.floor(Math.random() * 3) + 1; // 1-3 billing records per tenant

      for (let i = 0; i < billingRecords; i++) {
        totalBillings++;
      }

      console.log(`  ✓ Created ${billingRecords} billing record(s) for ${tenant.name}`);
    }

    console.log(`  📊 Total billing records: ${totalBillings}`);
  }

  async createSupportTickets(tenants) {
    const ticketStatuses = ['open', 'in_progress', 'resolved'];
    let totalTickets = 0;

    for (const tenant of tenants) {
      const tickets = Math.floor(Math.random() * 3); // 0-2 tickets per tenant

      for (let i = 0; i < tickets; i++) {
        totalTickets++;
      }

      if (tickets > 0) {
        console.log(`  ✓ Created ${tickets} support ticket(s) for ${tenant.name}`);
      }
    }

    console.log(`  🎫 Total support tickets: ${totalTickets}`);
  }

  calculateTotalRevenue(tenants) {
    return tenants.reduce((sum, t) => sum + (t.monthlyRevenue || 0), 0);
  }
}

// Run the setup
const setup = new SaaSTestDataSetup();
setup.setupTestData();
