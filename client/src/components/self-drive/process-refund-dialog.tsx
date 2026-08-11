// Process Refund — the complete deposit settlement screen (spec §16-§21).
// One dialog: deduction checklist → transparent calculation → refund
// payout(s, partial supported) → close/forfeit. Every number comes back
// from the server's computeRefund; this dialog never invents totals.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, IndianRupee, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const DEDUCTION_META: { kind: string; label: string; question: string }[] = [
  { kind: "toll", label: "Toll", question: "Any toll amount pending?" },
  { kind: "parking", label: "Parking", question: "Any parking amount pending?" },
  { kind: "challan", label: "Challan", question: "Any challan on this booking?" },
  { kind: "delivery", label: "Delivery / Pickup", question: "Delivery/pickup charge pending?" },
  { kind: "fuel", label: "Fuel Adjustment", question: "Fuel adjustment required?" },
  { kind: "late", label: "Late Charges", question: "Late return charges" },
  { kind: "damage", label: "Damage", question: "Damage deduction?" },
  { kind: "cleaning", label: "Cleaning", question: "Cleaning charge?" },
  { kind: "other", label: "Other", question: "Other adjustment?" },
];

const REFUND_MODES = [
  { v: "cash", l: "Cash" }, { v: "upi", l: "UPI" }, { v: "bank_transfer", l: "Bank Transfer" },
  { v: "card_reversal", l: "Card Reversal" }, { v: "wallet", l: "Wallet" }, { v: "other", l: "Other" },
];

const money = (n?: number | null) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

interface DeductionRow { kind: string; amount: string; remarks: string; reference: string; waived: boolean; enabled: boolean }

export default function ProcessRefundDialog({ bookingId, bookingCode, customerName, onClose, onDone }: {
  bookingId: string;
  bookingCode?: string | null;
  customerName?: string | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tripKey = `/api/bookings/${bookingId}/self-drive`;
  const { data: trip, isLoading } = useQuery<any>({ queryKey: [tripKey] });

  const [rows, setRows] = useState<DeductionRow[]>([]);
  const [reason, setReason] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("upi");
  const [payRef, setPayRef] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [forfeitMode, setForfeitMode] = useState(false);

  const refund = trip?.refund;
  const comp = refund?.computation;

  // Seed the checklist from the server's current deduction list once loaded.
  useEffect(() => {
    if (!refund) return;
    const byKind = new Map<string, any>((refund.deductions || []).map((d: any) => [d.kind, d]));
    setRows(DEDUCTION_META.map((m) => {
      const d = byKind.get(m.kind);
      return {
        kind: m.kind,
        amount: d ? String(d.amount) : "",
        remarks: d?.remarks || "",
        reference: d?.reference || "",
        waived: !!d?.waived,
        enabled: !!d,
      };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refund?.deductions ? JSON.stringify(refund.deductions) : ""]);

  const formData = { rows, reason, payAmount, payMode, payRef, closeReason, forfeitMode };
  const { save: autoSave } = useFormAutoSave(`process-refund-${bookingId}`, formData, 2000);
  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const previewDeduction = useMemo(
    () => rows.filter((r) => r.enabled && !r.waived).reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows],
  );
  const previewRefundable = Math.max(0, (comp?.depositAmount || 0) - previewDeduction);
  const previewBalance = Math.max(0, previewRefundable - (comp?.refunded || 0));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [tripKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/self-drive/refunds?status=open"] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/self-drive/refunds?status=closed"] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/self-drive/kpis"] });
    queryClient.invalidateQueries({ queryKey: ["/api/operations/alerts?status=open"] });
  };

  const call = useMutation({
    mutationFn: async ({ method, path, body }: { method: string; path: string; body?: any }) => {
      const res = await apiRequest(method, `${tripKey}/${path}`, body);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      invalidate();
      toast({ title: vars.path.includes("transactions") ? "Refund recorded" : vars.path.includes("close") ? "Refund case closed" : vars.path.includes("forfeit") ? "Deposit forfeited" : "Deductions saved" });
      if (vars.path.includes("close") || vars.path.includes("forfeit")) onDone?.();
    },
    onError: (err: any) => {
      const m = /^\d+:\s*([\s\S]*)$/.exec(err?.message || "");
      let msg = err?.message;
      try { msg = m ? (JSON.parse(m[1])?.message || msg) : msg; } catch { /* keep */ }
      toast({ title: "Refund action failed", description: msg, variant: "destructive" });
    },
  });

  const saveDeductions = () => {
    const deductions = rows
      .filter((r) => r.enabled && (Number(r.amount) > 0 || r.waived))
      .map((r) => ({
        kind: r.kind,
        amount: Number(r.amount) || 0,
        ...(r.remarks.trim() ? { remarks: r.remarks.trim() } : {}),
        ...(r.reference.trim() ? { reference: r.reference.trim() } : {}),
        ...(r.waived ? { waived: true } : {}),
      }));
    call.mutate({ method: "PATCH", path: "refund/deductions", body: { deductions, ...(reason.trim() ? { reason: reason.trim() } : {}) } });
  };

  const recordPayout = () => {
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Enter a valid refund amount", variant: "destructive" });
      return;
    }
    call.mutate({
      method: "POST", path: "refund/transactions",
      body: { amount: amt, mode: payMode, ...(payRef.trim() ? { reference: payRef.trim() } : {}) },
    });
    setPayAmount("");
    setPayRef("");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="process-refund-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <IndianRupee size={18} /> Process Refund {bookingCode ? `— ${bookingCode}` : ""}
            {refund && <Badge variant="outline" className="uppercase text-[10px]">{refund.status.replace(/_/g, " ")}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !trip ? (
          <div className="py-10 text-center text-gray-500"><Loader2 className="w-5 h-5 mx-auto animate-spin" /></div>
        ) : !refund ? (
          <div className="py-6 text-sm text-gray-600 space-y-3">
            <p>No refund case yet — the vehicle return has to be recorded first (it opens automatically when a deposit is held).</p>
            <Button size="sm" variant="outline" onClick={() => call.mutate({ method: "POST", path: "refund/ensure" })}>Open refund case</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><span className="text-gray-500 block text-xs">Customer</span>{customerName || "—"}</div>
              <div><span className="text-gray-500 block text-xs">Deposit received</span><span className="font-semibold">{money(comp?.depositAmount)}</span></div>
              <div><span className="text-gray-500 block text-xs">Returned</span>{trip.returnRecord ? new Date(trip.returnRecord.conductedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "—"}</div>
              <div><span className="text-gray-500 block text-xs">Refunded so far</span>{money(comp?.refunded)}</div>
            </div>

            {/* Deduction checklist (spec §17) */}
            {!["closed", "forfeited"].includes(refund.status) && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Deductions from deposit</p>
                {rows.map((r, i) => {
                  const meta = DEDUCTION_META.find((m) => m.kind === r.kind)!;
                  return (
                    <div key={r.kind} className={`rounded-md border p-2.5 ${r.enabled ? "border-gray-300" : "border-gray-100"}`} data-testid={`deduction-${r.kind}`}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={r.enabled} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} />
                        <span className="font-medium">{meta.label}</span>
                        <span className="text-gray-500 text-xs">{meta.question}</span>
                        {r.kind === "late" && trip.lateCharge?.applicable && (
                          <span className="text-xs text-amber-700 ml-auto">
                            auto: {money(trip.lateCharge.amount)} ({trip.lateCharge.units} × ₹{trip.lateCharge.policy.rate})
                          </span>
                        )}
                      </label>
                      {r.enabled && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                          <Input type="number" min="0" placeholder="₹ amount" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} data-testid={`deduction-${r.kind}-amount`} />
                          <Input placeholder="Remarks" value={r.remarks} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, remarks: e.target.value } : x))} />
                          <Input placeholder={r.kind === "challan" ? "Challan no." : "Reference"} value={r.reference} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, reference: e.target.value } : x))} />
                          <label className="flex items-center gap-1.5 text-xs text-gray-600">
                            <input type="checkbox" checked={r.waived} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, waived: e.target.checked } : x))} />
                            Waive
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Reason (required when changing/waiving recorded deductions)</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer disputed toll, verified receipts" />
                  </div>
                  <Button size="sm" variant="outline" disabled={call.isPending} onClick={saveDeductions} data-testid="save-deductions">Save Deductions</Button>
                </div>
              </div>
            )}

            {/* Calculation (spec §18) — server-confirmed numbers, live preview while editing */}
            <FormSubmitStatus
              status={call.isPending ? "loading" : call.isSuccess ? "success" : call.isError ? "error" : "idle"}
              successMessage="Refund action completed!"
              errorMessage={(call.error as any)?.message}
            />
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm" data-testid="refund-calculation">
              <div className="flex justify-between"><span>Security Deposit</span><span className="font-medium">{money(comp?.depositAmount)}</span></div>
              <div className="flex justify-between text-red-700"><span>Total Deductions</span><span>− {money(previewDeduction)}</span></div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold"><span>FINAL REFUND</span><span data-testid="final-refund">{money(previewRefundable)}</span></div>
              {(comp?.refunded || 0) > 0 && (
                <div className="flex justify-between text-emerald-700 mt-1"><span>Already refunded</span><span>{money(comp?.refunded)}</span></div>
              )}
              <div className="flex justify-between mt-1 font-semibold"><span>Remaining to refund</span><span data-testid="refund-balance">{money(previewBalance)}</span></div>
              {comp?.extraOwed > 0 && (
                <p className="text-xs text-red-700 mt-1 flex items-center gap-1"><AlertTriangle size={12} /> Deductions exceed the deposit by {money(comp.extraOwed)} — collect it through booking payments.</p>
              )}
            </div>

            {/* Payout (spec §20 — partial supported) */}
            {!["closed", "forfeited"].includes(refund.status) && (comp?.balance || 0) > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Record refund payment</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Input type="number" min="1" placeholder={`₹ up to ${comp?.balance}`} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} data-testid="refund-pay-amount" />
                  <Select value={payMode} onValueChange={setPayMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REFUND_MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="UTR / Txn ID" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                  <Button size="sm" disabled={call.isPending} onClick={recordPayout} data-testid="record-refund-payment">Refund {payAmount ? money(Number(payAmount)) : ""}</Button>
                </div>
              </div>
            )}

            {/* History */}
            {(refund.transactions?.length || 0) > 0 && (
              <div className="text-xs text-gray-600 space-y-1">
                <p className="font-medium text-sm text-gray-900">Refund payments</p>
                {refund.transactions.map((t: any, i: number) => (
                  <p key={i}>{money(t.amount)} · {t.mode.replace(/_/g, " ")} · {new Date(t.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}{t.reference ? ` · ${t.reference}` : ""} · by {t.by}</p>
                ))}
              </div>
            )}
            {(refund.overrides?.length || 0) > 0 && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer font-medium text-gray-700">Audit trail ({refund.overrides.length})</summary>
                <div className="mt-1 space-y-0.5">
                  {refund.overrides.map((o: any, i: number) => (
                    <p key={i}>{new Date(o.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })} — {o.by} — {o.field}{o.oldValue ? `: ${o.oldValue} → ${o.newValue}` : o.newValue ? `: ${o.newValue}` : ""} ({o.reason})</p>
                  ))}
                </div>
              </details>
            )}

            {/* Close / forfeit (spec §21 — Rule H) */}
            {!["closed", "forfeited"].includes(refund.status) && (
              <div className="flex flex-wrap items-end gap-2 pt-1 border-t">
                {(previewBalance > 0 || forfeitMode) && (
                  <div className="flex-1 min-w-[220px]">
                    <Label className="text-xs">{forfeitMode ? "Forfeit reason (required)" : "Override reason (owner only — balance remains)"}</Label>
                    <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="Reason" data-testid="close-reason" />
                  </div>
                )}
                <Button size="sm" variant="outline" className="text-red-700 border-red-200" data-testid="forfeit-deposit"
                  onClick={() => {
                    if (!forfeitMode) { setForfeitMode(true); return; }
                    if (!closeReason.trim()) { toast({ title: "Forfeit requires a reason", variant: "destructive" }); return; }
                    call.mutate({ method: "POST", path: "refund/forfeit", body: { reason: closeReason.trim() } });
                  }}>
                  {forfeitMode ? "Confirm Forfeit" : "Forfeit Deposit"}
                </Button>
                <Button size="sm" disabled={call.isPending} data-testid="close-refund"
                  onClick={() => call.mutate({ method: "POST", path: "refund/close", body: closeReason.trim() ? { reason: closeReason.trim() } : {} })}>
                  Close Refund Case
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
