import mongoose from 'mongoose';

async function createBookingTestData() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    const tenantId = '6a85a8f72a327d84cead8194';
    
    console.log('\n📊 Creating Booking System Test Data...\n');
    
    // 1. Create Customers
    console.log('1️⃣ Creating Customers...');
    const customers = [
      { name: 'Rajesh Sharma', phone: '9876543210', email: 'rajesh@example.com', city: 'Delhi' },
      { name: 'Priya Singh', phone: '9876543211', email: 'priya@example.com', city: 'Delhi' },
      { name: 'Amit Patel', phone: '9876543212', email: 'amit@example.com', city: 'Delhi' },
      { name: 'Neha Verma', phone: '9876543213', email: 'neha@example.com', city: 'Delhi' },
      { name: 'Vikram Kumar', phone: '9876543214', email: 'vikram@example.com', city: 'Delhi' }
    ];
    
    const customerDocs = customers.map(c => ({
      ...c,
      tenantId,
      totalBookings: 0,
      totalSpent: 0,
      rating: 4.5,
      createdAt: new Date()
    }));
    
    const customerResult = await db.collection('customers').insertMany(customerDocs);
    console.log(`   ✅ Created ${customerResult.insertedCount} customers\n`);
    
    // 2. Create Vehicles
    console.log('2️⃣ Creating Vehicles...');
    const vehicles = [
      { make: 'Toyota', model: 'Fortuner', licensePlate: 'DL-01-AB-1001', capacity: 4, status: 'available' },
      { make: 'Maruti', model: 'Swift', licensePlate: 'DL-01-AB-1002', capacity: 5, status: 'available' },
      { make: 'Hyundai', model: 'Creta', licensePlate: 'DL-01-AB-1003', capacity: 5, status: 'available' },
      { make: 'Honda', model: 'City', licensePlate: 'DL-01-AB-1004', capacity: 5, status: 'available' },
      { make: 'Tata', model: 'Nexon', licensePlate: 'DL-01-AB-1005', capacity: 5, status: 'available' }
    ];
    
    const vehicleDocs = vehicles.map(v => ({
      ...v,
      tenantId,
      color: 'White',
      year: 2023,
      registrationNumber: v.licensePlate,
      type: 'sedan',
      pricePerDay: 2000,
      pricePerHour: 250,
      pricePerKm: 15,
      createdAt: new Date()
    }));
    
    const vehicleResult = await db.collection('vehicles').insertMany(vehicleDocs);
    console.log(`   ✅ Created ${vehicleResult.insertedCount} vehicles\n`);
    
    // 3. Create Drivers
    console.log('3️⃣ Creating Drivers...');
    const driverNames = [
      'Rajendra Singh', 'Harpreet Kumar', 'Mohammed Ali', 'Suresh Patel', 'Vikram Sharma'
    ];
    
    const drivers = driverNames.map((name, i) => ({
      name,
      phone: `987654321${i}`,
      email: `driver${i}@example.com`,
      licenseNumber: `DL${i}123456`,
      status: 'available',
      totalTrips: 0,
      rating: 4.7,
      tenantId,
      createdAt: new Date()
    }));
    
    const driverResult = await db.collection('drivers').insertMany(drivers);
    console.log(`   ✅ Created ${driverResult.insertedCount} drivers\n`);
    
    // 4. Create Sample Bookings
    console.log('4️⃣ Creating Sample Bookings...');
    
    const now = new Date();
    const bookings = [];
    
    // Today's booking - Trip started
    bookings.push({
      bookingId: 'BK-' + Date.now() + '-001',
      tenantId,
      customerId: customerResult.insertedIds[0],
      customerName: customers[0].name,
      customerPhone: customers[0].phone,
      vehicleId: vehicleResult.insertedIds[0],
      vehicleInfo: { ...vehicles[0], licensePlate: vehicles[0].licensePlate },
      driverId: driverResult.insertedIds[0],
      driverInfo: { name: driverNames[0], phone: `9876543210` },
      pickupLocation: 'Delhi Airport Terminal 3',
      dropoffLocation: 'Hotel Marriott, CP',
      pickupDate: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      dropoffDate: new Date(now.getTime() + 1 * 60 * 60 * 1000), // 1 hour from now
      status: 'trip_started',
      totalAmount: 2500,
      paymentStatus: 'pending',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000)
    });
    
    // Today's booking - Confirmed
    bookings.push({
      bookingId: 'BK-' + Date.now() + '-002',
      tenantId,
      customerId: customerResult.insertedIds[1],
      customerName: customers[1].name,
      customerPhone: customers[1].phone,
      vehicleId: vehicleResult.insertedIds[1],
      vehicleInfo: { ...vehicles[1], licensePlate: vehicles[1].licensePlate },
      driverId: driverResult.insertedIds[1],
      driverInfo: { name: driverNames[1], phone: `9876543211` },
      pickupLocation: 'Connaught Place',
      dropoffLocation: 'Gurgaon Golf Course',
      pickupDate: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3 hours from now
      dropoffDate: new Date(now.getTime() + 5 * 60 * 60 * 1000), // 5 hours from now
      status: 'confirmed',
      totalAmount: 3000,
      paymentStatus: 'pending',
      createdAt: new Date()
    });
    
    // Tomorrow's booking
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    bookings.push({
      bookingId: 'BK-' + Date.now() + '-003',
      tenantId,
      customerId: customerResult.insertedIds[2],
      customerName: customers[2].name,
      customerPhone: customers[2].phone,
      vehicleId: vehicleResult.insertedIds[2],
      vehicleInfo: { ...vehicles[2], licensePlate: vehicles[2].licensePlate },
      driverId: driverResult.insertedIds[2],
      driverInfo: { name: driverNames[2], phone: `9876543212` },
      pickupLocation: 'Delhi Airport Terminal 1',
      dropoffLocation: 'Radisson Blu, Dwarka',
      pickupDate: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000), // 9 AM tomorrow
      dropoffDate: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000), // 2 PM tomorrow
      status: 'confirmed',
      totalAmount: 3500,
      paymentStatus: 'pending',
      createdAt: new Date()
    });
    
    const bookingResult = await db.collection('bookings').insertMany(bookings);
    console.log(`   ✅ Created ${bookingResult.insertedCount} bookings\n`);
    
    console.log('='.repeat(70));
    console.log('✅ TEST DATA CREATED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log(`   • Customers: ${customerResult.insertedCount}`);
    console.log(`   • Vehicles: ${vehicleResult.insertedCount}`);
    console.log(`   • Drivers: ${driverResult.insertedCount}`);
    console.log(`   • Bookings: ${bookingResult.insertedCount}`);
    console.log('\n💡 Now you can:');
    console.log('   1. Refresh your browser');
    console.log('   2. Go to Dashboard → Bookings');
    console.log('   3. See live bookings, upcoming bookings, and booking history');
    console.log('   4. Create new bookings from existing customers/vehicles/drivers\n');
    console.log('='.repeat(70) + '\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createBookingTestData();
