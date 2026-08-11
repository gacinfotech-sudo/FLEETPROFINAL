import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { apiRequest, ApiError } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FormSubmitStatus, FormSection } from "@/components/forms/form-enhancements";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "../../hooks/use-auth";
import {
  Users, AlertTriangle, Shield, ChevronLeft, ChevronRight, MapPin, User, CreditCard,
  Check, Lock, UserPlus, FileText, Briefcase, GitBranch,
} from "lucide-react";
import DriverContactsPanel from "./driver-contacts-panel";
import DriverDocumentsPanel from "./driver-documents-panel";
import DriverEmploymentHistoryPanel from "./driver-employment-history-panel";
import DriverLifecyclePanel from "./driver-lifecycle-panel";

// The original 12-field schema — UNCHANGED. This evolution reorganizes how
// these fields are collected (a progressive, multi-step wizard instead of a
// single form + collapsible "Additional Details" section) but removes
// nothing: every field the form captured before still exists below with
// identical validation.
const driverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  licenseNumber: z.string().optional(),
  experience: z.number().min(0, "Experience must be a positive number").optional(),
  rating: z.number().min(1).max(5).default(5),
  status: z.enum(["available", "on_duty", "inactive"]).default("available"),
  // Additional fields - UI only
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  aadharNumber: z.string().optional(),
  panNumber: z.string().optional(),
  dateOfJoining: z.string().optional(),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface DriverFormProps {
  driver?: any;
  onSuccess: () => void;
}

type WizardStepKey = "basic" | "personal" | "identity" | "contacts" | "documents" | "employment" | "lifecycle";

const WIZARD_STEPS: { key: WizardStepKey; label: string; icon: any; requiresDriverId: boolean }[] = [
  { key: "basic", label: "Basic Info", icon: User, requiresDriverId: false },
  { key: "personal", label: "Personal & Address", icon: MapPin, requiresDriverId: false },
  { key: "identity", label: "Identity Documents", icon: CreditCard, requiresDriverId: false },
  { key: "contacts", label: "Emergency Contacts", icon: Users, requiresDriverId: true },
  { key: "documents", label: "Documents", icon: FileText, requiresDriverId: true },
  { key: "employment", label: "Employment History", icon: Briefcase, requiresDriverId: true },
  { key: "lifecycle", label: "Lifecycle & Review", icon: GitBranch, requiresDriverId: true },
];

// Which wizard step renders each field's FormMessage — "Save & Continue"
// only lives on the "identity" step, so a server-side field error for a
// field on an earlier step (e.g. licenseNumber, on "basic") would
// otherwise be set on form state but never actually visible on screen.
// Used to jump the wizard back to the right step when that happens.
const STEP_FOR_FIELD: Partial<Record<keyof DriverFormData, WizardStepKey>> = {
  name: "basic",
  phone: "basic",
  licenseNumber: "basic",
  experience: "basic",
  rating: "basic",
  status: "basic",
  permanentAddress: "personal",
  currentAddress: "personal",
  maritalStatus: "personal",
  dateOfJoining: "personal",
  aadharNumber: "identity",
  panNumber: "identity",
};

export default function DriverForm({ driver, onSuccess }: DriverFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  // Tracks the driver record once it exists (either passed in for an edit,
  // or captured after the first "Save & Continue" during a create flow) —
  // this is what unlocks the lifecycle-stage-driven steps below, since
  // contacts/documents/employment history all require a real driver id.
  const [savedDriver, setSavedDriver] = useState<any>(driver || null);
  const driverId = savedDriver?._id || savedDriver?.id;
  const isEditMode = Boolean(driver);

  // Get current drivers count and plan info
  const { data: drivers } = useQuery({
    queryKey: ["/api/drivers"]
  });

  const currentDriverCount = Array.isArray(drivers) ? drivers.length : 0;
  const planLimits = (user?.tenantId as any)?.limits;
  const subscriptionPlan = (user?.tenantId as any)?.subscriptionPlan;
  const driverLimit = planLimits?.drivers || 0;
  const remainingSlots = Math.max(0, driverLimit - currentDriverCount);

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: driver?.name || "",
      phone: driver?.phone || "",
      licenseNumber: driver?.licenseNumber || "",
      experience: driver?.experience || undefined,
      rating: driver?.rating || 5,
      status: driver?.status || "available",
      // Additional fields - UI only
      permanentAddress: driver?.permanentAddress || "",
      currentAddress: driver?.currentAddress || "",
      maritalStatus: driver?.maritalStatus || undefined,
      aadharNumber: driver?.aadharNumber || "",
      panNumber: driver?.panNumber || "",
      dateOfJoining: driver?.dateOfJoining || "",
    },
  });

  // TASK-DRIVER-ADD-400-FIX: 400s from mongoDriverSchema now come back as
  // { message, fields: { <fieldName>: <friendly message> } } instead of a
  // raw Zod issues array (see server/routes.ts POST/PUT /api/drivers).
  // This renders those as field-specific FormMessage errors via RHF's
  // setError instead of dumping the whole thing in a toast — and, since
  // nothing here ever calls form.reset()/clears state on error, whatever
  // the user already typed stays exactly as they left it.
  const applyServerFieldErrors = (error: unknown): boolean => {
    if (!(error instanceof ApiError) || !error.fields) return false;
    let applied = false;
    let earliestStepIndex: number | null = null;
    for (const [field, message] of Object.entries(error.fields)) {
      if (!(field in form.getValues())) continue;
      form.setError(field as keyof DriverFormData, { type: "server", message });
      applied = true;
      const stepKey = STEP_FOR_FIELD[field as keyof DriverFormData];
      const idx = stepKey ? WIZARD_STEPS.findIndex((s) => s.key === stepKey) : -1;
      if (idx >= 0 && (earliestStepIndex === null || idx < earliestStepIndex)) {
        earliestStepIndex = idx;
      }
    }
    if (earliestStepIndex !== null && earliestStepIndex !== stepIndex) {
      setStepIndex(earliestStepIndex);
    }
    return applied;
  };

  const createDriverMutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      const response = await apiRequest("POST", "/api/drivers", data);
      return response.json();
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to create driver";
      if (errorMessage.includes("maximum") || errorMessage.includes("limit")) {
        toast({
          title: "🚫 Driver Limit Reached",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      if (applyServerFieldErrors(error)) {
        toast({ title: "Please check the highlighted fields", description: errorMessage, variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    },
  });

  const updateDriverMutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      const id = savedDriver._id || savedDriver.id;
      const response = await apiRequest("PUT", `/api/drivers/${id}`, data);
      return response.json();
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to update driver";
      if (applyServerFieldErrors(error)) {
        toast({ title: "Please check the highlighted fields", description: errorMessage, variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    },
  });

  const saveBasics = async (andThen: "close" | "continue") => {
    const valid = await form.trigger();
    if (!valid) return;
    const data = form.getValues();
    try {
      const result = savedDriver
        ? await updateDriverMutation.mutateAsync(data)
        : await createDriverMutation.mutateAsync(data);
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "Success", description: savedDriver ? "Driver updated successfully" : "Driver created successfully" });
      setSavedDriver(result);
      if (andThen === "close") {
        onSuccess();
      } else {
        setStepIndex(3); // jump to Emergency Contacts
      }
    } catch {
      // Errors already surfaced via the mutations' onError toasts/field
      // errors above — form values are left untouched either way.
    }
  };

  const isSaving = createDriverMutation.isPending || updateDriverMutation.isPending;
  const currentStep = WIZARD_STEPS[stepIndex];
  const canJumpToStep = (i: number) => !WIZARD_STEPS[i].requiresDriverId || Boolean(driverId);

  return (
    <div className="space-y-5">
      <FormSubmitStatus
        status={isSaving ? "loading" : "idle"}
        successMessage="Driver saved successfully!"
        errorMessage="Failed to save driver"
      />

      {/* Step navigator */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-center gap-1.5 w-max">
          {WIZARD_STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const locked = !canJumpToStep(i);
            const active = i === stepIndex;
            const complete = i < stepIndex;
            return (
              <button
                key={step.key}
                type="button"
                disabled={locked}
                onClick={() => !locked && setStepIndex(i)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap
                  ${active ? "bg-blue-600 text-white border-blue-600" : locked ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
              >
                {locked ? <Lock className="w-3 h-3" /> : complete && !active ? <Check className="w-3 h-3" /> : <StepIcon className="w-3 h-3" />}
                <span>{i + 1}. {step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!driverId && stepIndex < 3 && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Lock className="w-3 h-3" /> Emergency contacts, documents, employment history and lifecycle stage unlock once the driver's basic profile is saved.
        </p>
      )}

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {currentStep.key === "basic" && !isEditMode && subscriptionPlan && (
            <Card className="border-l-4 border-l-green-500 bg-green-50/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-green-600" />
                      <h4 className="font-medium text-green-900 capitalize">{subscriptionPlan} Plan</h4>
                    </div>
                    <p className="text-sm text-green-700">
                      You can create up to <span className="font-semibold">{driverLimit} drivers</span>.
                      Currently using <span className="font-semibold">{currentDriverCount}</span>,
                      <span className="ml-1 font-semibold text-emerald-600">{remainingSlots} slots remaining</span>.
                    </p>
                    {remainingSlots === 0 && (
                      <div className="mt-2 flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Driver limit reached. Contact admin to upgrade your plan.</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep.key === "basic" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="Enter driver's full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input placeholder="Enter phone number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number (Optional)</FormLabel>
                  <FormControl><Input placeholder="Enter license number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="experience" render={({ field }) => (
                <FormItem>
                  <FormLabel>Experience (Years) (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Years of driving experience" {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rating" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating (1-5) (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="5" step="0.1" placeholder="Driver rating (default: 5)" {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 5)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select driver status" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="on_duty">On Duty</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          )}

          {currentStep.key === "personal" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Address Information</h4>
              </div>
              <FormField control={form.control} name="permanentAddress" render={({ field }) => (
                <FormItem>
                  <FormLabel>Permanent Address</FormLabel>
                  <FormControl><Textarea placeholder="Enter permanent address" className="min-h-[80px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currentAddress" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Address (Temporary)</FormLabel>
                  <FormControl><Textarea placeholder="Enter current address" className="min-h-[80px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="sm:col-span-2 flex items-center gap-2 mt-2">
                <User className="w-4 h-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Personal Information</h4>
              </div>
              <FormField control={form.control} name="maritalStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Marital Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select marital status" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfJoining" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Joining</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          )}

          {currentStep.key === "identity" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Document Information</h4>
              </div>
              <FormField control={form.control} name="aadharNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aadhar Card Number</FormLabel>
                  <FormControl><Input placeholder="Enter Aadhar card number" maxLength={12} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="panNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN Card Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter PAN card number" maxLength={10} style={{ textTransform: "uppercase" }} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Alert className="sm:col-span-2">
                <AlertDescription className="text-xs">
                  Scanned copies of identity/address/license documents (with expiry tracking and verification) are
                  uploaded separately in the Documents step, once this profile is saved.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {currentStep.key === "contacts" && driverId && <DriverContactsPanel driverId={driverId} />}
          {currentStep.key === "documents" && driverId && <DriverDocumentsPanel driverId={driverId} />}
          {currentStep.key === "employment" && driverId && <DriverEmploymentHistoryPanel driverId={driverId} />}
          {currentStep.key === "lifecycle" && driverId && (
            <div className="space-y-4">
              <DriverLifecyclePanel driverId={driverId} />
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
                <UserPlus className="w-4 h-4" />
                <span>Basic profile saved. Use the tabs above any time to keep building out this driver's contacts, documents and employment history.</span>
              </div>
            </div>
          )}

          {/* Navigation / actions */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-2 border-t">
            <div className="flex gap-2">
              {stepIndex > 0 && (
                <Button type="button" variant="outline" onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={onSuccess}>
                {driverId ? "Close" : "Cancel"}
              </Button>

              {(currentStep.key === "basic" || currentStep.key === "personal") && (
                <Button type="button" onClick={() => setStepIndex((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              {currentStep.key === "identity" && (
                <>
                  <Button type="button" variant="secondary" disabled={isSaving} onClick={() => saveBasics("close")}>
                    {isSaving ? "Saving…" : driverId ? "Save & Close" : "Add Driver"}
                  </Button>
                  <Button type="button" disabled={isSaving} onClick={() => saveBasics("continue")}>
                    {isSaving ? "Saving…" : "Save & Continue"} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              )}

              {(currentStep.key === "contacts" || currentStep.key === "documents" || currentStep.key === "employment") && (
                <Button type="button" onClick={() => setStepIndex((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              {currentStep.key === "lifecycle" && (
                <Button type="button" onClick={onSuccess}>
                  <Check className="w-4 h-4 mr-1" /> Finish
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
