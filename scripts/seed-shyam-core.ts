#!/usr/bin/env ts-node
/**
 * SHYAM TENANT — CORE 15-DAY QA PORTFOLIO SEED
 * Customers, Drivers, Vehicles, Bookings ONLY (no financial records)
 */

import mongoose from 'mongoose';
import { Tenant, Customer, Booking, Vehicle, Driver } from '../server/models';

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
    console.log('✅ MongoDB Connected\n');

    // Find or create Shyam tenant
    console.log('🔍 Locating Shyam tenant...');
    let tenant = await Tenant.findOne({ name: /shyam/i });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Shyam',
        businessName: 'Shyam Cabs',
        isActive: true,
        serviceModes: { selfDrive: true, withDriver: true },
        subscriptionPlan: 'pro',
      });
      console.log(`✅ Created Shyam tenant: ${tenant._id}\n`);
    } else {
      console.log(`✅ Found Shyam tenant: ${tenant._id}\n`);
    }

    const tenantId = tenant._id;

    // Skip duplicate check — allow multiple seed runs to accumulate test data

    // Create customers
    console.log('👥 Creating 10 customers...');
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
    console.log(`✅ Created ${customers.length} customers\n`);

    // Create drivers
    console.log('🚗 Creating 5 drivers...');
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
    console.log(`✅ Created ${drivers.length} drivers\n`);

    // Create vehicles
    console.log('🚙 Creating 5 vehicles...');
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
    console.log(`✅ Created ${vehicles.length} vehicles\n`);

    // Create 37 bookings over 15 days
    console.log('📅 Creating 37 bookings across 15 days...');
    let currentDate = new Date(START_DATE);
    let bookingCount = 0;

    while (currentDate <= END_DATE) {
      const bookingsPerDay = Math.random() > 0.5 ? 3 : 2;

      for (let i = 0; i < bookingsPerDay; i++) {
        const customer = customers[Math.floor(Math.random() * customers.length)];
        const driver = drivers[Math.floor(Math.random() * drivers.length)];
        const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
        const isOutstation = Math.random() > 0.6;
        const totalFare = isOutstation ? 3000 + Math.random() * 3000 : 800 + Math.random() * 700;
        const uniqueId = `${currentDate.getTime()}-${i}-${Math.random().toString(36).substring(7)}`;

        await Booking.create({
          tenantId,
          bookingId: uniqueId,
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
        bookingCount++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`✅ Created ${bookingCount} bookings\n`);

    // Final report
    console.log('='.repeat(70));
    console.log('✅ SEED COMPLETE: SHYAM QA PORTFOLIO');
    console.log('='.repeat(70));
    console.log(`Batch: ${SEED_BATCH}`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Date Range: ${START_DATE.toISOString().split('T')[0]} → ${END_DATE.toISOString().split('T')[0]}`);
    console.log(`\nCore Portfolio Stats:`);
    console.log(`  Customers:   10`);
    console.log(`  Drivers:     5`);
    console.log(`  Vehicles:    5`);
    console.log(`  Bookings:    ${bookingCount}`);
    console.log('='.repeat(70));
    console.log('\n✅ Ready for testing! Login as Shyam tenant to see the data.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('🔴 Seed failed:', error);
    process.exit(1);
  }
}

main();
