import { safeRandomUUID } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { IndianRupee, Plus, Undo2 } from "lucide-react";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  booking: any;
}

function fmtMoney(n?: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  advance: "Advance", partial_payment: "Partial Payment", final_payment: "Final Payment",
  refund: "Refund", adjustment: "Adjustment", driver_collection: "Driver Collection", vendor_collection: "Vendor Collection",
};
const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash", upi: "UPI", bank_transfer: "Bank Transfer", card: "Card",
  payment_gateway: "Payment Gateway", driver_collection: "Driver Collection", vendor_collection: "Vendor Collection", credit: "Credit",
};

// Every dashboard/report that shows money for this booking needs to
// reflect a new payment immediately — react-query's default prefix
// matching can't help here because these pages bake dynamic filters into
// a single query-key string (e.g. "/api/operations/live-bookings?...:"),
// so a predicate that matches on URL prefix is what actually invalidates
// all of them without hardcoding every possible dynamic key.
function invalidateBookingMoneyQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && (
        key.startsWith('/api/operations') || key.startsWith('/api/bookings') || key.startsWith('/api/dashboard')
      );
    },
  });
}

export default function PaymentSection({ booking }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bookingId = booking._id || booking.id;

  const [form, setForm] = useState({
    amount: "", paymentType: "partial_payment", paymentMode: "cash",
    transactionReference: "", receivedBy: "", notes: "",
  });

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const historyQuery = useQuery<any[]>({
    queryKey: [`/api/bookings/${bookingId}/payments`],
    enabled: !!bookingId,
  });
  const history = historyQuery.data || [];

  const { save: autoSaveForm } = useFormAutoSave('payment-form', form, 2000);

  useEffect(() => {
    if (showAddPayment) autoSaveForm();
  }, [form, showAddPayment, autoSaveForm]);

  const totalAmount = booking.totalAmount || 0;
  const advanceReceived = booking.advanceReceived || 0;
  const remainingBalance = Math.max(0, totalAmount - advanceReceived);

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/payments`, {
        amount: Number(form.amount),
        paymentType: form.paymentType,
        paymentMode: form.paymentMode,
        transactionReference: form.transactionReference || undefined,
        receivedBy: form.receivedBy || undefined,
        notes: form.notes || undefined,
        idempotencyKey,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      setShowAddPayment(false);
      setForm({ amount: "", paymentType: "partial_payment", paymentMode: "cash", transactionReference: "", receivedBy: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}/payments`] });
      invalidateBookingMoneyQueries(queryClient);
    },
    onError: (err: any) => {
      toast({ title: "Could not record payment", description: err.message, variant: "destructive" });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const reason = window.prompt("Reason for reversing this payment?");
      if (!reason) throw new Error("__cancelled__");
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/payments/${transactionId}/reverse`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment reversed" });
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}/payments`] });
      invalidateBookingMoneyQueries(queryClient);
    },
    onError: (err: any) => {
      if (err.message === "__cancelled__") return;
      toast({ title: "Could not reverse payment", description: err.message, variant: "destructive" });
    },
  });

  const canReverse = user?.role === 'admin' || user?.role === 'client';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3">
        <div>
          <Label className="text-xs text-gray-500">Total</Label>
          <p className="text-sm font-semibold">{fmtMoney(totalAmount)}</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Received</Label>
          <p className="text-sm font-semibold text-green-600">{fmtMoney(advanceReceived)}</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Remaining Due</Label>
          <p className="text-sm font-semibold text-red-600">{fmtMoney(remainingBalance)}</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Driver Collection</Label>
          <p className="text-sm font-semibold">{fmtMoney(booking.driverCollectionAmount)}</p>
        </div>
        <div className="col-span-2 md:col-span-4 flex items-center justify-between pt-1">
          <Badge variant={booking.paymentStatus === 'paid' ? 'default' : booking.paymentStatus === 'refunded' ? 'destructive' : 'secondary'} className="capitalize">
            {booking.paymentStatus || 'pending'}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => { setShowAddPayment(true); setIdempotencyKey(safeRandomUUID()); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Payment
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Payment History</Label>
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {history.map((t: any) => (
              <div key={t._id} className="flex items-center justify-between p-2 text-sm">
                <div>
                  <div className={t.status === 'reversed' ? 'line-through text-gray-400' : ''}>
                    {fmtMoney(t.amount)} — {PAYMENT_TYPE_LABELS[t.paymentType] || t.paymentType} ({PAYMENT_MODE_LABELS[t.paymentMode] || t.paymentMode})
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(t.receivedAt).toLocaleString('en-IN')}
                    {t.transactionReference ? ` · Ref: ${t.transactionReference}` : ""}
                    {t.receivedBy ? ` · By: ${t.receivedBy}` : ""}
                  </div>
                </div>
                {t.status === 'completed' && canReverse && !['refund', 'adjustment'].includes(t.paymentType) && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => reverseMutation.mutate(t._id)}>
                    <Undo2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input type="number" min={0} className="pl-9" value={form.amount} onWheel={(e) => (e.target as HTMLElement).blur()} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Type</Label>
                <Select value={form.paymentType} onValueChange={(v) => setForm((f) => ({ ...f, paymentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="partial_payment">Partial Payment</SelectItem>
                    <SelectItem value="final_payment">Final Payment</SelectItem>
                    <SelectItem value="driver_collection">Driver Collection</SelectItem>
                    <SelectItem value="vendor_collection">Vendor Collection</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={form.paymentMode} onValueChange={(v) => setForm((f) => ({ ...f, paymentMode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="payment_gateway">Payment Gateway</SelectItem>
                    <SelectItem value="driver_collection">Driver Collection</SelectItem>
                    <SelectItem value="vendor_collection">Vendor Collection</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Transaction Reference (Optional)</Label>
                <Input value={form.transactionReference} onChange={(e) => setForm((f) => ({ ...f, transactionReference: e.target.value }))} />
              </div>
              <div>
                <Label>Received By (Optional)</Label>
                <Input value={form.receivedBy} onChange={(e) => setForm((f) => ({ ...f, receivedBy: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <FormSubmitStatus status={addPaymentMutation.isPending ? 'loading' : addPaymentMutation.isSuccess ? 'success' : 'idle'} successMessage="Payment recorded" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPayment(false)}>Cancel</Button>
            <Button
              disabled={!form.amount || Number(form.amount) <= 0 || addPaymentMutation.isPending}
              onClick={() => addPaymentMutation.mutate()}
            >
              {addPaymentMutation.isPending ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
