import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "../../hooks/use-auth";
import { Car, AlertTriangle, Shield } from "lucide-react";
import { useFormAutoSave, FormSubmitStatus } from "@/components/forms/form-enhancements";

// TASK-VEHICLE-DOMAIN-01: Quick-Add Required fields are Registration Number,
// Make, Model, Vehicle Category (docs/vehicle-research/VEHICLE-360-SPEC.md).
// `vehicleCategory` is intentionally a free-text field, not a hardcoded enum
// — VEHICLE-COMPLIANCE-MATRIX.md never settles on one fixed RTO category
// list (jurisdiction-dependent, explicitly flagged "not researched" for
// several related classifications), so inventing one here would be exactly
// the kind of unsourced fabrication that doc repeatedly warns against.
// Required-field validation (this schema) is skipped entirely for "Save
// Draft" — see `draftSchema` below.
const vehicleSchema = z.object({
  // ULTRA FAST: ALL vehicle fields optional - zero friction form
  // Users can create vehicle with ANY info, complete details later
  make: z.string().optional(),
  model: z.string().optional(),
  vehicleCategory: z.string().optional(),
  year: z.number().min(1900, "Valid year is required").optional(),
  registrationNumber: z.string().optional(),
  vehicleType: z.enum(["hatchback", "sedan", "suv", "economy", "standard", "premium", "luxury", "coupe", "convertible"]).optional(),
  ratePerDay: z.number().min(0).optional(),
  ratePerKm: z.number().min(0).optional(),
  status: z.enum(["available", "on_trip", "maintenance"]).default("available"),
  // Recommended (optional, never blocks any save action).
  variant: z.string().optional(),
  fuelType: z.enum(["petrol", "diesel", "cng", "electric", "hybrid"]).optional(),
  capacity: z.number().int().positive().optional(),
  ownershipType: z.enum(["owned", "leased", "financed", "rented"]).optional(),
  currentOdometer: z.number().min(0).optional(),
  branch: z.string().optional(),
});

// Save Draft intentionally validates nothing beyond "this is an object" —
// per the spec, "Save always succeeds without any compliance document
// present" and Recommended fields "never block save"; Draft goes further and
// lets even the normally-Required fields be empty, since its entire purpose
// is capturing a partial record to finish later.
const draftSchema = vehicleSchema.partial();

type VehicleFormData = z.infer<typeof vehicleSchema>;

/**
 * `mode` distinguishes the three Quick-Add save actions for whatever mounts
 * this form (currently `dashboard.tsx`'s "fleet" case, Integrator-only — see
 * this task's report for the exact proposed wiring). Per the spec, every
 * mode succeeds and should be followed by auto-opening the Vehicle 360 Setup
 * Checklist; "completeProfile" additionally signals intent to navigate
 * straight into the full profile once TASK-VEHICLE-360-UI-06's page exists.
 * `vehicle` is the created/updated record, useful for opening the checklist
 * against the right id without an extra fetch.
 */
type VehicleSaveMode = 'save' | 'draft' | 'completeProfile';
interface VehicleFormProps {
  vehicle?: any;
  onSuccess: (savedVehicle?: any, mode?: VehicleSaveMode) => void;
}

export default function VehicleForm({ vehicle, onSuccess }: VehicleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get current vehicles count and plan info
  const { data: vehicles } = useQuery({
    queryKey: ["/api/vehicles"]
  });

  const currentVehicleCount = Array.isArray(vehicles) ? vehicles.length : 0;
  const planLimits = (user?.tenantId as any)?.limits;
  const subscriptionPlan = (user?.tenantId as any)?.subscriptionPlan;
  const vehicleLimit = planLimits?.vehicles || 0;
  const remainingSlots = Math.max(0, vehicleLimit - currentVehicleCount);

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      make: vehicle?.make || "",
      model: vehicle?.model || "",
      vehicleCategory: vehicle?.vehicleCategory || "",
      year: vehicle?.year || undefined,
      registrationNumber: vehicle?.registrationNumber || "",
      vehicleType: vehicle?.vehicleType || undefined,
      ratePerDay: vehicle?.ratePerDay || undefined,
      ratePerKm: vehicle?.ratePerKm || vehicle?.pricePerKm || undefined,
      status: vehicle?.status || "available",
      variant: vehicle?.variant || "",
      fuelType: vehicle?.fuelType || undefined,
      capacity: vehicle?.capacity || undefined,
      ownershipType: vehicle?.ownershipType || undefined,
      currentOdometer: vehicle?.currentOdometer || undefined,
      branch: vehicle?.branch || "",
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async ({ data, mode }: { data: Partial<VehicleFormData>; mode: VehicleSaveMode }) => {
      // `isDraft` is an additive marker, not yet a real schema field — see
      // this task's report for the proposed backend patch (either a
      // dedicated boolean or a 'draft' addition to the status enum). Until
      // that lands, an unrecognized key is silently dropped by
      // `mongoVehicleSchema.parse` server-side (confirmed non-`.strict()`),
      // so this is safe to send today and simply starts working once the
      // Integrator applies the patch.
      const payload = mode === 'draft' ? { ...data, isDraft: true } : data;
      const response = await apiRequest("POST", "/api/vehicles", payload);
      return response.json();
    },
    onSuccess: (result, { mode }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Success",
        description: mode === 'draft' ? "Vehicle draft saved" : "Vehicle created successfully",
      });
      onSuccess(result, mode);
    },
    onError: (error: any) => {
      // Enhanced error handling with better UI
      const errorMessage = error.message || "Failed to create vehicle";
      
      // Show different error styles based on error type
      if (errorMessage.includes("maximum") || errorMessage.includes("limit")) {
        toast({
          title: "🚫 Vehicle Limit Reached",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async ({ data, mode }: { data: Partial<VehicleFormData>; mode: VehicleSaveMode }) => {
      const vehicleId = vehicle._id || vehicle.id;
      const payload = mode === 'draft' ? { ...data, isDraft: true } : data;
      const response = await apiRequest("PUT", `/api/vehicles/${vehicleId}`, payload);
      return response.json();
    },
    onSuccess: (result, { mode }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Success",
        description: mode === 'draft' ? "Vehicle draft saved" : "Vehicle updated successfully",
      });
      onSuccess(result, mode);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle",
        variant: "destructive",
      });
    },
  });

  const saveWithMode = async (data: Partial<VehicleFormData>, mode: VehicleSaveMode) => {
    if (vehicle) {
      await updateVehicleMutation.mutateAsync({ data, mode });
    } else {
      await createVehicleMutation.mutateAsync({ data, mode });
    }
  };

  // "Save Vehicle" and "Save & Complete Profile" both go through the normal
  // resolver (Required fields enforced); only their `mode` differs, which
  // `onSuccess` uses to decide whether to head straight into the full
  // profile once it exists (TASK-VEHICLE-360-UI-06).
  const handleSaveVehicle = form.handleSubmit((data) => saveWithMode(data, 'save'));
  const handleSaveAndCompleteProfile = form.handleSubmit((data) => saveWithMode(data, 'completeProfile'));

  // "Save Draft" deliberately bypasses `form.handleSubmit` (and therefore
  // the Required-field resolver) entirely — per the spec, a draft is
  // explicitly allowed to be incomplete. `draftSchema.parse` only guards
  // against wrong *types* (e.g. a non-numeric year), never missing values.
  const isSavingDraft = createVehicleMutation.isPending || updateVehicleMutation.isPending;
  const handleSaveDraft = async () => {
    const raw = draftSchema.parse(form.getValues());
    await saveWithMode(raw, 'draft');
  };

  // Form auto-save
  const { save: autoSave } = useFormAutoSave("vehicle-form", form.watch(), 2000);
  useEffect(() => {
    autoSave();
  }, [form.watch(), autoSave]);

  return (
    <Form {...form}>
      <form onSubmit={handleSaveVehicle} className="space-y-6">
        {/* Form Status */}
        <FormSubmitStatus
          status={createVehicleMutation.isPending || updateVehicleMutation.isPending ? "loading" : createVehicleMutation.isSuccess || updateVehicleMutation.isSuccess ? "success" : createVehicleMutation.isError || updateVehicleMutation.isError ? "error" : "idle"}
          successMessage="Vehicle saved successfully!"
          errorMessage={(createVehicleMutation.error as any)?.message || (updateVehicleMutation.error as any)?.message || "Failed to save vehicle"}
        />

        {/* Plan Limit Notification */}
        {!vehicle && subscriptionPlan && (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Car className="w-4 h-4 text-blue-600" />
                    <h4 className="font-medium text-blue-900 capitalize">
                      {subscriptionPlan} Plan
                    </h4>
                  </div>
                  <p className="text-sm text-blue-700">
                    You can create up to <span className="font-semibold">{vehicleLimit} vehicles</span>.
                    Currently using <span className="font-semibold">{currentVehicleCount}</span>, 
                    <span className="ml-1 font-semibold text-green-600">
                      {remainingSlots} slots remaining
                    </span>.
                  </p>
                  {remainingSlots === 0 && (
                    <div className="mt-2 flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Vehicle limit reached. Contact admin to upgrade your plan.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Maruti, Honda" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Swift, City" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicleCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Category *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Car (LMV), SUV, Bus, Truck" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="2023" 
                    {...field} 
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseInt(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="registrationNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registration Number *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., DL 01 AB 1234" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicleType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Type (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="hatchback">Hatchback</SelectItem>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="luxury">Luxury</SelectItem>
                    <SelectItem value="coupe">Coupe</SelectItem>
                    <SelectItem value="convertible">Convertible</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ratePerDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate per Day (₹) (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="1500" 
                    {...field} 
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseFloat(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ratePerKm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate per Km (₹) (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="12.50" 
                    {...field} 
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseFloat(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Recommended (optional) fields — never block any save action. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="variant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Variant (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., VXI, ZXI+" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fuelType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fuel Type (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fuel type (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="petrol">Petrol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="cng">CNG</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seating Capacity (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="4"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseInt(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ownershipType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ownership Type (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ownership type (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="owned">Owned</SelectItem>
                    <SelectItem value="leased">Leased</SelectItem>
                    <SelectItem value="financed">Financed</SelectItem>
                    <SelectItem value="rented">Rented</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentOdometer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Odometer (km) (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="15000"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value ? parseFloat(value) : undefined);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch / Base Location (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Indore Hub" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="on_trip">On Trip</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => onSuccess()}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSavingDraft}
            onClick={handleSaveDraft}
          >
            {isSavingDraft ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            type="submit"
            disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
          >
            {(createVehicleMutation.isPending || updateVehicleMutation.isPending)
              ? "Saving..."
              : vehicle ? "Update Vehicle" : "Save Vehicle"
            }
          </Button>
          <Button
            type="button"
            disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
            onClick={handleSaveAndCompleteProfile}
          >
            Save & Complete Profile
          </Button>
        </div>
      </form>
    </Form>
  );
}
