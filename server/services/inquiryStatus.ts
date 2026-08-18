// Centralized Inquiry status rules — mirrors the existing pattern in
// bookingStateMachine.ts (isValidStatus/getAllowedNextStatuses) so Inquiry
// status logic lives in exactly one place, not scattered across routes.
// See docs/INQUIRY_LEAD_STATUS_MAPPING.md.

export const INQUIRY_STATUSES = [
  'new', 'unverified', 'contact_attempted', 'contacted',
  'requirement_pending', 'requirement_completed', 'qualified',
  'converted_to_lead', 'future_follow_up', 'duplicate', 'invalid',
  'lost', 'cancelled',
] as const;

export type InquiryStatusValue = typeof INQUIRY_STATUSES[number];

const TERMINAL_STATES: InquiryStatusValue[] = ['converted_to_lead', 'duplicate', 'invalid', 'lost', 'cancelled'];

const ALLOWED_TRANSITIONS: Record<InquiryStatusValue, InquiryStatusValue[]> = {
  new: ['unverified', 'contact_attempted', 'contacted', 'qualified', 'duplicate', 'invalid', 'lost', 'cancelled'],
  unverified: ['contact_attempted', 'contacted', 'invalid', 'duplicate', 'cancelled'],
  contact_attempted: ['contacted', 'lost', 'cancelled'],
  contacted: ['requirement_pending', 'requirement_completed', 'qualified', 'future_follow_up', 'lost', 'cancelled'],
  requirement_pending: ['requirement_completed', 'qualified', 'lost', 'cancelled'],
  requirement_completed: ['qualified', 'lost', 'cancelled'],
  qualified: ['converted_to_lead', 'future_follow_up', 'lost', 'cancelled'],
  converted_to_lead: [],
  future_follow_up: ['contacted', 'qualified', 'lost', 'cancelled'],
  duplicate: [],
  invalid: [],
  lost: ['contacted'], // explicit reopen, per spec §44 "Allow Reopen"
  cancelled: [],
};

export function isValidInquiryStatus(value: string): value is InquiryStatusValue {
  return (INQUIRY_STATUSES as readonly string[]).includes(value);
}

export function isTerminalInquiryStatus(status: InquiryStatusValue): boolean {
  return TERMINAL_STATES.includes(status);
}

export function getAllowedNextInquiryStatuses(current: InquiryStatusValue): InquiryStatusValue[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export class InvalidInquiryTransitionError extends Error {
  code = 'INVALID_INQUIRY_TRANSITION';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInquiryTransitionError';
  }
}

export function assertValidInquiryTransition(from: InquiryStatusValue, to: InquiryStatusValue) {
  if (from === to) return;
  const allowed = getAllowedNextInquiryStatuses(from);
  if (!allowed.includes(to)) {
    throw new InvalidInquiryTransitionError(`Cannot move an inquiry from "${from}" to "${to}".`);
  }
}

// Minimum-required-fields check for qualification/conversion, per spec §10.
export function getMissingQualificationFields(inquiry: {
  customerName?: string;
  primaryMobile?: string;
  pickupDate?: Date | null;
  nextFollowUpAt?: Date | null;
  pickupLocation?: string;
  route?: string;
  numberOfPassengers?: number;
  vehicleCategory?: string;
  vehicleRequirements?: any[];
  source?: string;
  assignedExecutive?: string;
}): string[] {
  const missing: string[] = [];
  if (!inquiry.customerName?.trim()) missing.push('customerName');
  if (!inquiry.primaryMobile?.trim()) missing.push('primaryMobile');
  if (!inquiry.pickupDate && !inquiry.nextFollowUpAt) missing.push('pickupDate or nextFollowUpAt');
  if (!inquiry.pickupLocation?.trim() && !inquiry.route?.trim()) missing.push('pickupLocation or route');
  if (!inquiry.numberOfPassengers) missing.push('numberOfPassengers');
  if (!inquiry.vehicleCategory?.trim() && !(inquiry.vehicleRequirements && inquiry.vehicleRequirements.length > 0)) {
    missing.push('vehicleCategory or vehicleRequirements');
  }
  if (!inquiry.source?.trim()) missing.push('source');
  if (!inquiry.assignedExecutive?.trim()) missing.push('assignedExecutive');
  return missing;
}
