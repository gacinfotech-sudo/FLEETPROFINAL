import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";

const TRIP_TYPE_OPTIONS = [
  ["local", "Local"], ["airport_transfer", "Airport Transfer"], ["railway_transfer", "Railway Transfer"],
  ["one_way", "One-Way"], ["round_trip", "Round Trip"], ["outstation", "Outstation"],
  ["multi_city", "Multi-City"], ["religious_tour", "Religious Tour"], ["corporate_duty", "Corporate Duty"],
  ["wedding_event", "Wedding / Event"], ["group_tour", "Group Tour"], ["self_drive", "Self-Drive"],
  ["monthly_contract", "Monthly Contract"], ["employee_transport", "Employee Transport"], ["custom", "Custom Trip"],
] as const;

interface VehicleRequirement {
  requestedNameSnapshot: string;
  quantity: number;
  seatingCapacity?: number;
  luggageCapacity?: number;
  preferredModel?: string;
  serviceType: "with_driver" | "self_drive";
  alternativeAllowed: boolean;
  notes?: string;
}

interface CustomVehicleRequest {
  customVehicleName: string;
  seatingCapacity?: number;
  luxuryLevel?: string;
  quantity: number;
  customerDescription?: string;
  expectedBudget?: number;
  alternativeAllowed: boolean;
}

interface DetailedRequirementFormProps {
  inquiry: any;
  onSuccess?: (inquiry: any) => void;
  onCancel?: () => void;
}

export default function DetailedRequirementForm({ inquiry, onSuccess, onCancel }: DetailedRequirementFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tripType, setTripType] = useState(inquiry.tripType || "");
  const [flexibleDate, setFlexibleDate] = useState(!!inquiry.flexibleDate);
  const [route, setRoute] = useState(inquiry.route || "");
  const [viaLocations, setViaLocations] = useState(inquiry.viaLocations || "");
  const [placesToVisit, setPlacesToVisit] = useState(inquiry.placesToVisit || "");
  const [seniorCitizens, setSeniorCitizens] = useState(String(inquiry.seniorCitizens ?? ""));
  const [children, setChildren] = useState(String(inquiry.children ?? ""));
  const [infants, setInfants] = useState(String(inquiry.infants ?? ""));
  const [luggageCount, setLuggageCount] = useState(String(inquiry.luggageCount ?? ""));
  const [driverPreference, setDriverPreference] = useState(inquiry.driverPreference || "");
  const [languagePreference, setLanguagePreference] = useState(inquiry.languagePreference || "");
  const [acRequirement, setAcRequirement] = useState(inquiry.acRequirement || "");
  const [paymentArrangement, setPaymentArrangement] = useState(inquiry.paymentArrangement || "");
  const [tollParkingAgreement, setTollParkingAgreement] = useState(inquiry.tollParkingAgreement || "");
  const [customerVisibleInstructions, setCustomerVisibleInstructions] = useState(inquiry.customerVisibleInstructions || "");
  const [driverInstructions, setDriverInstructions] = useState(inquiry.driverInstructions || "");
  const [officeOnlyNotes, setOfficeOnlyNotes] = useState(inquiry.officeOnlyNotes || "");
  const [billingInstructions, setBillingInstructions] = useState(inquiry.billingInstructions || "");

  const [vehicleRequirements, setVehicleRequirements] = useState<VehicleRequirement[]>(inquiry.vehicleRequirements || []);
  const [newVehicle, setNewVehicle] = useState({ requestedNameSnapshot: "", quantity: "1", seatingCapacity: "", serviceType: "with_driver" as const });

  const [customVehicleRequests, setCustomVehicleRequests] = useState<CustomVehicleRequest[]>(inquiry.customVehicleRequests || []);
  const [newCustomVehicle, setNewCustomVehicle] = useState({ customVehicleName: "", seatingCapacity: "", quantity: "1", customerDescription: "" });

  const addVehicleRequirement = () => {
    if (!newVehicle.requestedNameSnapshot.trim()) return;
    setVehicleRequirements((list) => [...list, {
      requestedNameSnapshot: newVehicle.requestedNameSnapshot.trim(),
      quantity: Number(newVehicle.quantity) || 1,
      seatingCapacity: newVehicle.seatingCapacity ? Number(newVehicle.seatingCapacity) : undefined,
      serviceType: newVehicle.serviceType,
      alternativeAllowed: true,
    }]);
    setNewVehicle({ requestedNameSnapshot: "", quantity: "1", seatingCapacity: "", serviceType: "with_driver" });
  };
  const removeVehicleRequirement = (index: number) => setVehicleRequirements((list) => list.filter((_, i) => i !== index));

  const addCustomVehicle = () => {
    if (!newCustomVehicle.customVehicleName.trim()) return;
    setCustomVehicleRequests((list) => [...list, {
      customVehicleName: newCustomVehicle.customVehicleName.trim(),
      seatingCapacity: newCustomVehicle.seatingCapacity ? Number(newCustomVehicle.seatingCapacity) : undefined,
      quantity: Number(newCustomVehicle.quantity) || 1,
      customerDescription: newCustomVehicle.customerDescription || undefined,
      alternativeAllowed: true,
    }]);
    setNewCustomVehicle({ customVehicleName: "", seatingCapacity: "", quantity: "1", customerDescription: "" });
  };
  const removeCustomVehicle = (index: number) => setCustomVehicleRequests((list) => list.filter((_, i) => i !== index));

  const formData = {
    tripType, flexibleDate, route, viaLocations, placesToVisit,
    seniorCitizens, children, infants, luggageCount,
    driverPreference, languagePreference, acRequirement, paymentArrangement, tollParkingAgreement,
    customerVisibleInstructions, driverInstructions, officeOnlyNotes, billingInstructions,
    vehicleRequirements, customVehicleRequests,
  };

  const { save: autoSave } = useFormAutoSave(`dreq-form-${inquiry._id}`, formData, 2000);

  useEffect(() => {
    autoSave();
  }, [formData, autoSave]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        tripType: tripType || undefined,
        flexibleDate,
        route, viaLocations, placesToVisit,
        driverPreference, languagePreference, acRequirement, paymentArrangement, tollParkingAgreement,
        customerVisibleInstructions, driverInstructions, officeOnlyNotes, billingInstructions,
        vehicleRequirements, customVehicleRequests,
      };
      for (const [key, value] of [["seniorCitizens", seniorCitizens], ["children", children], ["infants", infants], ["luggageCount", luggageCount]] as const) {
        payload[key] = value === "" ? undefined : Number(value);
      }
      const res = await apiRequest("PATCH", `/api/inquiries/${inquiry._id}`, payload);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ variant: "success", title: "Requirement details saved" });
      onSuccess?.(updated);
    },
    onError: (error: any) => {
      toast({ title: "Could not save requirement details", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dreq-trip-type">Trip Type</Label>
          <Select value={tripType} onValueChange={setTripType}>
            <SelectTrigger id="dreq-trip-type"><SelectValue placeholder="Select trip type" /></SelectTrigger>
            <SelectContent>
              {TRIP_TYPE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Checkbox id="dreq-flexible" checked={flexibleDate} onCheckedChange={(v) => setFlexibleDate(!!v)} />
          <Label htmlFor="dreq-flexible" className="mb-0">Travel date is flexible</Label>
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Route & Itinerary</h3>
        <div>
          <Label htmlFor="dreq-route">Full Route</Label>
          <Input id="dreq-route" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Indore → Ujjain → Omkareshwar → Maheshwar → Indore" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dreq-via">Via Locations</Label>
            <Input id="dreq-via" value={viaLocations} onChange={(e) => setViaLocations(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dreq-places">Places to Visit</Label>
            <Input id="dreq-places" value={placesToVisit} onChange={(e) => setPlacesToVisit(e.target.value)} placeholder="Ujjain, Omkareshwar, Maheshwar" />
          </div>
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Passenger Requirements</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><Label htmlFor="dreq-senior">Senior Citizens</Label><Input id="dreq-senior" type="number" min="0" value={seniorCitizens} onChange={(e) => setSeniorCitizens(e.target.value)} /></div>
          <div><Label htmlFor="dreq-children">Children</Label><Input id="dreq-children" type="number" min="0" value={children} onChange={(e) => setChildren(e.target.value)} /></div>
          <div><Label htmlFor="dreq-infants">Infants</Label><Input id="dreq-infants" type="number" min="0" value={infants} onChange={(e) => setInfants(e.target.value)} /></div>
          <div><Label htmlFor="dreq-luggage">Luggage (bags)</Label><Input id="dreq-luggage" type="number" min="0" value={luggageCount} onChange={(e) => setLuggageCount(e.target.value)} /></div>
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Vehicle Requirements (multiple)</h3>
        {vehicleRequirements.length > 0 && (
          <div className="space-y-2">
            {vehicleRequirements.map((v, i) => (
              <div key={i} className="flex items-center justify-between border rounded-lg p-2 text-sm">
                <div>
                  <span className="font-medium">{v.quantity}× {v.requestedNameSnapshot}</span>
                  {v.seatingCapacity && <span className="text-gray-500"> · {v.seatingCapacity}-seater</span>}
                  <Badge variant="outline" className="ml-2 text-xs">{v.serviceType === "self_drive" ? "Self Drive" : "With Driver"}</Badge>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeVehicleRequirement(i)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            ))}
          </div>
        )}
        <Card><CardContent className="p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
          <div className="sm:col-span-2"><Label>Vehicle name</Label><Input value={newVehicle.requestedNameSnapshot} onChange={(e) => setNewVehicle((f) => ({ ...f, requestedNameSnapshot: e.target.value }))} placeholder="Innova Crysta" /></div>
          <div><Label>Qty</Label><Input type="number" min="1" value={newVehicle.quantity} onChange={(e) => setNewVehicle((f) => ({ ...f, quantity: e.target.value }))} /></div>
          <div><Label>Seats</Label><Input type="number" min="1" value={newVehicle.seatingCapacity} onChange={(e) => setNewVehicle((f) => ({ ...f, seatingCapacity: e.target.value }))} /></div>
          <Button type="button" variant="outline" onClick={addVehicleRequirement}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardContent></Card>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Custom Vehicle Requests</h3>
        <p className="text-xs text-gray-500">A customer-requested category, not a physical fleet vehicle. Reviewed separately before it becomes a real category.</p>
        {customVehicleRequests.length > 0 && (
          <div className="space-y-2">
            {customVehicleRequests.map((v, i) => (
              <div key={i} className="flex items-center justify-between border rounded-lg p-2 text-sm">
                <div>
                  <span className="font-medium">{v.quantity}× {v.customVehicleName}</span>
                  {v.seatingCapacity && <span className="text-gray-500"> · {v.seatingCapacity}-seater</span>}
                  {v.customerDescription && <div className="text-gray-500 text-xs">{v.customerDescription}</div>}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomVehicle(i)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            ))}
          </div>
        )}
        <Card><CardContent className="p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
          <div className="sm:col-span-2"><Label>Requested vehicle</Label><Input value={newCustomVehicle.customVehicleName} onChange={(e) => setNewCustomVehicle((f) => ({ ...f, customVehicleName: e.target.value }))} placeholder="Premium 8-Seater" /></div>
          <div><Label>Qty</Label><Input type="number" min="1" value={newCustomVehicle.quantity} onChange={(e) => setNewCustomVehicle((f) => ({ ...f, quantity: e.target.value }))} /></div>
          <div><Label>Seats</Label><Input type="number" min="1" value={newCustomVehicle.seatingCapacity} onChange={(e) => setNewCustomVehicle((f) => ({ ...f, seatingCapacity: e.target.value }))} /></div>
          <Button type="button" variant="outline" onClick={addCustomVehicle}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardContent></Card>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Driver Requirements</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label htmlFor="dreq-driver-pref">Driver Preference</Label><Input id="dreq-driver-pref" value={driverPreference} onChange={(e) => setDriverPreference(e.target.value)} placeholder="Experienced, route-familiar" /></div>
          <div><Label htmlFor="dreq-lang">Language Preference</Label><Input id="dreq-lang" value={languagePreference} onChange={(e) => setLanguagePreference(e.target.value)} placeholder="Hindi speaking" /></div>
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Service & Commercial</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><Label htmlFor="dreq-ac">AC Requirement</Label><Input id="dreq-ac" value={acRequirement} onChange={(e) => setAcRequirement(e.target.value)} /></div>
          <div><Label htmlFor="dreq-payment">Payment Arrangement</Label><Input id="dreq-payment" value={paymentArrangement} onChange={(e) => setPaymentArrangement(e.target.value)} /></div>
          <div><Label htmlFor="dreq-toll">Toll/Parking Agreement</Label><Input id="dreq-toll" value={tollParkingAgreement} onChange={(e) => setTollParkingAgreement(e.target.value)} /></div>
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-gray-700">Notes</h3>
        <div><Label htmlFor="dreq-customer-notes">Customer-visible Instructions</Label><Textarea id="dreq-customer-notes" rows={2} value={customerVisibleInstructions} onChange={(e) => setCustomerVisibleInstructions(e.target.value)} /></div>
        <div><Label htmlFor="dreq-driver-notes">Driver Instructions</Label><Textarea id="dreq-driver-notes" rows={2} value={driverInstructions} onChange={(e) => setDriverInstructions(e.target.value)} /></div>
        <div><Label htmlFor="dreq-office-notes">Office-only Notes</Label><Textarea id="dreq-office-notes" rows={2} value={officeOnlyNotes} onChange={(e) => setOfficeOnlyNotes(e.target.value)} /></div>
        <div><Label htmlFor="dreq-billing-notes">Billing Instructions</Label><Textarea id="dreq-billing-notes" rows={2} value={billingInstructions} onChange={(e) => setBillingInstructions(e.target.value)} /></div>
      </div>

      <FormSubmitStatus
        status={saveMutation.isPending ? "loading" : saveMutation.isSuccess ? "success" : saveMutation.isError ? "error" : "idle"}
        successMessage="Requirement details saved!"
        errorMessage={(saveMutation.error as any)?.message || "Failed to save"}
      />

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save Requirement Details</Button>
      </div>
    </div>
  );
}
