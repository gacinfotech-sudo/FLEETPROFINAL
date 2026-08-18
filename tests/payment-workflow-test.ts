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

    // Step 1: Get recent booking
    console.log('Step 1: Fetching recent booking...');
    const booking = await Booking.findOne(
      { status: { $ne: 'cancelled' } }
    ).sort({ createdAt: -1 });

    if (!booking) {
      console.log('FAIL: No bookings found in database');
      return;
    }

    console.log(`✓ Found booking: ${booking._id}`);
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
      } catch (err: any) {
        console.log(`✗ Failed to record payment: ${err.message}`);
        return;
      }
    } else {
      console.log('SKIPPED: Booking already fully paid');
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

    console.log(`  payment_status indicates full payment: ${paymentStatusCorrect ? '✓ PASS' : '✗ FAIL'} (status: ${paymentStatus})`);
    console.log(`  due_amount = 0: ${dueAmountCorrect ? '✓ PASS' : '✗ FAIL'} (₹${updatedDueAmount})`);

    // Generate report
    console.log('\n' + '='.repeat(50));
    console.log('PAYMENT WORKFLOW TEST REPORT');
    console.log('='.repeat(50));
    console.log(`Payment ID: ${paymentId}`);
    console.log(`Status: ${paymentStatus}`);
    console.log(`Due Amount: ₹${updatedDueAmount}`);
    console.log(`Result: ${(paymentStatusCorrect && dueAmountCorrect) ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testPaymentWorkflow().catch(console.error);
