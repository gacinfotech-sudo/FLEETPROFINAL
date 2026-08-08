// Shared, presentation-level derivations over the ONE canonical Booking
// record. Every booking surface (Booking Queues, Upcoming, Live, History,
// Customer 360, Dashboard, the Unified Booking Workspace itself) renders
// state through these helpers so no two screens can disagree about what a
// booking's date/allocation/payment situation actually is. Nothing here is
// stored — all inputs are canonical Booking fields, evaluated fresh.
//
// The server stays authoritative for every transition (bookingStateMachine,
// PUT /api/bookings/:id); this module only *describes* state for display
// and pre-flight checklists, it never decides a transition on its own.

import type { QueryClient } from "@tanstack/react-query";

// Sections of the Unified Booking Workspace a caller can deep-focus
// (e.g. clicking a "Date Pending" flag opens the workspace on Schedule).
export type WorkspaceSection =
  | "overview"
  | "customer"
  | "schedule"
  | "allocation"
  | "payments"
  | "followup"
  | "selfdrive"
  | "timeline";

const TERMINAL_STATUSES = new Set(["closed", "cancelled", "no_show"]);
const FINALIZED_STATUSES = new Set(["completed", "payment_pending", "closed", "cancelled", "no_show"]);
const LIVE_STATUSES = new Set(["trip_started", "ongoing", "extended", "return_pending"]);
const PRE_CONFIRM_STATUSES = new Set(["enquiry", "quotation_sent", "tentative", "on_hold"]);

export const isTerminal = (status?: string) => TERMINAL_STATUSES.has(status || "");
export const isFinalized = (status?: string) => FINALIZED_STATUSES.has(status || "");
export const isLive = (status?: string) => LIVE_STATUSES.has(status || "");
export const isPreConfirm = (status?: string) => PRE_CONFIRM_STATUSES.has(status || "");

// Mirrors server/booking/queues/resolvers.ts: absent travelDateStatus on a
// legacy booking always means a real confirmed date was supplied.
export function resolveTravelDateStatus(b: any): "confirmed" | "range" | "not_decided" {
  const v = b?.travelDateStatus;
  return v === "range" || v === "not_decided" ? v : "confirmed";
}

const refAssigned = (v: any) => !!(v && (typeof v === "string" ? v : v._id || v.id));

// ---------------------------------------------------------------------------
// Allocation — the two-axis truth behind the old contradictory
// "Status: Driver Assigned / Flag: Unallocated" display. Driver and vehicle
// are independent facts; vendor fulfilment satisfies both at once.
// ---------------------------------------------------------------------------
export interface AllocationState {
  driverAssigned: boolean;
  vehicleAssigned: boolean;
  vendorFulfilled: boolean;
  selfDrive: boolean;
  complete: boolean;
  /** Precise, human-readable summary, e.g. "Driver Assigned · Vehicle Pending" */
  label: string;
  /** What is still missing, [] when complete */
  missing: ("driver" | "vehicle")[];
}

export function deriveAllocation(b: any): AllocationState {
  const selfDrive = b?.bookingType === "self_drive";
  const vendorFulfilled = !!(
    b?.fulfilmentType === "vendor" ||
    b?.vendorName ||
    refAssigned(b?.vendorVehicleId) ||
    refAssigned(b?.fulfilmentVendorId)
  );
  // Both the raw document shape (vehicleId/driverId) and queue-row summary
  // shape (vehicle/driver objects) are accepted so every surface can use this.
  const vehicleAssigned = vendorFulfilled || refAssigned(b?.vehicleId) || refAssigned(b?.vehicle);
  const driverAssigned = vendorFulfilled || selfDrive || refAssigned(b?.driverId) || refAssigned(b?.driver);

  const missing: ("driver" | "vehicle")[] = [];
  if (!driverAssigned) missing.push("driver");
  if (!vehicleAssigned) missing.push("vehicle");
  const complete = missing.length === 0;

  let label: string;
  if (vendorFulfilled) label = b?.vendorName ? `Vendor — ${b.vendorName}` : "Vendor Fulfilled";
  else if (complete) label = selfDrive && !refAssigned(b?.driverId) ? "Self-drive · Vehicle Assigned" : "Allocated";
  else if (driverAssigned && !vehicleAssigned) label = "Driver Assigned · Vehicle Pending";
  else if (vehicleAssigned && !driverAssigned) label = "Vehicle Assigned · Driver Pending";
  else label = "Allocation Pending";

  return { driverAssigned, vehicleAssigned, vendorFulfilled, selfDrive, complete, label, missing };
}

// ---------------------------------------------------------------------------
// Payment — ledger-derived; advanceReceived is the server-maintained cache.
// ---------------------------------------------------------------------------
export interface PaymentState {
  total: number;
  received: number;
  balance: number;
  label: "Unpaid" | "Partial" | "Paid" | "Overpaid";
}

export function derivePayment(b: any): PaymentState {
  const total = Number(b?.totalAmount) || 0;
  const received = Number(b?.advanceReceived) || 0;
  const balance = total - received;
  let label: PaymentState["label"];
  if (received <= 0) label = "Unpaid";
  else if (balance > 0) label = "Partial";
  else if (balance === 0) label = "Paid";
  else label = "Overpaid";
  return { total, received, balance, label };
}

// ---------------------------------------------------------------------------
// Readiness — the compact "what is missing to move forward" checklist shown
// at the top of the workspace and used by the Confirm pre-flight (§23).
// ---------------------------------------------------------------------------
export type ReadinessLevel = "complete" | "pending" | "missing";

export interface ReadinessItem {
  key: string;
  label: string;
  level: ReadinessLevel;
  detail?: string;
  /** Workspace section a quick-fix click should focus */
  focus: WorkspaceSection;
  /** true = must be complete before Confirm; pending is acceptable */
  requiredForConfirm: boolean;
}

export function deriveReadiness(b: any): ReadinessItem[] {
  const dateStatus = resolveTravelDateStatus(b);
  const alloc = deriveAllocation(b);
  const pay = derivePayment(b);

  const date: ReadinessItem = {
    key: "date",
    label: "Travel Date",
    focus: "schedule",
    requiredForConfirm: true,
    ...(dateStatus === "confirmed" && b?.pickupDate
      ? { level: "complete" as const }
      : dateStatus === "range"
        ? { level: "pending" as const, detail: "Date range — confirm exact date" }
        : { level: "missing" as const, detail: "Not decided" }),
  };

  return [
    {
      key: "customer",
      label: "Customer",
      focus: "customer",
      requiredForConfirm: true,
      level: b?.customerName && b?.customerPhone ? "complete" : "missing",
    },
    {
      key: "route",
      label: "Route",
      focus: "customer",
      requiredForConfirm: true,
      level: b?.pickupLocation ? "complete" : "missing",
    },
    date,
    {
      key: "allocation",
      label: "Allocation",
      focus: "allocation",
      // §24: a booking may be Confirmed with allocation still pending.
      requiredForConfirm: false,
      level: alloc.complete ? "complete" : "pending",
      detail: alloc.complete ? alloc.label : alloc.label,
    },
    {
      key: "fare",
      label: "Fare",
      focus: "payments",
      requiredForConfirm: true,
      level: pay.total > 0 ? "complete" : "missing",
      detail: pay.total > 0 ? undefined : "No fare set",
    },
    {
      key: "payment",
      label: "Payment",
      focus: "payments",
      requiredForConfirm: false,
      level: pay.label === "Paid" ? "complete" : "pending",
      detail: pay.label === "Paid" ? "Paid" : `${pay.label} — balance ₹${pay.balance.toLocaleString("en-IN")}`,
    },
  ];
}

/** Confirm pre-flight (client-side courtesy only — the server state machine
 *  remains the authority and re-validates on POST /api/bookings/:id/status). */
export function confirmBlockers(b: any): ReadinessItem[] {
  if (!isPreConfirm(b?.status)) return [];
  return deriveReadiness(b).filter((i) => i.requiredForConfirm && i.level !== "complete");
}

// ---------------------------------------------------------------------------
// Cache invalidation — ONE canonical helper so every save refreshes every
// booking view (queues, upcoming, live, history, dashboard, Customer 360)
// the same way. Same predicate approach payment-section.tsx established:
// dynamic filters are baked into query-key strings, so prefix matching is
// the only reliable net.
// ---------------------------------------------------------------------------
export function invalidateBookingViews(queryClient: QueryClient, opts: { customerId?: string } = {}) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== "string") return false;
      if (key.startsWith("/api/bookings") || key.startsWith("/api/operations") || key.startsWith("/api/dashboard")) return true;
      if (opts.customerId && key.startsWith(`/api/customers/${opts.customerId}`)) return true;
      return false;
    },
  });
  if (opts.customerId) queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
}
