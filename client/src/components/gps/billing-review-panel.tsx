import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Satellite, Check, X, RefreshCw, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

interface Props {
  booking: any;
}

// TASK-GPS-TRIP-BILLING-06's one owned client file. Surfaces GPS-derived
// distance evidence ALONGSIDE the existing manual odometer values shown in
// duty-slip.tsx (see that file's "Odometer & Trip Log" section) — this
// panel never edits or replaces booking.startOdometer/endOdometer/
// totalKilometers; it only ever reads them (as meterDistanceKm, a
// point-in-time snapshot already captured server-side) for comparison.
// Approve/reject write only to the server's own GpsTripReconciliation
// record, never to the booking.

const DISTANCE_SOURCE_LABEL: Record<string, string> = {
  gps_only: "GPS distance only (no meter reading recorded)",
  meter_only: "Meter reading only",
  both_matched: "GPS and meter distance match",
  both_mismatched: "GPS and meter distance mismatch",
  insufficient_data: "Insufficient data to reconcile",
};

const REVIEW_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_review: { label: "Pending Review", className: "border-amber-300 text-amber-700 bg-amber-50" },
  approved: { label: "Approved", className: "border-green-300 text-green-700 bg-green-50" },
  rejected: { label: "Rejected", className: "border-red-300 text-red-700 bg-red-50" },
  not_applicable: { label: "Not Applicable", className: "border-gray-300 text-gray-600 bg-gray-50" },
};

function fmtKm(n?: number) {
  if (n === undefined || n === null) return "—";
  return `${n.toFixed(1)} km`;
}

function fmtPct(n?: number) {
  if (n === undefined || n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export default function BillingReviewPanel({ booking }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canReview = hasPermission("gps.distance.review");
  const canApprove = hasPermission("gps.distance.approve");
  const bookingId = booking?._id || booking?.id;

  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const formData = { rejectNote };
  const { save: autoSave } = useFormAutoSave(`gps-billing-${bookingId}`, formData, 2000);
  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const queryKey = [`/api/gps/billing/bookings/${bookingId}/reconciliation`];

  const { data, isLoading } = useQuery<any>({
    queryKey,
    enabled: canReview && !!bookingId,
  });
  const reconciliation = data?.reconciliation;

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const computeMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/gps/billing/bookings/${bookingId}/reconcile`, {})).json(),
    onSuccess: () => {
      toast({ title: "GPS reconciliation computed" });
      invalidate();
    },
    onError: (err: any) => toast({ title: "Could not compute GPS reconciliation", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/gps/billing/bookings/${bookingId}/approve`, {})).json(),
    onSuccess: () => {
      toast({ title: "Billable distance approved" });
      invalidate();
    },
    onError: (err: any) => toast({ title: "Could not approve", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (note: string) => (await apiRequest("POST", `/api/gps/billing/bookings/${bookingId}/reject`, { note })).json(),
    onSuccess: () => {
      toast({ title: "Reconciliation rejected" });
      setShowReject(false);
      setRejectNote("");
      invalidate();
    },
    onError: (err: any) => toast({ title: "Could not reject", description: err.message, variant: "destructive" }),
  });

  // Not reachable at all without GPS_DISTANCE_REVIEW — not a broken/empty
  // panel for everyone else, this section simply doesn't render (same
  // pattern as trip-cost-summary.tsx's profitability gate).
  if (!canReview) return null;
  if (!bookingId) return null;

  const statusBadge = reconciliation ? REVIEW_STATUS_BADGE[reconciliation.reviewStatus] : undefined;

  return (
    <div className="space-y-3">
      <FormSubmitStatus
        status={approveMutation.isPending || rejectMutation.isPending ? "loading" : approveMutation.isSuccess || rejectMutation.isSuccess ? "success" : approveMutation.isError || rejectMutation.isError ? "error" : "idle"}
        successMessage="GPS reconciliation status updated!"
        errorMessage={(approveMutation.error as any)?.message || (rejectMutation.error as any)?.message}
      />
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Satellite className="h-4 w-4" /> GPS Distance Reconciliation
        </Label>
        <Button
          size="sm"
          variant="outline"
          disabled={computeMutation.isPending}
          onClick={() => computeMutation.mutate()}
          data-testid="button-gps-reconcile"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${computeMutation.isPending ? "animate-spin" : ""}`} />
          {reconciliation ? "Recompute" : "Run Reconciliation"}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading GPS reconciliation…</p>}

      {!isLoading && !reconciliation && (
        <p className="text-sm text-gray-500">No GPS reconciliation computed yet for this booking.</p>
      )}

      {reconciliation && (
        <div className="space-y-3 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{DISTANCE_SOURCE_LABEL[reconciliation.distanceSource] || reconciliation.distanceSource}</span>
            {statusBadge && (
              <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Meter Distance</p><p className="font-semibold">{fmtKm(reconciliation.meterDistanceKm)}</p></div>
            <div><p className="text-xs text-gray-500">GPS Distance</p><p className="font-semibold">{fmtKm(reconciliation.gpsDistanceKm)}</p></div>
            <div><p className="text-xs text-gray-500">Mismatch</p><p className="font-semibold">{fmtKm(reconciliation.mismatchKm)}</p></div>
            <div><p className="text-xs text-gray-500">Mismatch %</p><p className={`font-semibold ${reconciliation.distanceSource === "both_mismatched" ? "text-red-600" : ""}`}>{fmtPct(reconciliation.mismatchPct)}</p></div>
          </div>

          {reconciliation.dataGap && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              A GPS device was on record for this trip, but no telemetry was stored for the window — this is a data gap, not a confirmed mismatch.
            </div>
          )}
          {reconciliation.deviceCorrelationStatus === "none" && reconciliation.distanceSource !== "insufficient_data" && (
            <p className="text-xs text-gray-500">No GPS device was assigned to this vehicle during the trip window — the meter reading remains the only evidence.</p>
          )}
          {reconciliation.driverCorrelationStatus === "ambiguous" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              More than one driver was on record for this vehicle/window ({reconciliation.driverCorrelationCandidateCount} candidates) — driver attribution is ambiguous; review before approving.
            </div>
          )}

          {reconciliation.reviewStatus === "pending_review" && canApprove && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
                data-testid="button-gps-approve"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-300"
                onClick={() => setShowReject(true)}
                data-testid="button-gps-reject"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </div>
          )}

          {reconciliation.approvalNote && (
            <p className="text-xs text-gray-500">Note: {reconciliation.approvalNote}</p>
          )}
        </div>
      )}

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject GPS Reconciliation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason (required)</Label>
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Explain why this GPS/meter reconciliation is being rejected…"
                data-testid="input-gps-reject-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button
              disabled={rejectNote.trim().length < 3 || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(rejectNote.trim())}
              data-testid="button-gps-reject-confirm"
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
