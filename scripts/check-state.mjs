import mongoose from 'mongoose';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-main');

  const { Driver, DriverSalaryMaster, DriverAttendance, MonthlyPayroll, Tenant } =
    await import('../server/models/index.ts');

  console.log('========== DATABASE STATE CHECK ==========\n');

  const tenants = await Tenant.countDocuments();
  console.log(`Tenants: ${tenants}`);

  const drivers = await Driver.countDocuments();
  console.log(`Drivers: ${drivers}`);

  const masters = await DriverSalaryMaster.countDocuments();
  console.log(`Driver Salary Masters: ${masters}`);

  const attendance = await DriverAttendance.countDocuments();
  console.log(`Attendance Records: ${attendance}`);

  const payrolls = await MonthlyPayroll.countDocuments();
  console.log(`Monthly Payrolls: ${payrolls}`);

  if (masters > 0) {
    console.log('\n========== SALARY MASTERS SAMPLE ==========');
    const masterList = await DriverSalaryMaster.find().limit(5);
    masterList.forEach(m => {
      console.log(`${m._id}: ${m.name || 'N/A'} - Base: ₹${m.baseSalary}`);
    });
  }

  if (tenants > 0) {
    console.log('\n========== TENANT INFO ==========');
    const tenant = await Tenant.findOne();
    if (tenant) {
      console.log(`ID: ${tenant._id}`);
      console.log(`Name: ${tenant.name}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
