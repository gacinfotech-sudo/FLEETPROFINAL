/**
 * SEED SAAS DATA TO MONGODB
 * Directly populates MongoDB with test tenant and billing data
 * Run: npx ts-node scripts/seed-saas-data.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetpro';

interface TestTenant {
  _id?: mongoose.Types.ObjectId;
  name: string;
  businessName: string;
  businessType: string;
  subscriptionPlan: 'starter' | 'pro' | 'enterprise';
  isActive: boolean;
  createdAt: Date;
  monthlyRevenue: number;
  activeUsers: number;
  bookingsThisMonth: number;
  maxManagers: number;
  usageCounters: {
    bookingsThisMonth: number;
  };
}

async function seedData() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection failed');

    // Clear existing test data
    console.log('🗑️  Clearing existing test data...');
    await db.collection('tenants').deleteMany({});
    console.log('✅ Cleared tenants\n');

    // Create test tenants
    console.log('📝 Creating test tenants...');
    const testTenants: TestTenant[] = [
      {
        name: 'Prateek Motors',
        businessName: 'Prateek Motors',
        businessType: 'automotive',
        subscriptionPlan: 'pro',
        isActive: true,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        monthlyRevenue: 15000,
        activeUsers: 25,
        bookingsThisMonth: 145,
        maxManagers: 5,
        usageCounters: { bookingsThisMonth: 145 }
      },
      {
        name: 'Aradhya Car Bazaar',
        businessName: 'Aradhya Car Bazaar',
        businessType: 'automotive',
        subscriptionPlan: 'pro',
        isActive: true,
        createdAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
        monthlyRevenue: 18000,
        activeUsers: 32,
        bookingsThisMonth: 178,
        maxManagers: 5,
        usageCounters: { bookingsThisMonth: 178 }
      },
      {
        name: 'Quick Ride Services',
        businessName: 'Quick Ride Services',
        businessType: 'transportation',
        subscriptionPlan: 'starter',
        isActive: true,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        monthlyRevenue: 5000,
        activeUsers: 8,
        bookingsThisMonth: 92,
        maxManagers: 3,
        usageCounters: { bookingsThisMonth: 92 }
      },
      {
        name: 'Elite Taxi Fleet',
        businessName: 'Elite Taxi Fleet',
        businessType: 'transportation',
        subscriptionPlan: 'enterprise',
        isActive: true,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        monthlyRevenue: 50000,
        activeUsers: 85,
        bookingsThisMonth: 542,
        maxManagers: 10,
        usageCounters: { bookingsThisMonth: 542 }
      },
      {
        name: 'Local Delivery Hub',
        businessName: 'Local Delivery Hub',
        businessType: 'logistics',
        subscriptionPlan: 'starter',
        isActive: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        monthlyRevenue: 4500,
        activeUsers: 5,
        bookingsThisMonth: 67,
        maxManagers: 2,
        usageCounters: { bookingsThisMonth: 67 }
      },
      {
        name: 'Premium Transport Co',
        businessName: 'Premium Transport Co',
        businessType: 'transportation',
        subscriptionPlan: 'pro',
        isActive: false, // Trial ended
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        monthlyRevenue: 12000,
        activeUsers: 18,
        bookingsThisMonth: 103,
        maxManagers: 4,
        usageCounters: { bookingsThisMonth: 103 }
      }
    ];

    const tenantResult = await db.collection('tenants').insertMany(testTenants);
    console.log(`✅ Created ${tenantResult.insertedCount} test tenants\n`);

    // Create booking payment records
    console.log('💳 Creating billing records...');
    const tenantIds = Object.values(tenantResult.insertedIds);

    const billingRecords = [];
    for (const tenantId of tenantIds) {
      const randomPayments = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < randomPayments; i++) {
        billingRecords.push({
          tenantId,
          amount: Math.floor(Math.random() * 10000) + 1000,
          status: 'completed',
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          paymentMethod: 'bank_transfer',
          invoiceNumber: `INV-${Date.now()}-${i}`
        });
      }
    }

    const billingResult = await db.collection('bookingPayments').insertMany(billingRecords);
    console.log(`✅ Created ${billingResult.insertedCount} billing records\n`);

    // Create support tickets
    console.log('🎫 Creating support tickets...');
    const ticketTypes = ['technical', 'billing', 'feature_request', 'general'];
    const ticketStatuses = ['open', 'in_progress', 'resolved'];

    const tickets = [];
    for (const tenantId of tenantIds) {
      const numTickets = Math.floor(Math.random() * 3);
      for (let i = 0; i < numTickets; i++) {
        tickets.push({
          tenantId,
          subject: `Support Request ${i + 1}`,
          type: ticketTypes[Math.floor(Math.random() * ticketTypes.length)],
          status: ticketStatuses[Math.floor(Math.random() * ticketStatuses.length)],
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          priority: Math.random() > 0.7 ? 'high' : 'normal'
        });
      }
    }

    if (tickets.length > 0) {
      const ticketResult = await db.collection('support_tickets').insertMany(tickets);
      console.log(`✅ Created ${ticketResult.insertedCount} support tickets\n`);
    }

    // Create subscription plans
    console.log('📋 Creating subscription plans...');
    const plans = [
      {
        planId: 'PLAN-STARTER',
        name: 'Starter',
        price: 4999,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Up to 10 users', '50 bookings/month', 'Basic analytics'],
        createdAt: new Date()
      },
      {
        planId: 'PLAN-PRO',
        name: 'Professional',
        price: 14999,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Up to 50 users', 'Unlimited bookings', 'Advanced analytics', 'API access'],
        createdAt: new Date()
      },
      {
        planId: 'PLAN-ENTERPRISE',
        name: 'Enterprise',
        price: 49999,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Unlimited users', 'Unlimited bookings', 'Premium analytics', 'Priority support'],
        createdAt: new Date()
      }
    ];

    const planResult = await db.collection('subscription_plans').insertMany(plans);
    console.log(`✅ Created ${planResult.insertedCount} subscription plans\n`);

    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('✅ SAAS DATA SEEDING COMPLETE!');
    console.log('═══════════════════════════════════════════\n');

    const totalRevenue = testTenants.reduce((sum, t) => sum + t.monthlyRevenue, 0);
    const activeTenants = testTenants.filter(t => t.isActive).length;

    console.log('📊 Dashboard Metrics:');
    console.log(`  • Total Tenants: ${testTenants.length}`);
    console.log(`  • Active Tenants: ${activeTenants}`);
    console.log(`  • Trial Tenants: ${testTenants.length - activeTenants}`);
    console.log(`  • Monthly Revenue: ₹${totalRevenue.toLocaleString()}`);
    console.log(`  • Billing Records: ${billingRecords.length}`);
    console.log(`  • Support Tickets: ${tickets.length}`);
    console.log('');
    console.log('Refresh your dashboard at: https://localhost:5050/login');
    console.log('');

    await mongoose.disconnect();
    console.log('✅ MongoDB connection closed\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedData();
