// One-time backfill: populate scheduledStartDateTime/scheduledEndDateTime
// on every existing booking. These fields are now the ONLY thing the
// driver/vehicle overlap queries (services/availability.ts) compare
// against — a booking without them can never be detected as a conflict
// source, so this must run before that query change is relied upon in
// production. New/updated bookings get these fields automatically via the
// model's pre-save / pre-findOneAndUpdate hooks (server/models/index.ts);
// this script only covers rows written before those hooks existed.
import 'dotenv/config';
import mongoose from 'mongoose';
import { Booking } from '../server/models/index';

function combineDateAndTime(date: any, time?: string): Date | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  if (time && /^\d{1,2}:\d{2}/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const cursor = Booking.find({
    $or: [{ scheduledStartDateTime: { $exists: false } }, { scheduledStartDateTime: null }],
  }).cursor();

  let updated = 0;
  let skipped = 0;
  for await (const doc of cursor) {
    const start = combineDateAndTime(doc.pickupDate, doc.pickupTime);
    const end = combineDateAndTime(doc.returnDate || doc.pickupDate, doc.returnTime || doc.pickupTime) || start;
    if (!start) { skipped++; continue; }
    await Booking.updateOne(
      { _id: doc._id },
      { $set: { scheduledStartDateTime: start, scheduledEndDateTime: end } }
    );
    updated++;
  }

  console.log(`Backfilled ${updated} bookings. Skipped ${skipped} (no valid pickupDate).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
