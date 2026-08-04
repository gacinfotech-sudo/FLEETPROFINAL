import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function fmtDate(d?: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

async function parseApiError(err: any) {
  const match = /^(\d+):\s*([\s\S]*)$/.exec(err.message || "");
  if (match) {
    try {
      const body = JSON.parse(match[2]);
      return { status: Number(match[1]), body };
    } catch { /* fall through */ }
  }
  return { status: 0, body: null };
}

export default function DriverLeavePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [approvingLeave, setApprovingLeave] = useState<any>(null);
  const [approveConflict, setApproveConflict] = useState<any>(null);
  const [override, setOverride] = useState(false);

  const [form, setForm] = useState({ driverId: "", startDate: "", endDate: "", leaveType: "unpaid", reason: "" });

  const driversQuery = useQuery({ queryKey: ["/api/drivers"] });
  const leavesQuery = useQuery({ queryKey: ["/api/driver-leaves"] });

  const drivers: any[] = (driversQuery.data as any[]) || [];
  const leaves: any[] = (leavesQuery.data as any[]) || [];

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/drivers/${form.driverId}/leave`, {
        startDate: form.startDate, endDate: form.endDate, leaveType: form.leaveType, reason: form.reason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-leaves"] });
      toast({ title: "Leave request created" });
      setShowRequestForm(false);
      setForm({ driverId: "", startDate: "", endDate: "", leaveType: "unpaid", reason: "" });
    },
    onError: (err: any) => toast({ title: "Could not create leave request", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ leaveId, withOverride }: { leaveId: string; withOverride: boolean }) => {
      try {
        const res = await apiRequest("POST", `/api/driver-leaves/${leaveId}/approve`, { override: withOverride });
        return res.json();
      } catch (err: any) {
        const { status, body } = await parseApiError(err);
        const e: any = new Error(body?.message || err.message);
        e.status = status; e.body = body;
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-leaves"] });
      toast({ title: "Leave approved" });
      setApprovingLeave(null);
      setApproveConflict(null);
      setOverride(false);
    },
    onError: (err: any) => {
      if (err.status === 409 && err.body?.code === "LEAVE_BOOKING_CONFLICT") {
        setApproveConflict(err.body.conflicts);
        return;
      }
      toast({ title: "Could not approve leave", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (leaveId: string) => {
      const res = await apiRequest("POST", `/api/driver-leaves/${leaveId}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-leaves"] });
      toast({ title: "Leave rejected" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Leave</h1>
          <p className="text-sm text-gray-500">Approved leave blocks the driver from assignment only for that date range.</p>
        </div>
        <Button onClick={() => setShowRequestForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Request Leave
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Leave Requests</CardTitle></CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No leave requests yet.</p>
          ) : (
            <div className="space-y-2">
              {leaves.map((l: any) => (
                <div key={l._id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium">{l.driverId?.name || "Unknown driver"}</div>
                    <div className="text-sm text-gray-500">
                      {fmtDate(l.startDate)} – {fmtDate(l.endDate)} · {l.leaveType} {l.reason ? `· ${l.reason}` : ""}
                    </div>
                    {l.conflictingBookings?.length > 0 && (
                      <div className="text-xs text-amber-600 mt-1">
                        Approved with conflicts: {l.conflictingBookings.join(", ")} — replacement still needed
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {l.status === "pending" && (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                    {l.status === "approved" && <Badge className="bg-green-600">Approved</Badge>}
                    {l.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                    {l.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(l._id)}>Reject</Button>
                        <Button size="sm" onClick={() => { setApprovingLeave(l); approveMutation.mutate({ leaveId: l._id, withOverride: false }); }}>
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request leave dialog */}
      <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Driver Leave</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Driver</Label>
              <Select value={form.driverId} onValueChange={(v) => setForm((f) => ({ ...f, driverId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d: any) => <SelectItem key={d._id || d.id} value={d._id || d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Leave Type</Label>
              <Select value={form.leaveType} onValueChange={(v) => setForm((f) => ({ ...f, leaveType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="weekly_off">Weekly Off</SelectItem>
                  <SelectItem value="comp_off">Comp Off</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestForm(false)}>Cancel</Button>
            <Button
              disabled={!form.driverId || !form.startDate || !form.endDate || requestMutation.isPending}
              onClick={() => requestMutation.mutate()}
            >
              {requestMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval conflict dialog */}
      <Dialog open={!!approveConflict} onOpenChange={(v) => { if (!v) { setApproveConflict(null); setApprovingLeave(null); setOverride(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />Booking conflicts found</DialogTitle></DialogHeader>
          <Alert variant="destructive">
            <AlertTitle>This driver has confirmed bookings in this period</AlertTitle>
            <AlertDescription>
              <div className="space-y-1 text-xs mt-1">
                {approveConflict?.map((c: any) => (
                  <div key={c.id}>{c.bookingId} — {c.customerName} ({fmtDate(c.pickupDate)}, {c.status})</div>
                ))}
              </div>
              <p className="text-xs mt-2">You must assign a replacement driver for these bookings. Approving anyway records these as needing action.</p>
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2">
            <Checkbox id="leave-override" checked={override} onCheckedChange={(v) => setOverride(!!v)} />
            <Label htmlFor="leave-override" className="text-sm">Approve anyway — I will assign a replacement driver</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveConflict(null); setApprovingLeave(null); setOverride(false); }}>Cancel</Button>
            <Button
              disabled={!override || approveMutation.isPending}
              onClick={() => approveMutation.mutate({ leaveId: approvingLeave._id, withOverride: true })}
            >
              Approve With Conflicts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
