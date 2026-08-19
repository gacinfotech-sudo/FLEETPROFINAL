import mongoose from 'mongoose';

async function auditBookingSystem() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    const tenantId = '6a85a8f72a327d84cead8194';
    
    console.log('\n' + '='.repeat(70));
    console.log('🔍 BOOKING SYSTEM COMPREHENSIVE AUDIT');
    console.log('='.repeat(70) + '\n');
    
    // 1. Check Customers
    console.log('1️⃣ CUSTOMERS');
    console.log('-'.repeat(70));
    const customers = await db.collection('customers').find({ tenantId }).toArray();
    console.log(`   Total: ${customers.length}`);
    if (customers.length > 0) {
      customers.slice(0, 3).forEach(c => {
        console.log(`   ✓ ${c.name} (${c.phone}) - ${c.email}`);
      });
    } else {
      console.log('   ⚠️  NO CUSTOMERS FOUND');
    }
    
    // 2. Check Vehicles
    console.log('\n2️⃣ VEHICLES');
    console.log('-'.repeat(70));
    const vehicles = await db.collection('vehicles').find({ tenantId }).toArray();
    console.log(`   Total: ${vehicles.length}`);
    if (vehicles.length > 0) {
      vehicles.slice(0, 3).forEach(v => {
        console.log(`   ✓ ${v.make} (${v.licensePlate}) - Status: ${v.status}`);
      });
    } else {
      console.log('   ⚠️  NO VEHICLES FOUND');
    }
    
    // 3. Check Drivers
    console.log('\n3️⃣ DRIVERS');
    console.log('-'.repeat(70));
    const drivers = await db.collection('drivers').find({ tenantId }).toArray();
    console.log(`   Total: ${drivers.length}`);
    if (drivers.length > 0) {
      drivers.slice(0, 3).forEach(d => {
        console.log(`   ✓ ${d.name} (${d.phone}) - Status: ${d.status}`);
      });
    } else {
      console.log('   ⚠️  NO DRIVERS FOUND');
    }
    
    // 4. Check Bookings
    console.log('\n4️⃣ BOOKINGS');
    console.log('-'.repeat(70));
    const bookings = await db.collection('bookings').find({ tenantId }).toArray();
    console.log(`   Total: ${bookings.length}`);
    
    if (bookings.length > 0) {
      console.log('\n   📊 Booking Status Distribution:');
      const statusCounts = {};
      bookings.forEach(b => {
        statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });
      
      console.log('\n   🔍 Recent Bookings:');
      const recent = bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
      recent.forEach(b => {
        console.log(`      ✓ ID: ${b.bookingId}`);
        console.log(`        Customer: ${b.customerName || 'N/A'}`);
        console.log(`        Vehicle: ${b.vehicleInfo?.make || 'N/A'}`);
        console.log(`        Driver: ${b.driverInfo?.name || 'N/A'}`);
        console.log(`        Status: ${b.status}`);
        console.log(`        Amount: ₹${b.totalAmount || 0}`);
      });
    } else {
      console.log('   ⚠️  NO BOOKINGS FOUND');
    }
    
    // 5. Check for Data Integrity Issues
    console.log('\n5️⃣ DATA INTEGRITY CHECK');
    console.log('-'.repeat(70));
    
    let issues = 0;
    
    // Check bookings with missing customer
    const bookingsNoCustomer = await db.collection('bookings').countDocuments({
      tenantId,
      $or: [
        { customerName: { $exists: false } },
        { customerName: null },
        { customerName: '' }
      ]
    });
    if (bookingsNoCustomer > 0) {
      console.log(`   ❌ ${bookingsNoCustomer} bookings missing customer name`);
      issues++;
    }
    
    // Check bookings with missing vehicle
    const bookingsNoVehicle = await db.collection('bookings').countDocuments({
      tenantId,
      $or: [
        { vehicleInfo: { $exists: false } },
        { vehicleInfo: null }
      ]
    });
    if (bookingsNoVehicle > 0) {
      console.log(`   ❌ ${bookingsNoVehicle} bookings missing vehicle info`);
      issues++;
    }
    
    // Check bookings with missing amount
    const bookingsNoAmount = await db.collection('bookings').countDocuments({
      tenantId,
      $or: [
        { totalAmount: { $exists: false } },
        { totalAmount: null },
        { totalAmount: 0 }
      ]
    });
    if (bookingsNoAmount > 0) {
      console.log(`   ⚠️  ${bookingsNoAmount} bookings with zero/missing amount`);
      issues++;
    }
    
    // Check vehicles with invalid status
    const vehicleStatusCheck = await db.collection('vehicles').find({
      tenantId,
      status: { $nin: ['available', 'on_trip', 'maintenance', 'RESERVED', 'ASSIGNED', 'RETURNING', 'CLEANING', 'MAINTENANCE_DUE', 'IN_MAINTENANCE', 'BREAKDOWN', 'ACCIDENT_HOLD', 'INACTIVE', 'SOLD'] }
    }).toArray();
    if (vehicleStatusCheck.length > 0) {
      console.log(`   ❌ ${vehicleStatusCheck.length} vehicles with invalid status`);
      issues++;
    }
    
    // Check drivers with invalid status
    const driverStatusCheck = await db.collection('drivers').find({
      tenantId,
      status: { $nin: ['available', 'on_duty', 'inactive', 'on_leave'] }
    }).toArray();
    if (driverStatusCheck.length > 0) {
      console.log(`   ❌ ${driverStatusCheck.length} drivers with invalid status`);
      issues++;
    }
    
    if (issues === 0) {
      console.log('   ✅ No data integrity issues found!');
    }
    
    // 6. Check API Collections
    console.log('\n6️⃣ WHATSAPP & REMINDER DATA');
    console.log('-'.repeat(70));
    
    const reminders = await db.collection('whatsapp_reminders').countDocuments({ tenantId });
    const settings = await db.collection('whatsapp_reminder_settings').countDocuments({ tenantId });
    const sessions = await db.collection('whatsapp_sessions_permanent').countDocuments({ tenantId });
    
    console.log(`   WhatsApp Reminders: ${reminders}`);
    console.log(`   Reminder Settings: ${settings}`);
    console.log(`   WhatsApp Sessions: ${sessions}`);
    
    // 7. Summary
    console.log('\n7️⃣ SUMMARY');
    console.log('-'.repeat(70));
    console.log(`   ✅ Customers: ${customers.length}`);
    console.log(`   ✅ Vehicles: ${vehicles.length}`);
    console.log(`   ✅ Drivers: ${drivers.length}`);
    console.log(`   ✅ Bookings: ${bookings.length}`);
    console.log(`   ${issues === 0 ? '✅' : '❌'} Data Issues: ${issues}`);
    
    if (customers.length === 0 || vehicles.length === 0 || drivers.length === 0) {
      console.log('\n⚠️  RECOMMENDATION: Create test data (customers, vehicles, drivers)');
      console.log('    before creating bookings!\n');
    } else if (bookings.length === 0) {
      console.log('\n💡 INFO: No bookings yet. System is ready for bookings.\n');
    } else {
      console.log('\n✅ System is operational!\n');
    }
    
    console.log('='.repeat(70) + '\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

auditBookingSystem();
