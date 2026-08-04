import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Merge, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function money(value?: number) {
  return `₹${(value || 0).toLocaleString('en-IN')}`;
}

export default function CustomerDuplicateReview({ customerId }: { customerId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [reason, setReason] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/customers/${customerId}/duplicate-candidates`],
  });
  const candidates = data?.candidates || [];

  const mergeMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/customers/merge", {
      sourceCustomerId: candidate._id,
      targetCustomerId: customerId,
      reason,
    })).json(),
    onSuccess: () => {
      toast({ title: "Customers merged", description: "All linked records now point to the canonical profile." });
      setCandidate(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/duplicate-candidates`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/bookings`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/requirements`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/rewards`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: (error: any) => toast({ title: "Merge failed", description: error.message, variant: "destructive" }),
  });

  if (isLoading) return null;
  if (candidates.length === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-green-700"><ShieldCheck className="h-3.5 w-3.5" /> No duplicate match</span>;
  }

  return (
    <>
      <Button size="sm" variant="outline" className="border-amber-300 text-amber-800" onClick={() => setReviewOpen(true)}>
        <AlertTriangle className="h-4 w-4 mr-1" /> Review Duplicates ({candidates.length})
      </Button>
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Possible Duplicate Customers</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Review the evidence before merging. The currently open customer remains the canonical profile.</p>
          <div className="space-y-3">
            {candidates.map((row: any) => (
              <div key={row._id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-gray-600">{row.primaryMobile?.replace(/^91/, '')} {row.email ? `· ${row.email}` : ''}</p>
                    <div className="flex gap-1 mt-2">{row.matchReasons.map((match: string) => <Badge key={match} variant="outline" className="capitalize bg-white">Same {match}</Badge>)}</div>
                  </div>
                  <Button size="sm" onClick={() => { setReviewOpen(false); setCandidate(row); setReason(""); }}><Merge className="h-4 w-4 mr-1" /> Merge into Current</Button>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <span>Bookings: <strong>{row.totalBookings || row.recentBookings?.length || 0}</strong></span>
                  <span>Lifetime spend: <strong>{money(row.totalSpending)}</strong></span>
                  <span>Pending due: <strong className="text-red-700">{money(row.pendingDue)}</strong></span>
                </div>
                {row.recentBookings?.length > 0 && <p className="text-xs text-gray-500 mt-2">Latest: {row.recentBookings[0].bookingId} · {row.recentBookings[0].pickupLocation} → {row.recentBookings[0].dropoffLocation || '-'}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!candidate} onOpenChange={(open) => !open && setCandidate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Customer Merge</DialogTitle></DialogHeader>
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">
            <strong>{candidate?.name}</strong> will become a merge tombstone. Its bookings, rewards, feedback, complaints, requirements, messages and follow-ups will move to the current customer.
          </div>
          <div><Label>Merge reason</Label><Input placeholder="Example: Same customer registered with alternate mobile" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCandidate(null)}>Cancel</Button>
            <Button variant="destructive" disabled={reason.trim().length < 5 || mergeMutation.isPending} onClick={() => mergeMutation.mutate()}>
              {mergeMutation.isPending ? 'Merging...' : 'Confirm Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
