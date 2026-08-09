/**
 * SHYAM TENANT — 15-DAY QA/DEMO PORTFOLIO SEED
 *
 * Purpose: Create realistic synthetic data for comprehensive testing
 * Date Range: 2026-08-09 → 2026-08-23
 * Target: 2-3 bookings/day ≈ 37-40 bookings
 *
 * SEED BATCH: SHYAM_QA_20260809_V1
 *
 * This is DATA SEEDING ONLY.
 * - Do not change UI
 * - Do not modify application structure
 * - Do not disturb current development
 */

import mongoose from 'mongoose';
import {
  Tenant,
  User,
  Customer,
  Booking,
  Vehicle,
  Driver,
  Vendor,
  PaymentTransaction,
  Expense,
  Invoice,
  Inquiry,
  Lead,
  LeadFollowUp,
  Quotation,
} from '../server/models';

// Admin user for createdBy field
const SEED_ADMIN = { userId: 'seed-admin', role: 'admin' };

const SEED_BATCH = 'SHYAM_QA_20260809_V1';
const START_DATE = new Date('2026-08-09');
const END_DATE = new Date('2026-08-23');

// Sample locations in MP
const LOCATIONS = {
  INDORE: 'Indore',
  UJJAIN: 'Ujjain',
  OMKARESHWAR: 'Omkareshwar',
  MAHESHWAR: 'Maheshwar',
  MANDU: 'Mandu',
  BHOPAL: 'Bhopal',
  DEWAS: 'Dewas',
  PITHAMPUR: 'Pithampur',
  AIRPORT: 'Indore Airport',
  RAILWAY: 'Indore Railway',
};

interface SeedStats {
  tenantId: string;
  customersCreated: number;
  driversCreated: number;
  vehiclesCreated: number;
  vendorsCreated: number;
  bookingsCreated: number;
  paymentsCreated: number;
  expensesCreated: number;
  invoicesCreated: number;
  inquiriesCreated: number;
  leadsCreated: number;
  quotationsCreated: number;
}

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Step 1: Find or identify Shyam tenant
    console.log('\n📋 PHASE 1: Identify Shyam Tenant');
    let shyamTenant = await Tenant.findOne({ name: /shyam/i });

    if (!shyamTenant) {
      console.log('⚠️ Shyam tenant not found. Creating test tenant...');
      shyamTenant = await Tenant.create({
        name: 'Shyam',
        businessName: 'Shyam Cabs',
        isActive: true,
        serviceModes: { selfDrive: true, withDriver: true },
        maxManagers: 5,
        subscriptionPlan: 'pro',
      });
      console.log(`✅ Created new Shyam tenant: ${shyamTenant._id}`);
    } else {
      console.log(`✅ Found existing Shyam tenant: ${shyamTenant._id}`);
    }

    const tenantId = shyamTenant._id;

    // Step 2: Check for existing seed batch
    console.log('\n📋 PHASE 2: Check Existing Seed Batch');
    const existingBookings = await Booking.countDocuments({
      tenantId,
      seedBatch: SEED_BATCH,
    });

    if (existingBookings > 0) {
      console.log(`⚠️ Found ${existingBookings} existing records from ${SEED_BATCH}`);
      console.log('ℹ️ To refresh, please run cleanup first or use different seed batch');
      process.exit(0);
    }

    console.log('✅ No existing seed batch found - proceeding with fresh seed');

    // Step 3: Create Synthetic Data
    console.log('\n📋 PHASE 3: Creating Synthetic Data Portfolio');

    const stats: SeedStats = {
      tenantId: tenantId.toString(),
      customersCreated: 0,
      driversCreated: 0,
      vehiclesCreated: 0,
      vendorsCreated: 0,
      bookingsCreated: 0,
      paymentsCreated: 0,
      expensesCreated: 0,
      invoicesCreated: 0,
      inquiriesCreated: 0,
      leadsCreated: 0,
      quotationsCreated: 0,
    };

    // Create customers
    console.log('\n🧑 Creating customers...');
    const customers = await createCustomers(tenantId);
    stats.customersCreated = customers.length;
    console.log(`✅ Created ${customers.length} customers`);

    // Create drivers
    console.log('\n👨‍✈️ Creating drivers...');
    const drivers = await createDrivers(tenantId);
    stats.driversCreated = drivers.length;
    console.log(`✅ Created ${drivers.length} drivers`);

    // Create vehicles
    console.log('\n🚗 Creating vehicles...');
    const vehicles = await createVehicles(tenantId);
    stats.vehiclesCreated = vehicles.length;
    console.log(`✅ Created ${vehicles.length} vehicles`);

    // Create vendors
    console.log('\n🤝 Creating vendors...');
    const vendors = await createVendors(tenantId);
    stats.vendorsCreated = vendors.length;
    console.log(`✅ Created ${vendors.length} vendors`);

    // Create bookings with interconnected data
    console.log('\n📅 Creating bookings and related data...');
    const { bookings, payments, expenses, invoices } = await createBookingsPortfolio(
      tenantId,
      customers,
      drivers,
      vehicles,
      vendors
    );
    stats.bookingsCreated = bookings.length;
    stats.paymentsCreated = payments.length;
    stats.expensesCreated = expenses.length;
    stats.invoicesCreated = invoices.length;
    console.log(`✅ Created ${bookings.length} bookings`);
    console.log(`✅ Created ${payments.length} payments`);
    console.log(`✅ Created ${expenses.length} expenses`);
    console.log(`✅ Created ${invoices.length} invoices`);

    // Create CRM data
    console.log('\n📊 Creating CRM data...');
    const { inquiries, leads, quotations } = await createCRMData(tenantId, customers);
    stats.inquiriesCreated = inquiries.length;
    stats.leadsCreated = leads.length;
    stats.quotationsCreated = quotations.length;
    console.log(`✅ Created ${inquiries.length} inquiries`);
    console.log(`✅ Created ${leads.length} leads`);
    console.log(`✅ Created ${quotations.length} quotations`);

    // Print final report
    console.log('\n' + '='.repeat(80));
    console.log('✅ SEED COMPLETE: SHYAM QA PORTFOLIO');
    console.log('='.repeat(80));
    console.log(`Seed Batch: ${SEED_BATCH}`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Date Range: ${START_DATE.toISOString().split('T')[0]} → ${END_DATE.toISOString().split('T')[0]}`);
    console.log('\nStats:');
    console.log(`  Customers:   ${stats.customersCreated}`);
    console.log(`  Drivers:     ${stats.driversCreated}`);
    console.log(`  Vehicles:    ${stats.vehiclesCreated}`);
    console.log(`  Vendors:     ${stats.vendorsCreated}`);
    console.log(`  Bookings:    ${stats.bookingsCreated}`);
    console.log(`  Payments:    ${stats.paymentsCreated}`);
    console.log(`  Expenses:    ${stats.expensesCreated}`);
    console.log(`  Invoices:    ${stats.invoicesCreated}`);
    console.log(`  Inquiries:   ${stats.inquiriesCreated}`);
    console.log(`  Leads:       ${stats.leadsCreated}`);
    console.log(`  Quotations:  ${stats.quotationsCreated}`);
    console.log('='.repeat(80));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('🔴 Seed failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createCustomers(tenantId: any) {
  const customers = [];
  const customerData = [
    { name: 'Rajesh Kumar', phone: '919876543210', type: 'individual' },
    { name: 'Priya Sharma', phone: '919876543211', type: 'individual' },
    { name: 'Amit Patel', phone: '919876543212', type: 'corporate' },
    { name: 'Neha Singh', phone: '919876543213', type: 'individual' },
    { name: 'Vikram Reddy', phone: '919876543214', type: 'corporate' },
    { name: 'Ananya Gupta', phone: '919876543215', type: 'individual' },
    { name: 'Rohan Verma', phone: '919876543216', type: 'individual' },
    { name: 'Divya Nair', phone: '919876543217', type: 'individual' },
    { name: 'Sanjay Iyer', phone: '919876543218', type: 'corporate' },
    { name: 'Meera Menon', phone: '919876543219', type: 'individual' },
  ];

  for (const data of customerData) {
    const customer = await Customer.create({
      tenantId,
      name: data.name,
      primaryMobile: data.phone,
      whatsappNumber: data.phone,
      email: `${data.name.toLowerCase().replace(/\s+/g, '.')}@test.com`,
      city: LOCATIONS.INDORE,
      customerType: data.type,
      customerStatus: 'new',
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalSpending: 0,
      rewardPointsBalance: 0,
      createdBy: SEED_ADMIN,
      seedBatch: SEED_BATCH,
    });
    customers.push(customer);
  }

  return customers;
}

async function createDrivers(tenantId: any) {
  const drivers = [];
  const driverData = [
    { name: 'Ravi Kumar', phone: '9111111111', licenseNumber: 'DL-2023-001' },
    { name: 'Suresh Singh', phone: '9111111112', licenseNumber: 'DL-2023-002' },
    { name: 'Mahesh Patel', phone: '9111111113', licenseNumber: 'DL-2023-003' },
    { name: 'Ganesh Sharma', phone: '9111111114', licenseNumber: 'DL-2023-004' },
    { name: 'Ashok Verma', phone: '9111111115', licenseNumber: 'DL-2023-005' },
  ];

  for (const data of driverData) {
    const driver = await Driver.create({
      tenantId,
      name: data.name,
      mobile: data.phone,
      licenseNumber: data.licenseNumber,
      licenseExpiry: new Date('2028-12-31'),
      insRcExpiry: new Date('2027-12-31'),
      status: 'AVAILABLE',
      seedBatch: SEED_BATCH,
      createdAt: new Date(),
    });
    drivers.push(driver);
  }

  return drivers;
}

async function createVehicles(tenantId: any) {
  const vehicles = [];
  const vehicleData = [
    { reg: 'MP04AB1001', model: 'Innova Crysta', seats: 8, fuelType: 'DIESEL' },
    { reg: 'MP04AB1002', model: 'Ertiga', seats: 7, fuelType: 'PETROL' },
    { reg: 'MP04AB1003', model: 'Dzire', seats: 5, fuelType: 'PETROL' },
    { reg: 'MP04AB1004', model: 'Creta', seats: 5, fuelType: 'DIESEL' },
    { reg: 'MP04AB1005', model: 'Innova', seats: 8, fuelType: 'DIESEL' },
  ];

  for (const data of vehicleData) {
    const vehicle = await Vehicle.create({
      tenantId,
      registrationNumber: data.reg,
      model: data.model,
      seatingCapacity: data.seats,
      fuelType: data.fuelType,
      ownership: 'OWN',
      status: 'AVAILABLE',
      currentOdometer: Math.floor(Math.random() * 50000) + 10000,
      seedBatch: SEED_BATCH,
      createdAt: new Date(),
    });
    vehicles.push(vehicle);
  }

  return vehicles;
}

async function createVendors(tenantId: any) {
  const vendors = [];
  const vendorData = [
    { name: 'Vendor A Cabs', contact: '9888888888' },
    { name: 'Vendor B Travel', contact: '9888888889' },
    { name: 'Vendor C Fleet', contact: '9888888890' },
  ];

  for (const data of vendorData) {
    const vendor = await Vendor.create({
      tenantId,
      name: data.name,
      contactPerson: data.name,
      contactPhone: data.contact,
      isActive: true,
      seedBatch: SEED_BATCH,
      createdAt: new Date(),
    });
    vendors.push(vendor);
  }

  return vendors;
}

async function createBookingsPortfolio(
  tenantId: any,
  customers: any[],
  drivers: any[],
  vehicles: any[],
  vendors: any[]
) {
  const bookings = [];
  const payments = [];
  const expenses = [];
  const invoices = [];

  let currentDate = new Date(START_DATE);
  let bookingNumber = 1000;
  let invoiceNumber = 1;

  while (currentDate <= END_DATE) {
    // 2-3 bookings per day
    const bookingsPerDay = Math.random() > 0.5 ? 3 : 2;

    for (let i = 0; i < bookingsPerDay; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const driver = drivers[Math.floor(Math.random() * drivers.length)];
      const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];

      const bookingType = ['ONE_WAY', 'ROUND_TRIP', 'LOCAL'][Math.floor(Math.random() * 3)];
      const totalFare = bookingType === 'LOCAL' ? 500 + Math.random() * 500 : 2000 + Math.random() * 4000;

      const booking = await Booking.create({
        tenantId,
        bookingNumber: `BK${bookingNumber++}`,
        customerId: customer._id,
        driverId: driver._id,
        vehicleId: vehicle._id,
        pickupLocation: LOCATIONS.INDORE,
        dropLocation: bookingType === 'LOCAL' ? LOCATIONS.INDORE : LOCATIONS.UJJAIN,
        bookingType,
        scheduledDate: currentDate,
        status: 'COMPLETED',
        totalFare: Math.round(totalFare),
        advanceAmount: Math.round(totalFare * 0.2),
        balanceAmount: Math.round(totalFare * 0.8),
        seedBatch: SEED_BATCH,
        createdAt: currentDate,
      });
      bookings.push(booking);

      // Create payment
      const payment = await PaymentTransaction.create({
        tenantId,
        bookingId: booking._id,
        customerId: customer._id,
        amount: booking.totalFare,
        paymentMethod: ['CASH', 'ONLINE', 'UPI'][Math.floor(Math.random() * 3)],
        status: 'PAID',
        paidAt: currentDate,
        seedBatch: SEED_BATCH,
        createdAt: currentDate,
      });
      payments.push(payment);

      // Create expenses (fuel, toll, parking)
      if (bookingType !== 'LOCAL') {
        // Fuel
        const fuelAmount = 300 + Math.random() * 200;
        const fuelExpense = await Expense.create({
          tenantId,
          bookingId: booking._id,
          vehicleId: vehicle._id,
          driverId: driver._id,
          category: 'FUEL',
          amount: Math.round(fuelAmount),
          description: 'CNG/Diesel',
          status: 'APPROVED',
          seedBatch: SEED_BATCH,
          createdAt: currentDate,
        });
        expenses.push(fuelExpense);

        // Toll
        const tollExpense = await Expense.create({
          tenantId,
          bookingId: booking._id,
          vehicleId: vehicle._id,
          driverId: driver._id,
          category: 'TOLL',
          amount: Math.round(100 + Math.random() * 200),
          description: 'Highway toll',
          status: 'APPROVED',
          seedBatch: SEED_BATCH,
          createdAt: currentDate,
        });
        expenses.push(tollExpense);

        // Parking
        const parkingExpense = await Expense.create({
          tenantId,
          bookingId: booking._id,
          vehicleId: vehicle._id,
          driverId: driver._id,
          category: 'PARKING',
          amount: Math.round(50 + Math.random() * 100),
          description: 'Destination parking',
          status: 'APPROVED',
          seedBatch: SEED_BATCH,
          createdAt: currentDate,
        });
        expenses.push(parkingExpense);
      }

      // Create invoice
      const invoice = await Invoice.create({
        tenantId,
        customerId: customer._id,
        invoiceNumber: `INV-${String(invoiceNumber++).padStart(5, '0')}`,
        totalAmount: booking.totalFare,
        paidAmount: booking.totalFare,
        outstandingAmount: 0,
        status: 'PAID',
        invoiceDate: currentDate,
        dueDate: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        seedBatch: SEED_BATCH,
        createdAt: currentDate,
      });
      invoices.push(invoice);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { bookings, payments, expenses, invoices };
}

async function createCRMData(tenantId: any, customers: any[]) {
  const inquiries = [];
  const leads = [];
  const quotations = [];

  for (let i = 0; i < 10; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];

    // Create inquiry
    const inquiry = await Inquiry.create({
      tenantId,
      customerId: customer._id,
      inquiryNumber: `INQ-${String(1000 + i).slice(-4)}`,
      subject: ['Airport Transfer', 'City Tour', 'Corporate Transport', 'Wedding Transport'][Math.floor(Math.random() * 4)],
      status: 'CONVERTED',
      seedBatch: SEED_BATCH,
      createdAt: new Date(START_DATE.getTime() + Math.random() * (END_DATE.getTime() - START_DATE.getTime())),
    });
    inquiries.push(inquiry);

    // Create lead
    const lead = await Lead.create({
      tenantId,
      customerId: customer._id,
      leadNumber: `LD-${String(1000 + i).slice(-4)}`,
      source: ['PHONE', 'WHATSAPP', 'WEBSITE'][Math.floor(Math.random() * 3)],
      status: 'QUALIFIED',
      seedBatch: SEED_BATCH,
      createdAt: new Date(START_DATE.getTime() + Math.random() * (END_DATE.getTime() - START_DATE.getTime())),
    });
    leads.push(lead);

    // Create quotation
    const quotation = await Quotation.create({
      tenantId,
      customerId: customer._id,
      quotationNumber: `QT-${String(1000 + i).slice(-4)}`,
      totalAmount: 2000 + Math.random() * 5000,
      status: 'APPROVED',
      seedBatch: SEED_BATCH,
      createdAt: new Date(START_DATE.getTime() + Math.random() * (END_DATE.getTime() - START_DATE.getTime())),
    });
    quotations.push(quotation);
  }

  return { inquiries, leads, quotations };
}

// Run seed
main().catch(console.error);
