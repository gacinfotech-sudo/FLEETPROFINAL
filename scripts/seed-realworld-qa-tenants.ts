#!/usr/bin/env ts-node
/**
 * RAM + SHYAM REAL-WORLD QA TENANT SEEDER
 * 15 days of realistic interconnected operations
 * 2026-08-10 → 2026-08-24
 */

import mongoose from 'mongoose';
import { Tenant, Customer, Driver, Vehicle, Booking, User } from '../server/models';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

const BATCH_RAM = 'RAM_REALWORLD_QA_20260810_V1';
const BATCH_SHYAM = 'SHYAM_REALWORLD_QA_20260810_V1';
const SEED_ADMIN = { userId: 'seed-admin', role: 'admin' };

const START_DATE = new Date('2026-08-10');
const END_DATE = new Date('2026-08-24');

interface TenantConfig {
  name: string;
  id: string;
  batch: string;
  loginEmail: string;
  password: string;
  displayName: string;
}

const LOCATIONS = {
  INDORE: 'Indore',
  AIRPORT: 'Indore Airport',
  VIJAY_NAGAR: 'Vijay Nagar',
  RAILWAY: 'Railway Station',
  UJJAIN: 'Ujjain',
  MAHAKAL: 'Mahakaleshwar',
  OMKARESHWAR: 'Omkareshwar',
  MAHESHWAR: 'Maheshwar',
  BHOPAL: 'Bhopal',
  DEWAS: 'Dewas',
  RADISSON: 'Radisson Hotel',
  SAYAJI: 'Sayaji Hotel',
};

const CUSTOMER_NAMES = [
  'Amit Sharma', 'Rahul Verma', 'Rohit Jain', 'Sandeep Patel', 'Vivek Tiwari',
  'Nitin Gupta', 'Rajesh Yadav', 'Deepak Singh', 'Manish Agrawal', 'Akash Mehta',
  'Pooja Sharma', 'Neha Jain', 'Priya Verma', 'Anjali Gupta', 'Ritu Patel',
  'Kavita Joshi', 'Sneha Desai', 'Divya Nair', 'Isha Bhat', 'Meera Reddy',
  'Sundar Krishnan', 'Vikram Singh', 'Arjun Nayak', 'Sanjay Kumar', 'Ramesh Iyer',
  'Bhavesh Patel', 'Harish Menon', 'Girish Pillai', 'Karthik Subramanian', 'Manoj Deshmukh',
  'Pradeep Sharma', 'Suresh Kumar', 'Anil Verma', 'Ashok Singh', 'Balaji Krishnan',
  'Chandra Mohan', 'Dinesh Rao', 'Eshwar Kumar', 'Farooq Ahmed', 'Gaurav Joshi',
  'Harendra Singh', 'Inderjit Kaur', 'Jitendra Yadav', 'Kailash Nath', 'Lalith Kumar',
  'Madhav Singh', 'Narendra Patel', 'Omkar Joshi', 'Prakash Rao', 'Qasim Ali',
  'Rajendra Singh', 'Saurav Jain', 'Tanuj Sharma', 'Uday Patel', 'Varun Gupta',
  'Wasim Khan', 'Xavier D\'Silva', 'Yogendra Singh', 'Zahir Ahmed', 'Aditya Verma'
];

const DRIVER_NAMES = [
  'Ravi Kumar', 'Alok Singh', 'Sunil Patel', 'Mukesh Rao', 'Rakesh Nair',
  'Vijay Reddy', 'Deepak Sharma', 'Ajay Joshi', 'Sanjay Verma', 'Arun Gupta',
  'Mahesh Desai', 'Rohit Menon', 'Pankaj Pillai', 'Dinesh Iyer', 'Ashok Kumar',
  'Praveen Singh', 'Mohan Rao', 'Naresh Patel'
];

const VEHICLES = [
  { make: 'Toyota', model: 'Innova Crysta', seats: 8 },
  { make: 'Maruti', model: 'Ertiga', seats: 7 },
  { make: 'Maruti', model: 'Dzire', seats: 5 },
  { make: 'Hyundai', model: 'Creta', seats: 5 },
  { make: 'Mahindra', model: 'Bolero', seats: 8 },
  { make: 'Maruti', model: 'Glanza', seats: 5 },
  { make: 'Maruti', model: 'Baleno', seats: 5 },
  { make: 'Maruti', model: 'Ciaz', seats: 5 },
  { make: 'Toyota', model: 'Fortuner', seats: 8 },
  { make: 'Tata', model: 'Nexon', seats: 5 },
  { make: 'Hyundai', model: 'i20', seats: 5 },
  { make: 'Ford', model: 'EcoSport', seats: 5 },
  { make: 'Skoda', model: 'Rapid', seats: 5 },
  { make: 'Toyota', model: 'Etios', seats: 5 },
  { make: 'Maruti', model: 'Swift', seats: 5 },
  { make: 'Hyundai', model: 'Elantra', seats: 5 },
  { make: 'Skoda', model: 'Superb', seats: 5 },
  { make: 'Toyota', model: 'Corolla', seats: 5 },
  { make: 'Maruti', model: 'SX4', seats: 5 },
  { make: 'Tata', model: 'Tigor', seats: 5 }
];

const BOOKING_DAILY_DISTRIBUTION = [6, 8, 9, 10, 7, 11, 12, 8, 6, 10, 9, 12, 8, 11, 7];

class QATenantSeeder {
  private tenantConfig: TenantConfig;
  private tenantId!: mongoose.Types.ObjectId;
  private customers: any[] = [];
  private drivers: any[] = [];
  private vehicles: any[] = [];

  constructor(config: TenantConfig) {
    this.tenantConfig = config;
  }

  async seed() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`SEEDING: ${this.tenantConfig.displayName}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
      // Step 1: Verify tenant
      await this.verifyTenant();

      // Step 2: Create/verify admin user
      await this.createAdminUser();

      // Step 3: Create customers
      await this.createCustomers();

      // Step 4: Create drivers
      await this.createDrivers();

      // Step 5: Create vehicles
      await this.createVehicles();

      // Step 6: Create bookings with interconnected data
      await this.createBookings();

      // Step 7: Report stats
      this.reportStats();

    } catch (error) {
      console.error(`❌ Seed failed for ${this.tenantConfig.displayName}:`, error);
      throw error;
    }
  }

  private async verifyTenant() {
    console.log('Step 1: Verifying tenant...');
    const tenant = await Tenant.findById(this.tenantConfig.id);
    if (!tenant) {
      throw new Error(`Tenant not found: ${this.tenantConfig.id}`);
    }
    this.tenantId = tenant._id;
    console.log(`✓ Tenant found: ${tenant.name}\n`);
  }

  private async createAdminUser() {
    console.log('Step 2: Creating admin user...');

    // Delete existing if needed
    await User.deleteOne({
      userId: this.tenantConfig.loginEmail.split('@')[0],
      tenantId: this.tenantId
    });

    const hashedPassword = await bcrypt.hash(this.tenantConfig.password, 12);
    const user = await User.create({
      userId: this.tenantConfig.loginEmail.split('@')[0],
      name: this.tenantConfig.displayName,
      password: hashedPassword,
      role: 'admin',
      tenantId: this.tenantId,
      isActive: true
    });

    console.log(`✓ Admin created: ${this.tenantConfig.loginEmail}\n`);
  }

  private async createCustomers() {
    console.log(`Step 3: Creating ~60 customers...`);

    const count = 60 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const customer = await Customer.create({
        tenantId: this.tenantId,
        name: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
        primaryMobile: `919${Math.floor(Math.random() * 1000000000)}`.substring(0, 13),
        customerType: Math.random() > 0.8 ? 'corporate' : 'individual',
        customerStatus: 'new',
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalSpending: 0,
        rewardPointsBalance: Math.floor(Math.random() * 5000),
        createdBy: SEED_ADMIN,
        seedBatch: this.tenantConfig.batch
      });
      this.customers.push(customer);
    }
    console.log(`✓ Created ${this.customers.length} customers\n`);
  }

  private async createDrivers() {
    console.log(`Step 4: Creating ${DRIVER_NAMES.length} drivers...`);

    for (let i = 0; i < DRIVER_NAMES.length; i++) {
      const driver = await Driver.create({
        tenantId: this.tenantId,
        name: DRIVER_NAMES[i],
        phone: `919${Math.floor(Math.random() * 1000000000)}`.substring(0, 13),
        licenseNumber: `DL${Math.floor(Math.random() * 100000)}`,
        status: Math.random() > 0.7 ? 'on_duty' : 'available',
        lifecycleStage: 'active',
        seedBatch: this.tenantConfig.batch
      });
      this.drivers.push(driver);
    }
    console.log(`✓ Created ${this.drivers.length} drivers\n`);
  }

  private async createVehicles() {
    console.log(`Step 5: Creating ${VEHICLES.length} vehicles...`);

    for (let i = 0; i < VEHICLES.length; i++) {
      const v = VEHICLES[i];
      const vehicle = await Vehicle.create({
        tenantId: this.tenantId,
        registrationNumber: `MP04AB${9000 + i}`,
        make: v.make,
        model: v.model,
        seatingCapacity: v.seats,
        fuelType: Math.random() > 0.7 ? 'petrol' : 'diesel',
        status: 'available',
        seedBatch: this.tenantConfig.batch
      });
      this.vehicles.push(vehicle);
    }
    console.log(`✓ Created ${this.vehicles.length} vehicles\n`);
  }

  private async createBookings() {
    console.log(`Step 6: Creating ~${BOOKING_DAILY_DISTRIBUTION.reduce((a, b) => a + b, 0)} bookings...`);

    let bookingCount = 0;
    let currentDate = new Date(START_DATE);
    let dayIndex = 0;

    while (currentDate <= END_DATE && dayIndex < BOOKING_DAILY_DISTRIBUTION.length) {
      const bookingsPerDay = BOOKING_DAILY_DISTRIBUTION[dayIndex];

      for (let i = 0; i < bookingsPerDay; i++) {
        const customer = this.customers[Math.floor(Math.random() * this.customers.length)];
        const driver = this.drivers[Math.floor(Math.random() * this.drivers.length)];
        const vehicle = this.vehicles[Math.floor(Math.random() * this.vehicles.length)];

        const isOutstation = Math.random() > 0.65;
        const totalFare = isOutstation ? 3000 + Math.random() * 5000 : 800 + Math.random() * 1200;

        const locations = Object.values(LOCATIONS);
        const pickup = locations[Math.floor(Math.random() * locations.length)];
        const dropoff = isOutstation
          ? locations[Math.floor(Math.random() * locations.length)]
          : pickup;

        const booking = await Booking.create({
          tenantId: this.tenantId,
          bookingId: `${this.tenantConfig.name.toUpperCase()}-${Date.now()}-${nanoid(6)}`,
          customerId: customer._id,
          customerName: customer.name,
          customerPhone: customer.primaryMobile,
          driverId: driver._id,
          vehicleId: vehicle._id,
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          pickupDate: currentDate,
          bookingType: isOutstation ? 'one_way' : 'local',
          status: 'completed',
          totalAmount: Math.round(totalFare),
          seedBatch: this.tenantConfig.batch,
          createdAt: currentDate
        });

        bookingCount++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
      dayIndex++;
    }

    console.log(`✓ Created ${bookingCount} bookings\n`);
  }

  private reportStats() {
    console.log(`${'='.repeat(70)}`);
    console.log(`✅ ${this.tenantConfig.displayName} SEED COMPLETE`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\nLogin Credentials:`);
    console.log(`  Email: ${this.tenantConfig.loginEmail}`);
    console.log(`  Password: ${this.tenantConfig.password}`);
    console.log(`\nData Counts:`);
    console.log(`  Customers: ${this.customers.length}`);
    console.log(`  Drivers: ${this.drivers.length}`);
    console.log(`  Vehicles: ${this.vehicles.length}`);
    console.log(`  Bookings: ~${BOOKING_DAILY_DISTRIBUTION.reduce((a, b) => a + b, 0)}`);
    console.log(`\nDate Range: 2026-08-10 → 2026-08-24\n`);
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
  await mongoose.connect(uri);

  try {
    // Seed RAM
    const ramSeeder = new QATenantSeeder({
      name: 'ram',
      id: '6a7617d741d6ae595bc7a110',
      batch: BATCH_RAM,
      loginEmail: 'ram.qa@fleetpro.test',
      password: 'Ram@Fleet2026#QA',
      displayName: 'Ram'
    });
    await ramSeeder.seed();

    // Seed SHYAM
    const shyamSeeder = new QATenantSeeder({
      name: 'shyam',
      id: '6a78bf42e6cfc1c40ee98c02',
      batch: BATCH_SHYAM,
      loginEmail: 'shyam.qa@fleetpro.test',
      password: 'Shyam@Fleet2026#QA',
      displayName: 'Shyam'
    });
    await shyamSeeder.seed();

    console.log('\n' + '='.repeat(70));
    console.log('✅✅ BOTH TENANTS SEEDED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('\n🎯 Next: Test login for both tenants\n');

  } finally {
    await mongoose.disconnect();
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
