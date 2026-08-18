// Centralized Quotation status rules — same pattern as inquiryStatus.ts /
// leadStatus.ts / bookingStateMachine.ts.

export const QUOTATION_STATUSES = [
  'draft', 'under_review', 'approved', 'sent', 'viewed', 'customer_query',
  'negotiation', 'accepted', 'rejected', 'expired', 'superseded', 'converted',
] as const;

export type QuotationStatusValue = typeof QUOTATION_STATUSES[number];

// Per spec §19: "Accepted quotation becomes immutable" — accepted and
// everything downstream/terminal cannot be edited or re-transitioned,
// except accepted -> converted (booking conversion, a later phase).
const IMMUTABLE_STATES: QuotationStatusValue[] = ['accepted', 'rejected', 'expired', 'superseded', 'converted'];

const ALLOWED_TRANSITIONS: Record<QuotationStatusValue, QuotationStatusValue[]> = {
  draft: ['under_review', 'approved', 'rejected'],
  under_review: ['draft', 'approved', 'rejected'],
  approved: ['sent', 'draft'],
  sent: ['viewed', 'customer_query', 'negotiation', 'accepted', 'rejected', 'expired', 'superseded'],
  viewed: ['customer_query', 'negotiation', 'accepted', 'rejected', 'expired', 'superseded'],
  customer_query: ['negotiation', 'sent', 'accepted', 'rejected', 'superseded'],
  negotiation: ['sent', 'accepted', 'rejected', 'superseded'],
  accepted: ['converted'],
  rejected: [],
  expired: [],
  superseded: [],
  converted: [],
};

export function isValidQuotationStatus(value: string): value is QuotationStatusValue {
  return (QUOTATION_STATUSES as readonly string[]).includes(value);
}

export function isImmutableQuotationStatus(status: QuotationStatusValue): boolean {
  return IMMUTABLE_STATES.includes(status);
}

export function getAllowedNextQuotationStatuses(current: QuotationStatusValue): QuotationStatusValue[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export class InvalidQuotationTransitionError extends Error {
  code = 'INVALID_QUOTATION_TRANSITION';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQuotationTransitionError';
  }
}

export function assertValidQuotationTransition(from: QuotationStatusValue, to: QuotationStatusValue) {
  if (from === to) return;
  const allowed = getAllowedNextQuotationStatuses(from);
  if (!allowed.includes(to)) {
    throw new InvalidQuotationTransitionError(`Cannot move a quotation from "${from}" to "${to}".`);
  }
}

// Computes a QuotationOption's totalPaise from its component fields —
// centralized so the create/update route and any future PDF/summary
// rendering never compute this two different ways.
export function computeOptionTotalPaise(option: {
  baseRatePaise?: number;
  driverAllowancePaise?: number;
  nightHaltPaise?: number;
  discountPaise?: number;
  gstPaise?: number;
  quantity?: number;
}): number {
  const base = (option.baseRatePaise || 0) * (option.quantity || 1);
  const extras = (option.driverAllowancePaise || 0) + (option.nightHaltPaise || 0);
  const discount = option.discountPaise || 0;
  const gst = option.gstPaise || 0;
  return Math.max(0, base + extras - discount + gst);
}
