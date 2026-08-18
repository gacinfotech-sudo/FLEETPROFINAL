import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { Gift, Minus, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  customerId: string;
  rewards: any;
}

export default function CustomerRewardsPanel({ customerId, rewards }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("100");
  const [reason, setReason] = useState("");
  const canAdjust = user?.role === 'admin' || user?.role === 'client';

  const formData = { points, reason };
  const { save: autoSave } = useFormAutoSave(`customer-rewards-${customerId}`, formData, 2000);
  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/rewards`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const value = Math.round(Number(points) * 100) / 100;
      if (!Number.isFinite(value) || value === 0) throw new Error("Enter a non-zero number of points");
      if (!reason.trim()) throw new Error("Reason is required");
      return (await apiRequest("POST", `/api/customers/${customerId}/rewards/adjust`, {
        points: value,
        reason: reason.trim(),
      })).json();
    },
    onSuccess: (result) => {
      toast({ title: "Reward points updated", description: `New balance: ${result.balance} points` });
      setOpen(false);
      setReason("");
      setPoints("100");
      invalidate();
    },
    onError: (error: any) => toast({ title: "Could not update rewards", description: error.message, variant: "destructive" }),
  });

  const transactions = rewards?.transactions || [];
  const rule = rewards?.rule || {};

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2"><Gift className="h-5 w-5 text-amber-600" /> Rewards Program</CardTitle>
          {canAdjust && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Give / Deduct</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white border p-3">
            <p className="text-xs text-gray-500">Available</p>
            <p className="text-2xl font-bold text-amber-700">{rewards?.balance || 0}</p>
            <p className="text-xs text-gray-500">points</p>
          </div>
          <div className="rounded-lg bg-white border p-3">
            <p className="text-xs text-gray-500">Tier</p>
            <p className="font-semibold flex items-center gap-1"><Star className="h-4 w-4 text-amber-500" />{rewards?.tier || 'Regular'}</p>
          </div>
          <div className="rounded-lg bg-white border p-3">
            <p className="text-xs text-gray-500">Value</p>
            <p className="font-semibold">₹{rule.redemptionValuePerPoint || 1}/point</p>
            <p className="text-xs text-gray-500">Min {rule.minPointsToRedeem || 100}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Recent reward activity</p>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-500 rounded-lg border bg-white p-3">No reward activity yet.</p>
          ) : (
            <div className="rounded-lg border bg-white divide-y max-h-44 overflow-y-auto">
              {transactions.slice(0, 8).map((tx: any) => (
                <div key={tx._id} className="flex justify-between gap-3 p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="capitalize font-medium">{tx.transactionType?.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500 truncate">{tx.reason || 'Reward adjustment'}</p>
                  </div>
                  <span className={`font-semibold whitespace-nowrap ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.points >= 0 ? '+' : ''}{tx.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Give or Deduct Reward Points</DialogTitle></DialogHeader>
          <FormSubmitStatus
            status={mutation.isPending ? "loading" : mutation.isSuccess ? "success" : mutation.isError ? "error" : "idle"}
            successMessage="Reward points updated!"
            errorMessage={(mutation.error as any)?.message}
          />
          <div className="space-y-4">
            <div>
              <Label>Points</Label>
              <Input type="number" step="1" value={points} onChange={(event) => setPoints(event.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Positive number gives points; negative number deducts them.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[50, 100, 200].map((value) => (
                <Button key={value} type="button" size="sm" variant="outline" onClick={() => setPoints(String(value))}>+{value}</Button>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setPoints("-50")}><Minus className="h-3 w-3 mr-1" />50</Button>
            </div>
            <div>
              <Label>Reason</Label>
              <Input placeholder="Referral bonus, service recovery, correction..." value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={mutation.isPending || !reason.trim() || Number(points) === 0} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Updating...' : 'Update Points'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
