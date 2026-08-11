import mongoose from 'mongoose';
import { DriverSalaryMaster, IDriverSalaryMaster, Driver, IDriver } from '../models/index';

export interface CreateSalaryMasterInput {
  tenantId: string;
  driverId: string;
  salaryType: 'fixed_monthly' | 'daily' | 'per_trip' | 'fixed_incentive' | 'custom';
  baseSalary: number;
  perDaySalary?: number;
  perTripSalary?: number;
  kmIncentivePerKm?: number;
  nightAllowancePerNight?: number;
  outstationAllowancePerDay?: number;
  foodAllowance?: number;
  overtimeRatePerHour?: number;
  extraDutyRate?: number;
  weeklyOffDays?: number[];
  weeklyOffLeaveType?: 'paid' | 'unpaid' | 'compensatory';
  salaryStartDate: Date;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

export interface UpdateSalaryMasterInput extends Partial<CreateSalaryMasterInput> {
  status?: 'active' | 'inactive';
}

export async function createOrUpdateSalaryMaster(
  input: CreateSalaryMasterInput | (UpdateSalaryMasterInput & { driverId: string })
): Promise<IDriverSalaryMaster> {
  validateSalaryInput(input);

  const driver = await Driver.findById(input.driverId);
  if (!driver) {
    throw new Error(`Driver ${input.driverId} not found`);
  }

  const existing = await DriverSalaryMaster.findOne({
    tenantId: new mongoose.Types.ObjectId(input.tenantId),
    driverId: new mongoose.Types.ObjectId(input.driverId)
  });

  const data = {
    tenantId: input.tenantId,
    driverId: input.driverId,
    name: driver.name,
    mobile: driver.phone,
    joiningDate: driver.dateOfJoining || new Date(),
    ...input
  };

  if (existing) {
    Object.assign(existing, data);
    return existing.save();
  }

  return DriverSalaryMaster.create(data);
}

export async function getSalaryMasterByDriver(
  tenantId: string,
  driverId: string
): Promise<IDriverSalaryMaster | null> {
  return DriverSalaryMaster.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    driverId: new mongoose.Types.ObjectId(driverId)
  });
}

export async function listSalaryMasters(
  tenantId: string,
  filter?: { status?: 'active' | 'inactive' }
): Promise<IDriverSalaryMaster[]> {
  const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  if (filter?.status) {
    query.status = filter.status;
  }
  return DriverSalaryMaster.find(query).sort({ createdAt: -1 });
}

export async function updateSalaryMasterStatus(
  tenantId: string,
  driverId: string,
  status: 'active' | 'inactive'
): Promise<IDriverSalaryMaster | null> {
  return DriverSalaryMaster.findOneAndUpdate(
    {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId)
    },
    { status, updatedAt: new Date() },
    { new: true }
  );
}

export async function deleteSalaryMaster(
  tenantId: string,
  driverId: string
): Promise<void> {
  await DriverSalaryMaster.deleteOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    driverId: new mongoose.Types.ObjectId(driverId)
  });
}

function validateSalaryInput(input: any) {
  if (!input.salaryType) {
    throw new Error('Salary type is required');
  }

  if (input.salaryType === 'fixed_monthly' && input.baseSalary === undefined) {
    throw new Error('Base salary is required for fixed monthly salary type');
  }

  if (input.salaryType === 'daily' && input.perDaySalary === undefined) {
    throw new Error('Per-day salary is required for daily salary type');
  }

  if (input.salaryType === 'per_trip' && input.perTripSalary === undefined) {
    throw new Error('Per-trip salary is required for per-trip salary type');
  }

  if (input.baseSalary !== undefined && input.baseSalary < 0) {
    throw new Error('Salary amount cannot be negative');
  }

  if (input.salaryStartDate && !(input.salaryStartDate instanceof Date)) {
    try {
      new Date(input.salaryStartDate);
    } catch {
      throw new Error('Invalid salary start date');
    }
  }
}

export interface SalaryMasterSummary {
  driverId: string;
  name: string;
  mobile: string;
  salaryType: string;
  baseSalary: number;
  totalAllowances: number;
  status: string;
  joiningDate: Date;
}

export async function getSalaryMasterSummary(
  tenantId: string,
  driverId: string
): Promise<SalaryMasterSummary | null> {
  const master = await getSalaryMasterByDriver(tenantId, driverId);
  if (!master) return null;

  const totalAllowances =
    (master.nightAllowancePerNight || 0) +
    (master.outstationAllowancePerDay || 0) +
    (master.foodAllowance || 0) +
    (master.extraDutyRate || 0);

  return {
    driverId: master.driverId.toString(),
    name: master.name,
    mobile: master.mobile,
    salaryType: master.salaryType,
    baseSalary: master.baseSalary,
    totalAllowances,
    status: master.status,
    joiningDate: master.joiningDate
  };
}
