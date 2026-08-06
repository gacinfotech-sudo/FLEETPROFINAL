import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, AlertTriangle, Plus, CheckCircle2, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  customerId: string;
  bookings: any[];
}

const CATEGORY_LABELS: Record<string, string> = {
  driver_late: "Driver Late", driver_behaviour: "Driver Behaviour", rash_driving: "Rash Driving",
  vehicle_problem: "Vehicle Problem", vehicle_cleanliness: "Vehicle Cleanliness", vehicle_breakdown: "Vehicle Breakdown", ac_problem: "AC Problem",
  wrong_vehicle: "Wrong Vehicle", booking_issue: "Booking Issue", payment_dispute: "Payment Dispute",
  office_communication: "Office Communication", vendor_issue: "Vendor Issue", self_drive_issue: "Self-Drive Issue", other: "Other",
};

const SEVERITY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-700", medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800", critical: "bg-red-100 text-red-800",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-red-100 text-red-800", in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800", closed: "bg-gray-100 text-gray-600",
};

const EMPTY_FEEDBACK_FORM = {
  bookingId: "", type: "feedback", driverRating: 0, vehicleRating: 0, serviceRating: 0,
  vehicleCleanlinessRating: 0, vehicleComfortRating: 0, vehicleAcRating: 0, vehicleConditionRating: 0,
  vehicleIssueReported: false, breakdownOccurred: false, vehicleIssueDescription: "",
  driverPunctualityRating: 0, driverBehaviourRating: 0, driverSafetyRating: 0,
  driverRouteKnowledgeRating: 0, driverPaymentHandlingRating: 0, comments: "",
};

const DRIVER_RATING_FIELDS = [
  ['driverPunctualityRating', 'Punctuality'], ['driverBehaviourRating', 'Behaviour'],
  ['driverSafetyRating', 'Driving Safety'], ['driverRouteKnowledgeRating', 'Route Knowledge'],
  ['driverPaymentHandlingRating', 'Payment Handling'],
] as const;

const VEHICLE_RATING_FIELDS = [
  ['vehicleCleanlinessRating', 'Cleanliness'], ['vehicleComfortRating', 'Comfort'],
  ['vehicleAcRating', 'AC Performance'], ['vehicleConditionRating', 'Vehicle Condition'],
] as const;

function Stars({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-gray-400 text-xs">Not rated</span>;
  return (
    <span className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
      ))}
    </span>
  );
}

export default function CustomerService({ customerId, bookings }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [resolvingComplaint, setResolvingComplaint] = useState<any>(null);

  const [feedbackForm, setFeedbackForm] = useState({ ...EMPTY_FEEDBACK_FORM });
  const [complaintForm, setComplaintForm] = useState({ bookingId: "", category: "other", severity: "medium", description: "", responsibleParty: "unclear", responsibilityReason: "" });
  const [resolveForm, setResolveForm] = useState({ status: "in_progress", correctiveAction: "none", compensationAmount: "", compensationPoints: "", resolution: "", responsibleParty: "unclear", responsibilityReason: "" });

  const { data: feedback } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/feedback`] });
  const { data: complaints } = useQuery<any[]>({ queryKey: [`/api/customers/${customerId}/complaints`] });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/feedback`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/complaints`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/drivers`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/vehicles`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/rewards`] });
    queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).includes('/customer-feedback-profile') });
    queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/reports/vehicle-performance') });
  };

  const addFeedback = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { ...feedbackForm };
      for (const field of ['driverRating', 'vehicleRating', 'serviceRating', ...DRIVER_RATING_FIELDS.map(([key]) => key), ...VEHICLE_RATING_FIELDS.map(([key]) => key)]) {
        if (!payload[field]) payload[field] = undefined;
      }
      return (await apiRequest("POST", `/api/customers/${customerId}/feedback`, payload)).json();
    },
    onSuccess: () => { toast({ title: "Feedback recorded" }); setShowFeedbackForm(false); setFeedbackForm({ ...EMPTY_FEEDBACK_FORM }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not record feedback", description: err.message, variant: "destructive" }),
  });

  const addComplaint = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/customers/${customerId}/complaints`, complaintForm)).json(),
    onSuccess: () => { toast({ title: "Complaint recorded" }); setShowComplaintForm(false); setComplaintForm({ bookingId: "", category: "other", severity: "medium", description: "", responsibleParty: "unclear", responsibilityReason: "" }); invalidate(); },
    onError: (err: any) => toast({ title: "Could not record complaint", description: err.message, variant: "destructive" }),
  });

  const resolveComplaint = useMutation({
    mutationFn: async () => (await apiRequest("PUT", `/api/customers/${customerId}/complaints/${resolvingComplaint._id}`, {
      ...resolveForm,
      compensationAmount: resolveForm.compensationAmount ? Number(resolveForm.compensationAmount) : undefined,
      compensationPoints: resolveForm.compensationPoints ? Number(resolveForm.compensationPoints) : undefined,
    })).json(),
    onSuccess: () => { toast({ title: "Complaint updated" }); setResolvingComplaint(null); invalidate(); },
    onError: (err: any) => toast({ title: "Could not update complaint", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Feedback */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-700">Feedback</Label>
          <Button size="sm" variant="outline" onClick={() => setShowFeedbackForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Feedback
          </Button>
        </div>
        {(!feedback || feedback.length === 0) ? (
          <p className="text-sm text-gray-500">No feedback recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {feedback.map((f: any) => (
              <div key={f._id} className="border rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>Driver{f.driverId?.name ? ` (${f.driverId.name})` : ''}: <Stars rating={f.driverRating} /></span>
                  <span>Vehicle{f.vehicleId ? ` (${[f.vehicleId.make, f.vehicleId.vehicleModel].filter(Boolean).join(' ')} ${f.vehicleId.licensePlate || ''})` : ''}: <Stars rating={f.vehicleRating} /></span>
                  <span>Service: <Stars rating={f.serviceRating} /></span>
                  {f.type === 'appreciation' && <Badge className="bg-green-100 text-green-800">Appreciation</Badge>}
                </div>
                {(f.driverPunctualityRating || f.driverBehaviourRating || f.driverSafetyRating || f.driverRouteKnowledgeRating || f.driverPaymentHandlingRating) && <p className="text-xs text-gray-500">Punctuality {f.driverPunctualityRating || '-'} · Behaviour {f.driverBehaviourRating || '-'} · Safety {f.driverSafetyRating || '-'} · Route {f.driverRouteKnowledgeRating || '-'} · Payment {f.driverPaymentHandlingRating || '-'}</p>}
                {(f.vehicleCleanlinessRating || f.vehicleComfortRating || f.vehicleAcRating || f.vehicleConditionRating) && <p className="text-xs text-gray-500">Cleanliness {f.vehicleCleanlinessRating || '-'} · Comfort {f.vehicleComfortRating || '-'} · AC {f.vehicleAcRating || '-'} · Condition {f.vehicleConditionRating || '-'}</p>}
                {(f.vehicleIssueReported || f.breakdownOccurred) && <p className="text-xs text-red-600">{f.breakdownOccurred ? 'Breakdown reported' : 'Vehicle issue reported'}{f.vehicleIssueDescription ? ` · ${f.vehicleIssueDescription}` : ''}</p>}
                {f.comments && <p className="text-gray-600">{f.comments}</p>}
                <p className="text-xs text-gray-400">{new Date(f.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Complaints and service recovery */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-700">Complaints</Label>
          <Button size="sm" variant="outline" onClick={() => setShowComplaintForm(true)}>
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Raise Complaint
          </Button>
        </div>
        {(!complaints || complaints.length === 0) ? (
          <p className="text-sm text-gray-500">No complaints recorded.</p>
        ) : (
          <div className="space-y-2">
            {complaints.map((c: any) => (
              <div key={c._id} className="border rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{CATEGORY_LABELS[c.category] || c.category}</span>
                    <Badge className={SEVERITY_BADGE[c.severity]}>{c.severity}</Badge>
                    <Badge className={STATUS_BADGE[c.status]}>{c.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  {c.status !== 'closed' && (
                    <Button size="sm" variant="ghost" onClick={() => { setResolvingComplaint(c); setResolveForm({ status: c.status === 'open' ? 'in_progress' : c.status, correctiveAction: c.correctiveAction || 'none', compensationAmount: '', compensationPoints: '', resolution: c.resolution || '', responsibleParty: c.responsibleParty || 'unclear', responsibilityReason: c.responsibilityReason || '' }); }}>
                      Manage
                    </Button>
                  )}
                </div>
                <p className="text-gray-700">{c.description}</p>
                <p className="text-xs text-gray-500 capitalize">Responsibility: {c.responsibleParty || 'unclear'}{c.driverId?.name ? ` · Driver ${c.driverId.name}` : ''}{c.vehicleId ? ` · Vehicle ${[c.vehicleId.make, c.vehicleId.vehicleModel].filter(Boolean).join(' ')} ${c.vehicleId.licensePlate || ''}` : ''}{c.responsibilityReason ? ` · ${c.responsibilityReason}` : ''}</p>
                {c.correctiveAction && c.correctiveAction !== 'none' && (
                  <p className="text-xs text-green-700">
                    Compensation: {c.correctiveAction.replace(/_/g, ' ')}
                    {c.compensationAmount ? ` — ₹${c.compensationAmount}` : ""}
                    {c.compensationPoints ? ` — ${c.compensationPoints} points` : ""}
                  </p>
                )}
                {c.resolution && <p className="text-xs text-gray-500">Resolution: {c.resolution}</p>}
                <p className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add feedback dialog */}
      <Dialog open={showFeedbackForm} onOpenChange={setShowFeedbackForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Feedback</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Feedback Type</Label>
              <Select value={feedbackForm.type} onValueChange={(v) => setFeedbackForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="feedback">Feedback</SelectItem><SelectItem value="appreciation">Appreciation</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Booking (required for Driver/Vehicle ratings)</Label>
              <Select value={feedbackForm.bookingId} onValueChange={(v) => setFeedbackForm((f) => ({ ...f, bookingId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select booking" /></SelectTrigger>
                <SelectContent>
                  {bookings.map((b: any) => <SelectItem key={b._id} value={b._id}>{b.bookingId} · {[b.vehicleId?.make, b.vehicleId?.vehicleModel].filter(Boolean).join(' ') || 'No vehicle'} · {b.driverId?.name || 'No driver'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {([['driverRating', 'Overall Driver'], ['vehicleRating', 'Vehicle'], ['serviceRating', 'Overall Service']] as const).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between gap-3">
                <Label>{label}</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-label={`${label} ${n}`} onClick={() => setFeedbackForm((f) => ({ ...f, [field]: n }))}>
                      <Star className={`w-5 h-5 ${n <= (feedbackForm as any)[field] ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-semibold">Detailed Driver Ratings</p>
              {DRIVER_RATING_FIELDS.map(([field, label]) => <div key={field} className="flex items-center justify-between gap-3"><Label>{label}</Label><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${label} ${n}`} onClick={() => setFeedbackForm((form) => ({ ...form, [field]: n }))}><Star className={`w-5 h-5 ${n <= feedbackForm[field] ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} /></button>)}</div></div>)}
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-semibold">Detailed Vehicle Ratings</p>
              {VEHICLE_RATING_FIELDS.map(([field, label]) => <div key={field} className="flex items-center justify-between gap-3"><Label>{label}</Label><div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${label} ${n}`} onClick={() => setFeedbackForm((form) => ({ ...form, [field]: n }))}><Star className={`w-5 h-5 ${n <= feedbackForm[field] ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} /></button>)}</div></div>)}
              <div className="flex gap-5 flex-wrap pt-1">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={feedbackForm.vehicleIssueReported} onCheckedChange={(value) => setFeedbackForm((form) => ({ ...form, vehicleIssueReported: !!value }))} /> Vehicle issue reported</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={feedbackForm.breakdownOccurred} onCheckedChange={(value) => setFeedbackForm((form) => ({ ...form, breakdownOccurred: !!value, vehicleIssueReported: !!value || form.vehicleIssueReported }))} /> Breakdown occurred</label>
              </div>
              {(feedbackForm.vehicleIssueReported || feedbackForm.breakdownOccurred) && <div><Label>Vehicle Issue / Breakdown Details</Label><Textarea value={feedbackForm.vehicleIssueDescription} onChange={(e) => setFeedbackForm((form) => ({ ...form, vehicleIssueDescription: e.target.value }))} /></div>}
            </div>
            <div>
              <Label>Comments</Label>
              <Textarea value={feedbackForm.comments} onChange={(e) => setFeedbackForm((f) => ({ ...f, comments: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackForm(false)}>Cancel</Button>
            <Button disabled={addFeedback.isPending} onClick={() => addFeedback.mutate()}>Save Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raise complaint dialog */}
      <Dialog open={showComplaintForm} onOpenChange={setShowComplaintForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raise Complaint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Booking (Optional)</Label>
              <Select value={complaintForm.bookingId} onValueChange={(v) => setComplaintForm((f) => ({ ...f, bookingId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select booking" /></SelectTrigger>
                <SelectContent>
                  {bookings.map((b: any) => <SelectItem key={b._id} value={b._id}>{b.bookingId} · {[b.vehicleId?.make, b.vehicleId?.vehicleModel].filter(Boolean).join(' ') || 'No vehicle'} · {b.driverId?.name || 'No driver'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={complaintForm.category} onValueChange={(v) => setComplaintForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={complaintForm.severity} onValueChange={(v) => setComplaintForm((f) => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Verified Responsible Party</Label>
              <Select value={complaintForm.responsibleParty} onValueChange={(v) => setComplaintForm((f) => ({ ...f, responsibleParty: v, responsibilityReason: v === 'unclear' ? '' : f.responsibilityReason }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="unclear">Unclear / Investigate</SelectItem><SelectItem value="driver">Driver</SelectItem><SelectItem value="vehicle">Vehicle</SelectItem><SelectItem value="company">Company / Office</SelectItem><SelectItem value="vendor">Vendor</SelectItem><SelectItem value="customer">Customer</SelectItem></SelectContent>
              </Select>
            </div>
            {complaintForm.responsibleParty !== 'unclear' && <div><Label>Responsibility Evidence / Reason</Label><Textarea value={complaintForm.responsibilityReason} onChange={(e) => setComplaintForm((f) => ({ ...f, responsibilityReason: e.target.value }))} /></div>}
            <div>
              <Label>Description</Label>
              <Textarea value={complaintForm.description} onChange={(e) => setComplaintForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplaintForm(false)}>Cancel</Button>
            <Button disabled={!complaintForm.description.trim() || (complaintForm.responsibleParty !== 'unclear' && !complaintForm.responsibilityReason.trim()) || addComplaint.isPending} onClick={() => addComplaint.mutate()}>Submit Complaint</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve/manage complaint dialog */}
      <Dialog open={!!resolvingComplaint} onOpenChange={(open) => !open && setResolvingComplaint(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Complaint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={resolveForm.status} onValueChange={(v) => setResolveForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Verified Responsible Party</Label>
              <Select value={resolveForm.responsibleParty} onValueChange={(v) => setResolveForm((f) => ({ ...f, responsibleParty: v, responsibilityReason: v === 'unclear' ? '' : f.responsibilityReason }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="unclear">Unclear / Investigate</SelectItem><SelectItem value="driver">Driver</SelectItem><SelectItem value="vehicle">Vehicle</SelectItem><SelectItem value="company">Company / Office</SelectItem><SelectItem value="vendor">Vendor</SelectItem><SelectItem value="customer">Customer</SelectItem></SelectContent>
              </Select>
            </div>
            {resolveForm.responsibleParty !== 'unclear' && <div><Label>Responsibility Evidence / Reason</Label><Textarea value={resolveForm.responsibilityReason} onChange={(e) => setResolveForm((f) => ({ ...f, responsibilityReason: e.target.value }))} /></div>}
            <div>
              <Label>Corrective Action / Compensation</Label>
              <Select value={resolveForm.correctiveAction} onValueChange={(v) => setResolveForm((f) => ({ ...f, correctiveAction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="apology">Apology</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="partial_refund">Partial Refund</SelectItem>
                  <SelectItem value="discount_coupon">Discount Coupon</SelectItem>
                  <SelectItem value="reward_points">Reward Points</SelectItem>
                  <SelectItem value="free_upgrade">Free Upgrade</SelectItem>
                  <SelectItem value="manager_callback">Manager Callback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(resolveForm.correctiveAction === 'refund' || resolveForm.correctiveAction === 'partial_refund') && (
              <div>
                <Label>Refund Amount (₹) — creates a real payment ledger transaction</Label>
                <Input type="number" min={0} value={resolveForm.compensationAmount} onChange={(e) => setResolveForm((f) => ({ ...f, compensationAmount: e.target.value }))} />
              </div>
            )}
            {resolveForm.correctiveAction === 'reward_points' && (
              <div>
                <Label>Bonus Points — creates a real reward ledger transaction</Label>
                <Input type="number" min={0} value={resolveForm.compensationPoints} onChange={(e) => setResolveForm((f) => ({ ...f, compensationPoints: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Resolution Notes</Label>
              <Textarea value={resolveForm.resolution} onChange={(e) => setResolveForm((f) => ({ ...f, resolution: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvingComplaint(null)}>Cancel</Button>
            <Button disabled={(resolveForm.responsibleParty !== 'unclear' && !resolveForm.responsibilityReason.trim()) || resolveComplaint.isPending} onClick={() => resolveComplaint.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
