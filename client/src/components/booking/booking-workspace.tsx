// UNIFIED BOOKING WORKSPACE — the ONE editor every booking surface opens.
// Booking Queues, Upcoming, Live, History, Customer 360, Dashboard and
// search all open this same component over the same canonical Booking
// record (fetched fresh from GET /api/bookings/:id — never a stale row
// object). There is deliberately no queue-specific / upcoming-specific /
// history-specific editor anywhere else in the client.
//
// Design rules this component enforces:
// - Persisted-booking editing only. It NEVER touches the Add Booking
//   wizard's draft state (BookingDraft) — a booking with an ID is a real
//   record, not an unsaved draft (§77).
// - No client-side financial formulas. Fields are edited and saved as-is;
//   the server (PUT /api/bookings/:id + the payment ledger) is the single
//   financial engine. This replaces the old dashboard "Edit Booking
//   Dialog", which recomputed totalAmount client-side with a formula that
//   subtracted charges from the fare.
// - Status changes only via the canonical endpoints (POST status/start/
//   complete/cancel) — allowed transitions come from the server's state
//   machine via GET /api/bookings/:id's allowedNextStatuses, not from a
//   duplicated client-side copy of the transition table.
// - State-aware editing: operational fields lock once the booking is
//   finalized; financial adjustment on a closed booking requires a reason
//   (server-enforced, surfaced here).

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  WorkspaceSection,
  deriveAllocation,
  derivePayment,
  deriveReadiness,
  confirmBlockers,
  resolveTravelDateStatus,
  invalidateBookingViews,
  isFinalized,
  isTerminal,
  isPreConfirm,
} from "@/lib/booking-state";
import { ScheduleEditor } from "./schedule-editor";
import PaymentSection from "./payment-section";
import TripCostSummary from "./trip-cost-summary";
import ResourceFulfilmentPanel from "./resource-fulfilment-panel";
import AssignVendorDialog from "./assign-vendor-dialog";
import ExtendBookingDialog from "./extend-booking-dialog";
import BookingCommunication from "./booking-communication";
import PipelineStepper from "../pipeline/pipeline-stepper";
import { bookingPipelineInfo } from "../../lib/pipelineStages";

const STATUS_ACTION_LABELS: Record<string, string> = {
  quotation_sent: "Mark Quotation Sent",
  tentative: "Mark Tentative",
  on_hold: "Put On Hold",
  confirmed: "Confirm Booking",
  vehicle_assigned: "Mark Vehicle Assigned",
  driver_assigned: "Mark Driver Assigned",
  ready_for_dispatch: "Ready for Dispatch",
  trip_started: "Start Trip",
  ongoing: "Mark Ongoing",
  extended: "Mark Extended",
  return_pending: "Return Pending",
  completed: "Complete Trip",
  payment_pending: "Payment Pending",
  closed: "Close Booking",
};

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoney(n?: number) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
}

function toDateTimeLocal(d?: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const READINESS_STYLE: Record<string, string> = {
  complete: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  missing: "bg-red-100 text-red-800",
};

export interface BookingWorkspaceProps {
  bookingId: string;
  initialFocus?: WorkspaceSection;
  onClose: () => void;
}

export default function BookingWorkspace({ bookingId, initialFocus, onClose }: BookingWorkspaceProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const detailKey = `/api/bookings/${bookingId}`;
  const { data: booking, isLoading, isError } = useQuery<any>({ queryKey: [detailKey] });

  const [section, setSection] = useState<WorkspaceSection>(initialFocus || "overview");
  useEffect(() => {
    if (initialFocus) setSection(initialFocus);
  }, [initialFocus, bookingId]);

  // ----- editable form state (per section, dirty-tracked) -----------------
  const [customerForm, setCustomerForm] = useState<any>(null);
  const [pricingForm, setPricingForm] = useState<any>(null);
  const [followUpForm, setFollowUpForm] = useState<any>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeGuardOpen, setCloseGuardOpen] = useState(false);

  // Re-seed section forms whenever the canonical record (re)loads.
  useEffect(() => {
    if (!booking) return;
    setCustomerForm({
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      customerEmail: booking.customerEmail || "",
      pickupLocation: booking.pickupLocation || "",
      dropoffLocation: booking.dropoffLocation || "",
      notes: booking.notes || "",
      customerDiscussionSummary: booking.customerDiscussionSummary || "",
    });
    setPricingForm({
      totalAmount: booking.totalAmount ?? "",
      tollCharges: booking.tollCharges ?? "",
      parkingCharges: booking.parkingCharges ?? "",
      miscellaneousAmount: booking.miscellaneousAmount ?? "",
      miscellaneousDescription: booking.miscellaneousDescription ?? "",
    });
    setFollowUpForm({ followUpAt: toDateTimeLocal(booking.followUpAt) });
  }, [booking?._id, booking?.updatedAt, booking?.lastActivityAt]);

  const seededCustomer = useMemo(() => booking && ({
    customerName: booking.customerName || "",
    customerPhone: booking.customerPhone || "",
    customerEmail: booking.customerEmail || "",
    pickupLocation: booking.pickupLocation || "",
    dropoffLocation: booking.dropoffLocation || "",
    notes: booking.notes || "",
    customerDiscussionSummary: booking.customerDiscussionSummary || "",
  }), [booking]);

  const customerDirty = !!(customerForm && seededCustomer && JSON.stringify(customerForm) !== JSON.stringify(seededCustomer));
  const pricingDirty = !!(booking && pricingForm && (
    String(pricingForm.totalAmount) !== String(booking.totalAmount ?? "") ||
    String(pricingForm.tollCharges) !== String(booking.tollCharges ?? "") ||
    String(pricingForm.parkingCharges) !== String(booking.parkingCharges ?? "") ||
    String(pricingForm.miscellaneousAmount) !== String(booking.miscellaneousAmount ?? "") ||
    String(pricingForm.miscellaneousDescription) !== String(booking.miscellaneousDescription ?? "")
  ));
  const followUpDirty = !!(booking && followUpForm && followUpForm.followUpAt !== toDateTimeLocal(booking.followUpAt));
  const anyDirty = customerDirty || pricingDirty || followUpDirty;

  // ----- derived state ----------------------------------------------------
  const status: string = booking?.status || "";
  const readiness = booking ? deriveReadiness(booking) : [];
  const alloc = booking ? deriveAllocation(booking) : null;
  const pay = booking ? derivePayment(booking) : null;
  const dateStatus = booking ? resolveTravelDateStatus(booking) : "confirmed";
  const blockers = booking ? confirmBlockers(booking) : [];
  const opsEditable = booking ? !isFinalized(status) : false;
  const financeLocked = isTerminal(status) && status !== "closed" ? true : false; // cancelled/no_show: no fare edits
  const allowedNext: string[] = booking?.allowedNextStatuses || [];
  const isAdmin = !!(user && ["admin", "client"].includes((user as any).role));
  const customerId = booking?.customerId ? String(typeof booking.customerId === "object" ? booking.customerId._id || booking.customerId : booking.customerId) : undefined;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [detailKey] });
    invalidateBookingViews(queryClient, { customerId });
  };

  // ----- mutations (all against canonical endpoints) ----------------------
  const saveFields = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/bookings/${bookingId}`, fields);
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Booking updated" });
    },
    onError: (err: any) => toast({ title: "Could not save", description: err?.message, variant: "destructive" }),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ next, extra }: { next: string; extra?: Record<string, any> }) => {
      const endpoint = next === "trip_started" ? "start" : next === "completed" ? "complete" : "status";
      const body = endpoint === "status" ? { status: next, ...(extra || {}) } : (extra || {});
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/${endpoint}`, body);
      return res.json();
    },
    onSuccess: (_updated: any, vars) => {
      refresh();
      setConfirmReviewOpen(false);
      toast({ title: STATUS_ACTION_LABELS[vars.next] ? `${STATUS_ACTION_LABELS[vars.next]} — done` : "Status updated" });
    },
    onError: (err: any) => toast({ title: "Status change rejected", description: err?.message, variant: "destructive" }),
  });

  const cancelBooking = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/cancel`, { cancellationReason: cancelReason });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      setCancelOpen(false);
      toast({ title: "Booking cancelled" });
    },
    onError: (err: any) => toast({ title: "Could not cancel", description: err?.message, variant: "destructive" }),
  });

  // ----- allocation data (availability-aware, server-checked on save) -----
  const availabilityWindowReady = opsEditable && dateStatus === "confirmed" && !!booking?.pickupDate;
  const availQuery = availabilityWindowReady
    ? `pickupDate=${toDateInputStr(booking.pickupDate)}&returnDate=${toDateInputStr(booking.returnDate || booking.pickupDate)}${booking.pickupTime ? `&pickupTime=${booking.pickupTime}` : ""}${booking.returnTime ? `&returnTime=${booking.returnTime}` : ""}`
    : "";
  const { data: availableDrivers } = useQuery<any[]>({
    queryKey: [`/api/drivers/available?${availQuery}&excludeBookingId=${bookingId}&includeUnavailable=true`],
    enabled: availabilityWindowReady && section === "allocation",
  });
  const { data: availableVehicles } = useQuery<any[]>({
    queryKey: [`/api/vehicles/available?${availQuery}`],
    enabled: availabilityWindowReady && section === "allocation",
  });

  const requestClose = () => {
    if (anyDirty) setCloseGuardOpen(true);
    else onClose();
  };

  // ----- section save handlers -------------------------------------------
  const saveCustomer = () => saveFields.mutate(customerForm);
  const savePricing = () => {
    const fields: Record<string, any> = {
      totalAmount: pricingForm.totalAmount === "" ? 0 : Number(pricingForm.totalAmount),
      tollCharges: pricingForm.tollCharges === "" ? 0 : Number(pricingForm.tollCharges),
      parkingCharges: pricingForm.parkingCharges === "" ? 0 : Number(pricingForm.parkingCharges),
      miscellaneousAmount: pricingForm.miscellaneousAmount === "" ? 0 : Number(pricingForm.miscellaneousAmount),
      miscellaneousDescription: pricingForm.miscellaneousDescription || "",
    };
    if (status === "closed") {
      if (!adjustmentReason.trim()) {
        toast({ title: "Adjustment reason required", description: "This booking is closed — financial changes need a recorded reason.", variant: "destructive" });
        return;
      }
      fields.adjustmentReason = adjustmentReason.trim();
    }
    saveFields.mutate(fields);
  };
  const saveFollowUp = () =>
    saveFields.mutate({ followUpAt: followUpForm.followUpAt ? new Date(followUpForm.followUpAt).toISOString() : "" });
  const completeFollowUp = () => saveFields.mutate({ followUpAt: "" });

  // ----- timeline ---------------------------------------------------------
  const timeline = useMemo(() => {
    if (!booking) return [];
    const events: { at: Date; label: string; detail?: string }[] = [];
    events.push({ at: new Date(booking.createdAt), label: "Booking created", detail: booking.createdBy?.role });
    for (const h of booking.statusHistory || []) {
      events.push({
        at: new Date(h.changedAt),
        label: `Status: ${String(h.fromStatus).replace(/_/g, " ")} → ${String(h.toStatus).replace(/_/g, " ")}`,
        detail: [h.changedBy?.role, h.reason, h.override ? "override" : null].filter(Boolean).join(" · "),
      });
    }
    for (const r of booking.rescheduleHistory || []) {
      events.push({
        at: new Date(r.changedAt),
        label: `Rescheduled ${fmtDate(r.oldPickupDate)} → ${fmtDate(r.newPickupDate)}`,
        detail: [r.changedBy?.role, r.reason].filter(Boolean).join(" · "),
      });
    }
    for (const e of booking.extensionHistory || []) {
      events.push({
        at: new Date(e.createdAt),
        label: `Trip extended (#${e.extensionNumber}) to ${fmtDate(e.newReturnDate)}`,
        detail: `Revised total ${fmtMoney(e.revisedTotal)}`,
      });
    }
    for (const c of booking.revisionHistory || []) {
      events.push({
        at: new Date(c.correctedAt),
        label: `Backdated correction: ${(c.fieldsChanged || []).join(", ")}`,
        detail: [c.authorizedBy?.role, c.reason].filter(Boolean).join(" · "),
      });
    }
    return events.filter((e) => !isNaN(e.at.getTime())).sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [booking]);

  // -------------------------------------------------------------------------
  return (
    <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col overflow-hidden p-0">
        {(isLoading || isError || !booking) && (
          // Radix requires a DialogTitle in every DialogContent for screen
          // readers — keep one (visually hidden) while the canonical record
          // is still loading and the real summary header isn't mounted yet.
          <DialogHeader className="sr-only">
            <DialogTitle>Booking Workspace</DialogTitle>
          </DialogHeader>
        )}
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading booking…
          </div>
        )}
        {isError && (
          <div className="py-24 text-center text-sm text-red-600">Failed to load this booking.</div>
        )}
        {booking && customerForm && pricingForm && (
          <>
            {/* ---- sticky summary header (§9, §58) ---- */}
            <DialogHeader className="px-6 pt-5 pb-3 border-b space-y-2">
              <DialogTitle className="flex items-center gap-3 flex-wrap text-lg">
                <span className="font-mono">{booking.bookingId}</span>
                <Badge variant="outline" className="capitalize">{status.replace(/_/g, " ")}</Badge>
                {alloc && <Badge className={alloc.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>{alloc.label}</Badge>}
                {pay && <Badge className={pay.label === "Paid" ? "bg-green-100 text-green-800" : pay.label === "Unpaid" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{pay.label}{pay.balance > 0 ? ` · Due ${fmtMoney(pay.balance)}` : ""}</Badge>}
              </DialogTitle>
              <div className="text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                <span>{booking.customerName} · {booking.customerPhone}</span>
                <span>{booking.pickupLocation}{booking.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}</span>
                <span>
                  {dateStatus === "not_decided" ? "Date not decided" :
                    dateStatus === "range" ? `${fmtDate(booking.tentativeStartDate)} – ${fmtDate(booking.tentativeEndDate)} (range)` :
                    `${fmtDate(booking.pickupDate)}${booking.pickupTime ? ` · ${booking.pickupTime}` : ""}`}
                </span>
                <span className="text-gray-400">Last activity {fmtDateTime(booking.lastActivityAt || booking.updatedAt || booking.createdAt)}</span>
              </div>
              {/* Booking Readiness strip — every chip is a quick-fix link (§58-59) */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {readiness.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSection(r.focus)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${READINESS_STYLE[r.level]} hover:opacity-80`}
                    title={r.detail || r.label}
                  >
                    {r.label}: {r.level === "complete" ? "✓" : r.detail || (r.level === "missing" ? "Missing" : "Pending")}
                  </button>
                ))}
              </div>
            </DialogHeader>

            {/* ---- body ---- */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <Tabs value={section} onValueChange={(v) => setSection(v as WorkspaceSection)}>
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="customer">Customer &amp; Journey</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="allocation">Allocation</TabsTrigger>
                  <TabsTrigger value="payments">Pricing &amp; Payments</TabsTrigger>
                  <TabsTrigger value="followup">Follow-up &amp; Notes</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                {/* ================= OVERVIEW ================= */}
                <TabsContent value="overview" className="space-y-4 pt-4">
                  <PipelineStepper info={bookingPipelineInfo(booking)} />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-gray-500">Fare</p><p className="font-semibold">{fmtMoney(booking.totalAmount)}</p></div>
                    <div><p className="text-gray-500">Received</p><p className="font-semibold">{fmtMoney(booking.advanceReceived)}</p></div>
                    <div><p className="text-gray-500">Balance</p><p className="font-semibold">{pay ? fmtMoney(pay.balance) : "—"}</p></div>
                    <div><p className="text-gray-500">Source</p><p className="capitalize">{(booking.bookingSource || "direct customer").replace(/_/g, " ")}</p></div>
                  </div>

                  {/* Confirm panel (§22-24): smart checklist, never a dead reject */}
                  {isPreConfirm(status) && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <p className="font-medium text-sm">Confirm this booking</p>
                      <div className="space-y-1">
                        {readiness.filter((r) => r.requiredForConfirm || r.key === "allocation").map((r) => (
                          <div key={r.key} className="flex items-center gap-2 text-sm">
                            {r.level === "complete"
                              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                              : r.level === "missing" && r.requiredForConfirm
                                ? <AlertTriangle className="w-4 h-4 text-red-600" />
                                : <Circle className="w-4 h-4 text-amber-500" />}
                            <span>{r.label}</span>
                            <span className="text-gray-500 text-xs">{r.level === "complete" ? "" : r.detail || (r.requiredForConfirm ? "Missing" : "Optional / Pending")}</span>
                          </div>
                        ))}
                      </div>
                      {blockers.length > 0 ? (
                        <Button size="sm" onClick={() => setSection(blockers[0].focus)}>
                          Complete Missing Fields
                        </Button>
                      ) : (
                        <Button size="sm" disabled={changeStatus.isPending} onClick={() => setConfirmReviewOpen(true)}>
                          {alloc && !alloc.complete ? "Confirm with Allocation Pending" : "Confirm Booking"}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Lifecycle actions come from the server's own allowed-transition list */}
                  {allowedNext.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {allowedNext.filter((s) => !["cancelled", "no_show", "confirmed"].includes(s)).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          disabled={changeStatus.isPending}
                          onClick={() => changeStatus.mutate({ next: s })}
                        >
                          {STATUS_ACTION_LABELS[s] || s.replace(/_/g, " ")}
                        </Button>
                      ))}
                      {allowedNext.includes("cancelled") && (
                        <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>Cancel Booking</Button>
                      )}
                    </div>
                  )}
                  {isTerminal(status) && (
                    <Alert>
                      <AlertTitle className="capitalize">{status.replace(/_/g, " ")}</AlertTitle>
                      <AlertDescription>
                        {status === "cancelled" && booking.cancellationReason ? `Reason: ${booking.cancellationReason}. ` : ""}
                        This booking is final — history is preserved and cannot be rewritten. Use a new booking or an audited adjustment instead.
                      </AlertDescription>
                    </Alert>
                  )}

                  <BookingCommunication booking={booking} />
                </TabsContent>

                {/* ================= CUSTOMER & JOURNEY ================= */}
                <TabsContent value="customer" className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Customer Name</Label>
                      <Input value={customerForm.customerName} disabled={!opsEditable}
                        onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={customerForm.customerPhone} disabled={!opsEditable}
                        onChange={(e) => setCustomerForm({ ...customerForm, customerPhone: e.target.value })} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={customerForm.customerEmail} disabled={!opsEditable}
                        onChange={(e) => setCustomerForm({ ...customerForm, customerEmail: e.target.value })} />
                    </div>
                    <div>
                      <Label>Pickup Location</Label>
                      <Input value={customerForm.pickupLocation} disabled={!opsEditable}
                        onChange={(e) => setCustomerForm({ ...customerForm, pickupLocation: e.target.value })} />
                    </div>
                    <div>
                      <Label>Drop Location</Label>
                      <Input value={customerForm.dropoffLocation} disabled={!opsEditable}
                        onChange={(e) => setCustomerForm({ ...customerForm, dropoffLocation: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Customer Discussion Summary</Label>
                    <Textarea value={customerForm.customerDiscussionSummary} disabled={!opsEditable} rows={2}
                      onChange={(e) => setCustomerForm({ ...customerForm, customerDiscussionSummary: e.target.value })} />
                  </div>
                  <div>
                    <Label>Notes / Instructions</Label>
                    <Textarea value={customerForm.notes} rows={2}
                      onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} />
                  </div>
                  {customerDirty && (
                    <div className="flex justify-end">
                      <Button size="sm" disabled={saveFields.isPending} onClick={saveCustomer}>Save Changes</Button>
                    </div>
                  )}
                  {!opsEditable && <p className="text-xs text-gray-500">Customer/journey fields are locked because this booking is {status.replace(/_/g, " ")}.</p>}
                </TabsContent>

                {/* ================= SCHEDULE ================= */}
                <TabsContent value="schedule" className="pt-4">
                  {opsEditable ? (
                    <ScheduleEditor booking={booking} onSaved={refresh} />
                  ) : (
                    <div className="text-sm space-y-1">
                      <p>Travel date: <strong>{fmtDate(booking.pickupDate)}</strong> {booking.pickupTime || ""}</p>
                      {booking.returnDate && <p>Return: {fmtDate(booking.returnDate)} {booking.returnTime || ""}</p>}
                      <p className="text-xs text-gray-500">Schedule is locked for a {status.replace(/_/g, " ")} booking.</p>
                    </div>
                  )}
                </TabsContent>

                {/* ================= ALLOCATION ================= */}
                <TabsContent value="allocation" className="space-y-4 pt-4">
                  <AllocationSection
                    booking={booking}
                    opsEditable={opsEditable}
                    availabilityWindowReady={availabilityWindowReady}
                    availableDrivers={availableDrivers}
                    availableVehicles={availableVehicles}
                    saveFields={saveFields}
                    onGoSchedule={() => setSection("schedule")}
                  />
                  <Separator />
                  <ResourceFulfilmentPanel booking={booking} />
                  <div className="flex justify-end gap-2">
                    <AssignVendorDialog booking={booking} />
                    <ExtendBookingDialog booking={booking} />
                  </div>
                </TabsContent>

                {/* ================= PRICING & PAYMENTS ================= */}
                <TabsContent value="payments" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <Label>Final Customer Fare (₹)</Label>
                      <Input type="number" inputMode="numeric" value={pricingForm.totalAmount} disabled={financeLocked}
                        onChange={(e) => setPricingForm({ ...pricingForm, totalAmount: e.target.value })} />
                    </div>
                    <div>
                      <Label>Toll (₹)</Label>
                      <Input type="number" inputMode="numeric" value={pricingForm.tollCharges} disabled={financeLocked}
                        onChange={(e) => setPricingForm({ ...pricingForm, tollCharges: e.target.value })} />
                    </div>
                    <div>
                      <Label>Parking (₹)</Label>
                      <Input type="number" inputMode="numeric" value={pricingForm.parkingCharges} disabled={financeLocked}
                        onChange={(e) => setPricingForm({ ...pricingForm, parkingCharges: e.target.value })} />
                    </div>
                    <div>
                      <Label>Misc (₹)</Label>
                      <Input type="number" inputMode="numeric" value={pricingForm.miscellaneousAmount} disabled={financeLocked}
                        onChange={(e) => setPricingForm({ ...pricingForm, miscellaneousAmount: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>Misc Description</Label>
                      <Input value={pricingForm.miscellaneousDescription} disabled={financeLocked}
                        onChange={(e) => setPricingForm({ ...pricingForm, miscellaneousDescription: e.target.value })} />
                    </div>
                  </div>
                  {status === "closed" && (
                    <div>
                      <Label>Adjustment Reason (required — this booking is closed)</Label>
                      <Input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="Why is this financial record being adjusted?" />
                    </div>
                  )}
                  {pricingDirty && !financeLocked && (
                    <div className="flex justify-end">
                      <Button size="sm" disabled={saveFields.isPending} onClick={savePricing}>Save Pricing</Button>
                    </div>
                  )}
                  {financeLocked && <p className="text-xs text-gray-500">Financial fields are locked for a {status.replace(/_/g, " ")} booking.</p>}

                  <Separator />
                  <PaymentSection booking={booking} />
                  <TripCostSummary booking={booking} />
                </TabsContent>

                {/* ================= FOLLOW-UP & NOTES ================= */}
                <TabsContent value="followup" className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div>
                      <Label>Next Follow-up</Label>
                      <Input type="datetime-local" value={followUpForm?.followUpAt || ""}
                        onChange={(e) => setFollowUpForm({ followUpAt: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      {followUpDirty && (
                        <Button size="sm" disabled={saveFields.isPending} onClick={saveFollowUp}>Save Follow-up</Button>
                      )}
                      {booking.followUpAt && (
                        <Button size="sm" variant="outline" disabled={saveFields.isPending} onClick={completeFollowUp}>
                          Mark Follow-up Done
                        </Button>
                      )}
                    </div>
                  </div>
                  {booking.followUpAt && (
                    <p className="text-sm text-gray-600">
                      Current follow-up: {fmtDateTime(booking.followUpAt)}
                      {new Date(booking.followUpAt).getTime() <= Date.now() && <Badge className="ml-2 bg-blue-100 text-blue-800">Due</Badge>}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Follow-up date is separate from the travel date. Completing a follow-up removes this booking from the Follow-up Due queue automatically.
                  </p>
                </TabsContent>

                {/* ================= TIMELINE ================= */}
                <TabsContent value="timeline" className="pt-4">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-gray-500">No recorded events yet.</p>
                  ) : (
                    <ol className="space-y-3">
                      {timeline.map((e, i) => (
                        <li key={i} className="text-sm flex gap-3">
                          <span className="text-gray-400 whitespace-nowrap w-36 shrink-0">{fmtDateTime(e.at)}</span>
                          <span>
                            <span className="font-medium">{e.label}</span>
                            {e.detail && <span className="text-gray-500"> — {e.detail}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* ---- sticky footer ---- */}
            <div className="border-t px-6 py-3 flex items-center justify-between bg-gray-50">
              <p className="text-xs text-gray-500">
                {anyDirty ? "Unsaved changes in this workspace" : "All changes saved to the canonical booking"}
              </p>
              <div className="flex gap-2">
                {anyDirty && (
                  <Button
                    size="sm"
                    disabled={saveFields.isPending}
                    onClick={() => {
                      if (customerDirty) saveCustomer();
                      if (pricingDirty && !financeLocked) savePricing();
                      if (followUpDirty) saveFollowUp();
                    }}
                  >
                    Save Changes
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={requestClose}>Close</Button>
              </div>
            </div>
          </>
        )}

        {/* Confirm review (§22-23) */}
        <AlertDialog open={confirmReviewOpen} onOpenChange={setConfirmReviewOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm booking {booking?.bookingId}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-1 text-sm">
                  <p>{booking?.customerName} · {booking?.pickupLocation}{booking?.dropoffLocation ? ` → ${booking.dropoffLocation}` : ""}</p>
                  <p>Travel: {dateStatus === "confirmed" ? `${fmtDate(booking?.pickupDate)} ${booking?.pickupTime || ""}` : "—"}</p>
                  <p>Fare: {fmtMoney(booking?.totalAmount)}</p>
                  {alloc && !alloc.complete && (
                    <p className="text-amber-700">Allocation is still pending ({alloc.label}) — the booking will be confirmed and remain in the allocation queue.</p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={() => changeStatus.mutate({ next: "confirmed" })}>
                Confirm Booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel with reason */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel booking {booking?.bookingId}?</AlertDialogTitle>
              <AlertDialogDescription>The booking stays in history with its reason — it is never deleted.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input placeholder="Cancellation reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Booking</AlertDialogCancel>
              <AlertDialogAction disabled={!cancelReason.trim() || cancelBooking.isPending} onClick={() => cancelBooking.mutate()}>
                Cancel Booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Unsaved-changes guard (§44) */}
        <AlertDialog open={closeGuardOpen} onOpenChange={setCloseGuardOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>You have edits that haven't been saved to the booking yet.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Editing</AlertDialogCancel>
              <Button variant="outline" onClick={() => { setCloseGuardOpen(false); onClose(); }}>Discard</Button>
              <AlertDialogAction
                onClick={() => {
                  if (customerDirty) saveCustomer();
                  if (pricingDirty && !financeLocked) savePricing();
                  if (followUpDirty) saveFollowUp();
                  setCloseGuardOpen(false);
                  onClose();
                }}
              >
                Save &amp; Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function toDateInputStr(d?: string | Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------------------------------------------------------------------------
// Allocation section — own-fleet driver/vehicle assignment with genuine
// availability (server-filtered lists + server-side recheck on save §15).
// Vendor/outsource paths live right below it via the existing panels.
// ---------------------------------------------------------------------------
function AllocationSection({ booking, opsEditable, availabilityWindowReady, availableDrivers, availableVehicles, saveFields, onGoSchedule }: {
  booking: any;
  opsEditable: boolean;
  availabilityWindowReady: boolean;
  availableDrivers?: any[];
  availableVehicles?: any[];
  saveFields: any;
  onGoSchedule: () => void;
}) {
  const alloc = deriveAllocation(booking);
  const [driverPick, setDriverPick] = useState("");
  const [vehiclePick, setVehiclePick] = useState("");

  const currentDriver = booking.driverId && typeof booking.driverId === "object" ? booking.driverId : null;
  const currentVehicle = booking.vehicleId && typeof booking.vehicleId === "object" ? booking.vehicleId : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Current allocation:</span>
        <Badge className={alloc.complete ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>{alloc.label}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="border rounded-lg p-3 space-y-2">
          <p className="font-medium">Driver</p>
          <p>{currentDriver ? `${currentDriver.name}${currentDriver.phone ? ` · ${currentDriver.phone}` : ""}` : alloc.vendorFulfilled ? "Vendor driver" : alloc.selfDrive ? "Self-drive" : "Not assigned"}</p>
          {opsEditable && !alloc.vendorFulfilled && !alloc.selfDrive && (
            availabilityWindowReady ? (
              <div className="flex gap-2">
                <Select value={driverPick} onValueChange={setDriverPick}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose available driver" /></SelectTrigger>
                  <SelectContent>
                    {(availableDrivers || []).map((d: any) => (
                      <SelectItem key={d._id || d.id} value={String(d._id || d.id)} disabled={d.available === false}>
                        {d.name}{d.available === false ? ` — ${d.unavailabilityReason || "unavailable"}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!driverPick || saveFields.isPending}
                  onClick={() => { saveFields.mutate({ driverId: driverPick }); setDriverPick(""); }}>
                  {currentDriver ? "Change" : "Assign"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-700">
                Set a confirmed travel date first to see genuinely available drivers.{" "}
                <button type="button" className="underline" onClick={onGoSchedule}>Set date</button>
              </p>
            )
          )}
          {opsEditable && currentDriver && (
            <Button size="sm" variant="ghost" disabled={saveFields.isPending}
              onClick={() => saveFields.mutate({ driverId: "" })}>
              Clear driver (allocation pending)
            </Button>
          )}
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <p className="font-medium">Vehicle</p>
          <p>{currentVehicle ? `${currentVehicle.make || ""} ${currentVehicle.vehicleModel || currentVehicle.model || ""} (${currentVehicle.licensePlate || currentVehicle.registrationNumber || "—"})` : alloc.vendorFulfilled ? (booking.vendorVehicleDetails || "Vendor vehicle") : "Not assigned"}</p>
          {opsEditable && !alloc.vendorFulfilled && (
            availabilityWindowReady ? (
              <div className="flex gap-2">
                <Select value={vehiclePick} onValueChange={setVehiclePick}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Choose available vehicle" /></SelectTrigger>
                  <SelectContent>
                    {(availableVehicles || []).map((v: any) => (
                      <SelectItem key={v._id || v.id} value={String(v._id || v.id)}>
                        {v.make} {v.vehicleModel || v.model} ({v.licensePlate || v.registrationNumber || "—"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!vehiclePick || saveFields.isPending}
                  onClick={() => { saveFields.mutate({ vehicleId: vehiclePick }); setVehiclePick(""); }}>
                  {currentVehicle ? "Change" : "Assign"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-700">
                Set a confirmed travel date first to see genuinely available vehicles.{" "}
                <button type="button" className="underline" onClick={onGoSchedule}>Set date</button>
              </p>
            )
          )}
          {opsEditable && currentVehicle && (
            <Button size="sm" variant="ghost" disabled={saveFields.isPending}
              onClick={() => saveFields.mutate({ vehicleId: "" })}>
              Clear vehicle (allocation pending)
            </Button>
          )}
        </div>
      </div>

      {!alloc.complete && opsEditable && (
        <p className="text-xs text-gray-500">
          Own fleet unavailable? The booking stays captured either way — keep allocation pending, link a vendor, or start an outsource request below (§16).
        </p>
      )}
    </div>
  );
}
