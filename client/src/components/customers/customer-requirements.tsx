import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_FORM: Record<string, any> = {
  bookingId: "none", tripRequirement: "", pickupRequirements: "", dropRequirements: "", route: "",
  multipleStops: "", numberOfPassengers: "", luggage: "", hotelDetails: "", trainFlightDetails: "",
  seniorCitizenRequirement: false, childRequirement: false, wheelchair: false, templeTiming: "", darshanTiming: "",
  vehicleCategory: "", driverPreference: "", languagePreference: "", acRequirement: false,
  paymentArrangement: "", tollParkingAgreement: "", includedServices: "", excludedServices: "",
  customerVisibleInstructions: "", driverInstructions: "", officeOnlyNotes: "", billingInstructions: "",
};

const TEXT_FIELDS = [
  ["pickupRequirements", "Pickup requirements"], ["dropRequirements", "Drop requirements"],
  ["route", "Route"], ["multipleStops", "Multiple stops (comma separated)"],
  ["numberOfPassengers", "Number of passengers"], ["luggage", "Luggage"],
  ["hotelDetails", "Hotel details"], ["trainFlightDetails", "Train / flight details"],
  ["templeTiming", "Temple timing"], ["darshanTiming", "Bhasma Aarti / darshan timing"],
  ["vehicleCategory", "Vehicle category"], ["driverPreference", "Driver preference"],
  ["languagePreference", "Language preference"], ["paymentArrangement", "Payment arrangement"],
  ["tollParkingAgreement", "Toll / parking agreement"], ["includedServices", "Included services (comma separated)"],
  ["excludedServices", "Excluded services (comma separated)"], ["billingInstructions", "Billing instructions"],
];

const BOOLEAN_FIELDS = [
  ["seniorCitizenRequirement", "Senior citizen"], ["childRequirement", "Child passenger"],
  ["wheelchair", "Wheelchair"], ["acRequirement", "AC required"],
];

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function CustomerRequirements({ customerId, bookings }: { customerId: string; bookings: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const { data: requirements = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/customers/${customerId}/requirements`],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        bookingId: form.bookingId === 'none' ? undefined : form.bookingId,
        numberOfPassengers: form.numberOfPassengers ? Number(form.numberOfPassengers) : undefined,
        multipleStops: splitList(form.multipleStops),
        includedServices: splitList(form.includedServices),
        excludedServices: splitList(form.excludedServices),
      };
      return (await apiRequest("POST", `/api/customers/${customerId}/requirements`, payload)).json();
    },
    onSuccess: () => {
      toast({ title: "Requirement version saved" });
      setForm({ ...EMPTY_FORM });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/requirements`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
    },
    onError: (error: any) => toast({ title: "Could not save requirement", description: error.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-600" /> Requirements History</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Requirement</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-gray-500">Loading...</p> : requirements.length === 0 ? (
          <p className="text-sm text-gray-500">No saved requirement versions yet.</p>
        ) : (
          <div className="space-y-3">
            {requirements.map((row: any, index: number) => (
              <div key={row._id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Version {requirements.length - index}</Badge>
                    {row.bookingId?.bookingId && <Badge variant="secondary">{row.bookingId.bookingId}</Badge>}
                  </div>
                  <span className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleString('en-IN')}</span>
                </div>
                <p className="font-medium mt-2">{row.tripRequirement || row.route || 'Special customer requirement'}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 mt-2 text-gray-600">
                  {row.route && <span>Route: {row.route}</span>}
                  {row.numberOfPassengers && <span>Passengers: {row.numberOfPassengers}</span>}
                  {row.vehicleCategory && <span>Vehicle: {row.vehicleCategory}</span>}
                  {row.driverPreference && <span>Driver: {row.driverPreference}</span>}
                  {row.luggage && <span>Luggage: {row.luggage}</span>}
                  {row.multipleStops?.length > 0 && <span>Stops: {row.multipleStops.join(', ')}</span>}
                </div>
                {(row.customerVisibleInstructions || row.driverInstructions || row.officeOnlyNotes) && (
                  <div className="mt-2 pt-2 border-t space-y-1 text-gray-600">
                    {row.customerVisibleInstructions && <p>Customer: {row.customerVisibleInstructions}</p>}
                    {row.driverInstructions && <p>Driver: {row.driverInstructions}</p>}
                    {row.officeOnlyNotes && <p className="text-amber-700">Office only: {row.officeOnlyNotes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Requirement Version</DialogTitle></DialogHeader>
          <p className="text-xs text-gray-500">This saves a new immutable version; previous booking requirements are not overwritten.</p>
          <div className="space-y-4">
            <div>
              <Label>Linked booking (optional)</Label>
              <Select value={form.bookingId} onValueChange={(value) => setForm({ ...form, bookingId: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General / future requirement</SelectItem>
                  {bookings.map((booking) => <SelectItem key={booking._id} value={booking._id}>{booking.bookingId} · {booking.pickupLocation} → {booking.dropoffLocation || '-'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer trip requirement</Label>
              <Textarea value={form.tripRequirement} onChange={(event) => setForm({ ...form, tripRequirement: event.target.value })} placeholder="Complete trip requirement" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {TEXT_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type={key === 'numberOfPassengers' ? 'number' : 'text'} min={key === 'numberOfPassengers' ? 1 : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 border p-3">
              {BOOLEAN_FIELDS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} /> {label}
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Customer-visible instructions</Label><Textarea value={form.customerVisibleInstructions} onChange={(event) => setForm({ ...form, customerVisibleInstructions: event.target.value })} /></div>
              <div><Label>Driver instructions</Label><Textarea value={form.driverInstructions} onChange={(event) => setForm({ ...form, driverInstructions: event.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Office-only notes</Label><Textarea value={form.officeOnlyNotes} onChange={(event) => setForm({ ...form, officeOnlyNotes: event.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={addMutation.isPending} onClick={() => addMutation.mutate()}>{addMutation.isPending ? 'Saving...' : 'Save New Version'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
