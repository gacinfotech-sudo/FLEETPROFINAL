import mongoose from 'mongoose';
import { Booking, PaymentTransaction } from '../server/models/index';
import { recordPayment, recomputeBookingPaymentSummary } from '../server/services/paymentLedger';

async function testPaymentWorkflow() {
  try {
    console.log('Testing Payment Workflow...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Step 1: Find or create a booking with outstanding balance
    console.log('Step 1: Finding booking with outstanding balance...');
    let booking = await Booking.findOne({
      status: { $ne: 'cancelled' },
      $expr: {
        $gt: ['$totalAmount', '$advanceReceived']
      }
    }).sort({ createdAt: -1 });

    if (!booking) {
      // Create a test booking with balance
      console.log('  → No bookings with balance found, creating test booking...');
      booking = await Booking.create({
        bookingId: `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerName: 'Payment Test Customer',
        customerPhone: '9' + Math.random().toString().slice(2, 11),
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        pickupTime: '10:00',
        returnDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
        returnTime: '18:00',
        totalAmount: 5000, // ₹5000
        advanceReceived: 1500, // ₹1500 advance
        paymentStatus: 'pending',
        status: 'created',
        serviceMode: 'self_drive',
        tenantId: new mongoose.Types.ObjectId(),
        bookingType: 'self_drive',
        estimatedHours: 24
      });
    }

    console.log(`✓ Found/Created booking: ${booking._id}`);
    console.log(`  - Booking ID: ${booking.bookingId}`);
    console.log(`  - Customer: ${booking.customerName}`);
    console.log(`  - Total Amount: ₹${booking.totalAmount}`);
    console.log(`  - Advance Received: ₹${booking.advanceReceived || 0}`);
    console.log(`  - Payment Status: ${booking.paymentStatus || 'pending'}`);

    const dueAmount = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0));
    console.log(`  - Due Amount: ₹${dueAmount}`);

    // Step 2: Record full payment
    console.log('\nStep 2: Recording full payment...');
    let paymentId = 'N/A';
    if (dueAmount > 0) {
      try {
        const result = await recordPayment({
          tenantId: booking.tenantId?.toString() || 'default',
          bookingId: booking._id.toString(),
          amount: dueAmount,
          paymentType: 'final_payment',
          paymentMode: 'cash',
          receivedBy: 'Test Admin',
          notes: 'Full payment test',
          createdBy: { userId: 'system', role: 'admin' }
        });

        paymentId = result.transaction?._id?.toString() || 'N/A';
        console.log(`✓ Payment recorded: ${paymentId}`);
        console.log(`  - Amount: ₹${dueAmount}`);
        console.log(`  - Type: final_payment`);
        console.log(`  - Mode: cash`);
      } catch (err: any) {
        console.log(`✗ Failed to record payment: ${err.message}`);
        return;
      }
    } else {
      console.log('SKIPPED: Booking already fully paid (₹0 due)');
    }

    // Step 3: Verify updated booking
    console.log('\nStep 3: Verifying payment status...');
    const updatedBooking = await Booking.findOne({ _id: booking._id });

    if (!updatedBooking) {
      console.log('FAIL: Updated booking not found');
      return;
    }

    const updatedDueAmount = Math.max(0, (updatedBooking.totalAmount || 0) - (updatedBooking.advanceReceived || 0));
    const paymentStatus = updatedBooking.paymentStatus || 'pending';

    console.log(`✓ Updated Booking:`);
    console.log(`  - Payment Status: ${paymentStatus}`);
    console.log(`  - Advance Received: ₹${updatedBooking.advanceReceived || 0}`);
    console.log(`  - Total Amount: ₹${updatedBooking.totalAmount}`);
    console.log(`  - Due Amount: ₹${updatedDueAmount}`);

    // Step 4: Verify conditions
    console.log('\nStep 4: Verification Results:');
    const paymentStatusCorrect = paymentStatus === 'paid' || paymentStatus === 'full_paid' || updatedDueAmount === 0;
    const dueAmountCorrect = updatedDueAmount === 0;

    console.log(`  payment_status = 'paid' or due = 0: ${paymentStatusCorrect ? '✓ PASS' : '✗ FAIL'} (status: ${paymentStatus}, due: ₹${updatedDueAmount})`);
    console.log(`  due_amount = 0: ${dueAmountCorrect ? '✓ PASS' : '✗ FAIL'} (₹${updatedDueAmount})`);

    // Generate final report
    console.log('\n' + '='.repeat(50));
    console.log('PAYMENT WORKFLOW TEST REPORT');
    console.log('='.repeat(50));
    console.log(`Payment ID: ${paymentId}`);
    console.log(`Status: ${paymentStatus}`);
    console.log(`Due Amount: ₹${updatedDueAmount}`);
    console.log(`Result: ${(paymentStatusCorrect && dueAmountCorrect) ? '✓ PASS' : '✗ FAIL'}`);
    console.log('='.repeat(50));

    // Detailed verification
    console.log('\nDetailed Verification:');
    console.log(`1. payment_status_correct: ${paymentStatusCorrect}`);
    console.log(`2. due_amount_zero: ${dueAmountCorrect}`);
    console.log(`3. Full payment recorded: ${dueAmount > 0 ? 'Yes (₹' + dueAmount + ')' : 'No (already paid)'}`);
    console.log(`4. Booking ID verified: ${booking._id}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testPaymentWorkflow().catch(console.error);
