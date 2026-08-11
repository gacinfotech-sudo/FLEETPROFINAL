#!/usr/bin/env ts-node
/**
 * SHYAM TENANT — FAST 15-DAY QA PORTFOLIO SEED
 * Simplified version with schema-compliant fields only
 */

import mongoose from 'mongoose';
import {
  Tenant,
  Customer,
  Booking,
  Vehicle,
  Driver,
  PaymentTransaction,
  Expense,
  Invoice,
} from '../server/models';

const SEED_BATCH = 'SHYAM_QA_20260809_V1';
const START_DATE = new Date('2026-08-09');
const END_DATE = new Date('2026-08-23');
const ADMIN_USER = { userId: 'seed-admin', role: 'admin' };

const LOCATIONS = {
  INDORE: 'Indore',
  UJJAIN: 'Ujjain',
  AIRPORT: 'Indore Airport',
};

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');

    // Find or create Shyam tenant
    console.log('\n🔍 Locating Shyam tenant...');
    let tenant = await Tenant.findOne({ name: /shyam/i });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Shyam',
        businessName: 'Shyam Cabs',
        isActive: true,
        serviceModes: { selfDrive: true, withDriver: true },
        subscriptionPlan: 'pro',
      });
      console.log(`✅ Created Shyam tenant: ${tenant._id}`);
    } else {
      console.log(`✅ Found Shyam tenant: ${tenant._id}`);
    }

    // Check for existing seed
    const existing = await Booking.countDocuments({ tenantId: tenant._id, seedBatch: SEED_BATCH });
    if (existing > 0) {
      console.log(`⚠️ Found ${existing} existing records from ${SEED_BATCH}`);
      process.exit(0);
    }

    const tenantId = tenant._id;
    let stats = {
      customers: 0,
      drivers: 0,
      vehicles: 0,
      bookings: 0,
      payments: 0,
      expenses: 0,
      invoices: 0,
    };

    // Create customers
    console.log('\n👥 Creating 10 customers...');
    const customers = [];
    for (let i = 0; i < 10; i++) {
      const customer = await Customer.create({
        tenantId,
        name: `Customer ${i + 1}`,
        primaryMobile: `919876543${String(i).padStart(3, '0')}`,
        customerType: i % 3 === 0 ? 'corporate' : 'individual',
        customerStatus: 'new',
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalSpending: 0,
        rewardPointsBalance: 0,
        createdBy: ADMIN_USER,
        seedBatch: SEED_BATCH,
      });
      customers.push(customer);
    }
    stats.customers = customers.length;
    console.log(`✅ Created ${customers.length} customers`);

    // Create drivers
    console.log('\n🚗 Creating 5 drivers...');
    const drivers = [];
    const driverNames = ['Ravi', 'Suresh', 'Mahesh', 'Ganesh', 'Ashok'];
    for (let i = 0; i < 5; i++) {
      const driver = await Driver.create({
        tenantId,
        name: `${driverNames[i]} Kumar`,
        phone: `919111111${String(i).padStart(3, '0')}`,
        licenseNumber: `DL-2023-${String(i + 1).padStart(3, '0')}`,
        status: 'available',
        lifecycleStage: 'active',
        seedBatch: SEED_BATCH,
      });
      drivers.push(driver);
    }
    stats.drivers = drivers.length;
    console.log(`✅ Created ${drivers.length} drivers`);

    // Create vehicles
    console.log('\n🚙 Creating 5 vehicles...');
    const vehicles = [];
    const vehicleModels = ['Toyota', 'Maruti', 'Hyundai', 'Tata', 'Mahindra'];
    const vehicleNames = ['Innova Crysta', 'Ertiga', 'Dzire', 'Creta', 'Innova'];
    for (let i = 0; i < 5; i++) {
      const vehicle = await Vehicle.create({
        tenantId,
        registrationNumber: `MP04AB100${i + 1}`,
        make: vehicleModels[i],
        model: vehicleNames[i],
        seatingCapacity: i === 0 || i === 4 ? 8 : i === 1 ? 7 : 5,
        fuelType: i % 2 === 0 ? 'DIESEL' : 'PETROL',
        status: 'available',
        seedBatch: SEED_BATCH,
      });
      vehicles.push(vehicle);
    }
    stats.vehicles = vehicles.length;
    console.log(`✅ Created ${vehicles.length} vehicles`);

    // Create 37 bookings over 15 days
    console.log('\n📅 Creating 37 bookings...');
    let currentDate = new Date(START_DATE);
    let bookingNumber = 1000;
    let invoiceNumber = 1;

    while (currentDate <= END_DATE) {
      const bookingsPerDay = Math.random() > 0.5 ? 3 : 2;

      for (let i = 0; i < bookingsPerDay; i++) {
        const customer = customers[Math.floor(Math.random() * customers.length)];
        const driver = drivers[Math.floor(Math.random() * drivers.length)];
        const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
        const isOutstation = Math.random() > 0.6;
        const totalFare = isOutstation ? 3000 + Math.random() * 3000 : 800 + Math.random() * 700;

        const booking = await Booking.create({
          tenantId,
          bookingId: `BK${bookingNumber++}`,
          customerId: customer._id,
          customerName: customer.name,
          customerPhone: customer.primaryMobile,
          driverId: driver._id,
          vehicleId: vehicle._id,
          pickupLocation: LOCATIONS.INDORE,
          dropoffLocation: isOutstation ? LOCATIONS.UJJAIN : LOCATIONS.INDORE,
          pickupDate: currentDate,
          bookingType: isOutstation ? 'one_way' : 'local',
          status: 'completed',
          totalAmount: Math.round(totalFare),
          seedBatch: SEED_BATCH,
          createdAt: currentDate,
        });

        // Create payment
        await PaymentTransaction.create({
          tenantId,
          bookingId: booking._id,
          customerId: customer._id,
          amount: booking.totalFare,
          paymentMethod: ['CASH', 'ONLINE'][Math.floor(Math.random() * 2)],
          status: 'PAID',
          paidAt: currentDate,
          seedBatch: SEED_BATCH,
        });

        // Create expenses for outstation
        if (isOutstation) {
          await Expense.create({
            tenantId,
            bookingId: booking._id,
            vehicleId: vehicle._id,
            driverId: driver._id,
            category: 'FUEL',
            amount: Math.round(300 + Math.random() * 200),
            status: 'APPROVED',
            seedBatch: SEED_BATCH,
          });

          await Expense.create({
            tenantId,
            bookingId: booking._id,
            vehicleId: vehicle._id,
            driverId: driver._id,
            category: 'TOLL',
            amount: Math.round(100 + Math.random() * 100),
            status: 'APPROVED',
            seedBatch: SEED_BATCH,
          });
        }

        // Create invoice
        await Invoice.create({
          tenantId,
          customerId: customer._id,
          invoiceNumber: `INV-${String(invoiceNumber++).padStart(5, '0')}`,
          totalAmount: booking.totalFare,
          paidAmount: booking.totalFare,
          outstandingAmount: 0,
          status: 'PAID',
          invoiceDate: currentDate,
          seedBatch: SEED_BATCH,
        });

        stats.bookings++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    stats.payments = await PaymentTransaction.countDocuments({ tenantId, seedBatch: SEED_BATCH });
    stats.expenses = await Expense.countDocuments({ tenantId, seedBatch: SEED_BATCH });
    stats.invoices = await Invoice.countDocuments({ tenantId, seedBatch: SEED_BATCH });

    // Final report
    console.log('\n' + '='.repeat(70));
    console.log('✅ SEED COMPLETE: SHYAM QA PORTFOLIO');
    console.log('='.repeat(70));
    console.log(`Batch: ${SEED_BATCH}`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Date Range: ${START_DATE.toISOString().split('T')[0]} → ${END_DATE.toISOString().split('T')[0]}`);
    console.log(`\nStats:`);
    console.log(`  Customers:   ${stats.customers}`);
    console.log(`  Drivers:     ${stats.drivers}`);
    console.log(`  Vehicles:    ${stats.vehicles}`);
    console.log(`  Bookings:    ${stats.bookings}`);
    console.log(`  Payments:    ${stats.payments}`);
    console.log(`  Expenses:    ${stats.expenses}`);
    console.log(`  Invoices:    ${stats.invoices}`);
    console.log('='.repeat(70));

    await mongoose.connection.close();
    console.log('\n✅ Seed complete and database closed');
    process.exit(0);
  } catch (error) {
    console.error('🔴 Seed failed:', error);
    process.exit(1);
  }
}

main();
