import 'dotenv/config';
import mongoose from 'mongoose';
import { Customer } from '../server/models/index';

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);
  const customers = await Customer.find({
    $or: [{ customerCode: { $exists: false } }, { customerCode: null }, { customerCode: '' }],
  }).select('_id tenantId customerCode');

  const planned = customers.map((customer) => ({
    id: customer._id,
    tenantId: customer.tenantId,
    customerCode: `CUS-${customer._id.toString().slice(-8).toUpperCase()}`,
  }));
  const codes = new Set(planned.map((row) => `${row.tenantId}:${row.customerCode}`));
  if (codes.size !== planned.length) throw new Error('Generated customer-code collision detected.');

  if (apply && planned.length) {
    await Customer.bulkWrite(planned.map((row) => ({
      updateOne: {
        filter: { _id: row.id, tenantId: row.tenantId, customerCode: { $in: [null, ''] } },
        update: { $set: { customerCode: row.customerCode } },
      },
    })), { ordered: false });
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', customers: planned.length }));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error?.message || error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
