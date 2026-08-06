import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Wallet, Check, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

interface Props {
  booking: any;
}

function fmtMoney(n?: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: "Maintenance", damage: "Damage", tires: "Tires", fuel: "Fuel", other: "Other",
};

// Internal Trip Cost / Gross Contribution are margin data — only shown to
// users with the trip.profitability.view permission (docs/
// TRIP_COSTING_DATA_MAPPING.md: "gated behind a new trip.profitability.view
// permission"). Everyone else sees nothing here, not a broken/empty panel —
// this section simply doesn't render for them.
export default function TripCostSummary({ booking }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canViewTripProfitability, canApproveExpense } = usePermissions();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const bookingId = booking._id || booking.id;
  const vehicleId = booking.vehicleId?._id || booking.vehicleId;
  const driverId = booking.driverId?._id || booking.driverId;

  const [form, setForm] = useState({
    category: "fuel", amount: "", date: new Date().toISOString().slice(0, 10), description: "",
    customerChargeable: false, reimbursable: false,
  });

  const enabled = canViewTripProfitability() && !!bookingId;
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: [`/api/bookings/${bookingId}/trip-cost-summary`],
    enabled,
  });

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/expenses", {
        vehicleId, bookingId, driverId: driverId || undefined,
        category: form.category, amount: Number(form.amount), date: form.date,
        description: form.description, customerChargeable: form.customerChargeable, reimbursable: form.reimbursable,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Trip expense recorded" });
      setShowAddExpense(false);
      setForm({ category: "fuel", amount: "", date: new Date().toISOString().slice(0, 10), description: "", customerChargeable: false, reimbursable: false });
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}/trip-cost-summary`] });
    },
    onError: (err: any) => toast({ title: "Could not record expense", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      (await apiRequest("POST", `/api/expenses/${id}/${action}`, {})).json(),
    onSuccess: () => {
      toast({ title: "Expense updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}/trip-cost-summary`] });
    },
    onError: (err: any) => toast({ title: "Could not update expense", description: err.message, variant: "destructive" }),
  });

  if (!enabled) return null;
  if (isLoading) return <p className="text-sm text-gray-500">Loading trip cost summary...</p>;
  if (!summary) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Wallet className="h-4 w-4" /> Trip Cost & Profitability</Label>
        <Button size="sm" variant="outline" onClick={() => setShowAddExpense(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Trip Expense</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3 text-sm">
        <div><p className="text-xs text-gray-500">Customer Revenue</p><p className="font-semibold">{fmtMoney(summary.customerRevenue)}</p></div>
        <div><p className="text-xs text-gray-500">Internal Trip Cost</p><p className="font-semibold text-red-600">{fmtMoney(summary.internalTripCost)}</p></div>
        <div><p className="text-xs text-gray-500">Collected</p><p className="font-semibold text-green-600">{fmtMoney(summary.collection)}</p></div>
        <div><p className="text-xs text-gray-500">Gross Contribution</p><p className={`font-semibold ${summary.grossContribution >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtMoney(summary.grossContribution)}</p></div>
      </div>
      {summary.vendorDirectCost > 0 && (
        <p className="text-xs text-gray-500">Includes {fmtMoney(summary.vendorDirectCost)} vendor direct cost (this booking is vendor-fulfilled) + {fmtMoney(summary.expenseCost)} approved internal expenses.</p>
      )}
      {summary.pendingApprovalCount > 0 && (
        <p className="text-xs text-amber-700">{summary.pendingApprovalCount} expense{summary.pendingApprovalCount === 1 ? "" : "s"} awaiting approval — not yet counted in Internal Trip Cost above.</p>
      )}

      {summary.expenses?.length > 0 && (
        <div className="border rounded-lg divide-y">
          {summary.expenses.map((e: any) => (
            <div key={e._id} className="flex items-center justify-between p-2 text-sm">
              <div>
                <div>{fmtMoney(e.amount)} — {CATEGORY_LABELS[e.category] || e.category}{e.driverId?.name ? ` · ${e.driverId.name}` : ""}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  {new Date(e.date).toLocaleDateString('en-IN')}
                  <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">{e.approvalStatus}</Badge>
                  {e.customerChargeable && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700">Customer chargeable</Badge>}
                  {e.reimbursable && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-300 text-purple-700">Reimbursable</Badge>}
                </div>
              </div>
              {e.approvalStatus === 'pending' && canApproveExpense() && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="text-green-600" onClick={() => approveMutation.mutate({ id: e._id, action: 'approve' })}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => approveMutation.mutate({ id: e._id, action: 'reject' })}><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Trip Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="tires">Tires</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.customerChargeable} onCheckedChange={(v) => setForm((f) => ({ ...f, customerChargeable: !!v }))} />
              Customer chargeable (will not count as internal cost)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.reimbursable} onCheckedChange={(v) => setForm((f) => ({ ...f, reimbursable: !!v }))} />
              Reimbursable to driver
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpense(false)}>Cancel</Button>
            <Button disabled={!form.amount || Number(form.amount) <= 0 || addExpenseMutation.isPending} onClick={() => addExpenseMutation.mutate()}>
              {addExpenseMutation.isPending ? "Saving..." : "Record Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
