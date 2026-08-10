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
import QuickInquiryForm from "@/components/inquiries/quick-inquiry-form";
import DetailedRequirementForm from "@/components/inquiries/detailed-requirement-form";
import PipelineStepper from "@/components/pipeline/pipeline-stepper";
import ContextualActionBar from "@/components/pipeline/contextual-action-bar";
import { inquiryPipelineInfo } from "@/lib/pipelineStages";

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "secondary", unverified: "secondary", contact_attempted: "secondary", contacted: "secondary",
  requirement_pending: "secondary", requirement_completed: "secondary",
  qualified: "default", converted_to_lead: "default",
  future_follow_up: "outline",
  duplicate: "destructive", invalid: "destructive", lost: "destructive", cancelled: "destructive",
};

interface InquiriesPageProps {
  // Set by Customer 360°'s timeline (click-through on an "Inquiry logged"
  // event) — opens that specific inquiry's detail dialog directly instead
  // of landing on the plain, unfiltered list.
  initialInquiryId?: string | null;
}

export default function InquiriesPage({ initialInquiryId }: InquiriesPageProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewingInquiry, setViewingInquiry] = useState<any>(null);

  // The target inquiry may not be on the current (filtered/paginated) page,
  // so it's fetched directly by id rather than found in the loaded list.
  useEffect(() => {
    if (!initialInquiryId) return;
    apiRequest("GET", `/api/inquiries/${initialInquiryId}`)
      .then((res) => res.json())
      .then((inquiry) => setViewingInquiry(inquiry))
      .catch(() => {});
  }, [initialInquiryId]);
  const [showDetailedForm, setShowDetailedForm] = useState<any>(null);
  const [lostReason, setLostReason] = useState("");
  const [showLostDialog, setShowLostDialog] = useState<any>(null);
  // The backend has always accepted limit/skip and returned {rows, total}
  // (server/routes.ts) — this page just never sent/read either, silently
  // capping the list at the server's default 50 rows with no indication
  // more existed. Real pagination now, no backend change needed.
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  // Array-form queryKey (base URL + separate filter elements, matching the
  // convention already used by customers.tsx) so a plain
  // invalidateQueries({queryKey: ["/api/inquiries"]}) from anywhere else
  // (e.g. after creating/qualifying/converting an inquiry) prefix-matches
  // this query and actually refreshes the list — a single interpolated
  // string key would not match TanStack Query's array-prefix invalidation.
  const { data, isLoading, isError, refetch } = useQuery<{ rows: any[]; total: number }>({
    queryKey: ["/api/inquiries", statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", String(PAGE_SIZE));
      params.set("skip", String(page * PAGE_SIZE));
      const res = await apiRequest("GET", `/api/inquiries?${params.toString()}`);
      return res.json();
    },
  });

  const qualifyMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/inquiries/${id}/qualify`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ variant: "success", title: "Inquiry qualified" });
    },
    onError: async (error: any) => {
      toast({ title: "Cannot qualify yet", description: error.message, variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/inquiries/${id}/convert-to-lead`)).json(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ variant: "success", title: "Converted to lead", description: result?.lead?.leadNumber ? `${result.lead.leadNumber} created — see the Leads page.` : undefined });
    },
    onError: (error: any) => {
      toast({ title: "Could not convert", description: error.message, variant: "destructive" });
    },
  });

  const markLostMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await apiRequest("POST", `/api/inquiries/${id}/mark-lost`, { lostReason: reason })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setShowLostDialog(null);
      setLostReason("");
      toast({ title: "Inquiry marked lost" });
    },
    onError: (error: any) => {
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
    },
  });

  const rows = data?.rows || [];

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">💬 Inquiries</h1>
            <p className="text-indigo-100 mt-1">Customer inquiries & quotes • Track from inquiry to lead</p>
          </div>
          <Button
            onClick={() => setShowNewForm(true)}
            className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold"
          >
            ➕ New Inquiry
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">📊 TOTAL</p>
            <p className="text-2xl font-bold text-indigo-600 mt-2">{inquiries?.length || 0}</p>
            <p className="text-xs text-gray-500 mt-1">All inquiries</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">✨ NEW</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {inquiries?.filter((i: any) => i.status === 'new').length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Uncontacted</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">🎯 CONVERTED</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {inquiries?.filter((i: any) => i.status === 'converted_to_lead').length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">To leads</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">❌ LOST</p>
            <p className="text-2xl font-bold text-red-600 mt-2">
              {inquiries?.filter((i: any) => i.status === 'lost').length || 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Lost opportunities</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg sm:text-xl">All Inquiries</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Search name, mobile, inquiry #..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="w-full sm:w-64" />
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="converted_to_lead">Converted to Lead</SelectItem>
                  <SelectItem value="future_follow_up">Future Follow-up</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-red-600">Couldn't load inquiries.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse h-14 bg-gray-100 rounded-lg" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inquiry #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Travel Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                        <div className="space-y-2">
                          <div className="text-lg font-medium">No inquiries found</div>
                          <Button size="sm" onClick={() => setShowNewForm(true)}>Log New Inquiry</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((inquiry: any) => (
                      <TableRow key={inquiry._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingInquiry(inquiry)}>
                        <TableCell className="font-medium">{inquiry.inquiryNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{inquiry.customerName}</div>
                          <div className="text-sm text-gray-500">{inquiry.primaryMobile}</div>
                        </TableCell>
                        <TableCell className="capitalize">{(inquiry.source || "").replace(/_/g, " ")}</TableCell>
                        <TableCell>{inquiry.pickupDate ? new Date(inquiry.pickupDate).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[inquiry.status] || "secondary"} className="capitalize">
                            {inquiry.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{inquiry.priority}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 flex-wrap">
                            {inquiry.status !== "qualified" && inquiry.status !== "converted_to_lead" && !["lost", "cancelled", "duplicate", "invalid"].includes(inquiry.status) && (
                              <Button variant="ghost" size="sm" disabled={qualifyMutation.isPending} onClick={() => qualifyMutation.mutate(inquiry._id)}>
                                Qualify
                              </Button>
                            )}
                            {inquiry.status === "qualified" && (
                              <Button variant="ghost" size="sm" className="text-blue-600" disabled={convertMutation.isPending} onClick={() => convertMutation.mutate(inquiry._id)}>
                                Convert to Lead
                              </Button>
                            )}
                            {!["lost", "converted_to_lead", "cancelled", "duplicate", "invalid"].includes(inquiry.status) && (
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setShowLostDialog(inquiry)}>
                                Mark Lost
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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

      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Inquiry</DialogTitle></DialogHeader>
          <QuickInquiryForm onSuccess={() => setShowNewForm(false)} onCancel={() => setShowNewForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingInquiry} onOpenChange={(open) => !open && setViewingInquiry(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewingInquiry?.inquiryNumber}</DialogTitle></DialogHeader>
          {viewingInquiry && (
            <div className="space-y-3 text-sm">
              <PipelineStepper
                info={inquiryPipelineInfo(viewingInquiry)}
                nextAction={
                  viewingInquiry.status === "qualified"
                    ? { label: "Convert to Lead", onClick: () => convertMutation.mutate(viewingInquiry._id), disabled: convertMutation.isPending }
                    : viewingInquiry.status !== "converted_to_lead" && !["lost", "cancelled", "duplicate", "invalid"].includes(viewingInquiry.status)
                    ? { label: "Qualify", onClick: () => qualifyMutation.mutate(viewingInquiry._id), disabled: qualifyMutation.isPending }
                    : undefined
                }
              />
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Customer</span><div className="font-medium">{viewingInquiry.customerName}</div></div>
                <div><span className="text-gray-500">Mobile</span><div className="font-medium">{viewingInquiry.primaryMobile}</div></div>
                <div><span className="text-gray-500">Source</span><div className="font-medium capitalize">{(viewingInquiry.source || "").replace(/_/g, " ")}</div></div>
                <div><span className="text-gray-500">Status</span><div className="font-medium capitalize">{viewingInquiry.status.replace(/_/g, " ")}</div></div>
                <div><span className="text-gray-500">Trip Type</span><div className="font-medium capitalize">{(viewingInquiry.tripType || "-").replace(/_/g, " ")}</div></div>
                <div><span className="text-gray-500">Travel Date</span><div className="font-medium">{viewingInquiry.pickupDate ? new Date(viewingInquiry.pickupDate).toLocaleDateString() : "-"}{viewingInquiry.flexibleDate ? " (flexible)" : ""}</div></div>
                <div><span className="text-gray-500">Passengers</span><div className="font-medium">{viewingInquiry.numberOfPassengers ?? "-"}{viewingInquiry.seniorCitizens ? ` (${viewingInquiry.seniorCitizens} senior)` : ""}</div></div>
                <div><span className="text-gray-500">Luggage</span><div className="font-medium">{viewingInquiry.luggageCount ?? "-"}</div></div>
                <div><span className="text-gray-500">Pickup</span><div className="font-medium">{viewingInquiry.pickupLocation || "-"}</div></div>
                <div><span className="text-gray-500">Drop / Route</span><div className="font-medium">{viewingInquiry.route || viewingInquiry.dropLocation || "-"}</div></div>
                <div><span className="text-gray-500">Vehicle Requirement</span><div className="font-medium">{viewingInquiry.vehicleCategory || "-"}</div></div>
                <div><span className="text-gray-500">Assigned Executive</span><div className="font-medium">{viewingInquiry.assignedExecutive || "-"}</div></div>
                <div><span className="text-gray-500">Driver Preference</span><div className="font-medium">{viewingInquiry.driverPreference || "-"}</div></div>
                <div><span className="text-gray-500">Language</span><div className="font-medium">{viewingInquiry.languagePreference || "-"}</div></div>
              </div>

              {viewingInquiry.vehicleRequirements?.length > 0 && (
                <div>
                  <span className="text-gray-500">Vehicle Requirements</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {viewingInquiry.vehicleRequirements.map((v: any, i: number) => (
                      <Badge key={i} variant="secondary">{v.quantity}× {v.requestedNameSnapshot}{v.seatingCapacity ? ` (${v.seatingCapacity}-seater)` : ""}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {viewingInquiry.customVehicleRequests?.length > 0 && (
                <div>
                  <span className="text-gray-500">Custom Vehicle Requests</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {viewingInquiry.customVehicleRequests.map((v: any, i: number) => (
                      <Badge key={i} variant="outline">{v.quantity}× {v.customVehicleName}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewingInquiry.notes && <div><span className="text-gray-500">Notes</span><div className="font-medium whitespace-pre-wrap">{viewingInquiry.notes}</div></div>}
              {viewingInquiry.customerVisibleInstructions && <div><span className="text-gray-500">Customer-visible Instructions</span><div className="font-medium whitespace-pre-wrap">{viewingInquiry.customerVisibleInstructions}</div></div>}
              {viewingInquiry.status === "lost" && viewingInquiry.lostReason && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                  <span className="text-red-700 font-medium">Lost reason:</span> {viewingInquiry.lostReason}
                </div>
              )}

              <ContextualActionBar
                actions={[
                  {
                    key: "qualify",
                    label: "Qualify",
                    onClick: () => qualifyMutation.mutate(viewingInquiry._id),
                    pending: qualifyMutation.isPending,
                    hidden: viewingInquiry.status === "qualified" || viewingInquiry.status === "converted_to_lead" || ["lost", "cancelled", "duplicate", "invalid"].includes(viewingInquiry.status),
                  },
                  {
                    key: "convert-to-lead",
                    label: "Convert to Lead",
                    variant: "default",
                    onClick: () => convertMutation.mutate(viewingInquiry._id),
                    pending: convertMutation.isPending,
                    hidden: viewingInquiry.status !== "qualified",
                  },
                  {
                    key: "add-requirements",
                    label: "Add Full Requirement Details",
                    onClick: () => { setShowDetailedForm(viewingInquiry); setViewingInquiry(null); },
                    hidden: ["converted_to_lead", "lost", "cancelled", "duplicate", "invalid"].includes(viewingInquiry.status),
                  },
                  {
                    key: "mark-lost",
                    label: "Mark Lost",
                    variant: "destructive",
                    onClick: () => setShowLostDialog(viewingInquiry),
                    hidden: ["lost", "converted_to_lead", "cancelled", "duplicate", "invalid"].includes(viewingInquiry.status),
                  },
                ]}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetailedForm} onOpenChange={(open) => !open && setShowDetailedForm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Requirement Details — {showDetailedForm?.inquiryNumber}</DialogTitle></DialogHeader>
          {showDetailedForm && (
            <DetailedRequirementForm
              inquiry={showDetailedForm}
              onSuccess={(updated) => { setShowDetailedForm(null); setViewingInquiry(updated); }}
              onCancel={() => setShowDetailedForm(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showLostDialog} onOpenChange={(open) => !open && setShowLostDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Inquiry as Lost</DialogTitle></DialogHeader>
          <div>
            <Label htmlFor="lost-reason">Lost Reason *</Label>
            <Textarea id="lost-reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="e.g. Price too high, vehicle unavailable, no response..." />
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
    </div>
  );
}
