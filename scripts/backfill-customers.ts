// One-time backfill: every booking created before the Customer Database
// existed has customerName/customerPhone embedded but no customerId. This
// finds-or-creates a Customer per unique normalized mobile number (reusing
// the exact same findOrCreateCustomer used by live booking creation, so
// backfilled and future customers dedupe identically), links each booking,
// and recomputes every touched customer's stats once at the end — not per
// booking, since that would be O(n²) rework for a customer with many
// bookings. The booking's own customerName/customerPhone fields are never
// modified — this only ever adds customerId, preserving the historical
// snapshot per the "do not modify historical booking details" requirement.
import 'dotenv/config';
import mongoose from 'mongoose';
import { Booking } from '../server/models/index';
import { findOrCreateCustomer, recomputeCustomerStats } from '../server/services/customerService';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const unlinked = await Booking.find({ customerId: { $exists: false } });
  console.log(`Found ${unlinked.length} bookings without a linked customer.`);

  const touchedCustomerIds = new Set<string>();
  let linked = 0;
  let skipped = 0;

  for (const booking of unlinked) {
    try {
      const { customer } = await findOrCreateCustomer(
        booking.tenantId.toString(),
        { name: booking.customerName, phone: booking.customerPhone, email: booking.customerEmail },
        { userId: 'system', role: 'migration' }
      );
      booking.customerId = customer._id;
      await booking.save();
      touchedCustomerIds.add(customer._id.toString());
      linked++;
    } catch (err: any) {
      console.error(`Skipped booking ${booking.bookingId}: ${err?.message || err}`);
      skipped++;
    }
  }

  console.log(`Linked ${linked} bookings, skipped ${skipped} (invalid phone). Recomputing stats for ${touchedCustomerIds.size} customers...`);
  for (const customerId of touchedCustomerIds) {
    await recomputeCustomerStats(customerId);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
