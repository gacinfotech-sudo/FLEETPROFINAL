import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Spec §10-12 — the Outsource Vehicle sourcing workflow's comparison
// drawer. Shown on the Booking detail view alongside AssignVendorDialog
// (a separate, simpler "link one vendor directly" path); this panel is
// for the "contact several vendors, compare, then pick" path instead.
// Renders nothing once the booking's fulfilment is already resolved via
// either path — see docs/RESOURCE_FULFILMENT_MATRIX.md.
const TERMINAL_REQUEST_STATUSES = new Set(["cancelled", "resource_secured"]);

interface Props {
  booking: any;
}

export default function ResourceFulfilmentPanel({ booking }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bookingId = booking._id || booking.id;
  const [selectedVendorsToContact, setSelectedVendorsToContact] = useState<string[]>([]);
  const [respondingVendorId, setRespondingVendorId] = useState<string | null>(null);
  const [responseForm, setResponseForm] = useState({ response: "accepted", offeredVehicleDetails: "", offeredDriverDetails: "", quotedCost: "" });

  const { data: requests } = useQuery<any[]>({
    queryKey: [`/api/bookings/${bookingId}/sourcing-requests`],
  });
  const activeRequest = (requests || []).find((r) => !TERMINAL_REQUEST_STATUSES.has(r.status)) || (requests || [])[0];

  const { data: responsesData } = useQuery<{ responses: any[]; recommendations: { responseId: string; reasons: string[] }[] }>({
    queryKey: [`/api/sourcing-requests/${activeRequest?._id}/responses`],
    enabled: !!activeRequest,
  });
  const responses = responsesData?.responses || [];
  const recommendedIds = new Set((responsesData?.recommendations || []).map((r) => r.responseId));

  const { data: activeVendors } = useQuery<any[]>({
    queryKey: ["/api/vendors", "active"],
    queryFn: async () => (await fetch("/api/vendors?status=active", { credentials: "include" })).json(),
  });
  const contactedVendorIds = new Set(responses.map((r: any) => r.vendorId));
  const uncontactedVendors = (activeVendors || []).filter((v: any) => !contactedVendorIds.has(v._id));

  // Auto-save form state
  const { save: autoSaveResponse } = useFormAutoSave('vendor-response-form', responseForm, 2000);

  useEffect(() => {
    if (respondingVendorId) autoSaveResponse();
  }, [responseForm, respondingVendorId, autoSaveResponse]);

  const startMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/bookings/${bookingId}/sourcing-requests`, { quantity: 1 })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}/sourcing-requests`] }),
    onError: (err: any) => toast({ title: "Could not start sourcing", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sourcing-requests/${activeRequest._id}/send`, { vendorIds: selectedVendorsToContact })).json(),
    onSuccess: (result: any) => {
      const failed = (result.results || []).filter((r: any) => !r.ok);
      toast({
        title: failed.length ? "Sent, with some failures" : "Requirement sent",
        description: failed.length ? `${failed.length} vendor(s) could not be reached — see WhatsApp log.` : undefined,
      });
      setSelectedVendorsToContact([]);
      queryClient.invalidateQueries({ queryKey: [`/api/sourcing-requests/${activeRequest._id}/responses`] });
    },
    onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const recordMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sourcing-requests/${activeRequest._id}/responses`, {
      vendorId: respondingVendorId,
      response: responseForm.response,
      offeredVehicleDetails: responseForm.offeredVehicleDetails || undefined,
      offeredDriverDetails: responseForm.offeredDriverDetails || undefined,
      quotedCost: responseForm.quotedCost ? Number(responseForm.quotedCost) : undefined,
    })).json(),
    onSuccess: () => {
      toast({ title: "Response recorded" });
      setRespondingVendorId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/sourcing-requests/${activeRequest._id}/responses`] });
    },
    onError: (err: any) => toast({ title: "Could not record response", description: err.message, variant: "destructive" }),
  });

  const selectMutation = useMutation({
    mutationFn: async (responseId: string) => (await apiRequest("POST", `/api/sourcing-requests/${activeRequest._id}/select-vendor`, { responseId })).json(),
    onSuccess: () => {
      toast({ title: "Vendor selected — resource secured" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/bookings/${bookingId}/sourcing-requests`] });
    },
    onError: (err: any) => toast({ title: "Could not select vendor", description: err.message, variant: "destructive" }),
  });

  // Nothing to show once fulfilment is already resolved via either path
  // and there was never a sourcing request for this booking.
  if (!activeRequest && (booking.vehicleId || booking.vendorVehicleId)) return null;

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-orange-50 border-orange-200">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-800">Resource Fulfilment — Vendor Sourcing</Label>
        {activeRequest && <Badge variant="outline">{activeRequest.requestNumber} · {activeRequest.status.replace(/_/g, ' ')}</Badge>}
      </div>

      {!activeRequest && (
        <div className="text-sm text-gray-600 flex items-center gap-2">
          No sourcing request started yet for this booking.
          <Button id="sourcing-start" size="sm" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
            Create Outsource Request
          </Button>
        </div>
      )}

      {activeRequest?.status === 'resource_secured' && (
        <p className="text-sm text-green-700">Resource secured{booking.vendorName ? ` via ${booking.vendorName}` : ''}.</p>
      )}

      {activeRequest && activeRequest.status !== 'resource_secured' && activeRequest.status !== 'cancelled' && (
        <>
          <div>
            <Label className="text-xs text-gray-600">Contact Vendors</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {uncontactedVendors.length === 0 && <span className="text-xs text-gray-400">No more active vendors to contact.</span>}
              {uncontactedVendors.map((v: any) => (
                <button
                  key={v._id}
                  type="button"
                  id={`sourcing-contact-vendor-${v._id}`}
                  onClick={() => setSelectedVendorsToContact((prev) => prev.includes(v._id) ? prev.filter((id) => id !== v._id) : [...prev, v._id])}
                  className={`text-xs px-2 py-1 rounded border ${selectedVendorsToContact.includes(v._id) ? 'border-green-500 bg-green-100' : 'border-gray-300'}`}
                >
                  {v.companyName}
                </button>
              ))}
            </div>
            <Button id="sourcing-send" size="sm" className="mt-2" disabled={selectedVendorsToContact.length === 0 || sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              <Send className="w-3.5 h-3.5 mr-1" /> Send WhatsApp Requirement
            </Button>
          </div>

          {responses.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pr-2 py-1">Vendor</th><th className="pr-2">Response</th><th className="pr-2">Offer</th><th className="pr-2">Cost</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r: any) => (
                    <tr key={r._id} className="border-t">
                      <td className="py-1 pr-2">{r.vendorNameSnapshot}{recommendedIds.has(r._id) && <span title="Recommended" className="ml-1">★</span>}</td>
                      <td className="py-1 pr-2"><Badge variant="outline">{r.response.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-1 pr-2">{r.offeredVehicleDetails || '—'}{r.offeredDriverDetails ? ` / ${r.offeredDriverDetails}` : ''}</td>
                      <td className="py-1 pr-2">{r.quotedCost != null ? `₹${r.quotedCost}` : '—'}</td>
                      <td className="py-1">
                        <div className="flex gap-1">
                          <Button
                            id={`sourcing-record-${r._id}`}
                            size="sm" variant="ghost" className="h-6 px-2 text-xs"
                            onClick={() => {
                              setRespondingVendorId(r.vendorId);
                              setResponseForm({
                                response: r.response === 'pending' ? 'accepted' : r.response,
                                offeredVehicleDetails: r.offeredVehicleDetails || '',
                                offeredDriverDetails: r.offeredDriverDetails || '',
                                quotedCost: r.quotedCost != null ? String(r.quotedCost) : '',
                              });
                            }}
                          >
                            Record
                          </Button>
                          {(r.response === 'accepted' || r.response === 'alternative_offered') && (
                            <Button id={`sourcing-select-${r._id}`} size="sm" className="h-6 px-2 text-xs" disabled={selectMutation.isPending} onClick={() => selectMutation.mutate(r._id)}>
                              Select
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={!!respondingVendorId} onOpenChange={(open) => !open && setRespondingVendorId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Record Vendor Response</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Response</Label>
              <Select value={responseForm.response} onValueChange={(v) => setResponseForm({ ...responseForm, response: v })}>
                <SelectTrigger id="sourcing-record-response-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="alternative_offered">Alternative Offered</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sourcing-record-vehicle">Offered Vehicle</Label>
              <Input id="sourcing-record-vehicle" value={responseForm.offeredVehicleDetails} onChange={(e) => setResponseForm({ ...responseForm, offeredVehicleDetails: e.target.value })} placeholder="e.g. Swift Dzire MP09AB1234" />
            </div>
            <div>
              <Label htmlFor="sourcing-record-driver">Offered Driver</Label>
              <Input id="sourcing-record-driver" value={responseForm.offeredDriverDetails} onChange={(e) => setResponseForm({ ...responseForm, offeredDriverDetails: e.target.value })} placeholder="e.g. Ramesh, 98xxxxxxx0" />
            </div>
            <div>
              <Label htmlFor="sourcing-record-cost">Quoted Cost (₹)</Label>
              <Input id="sourcing-record-cost" type="number" value={responseForm.quotedCost} onChange={(e) => setResponseForm({ ...responseForm, quotedCost: e.target.value })} />
            </div>
          </div>
          <FormSubmitStatus status={recordMutation.isPending ? 'loading' : recordMutation.isSuccess ? 'success' : 'idle'} successMessage="Response recorded" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondingVendorId(null)}>Cancel</Button>
            <Button id="sourcing-record-save" disabled={recordMutation.isPending} onClick={() => recordMutation.mutate()}>Save Response</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
