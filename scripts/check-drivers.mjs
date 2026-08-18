import mongoose from 'mongoose';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-main');

  const { Driver } = await import('../server/models/index.ts');

  const drivers = await Driver.find();
  console.log(`Total drivers: ${drivers.length}`);
  console.log(`\nDriver statuses and details:`);

  const statuses = {};
  drivers.forEach(d => {
    statuses[d.status] = (statuses[d.status] || 0) + 1;
  });

  console.log('Status distribution:', statuses);

  console.log('\nFirst 15 drivers:');
  drivers.slice(0, 15).forEach(d => {
    console.log(`- ${d.name} (${d._id}) - Status: ${d.status}, Lifecycle: ${d.lifecycleStage || 'N/A'}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
