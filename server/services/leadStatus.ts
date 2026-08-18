// Centralized Lead status rules — same pattern as inquiryStatus.ts and
// bookingStateMachine.ts, kept in exactly one place.

export const LEAD_STATUSES = [
  'new', 'assigned', 'requirement_completed', 'quotation_draft', 'quotation_under_review',
  'quotation_sent', 'follow_up_due', 'negotiation', 'customer_confirmed', 'converted_to_customer',
  'converted_to_booking', 'future_requirement', 'lost', 'cancelled',
] as const;

export type LeadStatusValue = typeof LEAD_STATUSES[number];

const TERMINAL_STATES: LeadStatusValue[] = ['converted_to_booking', 'lost', 'cancelled'];

const ALLOWED_TRANSITIONS: Record<LeadStatusValue, LeadStatusValue[]> = {
  new: ['assigned', 'requirement_completed', 'lost', 'cancelled'],
  assigned: ['requirement_completed', 'quotation_draft', 'lost', 'cancelled'],
  requirement_completed: ['quotation_draft', 'lost', 'cancelled'],
  quotation_draft: ['quotation_under_review', 'quotation_sent', 'lost', 'cancelled'],
  quotation_under_review: ['quotation_draft', 'quotation_sent', 'lost', 'cancelled'],
  quotation_sent: ['follow_up_due', 'negotiation', 'customer_confirmed', 'lost', 'cancelled'],
  follow_up_due: ['negotiation', 'customer_confirmed', 'quotation_sent', 'future_requirement', 'lost', 'cancelled'],
  negotiation: ['customer_confirmed', 'quotation_draft', 'follow_up_due', 'lost', 'cancelled'],
  customer_confirmed: ['converted_to_customer', 'lost', 'cancelled'],
  converted_to_customer: ['converted_to_booking', 'lost', 'cancelled'],
  converted_to_booking: [],
  future_requirement: ['assigned', 'quotation_sent', 'lost', 'cancelled'],
  lost: ['assigned'], // explicit reopen
  cancelled: [],
};

export function isValidLeadStatus(value: string): value is LeadStatusValue {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isTerminalLeadStatus(status: LeadStatusValue): boolean {
  return TERMINAL_STATES.includes(status);
}

export function getAllowedNextLeadStatuses(current: LeadStatusValue): LeadStatusValue[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export class InvalidLeadTransitionError extends Error {
  code = 'INVALID_LEAD_TRANSITION';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLeadTransitionError';
  }
}

export function assertValidLeadTransition(from: LeadStatusValue, to: LeadStatusValue) {
  if (from === to) return;
  const allowed = getAllowedNextLeadStatuses(from);
  if (!allowed.includes(to)) {
    throw new InvalidLeadTransitionError(`Cannot move a lead from "${from}" to "${to}".`);
  }
}
