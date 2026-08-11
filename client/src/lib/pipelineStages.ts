// Maps each record type's real, detailed status (many values — see
// server/services/inquiryStatus.ts / leadStatus.ts / bookingStateMachine.ts)
// onto the single shared macro pipeline the spec describes:
//   Inquiry -> Qualified Lead -> Quotation -> Customer Confirmed
//     -> Booking -> Trip -> Invoice -> Closed
// This is presentation-only — it reads existing status values, it does not
// introduce a second status system or change any transition logic. Backend
// state machines remain the single source of truth for what's allowed.

export interface PipelineStage {
  key: string;
  label: string;
}

export interface PipelineStageInfo {
  currentIndex: number; // index into PIPELINE_STAGES, or -1 when blocked
  blocked?: { label: string; reason?: string };
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: "inquiry", label: "Inquiry" },
  { key: "qualified_lead", label: "Qualified Lead" },
  { key: "quotation", label: "Quotation" },
  { key: "customer_confirmed", label: "Customer Confirmed" },
  { key: "booking", label: "Booking" },
  { key: "trip", label: "Trip" },
  { key: "invoice", label: "Invoice" },
  { key: "closed", label: "Closed" },
];

function label(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function inquiryPipelineInfo(inquiry: { status: string }): PipelineStageInfo {
  const s = inquiry.status;
  if (["lost", "cancelled", "duplicate", "invalid"].includes(s)) {
    return { currentIndex: -1, blocked: { label: label(s) } };
  }
  if (s === "converted_to_lead") return { currentIndex: 1 };
  return { currentIndex: 0 }; // new, unverified, contact_attempted, contacted, requirement_pending/completed, qualified, future_follow_up
}

export function leadPipelineInfo(lead: { status: string }): PipelineStageInfo {
  const s = lead.status;
  if (["lost", "cancelled"].includes(s)) return { currentIndex: -1, blocked: { label: label(s) } };
  if (s === "converted_to_booking") return { currentIndex: 4 };
  if (s === "converted_to_customer") return { currentIndex: 3 };
  if (s === "customer_confirmed") return { currentIndex: 3 };
  if (["quotation_draft", "quotation_under_review", "quotation_sent", "follow_up_due", "negotiation"].includes(s)) return { currentIndex: 2 };
  return { currentIndex: 1 }; // new, assigned, requirement_completed, future_requirement
}

export function bookingPipelineInfo(booking: { status: string }): PipelineStageInfo {
  const s = booking.status;
  if (["cancelled", "no_show"].includes(s)) return { currentIndex: -1, blocked: { label: label(s) } };
  if (s === "closed") return { currentIndex: 7 };
  if (["completed", "payment_pending"].includes(s)) return { currentIndex: 6 };
  if (["trip_started", "ongoing", "extended", "return_pending"].includes(s)) return { currentIndex: 5 };
  return { currentIndex: 4 }; // enquiry, quotation_sent, tentative, on_hold, confirmed, vehicle_assigned, driver_assigned, ready_for_dispatch
}
