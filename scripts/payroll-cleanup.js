#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupOrphanedMasters() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';

  console.log('\n' + '='.repeat(100));
  console.log('PAYROLL CLEANUP: ARCHIVE ORPHANED SALARY MASTERS');
  console.log('='.repeat(100) + '\n');

  try {
    await mongoose.connect(mongoURI);
    const db = mongoose.connection.db;
    console.log('✅ Connected to MongoDB\n');

    // Get active drivers
    const activeDrivers = await db.collection('drivers').find({
      status: 'active'
    }).project({ _id: 1 }).toArray();

    const activeDriverIds = new Set(activeDrivers.map(d => d._id.toString()));
    console.log(`Found ${activeDrivers.length} active drivers\n`);

    // Find orphaned masters
    console.log('📋 Finding orphaned salary masters...');
    const allSalaryMasters = await db.collection('driversalarymaster').find({}).toArray();

    const orphanedMasters = allSalaryMasters.filter(
      m => !activeDriverIds.has(m.driverId.toString())
    );

    console.log(`Total salary masters: ${allSalaryMasters.length}`);
    console.log(`Orphaned (inactive driver): ${orphanedMasters.length}\n`);

    if (orphanedMasters.length === 0) {
      console.log('✅ No orphaned salary masters to clean up');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Archive orphaned masters (set status to 'archived')
    console.log('📋 Archiving orphaned salary masters...\n');

    const orphanedIds = orphanedMasters.map(m => m._id);

    const result = await db.collection('driversalarymaster').updateMany(
      { _id: { $in: orphanedIds } },
      {
        $set: {
          status: 'archived',
          archivedAt: new Date(),
          archivedReason: 'Orphaned - driver inactive or deleted'
        }
      }
    );

    console.log(`✅ Archived ${result.modifiedCount} salary masters\n`);

    // Verify
    const archivedCount = await db.collection('driversalarymaster').countDocuments({
      status: 'archived'
    });

    console.log(`Verification: ${archivedCount} salary masters now have status='archived'\n`);

    // Sample archived records
    console.log('Sample archived records:');
    const samples = await db.collection('driversalarymaster')
      .find({ status: 'archived' })
      .limit(5)
      .toArray();

    samples.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.name} - ${m.salaryType} - ₹${m.baseSalary}`);
    });

    if (archivedCount > 5) {
      console.log(`   ... and ${archivedCount - 5} more`);
    }

    console.log('\n' + '='.repeat(100));
    console.log('CLEANUP COMPLETE');
    console.log('='.repeat(100) + '\n');

    const finalResult = {
      totalSalaryMasters: allSalaryMasters.length,
      activeSalaryMasters: allSalaryMasters.length - orphanedMasters.length,
      archivedSalaryMasters: result.modifiedCount,
      status: 'success',
      message: `${result.modifiedCount} orphaned salary masters archived. Historical records preserved.`
    };

    console.log(JSON.stringify(finalResult, null, 2));
    console.log();

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanupOrphanedMasters();
