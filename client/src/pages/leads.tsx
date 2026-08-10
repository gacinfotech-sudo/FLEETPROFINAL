import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import QuotationPanel from "@/components/leads/quotation-panel";
import FollowUpPanel from "@/components/leads/followup-panel";
import CustomerDashboard from "@/components/customers/customer-dashboard";
import PipelineStepper from "@/components/pipeline/pipeline-stepper";
import ContextualActionBar from "@/components/pipeline/contextual-action-bar";
import { leadPipelineInfo } from "@/lib/pipelineStages";

const LEAD_STATUS_OPTIONS = [
  "new", "assigned", "requirement_completed", "quotation_draft", "quotation_under_review",
  "quotation_sent", "follow_up_due", "negotiation", "customer_confirmed", "converted_to_customer",
  "converted_to_booking", "future_requirement", "lost", "cancelled",
];

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "secondary", assigned: "secondary", requirement_completed: "secondary",
  quotation_draft: "outline", quotation_under_review: "outline", quotation_sent: "outline",
  follow_up_due: "outline", negotiation: "default", customer_confirmed: "default",
  converted_to_customer: "default", converted_to_booking: "default",
  future_requirement: "outline", lost: "destructive", cancelled: "destructive",
};

// apiRequest() throws Error("<status>: <raw response text>") on a non-2xx
// response (queryClient.ts:throwIfResNotOk) — status-transition rejections
// here return a JSON body ({message, code}), so without this the toast
// shown to the user was the whole raw JSON blob instead of the actual
// human-readable reason (e.g. "Cannot move a lead from ... to ..."),
// making a correctly-rejected invalid status change look like the control
// was simply broken. Same fix already applied in quotation-panel.tsx.
function extractApiErrorMessage(error: any): string {
  const raw = String(error?.message || "");
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) return raw;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed.message || raw;
  } catch {
    return raw;
  }
}

interface LeadsPageProps {
  // Receives a booking-form prefill object and navigates to the existing
  // Add Booking form — see docs/RECOMMENDED_IMPLEMENTATION_ROADMAP.md for
  // why this reuses that form entirely instead of a new Booking Wizard.
  onConvertToBooking?: (prefill: any) => void;
  // Set by Customer 360°'s timeline (click-through on a "converted to
  // lead" event) — opens that specific lead's detail dialog directly.
  initialLeadId?: string | null;
}

export default function LeadsPage({ onConvertToBooking, initialLeadId }: LeadsPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewingLead, setViewingLead] = useState<any>(null);

  // The target lead may not be on the current (filtered/paginated) page,
  // so it's fetched directly by id rather than found in the loaded list.
  useEffect(() => {
    if (!initialLeadId) return;
    apiRequest("GET", `/api/leads/${initialLeadId}`)
      .then((res) => res.json())
      .then((lead) => setViewingLead(lead))
      .catch(() => {});
  }, [initialLeadId]);
  const [lostReason, setLostReason] = useState("");
  const [showLostDialog, setShowLostDialog] = useState<any>(null);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
  const [convertingToBooking, setConvertingToBooking] = useState(false);
  // Same real bug as inquiries.tsx: the backend has always accepted
  // limit/skip and returned {rows, total} — this page never sent/read
  // either, silently capping the list at the server's default 50 rows.
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery<{ rows: any[]; total: number }>({
    queryKey: ["/api/leads", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("skip", String(page * PAGE_SIZE));
      const res = await apiRequest("GET", `/api/leads?${params.toString()}`);
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await apiRequest("PATCH", `/api/leads/${id}`, { status })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ variant: "success", title: "Lead status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Could not update status", description: extractApiErrorMessage(error), variant: "destructive" });
    },
  });

  const convertToCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/leads/${id}/convert-to-customer`);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setViewingLead(null);
      setViewingCustomerId(result.customer._id);
      toast({
        variant: "success",
        title: result.wasCreated ? "New customer created" : "Linked to existing customer",
        description: result.customer.name,
      });
    },
    onError: (error: any) => {
      toast({ title: "Could not convert to customer", description: extractApiErrorMessage(error), variant: "destructive" });
    },
  });

  // Trip type mapping mirrors docs/INQUIRY_BOOKING_FIELD_INVENTORY.md's
  // "Trip type mapping" table exactly — the one place this lossy-but-
  // recoverable mapping happens, so it can't drift from what that doc says.
  const mapTripTypeToBooking = (tripType?: string): { bookingType: string; formTripType: string } => {
    if (tripType === "self_drive") return { bookingType: "self_drive", formTripType: "one_way" };
    if (tripType === "local") return { bookingType: "with_driver", formTripType: "local" };
    if (tripType === "airport_transfer") return { bookingType: "with_driver", formTripType: "airport" };
    if (tripType === "round_trip" || tripType === "outstation") return { bookingType: "with_driver", formTripType: "round_trip" };
    return { bookingType: "with_driver", formTripType: "one_way" };
  };

  const handleConvertToBooking = async (lead: any) => {
    if (!lead.linkedCustomerId) {
      toast({ title: "Convert to Customer first", description: "A booking needs a linked customer record.", variant: "destructive" });
      return;
    }
    setConvertingToBooking(true);
    try {
      const quotations = await (await apiRequest("GET", `/api/leads/${lead._id}/quotations`)).json();
      const accepted = quotations.find((q: any) => q.status === "accepted");
      if (!accepted) {
        toast({ title: "No accepted quotation", description: "Accept a quotation before converting this lead to a booking.", variant: "destructive" });
        return;
      }
      const option = accepted.options.find((o: any) => o.optionNumber === accepted.acceptedOptionNumber);
      const inquiry = lead.inquiryId || {};
      const { bookingType, formTripType } = mapTripTypeToBooking(inquiry.tripType);

      onConvertToBooking?.({
        __leadId: lead._id,
        customerName: inquiry.customerName || "",
        customerPhone: inquiry.primaryMobile || "",
        customerEmail: inquiry.email || "",
        bookingType,
        tripType: formTripType,
        pickupLocation: inquiry.pickupLocation || "",
        dropoffLocation: inquiry.dropLocation || "",
        pickupDate: inquiry.pickupDate ? String(inquiry.pickupDate).slice(0, 10) : "",
        pickupTime: inquiry.pickupTime || "",
        returnDate: inquiry.returnDate ? String(inquiry.returnDate).slice(0, 10) : (inquiry.pickupDate ? String(inquiry.pickupDate).slice(0, 10) : ""),
        returnTime: inquiry.returnTime || "",
        amount: option ? Math.round((option.totalPaise || 0) / 100) : 0,
        notes: `Converted from ${inquiry.inquiryNumber || "inquiry"} / ${accepted.quotationNumber || "quotation"} — accepted option #${accepted.acceptedOptionNumber}: ${option?.vehicleNameSnapshot || ""}`,
      });
    } catch (error: any) {
      toast({ title: "Could not start booking conversion", description: extractApiErrorMessage(error), variant: "destructive" });
    } finally {
      setConvertingToBooking(false);
    }
  };

  const markLostMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await apiRequest("POST", `/api/leads/${id}/mark-lost`, { lostReason: reason })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setShowLostDialog(null);
      setLostReason("");
      toast({ title: "Lead marked lost" });
    },
    onError: (error: any) => {
      toast({ title: "Could not update", description: extractApiErrorMessage(error), variant: "destructive" });
    },
  });

  const rows = data?.rows || [];

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="gradient-header bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">🎯 Leads</h1>
        <p className="text-amber-100 mt-1">Qualified leads converted from inquiries • Track conversion to booking</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card card-hover bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">📊 TOTAL</p>
            <p className="text-2xl font-bold text-amber-600 mt-2">{rows?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-1">All leads</p>
          </CardContent>
        </Card>
        <Card className="stat-card card-hover bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">🔄 OPEN</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {rows?.filter((l: any) => l.status === 'open').length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Active leads</p>
          </CardContent>
        </Card>
        <Card className="stat-card card-hover bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">✅ CONVERTED</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {rows?.filter((l: any) => l.status === 'converted_to_booking').length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">To bookings</p>
          </CardContent>
        </Card>
        <Card className="stat-card card-hover bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">❌ CLOSED</p>
            <p className="text-2xl font-bold text-red-600 mt-2">
              {rows?.filter((l: any) => l.status === 'closed' || l.status === 'lost').length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Closed/lost</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg sm:text-xl">All Leads</CardTitle>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {LEAD_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-red-600">Couldn't load leads.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-14 bg-gray-100 rounded-lg" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Travel Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Executive</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                        No leads yet. Qualify and convert an inquiry to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((lead: any) => {
                      const inquiry = lead.inquiryId || {};
                      return (
                        <TableRow key={lead._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingLead(lead)}>
                          <TableCell className="font-medium">{lead.leadNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium">{inquiry.customerName}</div>
                            <div className="text-sm text-gray-500">{inquiry.primaryMobile}</div>
                          </TableCell>
                          <TableCell>{inquiry.pickupLocation || "-"}{inquiry.dropLocation ? ` → ${inquiry.dropLocation}` : ""}</TableCell>
                          <TableCell>{inquiry.pickupDate ? new Date(inquiry.pickupDate).toLocaleDateString() : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[lead.status] || "secondary"} className="capitalize">{lead.status.replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell>{lead.assignedExecutive || "-"}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 flex-wrap">
                              {!["lost", "cancelled", "converted_to_booking"].includes(lead.status) && (
                                <Select value={lead.status} onValueChange={(status) => updateStatusMutation.mutate({ id: lead._id, status })}>
                                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {LEAD_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, " ")}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
                              {!["lost", "cancelled", "converted_to_booking"].includes(lead.status) && (
                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setShowLostDialog(lead)}>Mark Lost</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {(data?.total ?? 0) > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                  <span>
                    Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= (data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingLead} onOpenChange={(open) => !open && setViewingLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewingLead?.leadNumber}</DialogTitle></DialogHeader>
          {viewingLead && (() => {
            const inquiry = viewingLead.inquiryId || {};
            return (
              <div className="space-y-3 text-sm">
                <PipelineStepper
                  info={leadPipelineInfo(viewingLead)}
                  nextAction={
                    !viewingLead.linkedCustomerId
                      ? { label: "Convert to Customer", onClick: () => convertToCustomerMutation.mutate(viewingLead._id), disabled: convertToCustomerMutation.isPending }
                      : !viewingLead.linkedBookingId
                      ? { label: "Convert to Booking", onClick: () => handleConvertToBooking(viewingLead), disabled: convertingToBooking }
                      : undefined
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-gray-500">Customer</span><div className="font-medium">{inquiry.customerName}</div></div>
                  <div><span className="text-gray-500">Mobile</span><div className="font-medium">{inquiry.primaryMobile}</div></div>
                  <div><span className="text-gray-500">Lead Status</span><div className="font-medium capitalize">{viewingLead.status.replace(/_/g, " ")}</div></div>
                  <div><span className="text-gray-500">Priority</span><div className="font-medium capitalize">{viewingLead.priority}</div></div>
                  <div><span className="text-gray-500">Inquiry #</span><div className="font-medium">{inquiry.inquiryNumber}</div></div>
                  <div><span className="text-gray-500">Source</span><div className="font-medium capitalize">{(inquiry.source || "").replace(/_/g, " ")}</div></div>
                  <div><span className="text-gray-500">Travel Date</span><div className="font-medium">{inquiry.pickupDate ? new Date(inquiry.pickupDate).toLocaleDateString() : "-"}</div></div>
                  <div><span className="text-gray-500">Passengers</span><div className="font-medium">{inquiry.numberOfPassengers ?? "-"}</div></div>
                  <div><span className="text-gray-500">Pickup</span><div className="font-medium">{inquiry.pickupLocation || "-"}</div></div>
                  <div><span className="text-gray-500">Route</span><div className="font-medium">{inquiry.route || inquiry.dropLocation || "-"}</div></div>
                  <div><span className="text-gray-500">Vehicle Requirement</span><div className="font-medium">{inquiry.vehicleCategory || "-"}</div></div>
                  <div><span className="text-gray-500">Assigned Executive</span><div className="font-medium">{viewingLead.assignedExecutive || "-"}</div></div>
                </div>
                {inquiry.vehicleRequirements?.length > 0 && (
                  <div>
                    <span className="text-gray-500">Vehicle Requirements</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {inquiry.vehicleRequirements.map((v: any, i: number) => <Badge key={i} variant="secondary">{v.quantity}× {v.requestedNameSnapshot}</Badge>)}
                    </div>
                  </div>
                )}
                {viewingLead.status === "lost" && viewingLead.lostReason && (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                    <span className="text-red-700 font-medium">Lost reason:</span> {viewingLead.lostReason}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  {viewingLead.linkedBookingId && <Badge variant="default">Booking Created</Badge>}
                </div>
                <ContextualActionBar
                  actions={[
                    {
                      key: "open-customer",
                      label: "Open Customer 360°",
                      onClick: () => setViewingCustomerId(viewingLead.linkedCustomerId),
                      hidden: !viewingLead.linkedCustomerId,
                    },
                    {
                      key: "convert-to-customer",
                      label: "Convert to Customer",
                      variant: "default",
                      onClick: () => convertToCustomerMutation.mutate(viewingLead._id),
                      pending: convertToCustomerMutation.isPending,
                      hidden: !!viewingLead.linkedCustomerId,
                    },
                    {
                      key: "convert-to-booking",
                      label: "Convert to Booking",
                      variant: viewingLead.linkedCustomerId ? "default" : "outline",
                      onClick: () => handleConvertToBooking(viewingLead),
                      disabled: convertingToBooking,
                      hidden: !!viewingLead.linkedBookingId,
                    },
                    {
                      key: "mark-lost",
                      label: "Mark Lost",
                      variant: "destructive",
                      onClick: () => setShowLostDialog(viewingLead),
                      hidden: ["lost", "cancelled", "converted_to_booking"].includes(viewingLead.status),
                    },
                  ]}
                />

                <Separator />
                <QuotationPanel leadId={viewingLead._id} inquiry={inquiry} />
                <Separator />
                <FollowUpPanel leadId={viewingLead._id} />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showLostDialog} onOpenChange={(open) => !open && setShowLostDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Lead as Lost</DialogTitle></DialogHeader>
          <div>
            <Label htmlFor="lead-lost-reason">Lost Reason *</Label>
            <Textarea id="lead-lost-reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="e.g. Price too high, competitor selected..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLostDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!lostReason.trim() || markLostMutation.isPending}
              onClick={() => markLostMutation.mutate({ id: showLostDialog._id, reason: lostReason })}
            >
              Mark Lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingCustomerId} onOpenChange={(open) => !open && setViewingCustomerId(null)}>
        <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Customer Dashboard</DialogTitle></DialogHeader>
          {viewingCustomerId && <CustomerDashboard customerId={viewingCustomerId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
