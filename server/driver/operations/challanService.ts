// TASK-DRIVER-OPERATIONS-06 — traffic challan tracking. Genuinely new; no
// prior representation of this existed anywhere in the schema.
import { DriverChallan, type IDriverChallan } from './models';
import { CHALLAN_STATUSES, type ActorRef, type ChallanStatus, type ChallanViolationType } from './types';

export interface CreateChallanInput {
  tenantId: string;
  driverId: string;
  actor: ActorRef;
  challanNumber?: string;
  violationType: ChallanViolationType;
  issuingAuthority?: string;
  challanDate: Date | string;
  location?: string;
  fineAmount?: number;
  bookingId?: string;
  vehicleId?: string;
}

export async function createDriverChallan(input: CreateChallanInput): Promise<IDriverChallan> {
  return DriverChallan.create({
    tenantId: input.tenantId,
    driverId: input.driverId,
    challanNumber: input.challanNumber,
    violationType: input.violationType,
    issuingAuthority: input.issuingAuthority,
    challanDate: new Date(input.challanDate),
    location: input.location,
    fineAmount: input.fineAmount,
    bookingId: input.bookingId || undefined,
    vehicleId: input.vehicleId || undefined,
    recordedBy: { userId: input.actor.userId, role: input.actor.role },
    status: 'pending',
  });
}

export async function listDriverChallans(tenantId: string, driverId: string): Promise<IDriverChallan[]> {
  return DriverChallan.find({ tenantId, driverId }).sort({ challanDate: -1 }).lean() as any;
}

export interface UpdateChallanStatusInput {
  tenantId: string;
  driverId: string;
  challanId: string;
  actor: ActorRef;
  status: ChallanStatus;
  paidAmount?: number;
  disputeReason?: string;
}

// Status transitions only (pending -> paid/disputed/waived) — never a
// delete. A mis-recorded challan stays visible with its full history
// rather than disappearing.
export async function updateDriverChallanStatus(input: UpdateChallanStatusInput): Promise<IDriverChallan | null> {
  if (!CHALLAN_STATUSES.includes(input.status)) {
    throw new Error(`Invalid challan status: '${input.status}'.`);
  }
  const challan = await DriverChallan.findOne({ _id: input.challanId, tenantId: input.tenantId, driverId: input.driverId });
  if (!challan) return null;
  challan.status = input.status;
  if (input.status === 'paid') {
    challan.paidAmount = input.paidAmount ?? challan.fineAmount;
    challan.paidAt = new Date();
  }
  if (input.status === 'disputed' && input.disputeReason) {
    challan.disputeReason = input.disputeReason;
  }
  challan.statusUpdatedBy = { userId: input.actor.userId, role: input.actor.role };
  challan.statusUpdatedAt = new Date();
  await challan.save();
  return challan;
}
