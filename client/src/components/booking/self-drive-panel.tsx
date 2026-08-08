// Self-Drive lifecycle panel — rendered as a tab inside the unified Booking
// Workspace for bookings with bookingType === 'self_drive' only. Drives the
// deposit → vehicle handover → return → settlement flow against
// /api/bookings/:id/self-drive/*. Same rules as the rest of the workspace:
// no client-side financial formulas beyond displaying the server-computed
// settlement, and every write goes through the canonical endpoints.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const STAGE_ORDER = ["deposit_pending", "awaiting_handover", "on_trip", "returned", "settled"] as const;

const STAGE_LABELS: Record<string, string> = {
  deposit_pending: "Deposit",
  awaiting_handover: "Handover",
  on_trip: "On Trip",
  returned: "Returned",
  settled: "Settled",
};

function fmtMoney(n?: number) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
}

function fmtDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface ChargeRow {
  label: string;
  amount: string;
}

export default function SelfDrivePanel({ bookingId, editable }: { bookingId: string; editable: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tripKey = `/api/bookings/${bookingId}/self-drive`;
  const { data: trip, isLoading } = useQuery<any>({ queryKey: [tripKey] });

  const [depositForm, setDepositForm] = useState({ amount: "", method: "cash", notes: "" });
  const [handoverForm, setHandoverForm] = useState({ odometerReading: "", fuelLevel: "", damageNoted: "" });
  const [returnForm, setReturnForm] = useState({ odometerReading: "", fuelLevel: "", damageNoted: "" });
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [settlementNotes, setSettlementNotes] = useState("");

  const post = useMutation({
    mutationFn: async ({ step, body }: { step: string; body: Record<string, any> }) => {
      const res = await apiRequest("POST", `${tripKey}/${step}`, body);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [tripKey] });
      toast({ title: `Self-drive ${vars.step} recorded` });
    },
    onError: (err: any) => toast({ title: "Could not save", description: err?.message, variant: "destructive" }),
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
  const chargesTotal = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const saveDeposit = () => {
    if (depositForm.amount === "" || Number(depositForm.amount) < 0) {
      toast({ title: "Deposit amount required", variant: "destructive" });
      return;
    }
    post.mutate({ step: "deposit", body: { amount: Number(depositForm.amount), method: depositForm.method, ...(depositForm.notes.trim() ? { notes: depositForm.notes.trim() } : {}) } });
  };

  const saveOdoStep = (step: "handover" | "return", form: typeof handoverForm) => {
    if (form.odometerReading === "" || form.fuelLevel === "") {
      toast({ title: "Odometer and fuel level are required", variant: "destructive" });
      return;
    }
    post.mutate({ step, body: { odometerReading: Number(form.odometerReading), fuelLevel: Number(form.fuelLevel), ...(form.damageNoted.trim() ? { damageNoted: form.damageNoted.trim() } : {}) } });
  };

  const saveSettlement = () => {
    const cleaned = charges.filter((c) => c.label.trim() && c.amount !== "");
    if (cleaned.some((c) => Number(c.amount) < 0)) {
      toast({ title: "Charge amounts cannot be negative", variant: "destructive" });
      return;
    }
    post.mutate({
      step: "settlement",
      body: {
        charges: cleaned.map((c) => ({ label: c.label.trim(), amount: Number(c.amount) })),
        ...(settlementNotes.trim() ? { notes: settlementNotes.trim() } : {}),
      },
    });
  };

  const odoStepFields = (
    form: typeof handoverForm,
    setForm: (f: typeof handoverForm) => void,
    step: "handover" | "return",
  ) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Odometer (km)</Label>
          <Input type="number" min="0" value={form.odometerReading} onChange={(e) => setForm({ ...form, odometerReading: e.target.value })} data-testid={`sd-${step}-odometer`} />
        </div>
        <div>
          <Label>Fuel Level (%)</Label>
          <Input type="number" min="0" max="100" value={form.fuelLevel} onChange={(e) => setForm({ ...form, fuelLevel: e.target.value })} data-testid={`sd-${step}-fuel`} />
        </div>
      </div>
      <div>
        <Label>Damage / Condition Notes (optional)</Label>
        <Textarea rows={2} value={form.damageNoted} onChange={(e) => setForm({ ...form, damageNoted: e.target.value })} />
      </div>
      <Button size="sm" disabled={post.isPending} onClick={() => saveOdoStep(step, form)} data-testid={`sd-${step}-save`}>
        {step === "handover" ? "Record Handover" : "Record Return"}
      </Button>
    </div>
  );

  const doneSummary = (rec: any) => (
    <p className="text-sm text-gray-600">
      Odometer {rec.odometerReading} km · Fuel {rec.fuelLevel}% · {fmtDateTime(rec.conductedAt)}
      {rec.damageNoted ? <span className="block text-amber-700">Damage noted: {rec.damageNoted}</span> : null}
    </p>
  );

  return (
    <div className="space-y-5" data-testid="self-drive-panel">
      {/* Stage stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STAGE_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <Separator className="w-4" />}
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

      {/* Deposit */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Security Deposit</p>
        {trip.deposit ? (
          <p className="text-sm text-gray-600" data-testid="sd-deposit-summary">
            {fmtMoney(trip.deposit.amount)} · {DEPOSIT_METHOD_LABELS[trip.deposit.method] || trip.deposit.method} · {fmtDateTime(trip.deposit.collectedAt)}
            {trip.deposit.notes ? <span className="block">{trip.deposit.notes}</span> : null}
          </p>
        ) : editable ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={depositForm.notes} onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })} />
            </div>
            <Button size="sm" disabled={post.isPending} onClick={saveDeposit} data-testid="sd-deposit-save">Record Deposit</Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Not recorded.</p>
        )}
      </div>

      {/* Handover */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Vehicle Handover to Customer</p>
        {trip.handover ? doneSummary(trip.handover)
          : editable ? odoStepFields(handoverForm, setHandoverForm, "handover")
          : <p className="text-sm text-gray-500">Not recorded.</p>}
      </div>

      {/* Return */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Vehicle Return</p>
        {trip.returnRecord ? (
          <>
            {doneSummary(trip.returnRecord)}
            {trip.handover && (
              <p className="text-xs text-gray-500">
                Distance driven: {trip.returnRecord.odometerReading - trip.handover.odometerReading} km
                {trip.returnRecord.fuelLevel < trip.handover.fuelLevel ? ` · Fuel down ${trip.handover.fuelLevel - trip.returnRecord.fuelLevel}%` : ""}
              </p>
            )}
          </>
        ) : trip.handover && editable ? odoStepFields(returnForm, setReturnForm, "return")
          : <p className="text-sm text-gray-500">{trip.handover ? "Not recorded." : "Record the handover first."}</p>}
      </div>

      {/* Settlement */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Settlement</p>
        {trip.settlement ? (
          <div className="text-sm text-gray-600 space-y-1" data-testid="sd-settlement-summary">
            {(trip.settlement.charges || []).map((c: any, i: number) => (
              <p key={i}>{c.label}: {fmtMoney(c.amount)}</p>
            ))}
            <p>Total charges: {fmtMoney(trip.settlement.totalCharges)}</p>
            <p className="font-medium text-gray-900">
              Deposit refund: {fmtMoney(trip.settlement.depositRefund)}
              {trip.settlement.balanceDue > 0 ? ` · Balance due from customer: ${fmtMoney(trip.settlement.balanceDue)}` : ""}
            </p>
            <p className="text-xs text-gray-500">Settled {fmtDateTime(trip.settlement.settledAt)}{trip.settlement.notes ? ` · ${trip.settlement.notes}` : ""}</p>
          </div>
        ) : trip.returnRecord && editable ? (
          <div className="space-y-3">
            {charges.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input placeholder="Charge (e.g. fuel shortage, damage)" value={c.label} onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Input type="number" min="0" placeholder="₹" className="w-28" value={c.amount} onChange={(e) => setCharges(charges.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <Button size="icon" variant="ghost" onClick={() => setCharges(charges.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setCharges([...charges, { label: "", amount: "" }])}>
              <Plus className="w-4 h-4 mr-1" /> Add Charge
            </Button>
            <div className="text-sm text-gray-600">
              Deposit held: {fmtMoney(trip.deposit?.amount)} · Charges: {fmtMoney(chargesTotal)} · Refund preview: {fmtMoney(Math.max(0, (trip.deposit?.amount || 0) - chargesTotal))}
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={settlementNotes} onChange={(e) => setSettlementNotes(e.target.value)} />
            </div>
            <Button size="sm" disabled={post.isPending} onClick={saveSettlement} data-testid="sd-settlement-save">Settle &amp; Compute Refund</Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{trip.returnRecord ? "Not recorded." : "Record the return first."}</p>
        )}
      </div>
    </div>
  );
}
