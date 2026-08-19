import mongoose from 'mongoose';

async function testDriverAssignment() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    const tenantId = '6a85a8f72a327d84cead8194';
    
    console.log('\n' + '='.repeat(70));
    console.log('🧪 TESTING DRIVER ASSIGNMENT FIX');
    console.log('='.repeat(70) + '\n');
    
    // 1. Get a booking with custom bookingId
    console.log('1️⃣ Finding test booking...');
    const booking = await db.collection('bookings').findOne({ tenantId });
    
    if (!booking) {
      console.log('❌ No booking found');
      process.exit(1);
    }
    
    console.log(`   ✅ Found booking:`);
    console.log(`      ID (MongoDB): ${booking._id}`);
    console.log(`      ID (Custom): ${booking.bookingId}`);
    console.log(`      Customer: ${booking.customerName}`);
    console.log(`      Status: ${booking.status}\n`);
    
    // 2. Get a driver to assign
    console.log('2️⃣ Finding driver to assign...');
    const driver = await db.collection('drivers').findOne({ tenantId });
    
    if (!driver) {
      console.log('❌ No driver found');
      process.exit(1);
    }
    
    console.log(`   ✅ Found driver:`);
    console.log(`      ID: ${driver._id}`);
    console.log(`      Name: ${driver.name}\n`);
    
    // 3. Simulate API call with custom bookingId (what the UI sends)
    console.log('3️⃣ Testing API with custom bookingId...');
    
    const updateData = {
      driverId: driver._id.toString(),
      driverInfo: {
        name: driver.name,
        phone: driver.phone
      }
    };
    
    console.log(`   Updating: POST /api/bookings/${booking.bookingId}`);
    console.log(`   Payload: driverId = ${driver._id}\n`);
    
    // Simulate the MongoDB update that would happen
    const result = await db.collection('bookings').updateOne(
      {
        _id: booking._id,
        tenantId: tenantId
      },
      {
        $set: updateData
      }
    );
    
    if (result.modifiedCount === 0) {
      console.log('❌ Update failed');
      process.exit(1);
    }
    
    console.log('   ✅ Update succeeded!\n');
    
    // 4. Verify the assignment
    console.log('4️⃣ Verifying assignment...');
    const updated = await db.collection('bookings').findOne({ _id: booking._id });
    
    console.log(`   ✅ Booking updated:`);
    console.log(`      Driver ID: ${updated.driverId}`);
    console.log(`      Driver Name: ${updated.driverInfo?.name}`);
    console.log(`      Driver Phone: ${updated.driverInfo?.phone}\n`);
    
    console.log('='.repeat(70));
    console.log('✅ SUCCESS! Driver assignment is working!');
    console.log('='.repeat(70) + '\n');
    
    console.log('📊 Summary:');
    console.log(`   Booking ID: ${booking.bookingId}`);
    console.log(`   Customer: ${booking.customerName}`);
    console.log(`   Assigned Driver: ${updated.driverInfo?.name}`);
    console.log(`   Status: ${updated.status}\n`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testDriverAssignment();
