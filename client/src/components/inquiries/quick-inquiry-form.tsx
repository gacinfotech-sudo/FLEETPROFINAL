import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { useFormAutoSave, FormSubmitStatus, FormSection } from "@/components/forms/form-enhancements";
import { ValidationRules, IndianValidators } from "@/components/forms/validation-rules";
import VehicleSelector from "./vehicle-selector";

const SOURCE_OPTIONS = [
  ["phone_call", "Phone Call"], ["whatsapp", "WhatsApp"], ["website", "Website"],
  ["google_business_profile", "Google Business Profile"], ["google_ads", "Google Ads"],
  ["facebook", "Facebook"], ["instagram", "Instagram"], ["hotel", "Hotel"],
  ["corporate_client", "Corporate Client"], ["travel_agent", "Travel Agent"],
  ["vendor_partner", "Vendor Partner"], ["referral", "Referral"],
  ["online_travel_platform", "Online Travel Platform"], ["repeat_customer", "Repeat Customer"],
  ["walk_in", "Walk-in"], ["direct_customer", "Direct Customer"], ["other", "Other"],
] as const;

interface QuickInquiryFormProps {
  onSuccess?: (inquiry: any) => void;
  onCancel?: () => void;
  initialMobile?: string;
}

const emptyForm = {
  customerName: "", primaryMobile: "", whatsappNumber: "", source: "phone_call",
  pickupDate: "", pickupLocation: "", dropLocation: "", numberOfPassengers: "",
  vehicleCategory: "", notes: "", assignedExecutive: "", priority: "medium", nextFollowUpAt: "",
};

function normalizeIndianPhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('091')) {
    return digits.slice(3);
  }

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

export default function QuickInquiryForm({ onSuccess, onCancel, initialMobile }: QuickInquiryFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm, primaryMobile: initialMobile || "", whatsappNumber: initialMobile || "" });
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupChecked, setLookupChecked] = useState(false);
  const [whatsappManuallyEdited, setWhatsappManuallyEdited] = useState(false);
  const [syncWhatsapp, setSyncWhatsapp] = useState(true);
  const [mobileError, setMobileError] = useState<string>("");

  // Form auto-save
  const { save: autoSave } = useFormAutoSave("quick-inquiry-form", form, 2000);

  const lookupMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("GET", `/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
      return res.json();
    },
    onSuccess: (data) => {
      setLookupResult(data.customer ? data : null);
      setLookupChecked(true);
    },
    onError: () => {
      setLookupResult(null);
      setLookupChecked(true);
    },
  });

  useEffect(() => {
    const digits = (initialMobile || "").replace(/\D/g, "");
    if (digits.length >= 10) lookupMutation.mutate(initialMobile!);
  }, []);

  // Auto-save form progress
  useEffect(() => {
    autoSave();
  }, [form, autoSave]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeIndianPhone(form.primaryMobile);
      if (!normalized) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }

      const payload: Record<string, any> = {
        ...form,
        primaryMobile: normalized,
      };

      if (form.whatsappNumber.trim()) {
        const normalizedWhatsapp = normalizeIndianPhone(form.whatsappNumber);
        if (normalizedWhatsapp) {
          payload.whatsappNumber = normalizedWhatsapp;
        }
      } else {
        delete payload.whatsappNumber;
      }

      if (!payload.numberOfPassengers) delete payload.numberOfPassengers;
      else payload.numberOfPassengers = Number(payload.numberOfPassengers);
      if (!payload.pickupDate) delete payload.pickupDate;
      if (!payload.nextFollowUpAt) delete payload.nextFollowUpAt;
      if (lookupResult?.customer?._id) payload.linkedCustomerId = lookupResult.customer._id;

      const res = await apiRequest("POST", "/api/inquiries", payload);
      return res.json();
    },
    onSuccess: (inquiry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ variant: "success", title: "Inquiry saved", description: `${inquiry.inquiryNumber} created.` });
      onSuccess?.(inquiry);
    },
    onError: (error: any) => {
      toast({ title: "Could not save inquiry", description: error.message, variant: "destructive" });
    },
  });

  const handleMobileChange = (value: string) => {
    setForm((f) => ({ ...f, primaryMobile: value }));
    setLookupChecked(false);
    setMobileError("");

    if (syncWhatsapp && !whatsappManuallyEdited) {
      const normalized = normalizeIndianPhone(value);
      if (normalized) {
        setForm((f) => ({ ...f, whatsappNumber: normalized }));
      }
    }
  };

  const handleMobileBlur = () => {
    const normalized = normalizeIndianPhone(form.primaryMobile);
    if (form.primaryMobile.trim()) {
      if (!normalized) {
        setMobileError("Enter a valid 10-digit Indian mobile number.");
      } else {
        setMobileError("");
        const digits = form.primaryMobile.replace(/\D/g, "");
        if (digits.length >= 10) lookupMutation.mutate(form.primaryMobile);
      }
    }
  };

  const handleWhatsappChange = (value: string) => {
    setForm((f) => ({ ...f, whatsappNumber: value }));
    if (value.trim()) {
      setWhatsappManuallyEdited(true);
    }
  };

  const handleSyncWhatsapp = (checked: boolean) => {
    setSyncWhatsapp(checked);
    setWhatsappManuallyEdited(false);
    if (checked) {
      const normalized = normalizeIndianPhone(form.primaryMobile);
      if (normalized) {
        setForm((f) => ({ ...f, whatsappNumber: normalized }));
      }
    }
  };

  const applyExistingCustomer = () => {
    if (!lookupResult?.customer) return;
    const c = lookupResult.customer;
    setForm((f) => ({
      ...f,
      customerName: f.customerName || c.name || "",
      whatsappNumber: f.whatsappNumber || c.whatsappNumber || "",
    }));
    toast({ title: "Customer details applied" });
  };

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const isFormValid = form.customerName.trim() && form.primaryMobile.trim() && !mobileError;

  return (
    <div className="space-y-4">
      <FormSubmitStatus
        status={createMutation.isPending ? "loading" : createMutation.isSuccess ? "success" : createMutation.isError ? "error" : "idle"}
        successMessage="Inquiry created successfully!"
        errorMessage={createMutation.error?.message || "Failed to create inquiry"}
      />

      <div className="border-b pb-4">
        <h3 className="font-semibold text-gray-900 mb-4">Customer Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="inq-name">Customer Name *</Label>
            <Input
              id="inq-name"
              value={form.customerName}
              onChange={(e) => set("customerName")(e.target.value)}
              placeholder="Somya Kandil"
            />
          </div>
          <div>
            <Label htmlFor="inq-mobile">Primary Mobile *</Label>
            <Input
              id="inq-mobile"
              value={form.primaryMobile}
              onChange={(e) => handleMobileChange(e.target.value)}
              onBlur={handleMobileBlur}
              placeholder="8305770046 or +918305770046"
              className={mobileError ? "border-red-500" : ""}
            />
            {mobileError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {mobileError}
              </div>
            )}
          </div>
        </div>

        {lookupMutation.isPending && <p className="text-sm text-gray-500 mt-3">Checking existing customers…</p>}

        {lookupChecked && lookupResult?.customer && (
          <Card className="border-blue-200 bg-blue-50 mt-4">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-blue-900">Existing Customer Found</span>
                <Badge variant="secondary">{lookupResult.customer.customerType || "individual"}</Badge>
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <div>{lookupResult.customer.name} — {lookupResult.customer.primaryMobile}</div>
                <div>Total bookings: {lookupResult.customer.totalBookings ?? 0} · Pending due: ₹{lookupResult.pendingDue ?? 0}</div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={applyExistingCustomer}>Use This Customer</Button>
              </div>
            </CardContent>
          </Card>
        )}
        {lookupChecked && !lookupResult?.customer && (
          <p className="text-sm text-gray-500 mt-3">No existing customer found for this number — a new inquiry-only contact will be saved.</p>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="inq-whatsapp">WhatsApp Number</Label>
              <Checkbox
                id="whatsapp-sync"
                checked={syncWhatsapp}
                onCheckedChange={(checked) => handleSyncWhatsapp(checked as boolean)}
              />
              <label htmlFor="whatsapp-sync" className="text-sm text-gray-600 cursor-pointer">Same as Primary Mobile</label>
            </div>
            <Input
              id="inq-whatsapp"
              value={form.whatsappNumber}
              onChange={(e) => handleWhatsappChange(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="inq-source">Lead Source</Label>
            <Select value={form.source} onValueChange={set("source")}>
              <SelectTrigger id="inq-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border-b pb-4">
        <h3 className="font-semibold text-gray-900 mb-4">Trip Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="inq-pickup-date">Travel Date</Label>
            <Input id="inq-pickup-date" type="date" value={form.pickupDate} onChange={(e) => set("pickupDate")(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inq-passengers">Passenger Count</Label>
            <Input id="inq-passengers" type="number" min="1" value={form.numberOfPassengers} onChange={(e) => set("numberOfPassengers")(e.target.value)} />
          </div>
          <VehicleSelector
            value={form.vehicleCategory}
            onChange={(vehicleTypeId, vehicleDisplayName) => {
              setForm((f) => ({ ...f, vehicleCategory: vehicleDisplayName }));
            }}
            passengerCount={form.numberOfPassengers ? parseInt(form.numberOfPassengers) : undefined}
            label="Vehicle Requirement"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <Label htmlFor="inq-pickup">Pickup Location</Label>
            <Input id="inq-pickup" value={form.pickupLocation} onChange={(e) => set("pickupLocation")(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inq-drop">Drop Location / Route</Label>
            <Input id="inq-drop" value={form.dropLocation} onChange={(e) => set("dropLocation")(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="border-b pb-4">
        <h3 className="font-semibold text-gray-900 mb-4">Lead Management</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="inq-executive">Assigned Executive</Label>
            <Input id="inq-executive" value={form.assignedExecutive} onChange={(e) => set("assignedExecutive")(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inq-priority">Priority</Label>
            <Select value={form.priority} onValueChange={set("priority")}>
              <SelectTrigger id="inq-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="inq-followup">Next Follow-up</Label>
            <Input id="inq-followup" type="date" value={form.nextFollowUpAt} onChange={(e) => set("nextFollowUpAt")(e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="inq-notes">Basic Requirement / Notes</Label>
        <Textarea id="inq-notes" rows={3} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button
          type="button"
          disabled={createMutation.isPending || !isFormValid}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Saving…" : "Save Inquiry"}
        </Button>
      </div>
    </div>
  );
}
