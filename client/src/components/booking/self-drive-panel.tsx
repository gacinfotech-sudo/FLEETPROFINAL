// Self-Drive lifecycle panel — rendered as a tab inside the unified Booking
// Workspace for bookings with bookingType === 'self_drive' only. Drives
// deposit → handover checklist → return → refund settlement against
// /api/bookings/:id/self-drive/*. No client-side financial formulas beyond
// previews — every persisted number comes from the canonical endpoints.
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Clock, IndianRupee, Loader2, MessageCircle, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safeRandomUUID } from "@/lib/utils";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import FuelGauge, { fuelLabel } from "@/components/self-drive/fuel-gauge";
import ProcessRefundDialog from "@/components/self-drive/process-refund-dialog";

const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank Transfer", other: "Other",
};

const LATE_UNIT_LABELS: Record<string, string> = {
  per_hour: "Per Hour", per_30min: "Per 30 Minutes", per_day: "Per Day", fixed: "Fixed Charge",
};

const STAGE_ORDER = ["deposit_pending", "awaiting_handover", "on_trip", "returned", "refund_pending", "settled"] as const;

const STAGE_LABELS: Record<string, string> = {
  deposit_pending: "Deposit",
  awaiting_handover: "Handover",
  on_trip: "On Trip",
  returned: "Returned",
  refund_pending: "Refund",
  settled: "Closed",
};

function fmtMoney(n?: number) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
}

function fmtDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// "12 Hours" / "2 Days 6 Hours" between two instants (spec §1).
export function formatDuration(start: Date | null, end: Date | null): string {
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return "—";
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  const days = Math.floor(mins / (24 * 60));
  const hours = Math.floor((mins % (24 * 60)) / 60);
  const rem = mins % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} Day${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} Hour${hours > 1 ? "s" : ""}`);
  if (days === 0 && rem > 0) parts.push(`${rem} Min`);
  return parts.join(" ") || "0 Min";
}

export default function SelfDrivePanel({ bookingId, editable }: { bookingId: string; editable: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tripKey = `/api/bookings/${bookingId}/self-drive`;
  const { data: trip, isLoading } = useQuery<any>({ queryKey: [tripKey] });
  const { data: booking } = useQuery<any>({ queryKey: [`/api/bookings/${bookingId}`] });

  const [depositForm, setDepositForm] = useState({ amount: "", method: "cash", reference: "", notes: "" });
  const [handoverForm, setHandoverForm] = useState({ odometerReading: "", fuelLevel: null as number | null, damageNoted: "", condition: "", documentsHandedOver: "", accessoriesHandedOver: "", depositConfirmed: false, notes: "" });
  const [returnForm, setReturnForm] = useState({ odometerReading: "", fuelLevel: null as number | null, damageNoted: "", condition: "", challanFound: false, notes: "" });
  const [lateForm, setLateForm] = useState<{ graceMinutes: string; rate: string; unit: string } | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);
  const [waSending, setWaSending] = useState<string | null>(null);

  const { save: autoSaveDeposit } = useFormAutoSave(`self-drive-deposit-${bookingId}`, depositForm, 2000);
  const { save: autoSaveHandover } = useFormAutoSave(`self-drive-handover-${bookingId}`, handoverForm, 2000);
  const { save: autoSaveReturn } = useFormAutoSave(`self-drive-return-${bookingId}`, returnForm, 2000);

  useEffect(() => { autoSaveDeposit(); }, [depositForm, autoSaveDeposit]);
  useEffect(() => { autoSaveHandover(); }, [handoverForm, autoSaveHandover]);
  useEffect(() => { autoSaveReturn(); }, [returnForm, autoSaveReturn]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [tripKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/live-vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/self-drive/refunds?status=open"] });
  };

  const post = useMutation({
    mutationFn: async ({ method, step, body }: { method?: string; step: string; body: Record<string, any> }) => {
      const res = await apiRequest(method || "POST", `${tripKey}/${step}`, body);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      invalidate();
      toast({ title: `Self-drive ${vars.step.replace(/\W.*$/, "")} saved` });
    },
    onError: (err: any) => {
      const m = /^\d+:\s*([\s\S]*)$/.exec(err?.message || "");
      let msg = err?.message;
      try { msg = m ? (JSON.parse(m[1])?.message || msg) : msg; } catch { /* keep */ }
      toast({ title: "Could not save", description: msg, variant: "destructive" });
    },
  });

  if (isLoading || !trip) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading self-drive record…
      </div>
    );
  }

  const stage: string = trip.stage || "deposit_pending";
  const stageIdx = STAGE_ORDER.indexOf(stage as any);
  const latePolicy = trip.latePolicy || { graceMinutes: 30, rate: 200, unit: "per_hour" };

  const scheduledStart = booking?.scheduledStartDateTime ? new Date(booking.scheduledStartDateTime) : null;
  const scheduledEnd = booking?.scheduledEndDateTime ? new Date(booking.scheduledEndDateTime) : null;

  const saveDeposit = () => {
    if (depositForm.amount === "" || Number(depositForm.amount) < 0) {
      toast({ title: "Deposit amount required", variant: "destructive" });
      return;
    }
    post.mutate({
      step: "deposit",
      body: {
        amount: Number(depositForm.amount), method: depositForm.method,
        ...(depositForm.reference.trim() ? { reference: depositForm.reference.trim() } : {}),
        ...(depositForm.notes.trim() ? { notes: depositForm.notes.trim() } : {}),
      },
    });
  };

  const saveHandover = () => {
    if (handoverForm.odometerReading === "" || handoverForm.fuelLevel === null) {
      toast({ title: "Odometer and fuel level are required", variant: "destructive" });
      return;
    }
    post.mutate({
      step: "handover",
      body: {
        odometerReading: Number(handoverForm.odometerReading),
        fuelLevel: handoverForm.fuelLevel,
        ...(handoverForm.damageNoted.trim() ? { damageNoted: handoverForm.damageNoted.trim() } : {}),
        ...(handoverForm.condition.trim() ? { condition: handoverForm.condition.trim() } : {}),
        ...(handoverForm.documentsHandedOver.trim() ? { documentsHandedOver: handoverForm.documentsHandedOver.trim() } : {}),
        ...(handoverForm.accessoriesHandedOver.trim() ? { accessoriesHandedOver: handoverForm.accessoriesHandedOver.trim() } : {}),
        depositConfirmed: handoverForm.depositConfirmed,
        ...(handoverForm.notes.trim() ? { notes: handoverForm.notes.trim() } : {}),
      },
    });
  };

  const saveReturn = () => {
    if (returnForm.odometerReading === "" || returnForm.fuelLevel === null) {
      toast({ title: "Odometer and fuel level are required", variant: "destructive" });
      return;
    }
    post.mutate({
      step: "return",
      body: {
        odometerReading: Number(returnForm.odometerReading),
        fuelLevel: returnForm.fuelLevel,
        ...(returnForm.damageNoted.trim() ? { damageNoted: returnForm.damageNoted.trim() } : {}),
        ...(returnForm.condition.trim() ? { condition: returnForm.condition.trim() } : {}),
        challanFound: returnForm.challanFound,
        ...(returnForm.notes.trim() ? { notes: returnForm.notes.trim() } : {}),
      },
    });
  };

  const sendReviewRequest = async () => {
    if (!booking?.customerId) {
      toast({ title: "No linked customer record", description: "Link this booking to a customer to send a review request.", variant: "destructive" });
      return;
    }
    setReviewSending(true);
    try {
      // Tenant-configured review link is resolved server-side (multi-tenant,
      // never one global link); requestId makes retries idempotent.
      await apiRequest("POST", `/api/customers/${booking.customerId}/google-reviews/request`, {
        bookingId, channel: "whatsapp", requestId: safeRandomUUID().replace(/-/g, "").slice(0, 24),
      });
      toast({ title: "Review request sent on WhatsApp" });
    } catch (err: any) {
      const m = /^\d+:\s*([\s\S]*)$/.exec(err?.message || "");
      let msg = err?.message;
      try { msg = m ? (JSON.parse(m[1])?.message || msg) : msg; } catch { /* keep */ }
      toast({ title: "Review request failed", description: msg, variant: "destructive" });
    } finally {
      setReviewSending(false);
    }
  };

  const refundComp = trip.refund?.computation;

  const sendWhatsApp = async (type: string) => {
    setWaSending(type);
    try {
      const res = await apiRequest("POST", `${tripKey}/whatsapp`, { type });
      const body = await res.json();
      if (body?.message?.status === "sent") {
        toast({ title: "WhatsApp sent", description: body.message.content?.slice(0, 120) });
      } else {
        toast({ title: "WhatsApp NOT delivered", description: body?.message?.error || "Provider reported failure — message recorded as failed.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "WhatsApp send failed", description: String(err?.message || ""), variant: "destructive" });
    } finally {
      setWaSending(null);
    }
  };

  const uploadPhotos = async (phase: "handover" | "return", files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    fd.append("phase", phase);
    Array.from(files).slice(0, 7).forEach((f) => fd.append("photos", f));
    try {
      await apiRequest("POST", `${tripKey}/photos`, fd);
      toast({ title: `${files.length} photo${files.length > 1 ? "s" : ""} attached` });
      invalidate();
    } catch (err: any) {
      toast({ title: "Photo upload failed", description: String(err?.message || ""), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5" data-testid="self-drive-panel">
      {/* Stage stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STAGE_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <Separator className="w-3" />}
            {i < stageIdx || stage === "settled" ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : i === stageIdx ? (
              <Circle className="w-4 h-4 text-blue-600 fill-blue-100" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300" />
            )}
            <span className={`text-xs font-medium ${i === stageIdx ? "text-blue-700" : "text-gray-600"}`}>{STAGE_LABELS[s]}</span>
          </div>
        ))}
        <Badge variant="outline" className="ml-auto capitalize" data-testid="sd-stage-badge">{stage.replace(/_/g, " ")}</Badge>
      </div>

      {/* Booking duration (spec §1) */}
      {booking && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm flex flex-wrap gap-x-6 gap-y-1" data-testid="sd-duration">
          <span className="flex items-center gap-1.5 text-gray-600"><Clock size={14} />Pickup <span className="text-gray-900 font-medium">{fmtDateTime(scheduledStart)}</span></span>
          <span className="text-gray-600">Expected Return <span className="text-gray-900 font-medium">{fmtDateTime(scheduledEnd)}</span></span>
          <span className="text-gray-600">Duration <span className="text-blue-700 font-semibold">{formatDuration(scheduledStart, scheduledEnd)}</span></span>
        </div>
      )}

      {/* Deposit (spec §2) — held money, strictly outside the rental ledger */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Security Deposit</p>
        {trip.deposit ? (
          <p className="text-sm text-gray-600" data-testid="sd-deposit-summary">
            <span className="font-semibold text-gray-900">{fmtMoney(trip.deposit.amount)}</span> · {DEPOSIT_METHOD_LABELS[trip.deposit.method] || trip.deposit.method} · {fmtDateTime(trip.deposit.collectedAt)} · by {trip.deposit.collectedBy}
            {trip.deposit.reference ? <span className="block text-xs">Ref: {trip.deposit.reference}</span> : null}
            {trip.deposit.notes ? <span className="block text-xs">{trip.deposit.notes}</span> : null}
          </p>
        ) : editable ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" min="0" value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} data-testid="sd-deposit-amount" />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={depositForm.method} onValueChange={(v) => setDepositForm({ ...depositForm, method: v })}>
                  <SelectTrigger data-testid="sd-deposit-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPOSIT_METHOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Transaction / Ref ID</Label>
                <Input value={depositForm.reference} onChange={(e) => setDepositForm({ ...depositForm, reference: e.target.value })} placeholder="UTR (optional)" />
              </div>
            </div>
            <div>
              <Label>Remarks (optional)</Label>
              <Input value={depositForm.notes} onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })} />
            </div>
            <FormSubmitStatus
              status={post.isPending ? "loading" : post.isError ? "error" : "idle"}
              successMessage="Deposit recorded successfully"
              errorMessage="Could not record deposit"
            />
            <Button size="sm" disabled={post.isPending} onClick={saveDeposit} data-testid="sd-deposit-save">Record Deposit</Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Not recorded.</p>
        )}
      </div>

      {/* Late-return charges (spec §10) */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="font-medium text-sm">Late Return Charges</p>
          {editable && !lateForm && (
            <Button size="sm" variant="ghost" onClick={() => setLateForm({ graceMinutes: String(latePolicy.graceMinutes), rate: String(latePolicy.rate), unit: latePolicy.unit })} data-testid="sd-late-edit">Change</Button>
          )}
        </div>
        {lateForm ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div>
              <Label className="text-xs">Grace (min)</Label>
              <Input type="number" min="0" value={lateForm.graceMinutes} onChange={(e) => setLateForm({ ...lateForm, graceMinutes: e.target.value })} data-testid="sd-late-grace" />
            </div>
            <div>
              <Label className="text-xs">Rate (₹)</Label>
              <Input type="number" min="0" value={lateForm.rate} onChange={(e) => setLateForm({ ...lateForm, rate: e.target.value })} data-testid="sd-late-rate" />
            </div>
            <div>
              <Label className="text-xs">Interval</Label>
              <Select value={lateForm.unit} onValueChange={(v) => setLateForm({ ...lateForm, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LATE_UNIT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" disabled={post.isPending} data-testid="sd-late-save"
                onClick={() => {
                  post.mutate({ method: "PATCH", step: "late-policy", body: { graceMinutes: Number(lateForm.graceMinutes) || 0, rate: Number(lateForm.rate) || 0, unit: lateForm.unit } });
                  setLateForm(null);
                }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setLateForm(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600" data-testid="sd-late-summary">
            Grace <span className="font-medium">{latePolicy.graceMinutes} min</span> · Rate <span className="font-medium">₹{latePolicy.rate}</span> · {LATE_UNIT_LABELS[latePolicy.unit] || latePolicy.unit}
            {trip.lateCharge?.applicable && (
              <span className="block text-amber-700 text-xs mt-0.5">
                {trip.returnRecord ? "Late charge" : "If returned now"}: {fmtMoney(trip.lateCharge.amount)} — {trip.lateCharge.units} × ₹{trip.lateCharge.policy.rate}, {trip.lateCharge.chargeableMinutes} min past grace
              </span>
            )}
          </p>
        )}
      </div>

      {/* Handover checklist (spec §4) */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Vehicle Handover to Customer</p>
        {trip.handover ? (
          <div className="text-sm text-gray-600 space-y-1.5">
            <p>KM Out <span className="font-medium text-gray-900">{trip.handover.odometerReading.toLocaleString("en-IN")}</span> · Fuel Out <span className="font-medium text-gray-900">{fuelLabel(trip.handover.fuelLevel)}</span> · {fmtDateTime(trip.handover.conductedAt)}</p>
            <FuelGauge value={trip.handover.fuelLevel} readOnly label="Fuel Out" />
            {trip.handover.condition && <p className="text-xs">Condition: {trip.handover.condition}</p>}
            {trip.handover.documentsHandedOver && <p className="text-xs">Documents: {trip.handover.documentsHandedOver}</p>}
            {trip.handover.accessoriesHandedOver && <p className="text-xs">Accessories: {trip.handover.accessoriesHandedOver}</p>}
            {trip.handover.damageNoted && <p className="text-xs text-amber-700">Existing damage: {trip.handover.damageNoted}</p>}
            {trip.handover.depositConfirmed !== undefined && <p className="text-xs">Deposit confirmed at handover: {trip.handover.depositConfirmed ? "Yes" : "No"}</p>}
          </div>
        ) : editable ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Odometer / KM Out</Label>
                <Input type="number" min="0" value={handoverForm.odometerReading} onChange={(e) => setHandoverForm({ ...handoverForm, odometerReading: e.target.value })} data-testid="sd-handover-odometer" />
              </div>
              <div className="sm:pt-1">
                <FuelGauge label="Fuel Level Out" value={handoverForm.fuelLevel} onChange={(pct) => setHandoverForm({ ...handoverForm, fuelLevel: pct })} />
              </div>
              <div>
                <Label>Vehicle Condition</Label>
                <Input value={handoverForm.condition} onChange={(e) => setHandoverForm({ ...handoverForm, condition: e.target.value })} placeholder="Clean, no scratches…" />
              </div>
              <div>
                <Label>Existing Damage Notes</Label>
                <Input value={handoverForm.damageNoted} onChange={(e) => setHandoverForm({ ...handoverForm, damageNoted: e.target.value })} />
              </div>
              <div>
                <Label>Documents Handed Over</Label>
                <Input value={handoverForm.documentsHandedOver} onChange={(e) => setHandoverForm({ ...handoverForm, documentsHandedOver: e.target.value })} placeholder="RC copy, insurance, PUC" />
              </div>
              <div>
                <Label>Accessories Handed Over</Label>
                <Input value={handoverForm.accessoriesHandedOver} onChange={(e) => setHandoverForm({ ...handoverForm, accessoriesHandedOver: e.target.value })} placeholder="Stepney, jack, charger" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={handoverForm.depositConfirmed} onChange={(e) => setHandoverForm({ ...handoverForm, depositConfirmed: e.target.checked })} data-testid="sd-handover-deposit-confirm" />
              Security deposit confirmed {trip.deposit ? `(${fmtMoney(trip.deposit.amount)} received)` : "(not recorded yet!)"}
            </label>
            <div>
              <Label>Handover Notes (optional)</Label>
              <Textarea rows={2} value={handoverForm.notes} onChange={(e) => setHandoverForm({ ...handoverForm, notes: e.target.value })} />
            </div>
            <FormSubmitStatus
              status={post.isPending ? "loading" : post.isError ? "error" : "idle"}
              successMessage="Handover recorded successfully"
              errorMessage="Could not record handover"
            />
            <Button size="sm" disabled={post.isPending} onClick={saveHandover} data-testid="sd-handover-save">Record Handover</Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Not recorded.</p>
        )}
      </div>

      {/* Return (spec §6) */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Vehicle Return</p>
        {trip.returnRecord ? (
          <div className="text-sm text-gray-600 space-y-1.5" data-testid="sd-return-summary">
            <p>KM In <span className="font-medium text-gray-900">{trip.returnRecord.odometerReading.toLocaleString("en-IN")}</span> · Fuel In <span className="font-medium text-gray-900">{fuelLabel(trip.returnRecord.fuelLevel)}</span> · {fmtDateTime(trip.returnRecord.conductedAt)}</p>
            {trip.handover && (
              <>
                <FuelGauge value={trip.returnRecord.fuelLevel} readOnly label="Fuel In (▲ = Fuel Out)" compareValue={trip.handover.fuelLevel} />
                <p className="text-xs" data-testid="sd-return-compare">
                  Distance driven: <span className="font-medium">{(trip.returnRecord.odometerReading - trip.handover.odometerReading).toLocaleString("en-IN")} km</span>
                  {" · "}Fuel Out {trip.handover.fuelLevel}% → Fuel In {trip.returnRecord.fuelLevel}%
                  {" · "}Difference <span className={trip.returnRecord.fuelLevel < trip.handover.fuelLevel ? "text-red-700 font-medium" : "text-emerald-700 font-medium"}>
                    {trip.returnRecord.fuelLevel - trip.handover.fuelLevel > 0 ? "+" : ""}{trip.returnRecord.fuelLevel - trip.handover.fuelLevel}%
                  </span>
                </p>
              </>
            )}
            {trip.returnRecord.challanFound && <p className="text-xs text-red-700">Challan flagged at return.</p>}
            {trip.returnRecord.damageNoted && <p className="text-xs text-amber-700">Damage found: {trip.returnRecord.damageNoted}</p>}
            {trip.returnRecord.condition && <p className="text-xs">Condition in: {trip.returnRecord.condition}</p>}
          </div>
        ) : trip.handover && editable ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Odometer / KM In</Label>
                <Input type="number" min="0" value={returnForm.odometerReading} onChange={(e) => setReturnForm({ ...returnForm, odometerReading: e.target.value })} data-testid="sd-return-odometer" />
                <p className="text-[11px] text-gray-500 mt-0.5">KM Out was {trip.handover.odometerReading.toLocaleString("en-IN")}</p>
              </div>
              <div className="sm:pt-1">
                <FuelGauge label="Fuel Level In" value={returnForm.fuelLevel} onChange={(pct) => setReturnForm({ ...returnForm, fuelLevel: pct })} compareValue={trip.handover.fuelLevel} />
              </div>
              <div>
                <Label>Vehicle Condition In</Label>
                <Input value={returnForm.condition} onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })} />
              </div>
              <div>
                <Label>Damage Found (notes)</Label>
                <Input value={returnForm.damageNoted} onChange={(e) => setReturnForm({ ...returnForm, damageNoted: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={returnForm.challanFound} onChange={(e) => setReturnForm({ ...returnForm, challanFound: e.target.checked })} data-testid="sd-return-challan" />
              Challan found / verification pending
            </label>
            <div>
              <Label>Return Notes (optional)</Label>
              <Textarea rows={2} value={returnForm.notes} onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })} />
            </div>
            <FormSubmitStatus
              status={post.isPending ? "loading" : post.isError ? "error" : "idle"}
              successMessage="Vehicle return recorded successfully"
              errorMessage="Could not record vehicle return"
            />
            <Button size="sm" disabled={post.isPending} onClick={saveReturn} data-testid="sd-return-save">Complete Vehicle Return</Button>
            <p className="text-[11px] text-gray-500">Completing the return opens the refund settlement automatically when a deposit is held.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{trip.handover ? "Not recorded." : "Record the handover first."}</p>
        )}
      </div>

      {/* Refund settlement (spec §13-§21) */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="font-medium text-sm">Deposit Refund</p>
          {trip.refund && (
            <Badge variant="outline" className={`uppercase text-[10px] ${["pending", "partially_refunded"].includes(trip.refund.status) ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`} data-testid="sd-refund-status">
              {trip.refund.status.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        {trip.refund ? (
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              Deposit {fmtMoney(refundComp?.depositAmount)} · Deductions {fmtMoney(refundComp?.totalDeduction)} · Refundable <span className="font-semibold text-gray-900">{fmtMoney(refundComp?.refundable)}</span>
              {" · "}Refunded {fmtMoney(refundComp?.refunded)} · Balance <span className={refundComp?.balance > 0 ? "text-red-700 font-semibold" : "text-emerald-700 font-semibold"} data-testid="sd-refund-balance">{fmtMoney(refundComp?.balance)}</span>
            </p>
            <Button size="sm" onClick={() => setRefundOpen(true)} data-testid="sd-process-refund">
              <IndianRupee size={14} className="mr-1" />{["closed", "forfeited"].includes(trip.refund.status) ? "View Settlement" : "Process Refund"}
            </Button>
          </div>
        ) : trip.returnRecord ? (
          (trip.deposit?.amount || 0) > 0 ? (
            <Button size="sm" variant="outline" onClick={() => post.mutate({ step: "refund/ensure", body: {} })}>Open refund case</Button>
          ) : (
            <p className="text-sm text-gray-500">No deposit was held — nothing to refund.</p>
          )
        ) : (
          <p className="text-sm text-gray-500">Opens automatically after the vehicle return.</p>
        )}
      </div>

      {/* Customer WhatsApp quick actions (spec §25) */}
      <div className="border rounded-lg p-4 space-y-2">
        <p className="font-medium text-sm flex items-center gap-1.5"><MessageCircle size={14} className="text-emerald-600" /> WhatsApp Customer</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["handover_details", "Handover Details", !!trip.handover],
            ["return_reminder", "Return Reminder", !trip.returnRecord],
            ["overdue_reminder", "Overdue Reminder", !trip.returnRecord],
            ["extension_payment_request", "Extension Payment", true],
            ["refund_confirmation", "Refund Confirmation", !!trip.refund && (trip.refund.computation?.refunded || 0) > 0],
          ] as [string, string, boolean][]).filter(([, , show]) => show).map(([type, label]) => (
            <Button key={type} size="sm" variant="outline" disabled={waSending === type} data-testid={`sd-wa-${type}`}
              onClick={() => sendWhatsApp(type)}>
              {waSending === type ? "Sending…" : label}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500">Uses your tenant templates (Reminder Settings). Delivery status is recorded honestly — failures show here.</p>
      </div>

      {/* Inspection photos (spec §4/§6) */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Inspection Photos</p>
        {(["handover", "return"] as const).map((phase) => {
          const phasePhotos = (trip.photos || []).filter((ph: any) => ph.phase === phase);
          return (
            <div key={phase} className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-medium text-gray-600 capitalize">{phase === "handover" ? "Vehicle Out" : "Vehicle Return"} ({phasePhotos.length})</span>
                {editable && (
                  <label className="text-xs text-blue-700 cursor-pointer hover:underline">
                    + Add photos
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" data-testid={`sd-photos-${phase}`}
                      onChange={(e) => uploadPhotos(phase, e.target.files)} />
                  </label>
                )}
              </div>
              {phasePhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {phasePhotos.map((ph: any) => (
                    <a key={ph.fileName} href={`${tripKey}/photos/${ph.fileName}`} target="_blank" rel="noreferrer">
                      <img src={`${tripKey}/photos/${ph.fileName}`} alt={ph.originalName || phase} className="h-16 w-16 object-cover rounded-md border border-gray-200" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Post-closure review request (spec §24) */}
      {(stage === "settled" || (trip.refund && ["refunded", "closed"].includes(trip.refund.status))) && (
        <div className="border rounded-lg p-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-gray-700 flex items-center gap-1.5"><Star size={14} className="text-amber-500" /> Trip closed — ask the customer for a Google review.</p>
          <Button size="sm" variant="outline" disabled={reviewSending} onClick={sendReviewRequest} data-testid="sd-review-request">
            <MessageCircle size={14} className="mr-1" />{reviewSending ? "Sending…" : "Send Review Request on WhatsApp"}
          </Button>
        </div>
      )}

      {refundOpen && (
        <ProcessRefundDialog
          bookingId={bookingId}
          bookingCode={booking?.bookingId}
          customerName={booking?.customerName}
          onClose={() => setRefundOpen(false)}
          onDone={() => { setRefundOpen(false); invalidate(); }}
        />
      )}
    </div>
  );
}
