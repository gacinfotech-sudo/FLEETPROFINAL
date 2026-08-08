// Collect Payment — thin wrapper over the canonical payment ledger
// (POST /api/bookings/:id/payments). No duplicate payment entry surface:
// this writes the same PaymentTransaction rows as the Booking Workspace,
// so Live Operations, Dashboard, Booking, and Customer 360 all update from
// one record (spec §37).

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LiveVehicleCard } from "@/pages/live-operations";
import { money } from "@/pages/live-operations";

export default function CollectPaymentDialog({ card, onClose, onDone }: {
  card: LiveVehicleCard;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(String(card.balance || ""));
  const [paymentMode, setPaymentMode] = useState("upi");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // One idempotency key per dialog-open — a double-click resolves to the
  // same PaymentTransaction (same contract as the workspace dialog).
  const idempotencyKey = useMemo(() => `liveops-${card.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`, [card.id]);

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/bookings/${card.id}/payments`, {
        amount: amt,
        paymentType: amt >= card.balance ? "final_payment" : "partial_payment",
        paymentMode,
        transactionReference: reference || undefined,
        idempotencyKey,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Payment failed");
      }
      toast({ title: "Payment recorded", description: `${money(amt)} against ${card.bookingCode}` });
      onDone();
    } catch (err: any) {
      toast({ title: "Payment failed", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Payment — {card.bookingCode}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-2.5">
            {card.customerName} · Total {money(card.totalAmount)} · Received {money(card.received)} ·{" "}
            <span className="font-semibold text-red-700">Balance {money(card.balance)}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount (₹)*</Label>
            <Input id="pay-amount" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="payment_gateway">Payment Gateway</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Reference (optional)</Label>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / txn id" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} data-testid="confirm-collect">
              {submitting ? "Recording…" : "Record Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
