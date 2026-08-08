import { safeRandomUUID } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar, MapPin, Clock, Car, User, CreditCard, ArrowRight, ArrowLeft, Check, Phone, Mail, IndianRupee, Download, ChevronDown, ChevronRight, Building2, Send, AlertTriangle, HelpCircle, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import html2pdf from 'html2pdf.js';
import BookingConfirmationPDF from "./booking-confirmation-pdf";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";

const bookingSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number too long"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  bookingSource: z.enum(["direct_customer", "walk_in", "phone_call", "whatsapp", "website", "google_business_profile",
    "google_ads", "facebook", "instagram", "hotel", "corporate_client", "travel_agent", "vendor_partner",
    "referral", "online_travel_platform", "repeat_customer", "other"]).default("direct_customer"),
  // Only meaningful (and shown) when bookingSource is an external/agent
  // source — see EXTERNAL_SOURCE_TYPES below. Kept optional at the schema
  // level since Zod's static shape can't see the sibling field; required-
  // when-applicable is enforced at submit time instead (same pattern the
  // rest of this multi-step form already uses for step validation).
  sourceName: z.string().optional(),
  sourceContact: z.string().optional(),
  // Optional link to a real Vendor Master record — when set, sourceName/
  // sourceContact above are auto-filled from it but stay editable/
  // overridable, and remain the actual display fields either way.
  sourceVendorId: z.string().optional(),
  sourceReferenceNumber: z.string().optional(),
  sourceCommissionType: z.enum(["flat", "percentage"]).optional(),
  sourceCommissionAmount: z.number().min(0).optional(),
  sourceNotes: z.string().optional(),
  // Optional as of the flexible-fulfilment initiative — a booking may be
  // confirmed with the physical vehicle still unresolved (Vendor Vehicle
  // or Outsource path). The step-2 Continue button and final submit both
  // enforce the real business rule (own vehicle selected, OR a vendor
  // vehicle selected, OR resourceMode acknowledges sourcing is pending)
  // via resourceMode/resourceAssignmentPending, not this schema.
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  bookingType: z.enum(["self_drive", "with_driver"]),
  tripType: z.enum(["one_way", "round_trip", "local", "airport"]),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropoffLocation: z.string().min(1, "Drop-off location is required"),
  // Date-certainty axis (TASK-BOOKING-UI-04, field contract from
  // TASK-BOOKING-DOMAIN-02): pickupDate/pickupTime/returnDate/returnTime
  // are relaxed from unconditionally-required to structurally optional
  // here, the same pattern already used for vehicleId above — the real
  // "required when travelDateStatus is 'confirmed' (the default)" rule is
  // enforced procedurally, by the Step 1 Continue button below, not by
  // this static Zod shape (mirrors how the vehicle/resourceMode
  // requirement is enforced by the Step 2 Continue button instead of the
  // schema). NOTE: the server-side counterpart of this relaxation
  // (mongoBookingSchemaWithCertainty) is DOMAIN-02's proposed patch,
  // not yet applied to this branch's backend — see this task's report.
  pickupDate: z.string().optional(),
  pickupTime: z.string().optional(),
  returnDate: z.string().optional(),
  returnTime: z.string().optional(),
  // travelDateStatus/tentativeStartDate/tentativeEndDate/followUpAt: real
  // field names from TASK-BOOKING-DOMAIN-02's report — do not rename.
  // lastActivityAt is deliberately NOT a client field (server-derived only,
  // per that report).
  travelDateStatus: z.enum(["confirmed", "range", "not_decided"]).default("confirmed"),
  tentativeStartDate: z.string().optional(),
  tentativeEndDate: z.string().optional(),
  followUpAt: z.string().optional(),
  amount: z.number().min(1, "Amount is required"),
  totalKilometers: z.number().min(0).optional(),
  tollCharges: z.number().min(0, "Toll charges must be 0 or greater").optional(),
  parkingCharges: z.number().min(0, "Parking charges must be 0 or greater").optional(),
  petrolCharges: z.number().min(0, "Petrol charges must be 0 or greater").optional(),
  dieselCharges: z.number().min(0, "Diesel charges must be 0 or greater").optional(),
  cngCharges: z.number().min(0, "CNG charges must be 0 or greater").optional(),
  miscellaneousAmount: z.number().min(0, "Miscellaneous amount must be 0 or greater").optional(),
  miscellaneousDescription: z.string().optional(),
  pricingType: z.enum(["day", "km"]).optional(),
  notes: z.string().optional(),
  customerDiscussionSummary: z.string().optional(),
  // Third-party driver fields
  useThirdPartyDriver: z.boolean().optional(),
  thirdPartyDriverName: z.string().optional(),
  thirdPartyDriverCharges: z.number().min(0, "Third-party driver charges must be 0 or greater").optional(),
  // Advance Payment — recorded as a real ledger transaction on the
  // backend (see routes.ts), not just a raw number on the booking.
  advanceRequested: z.number().min(0).optional(),
  advanceReceived: z.number().min(0).optional(),
  advancePaymentMode: z.enum(["cash", "upi", "bank_transfer", "card", "payment_gateway", "driver_collection", "vendor_collection", "credit"]).optional(),
  advanceTransactionReference: z.string().optional(),
  advanceReceivedBy: z.string().optional(),
  advancePaymentNotes: z.string().optional(),
  driverCollectionAmount: z.number().min(0).optional(),
  collectionMode: z.enum(["company", "driver", "vendor", "split"]).optional(),
  redeemPoints: z.number().min(0).optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

// Sources where the booking was actually brought in by an outside
// party — these need the vendor/agent detail block (reference number,
// contact, commission) filled in so the source ledger and profitability
// report can attribute revenue and commission correctly. Pure in-house
// sources (walk-in, phone, WhatsApp, website, ads, repeat customer) never
// need commission tracking, so the extra fields stay hidden for those.
const EXTERNAL_SOURCE_TYPES = new Set(["hotel", "corporate_client", "travel_agent", "vendor_partner", "referral", "online_travel_platform"]);

interface EnhancedBookingFormProps {
  onSuccess: (booking?: any) => void;
  // Pre-fills the form (e.g. from a Lead/Inquiry/accepted Quotation being
  // converted into a booking, spec §24 "Do not re-enter the same
  // information manually") without skipping any validation, availability
  // check, or the vehicle/driver picker itself — the user still completes
  // and submits through this exact same form and the existing
  // POST /api/bookings endpoint, unchanged.
  initialValues?: Partial<BookingFormData>;
}

// Small, presentational-only status line for the referral search/code
// inputs — "type more", "searching", "found", or "not found", never
// silently blank so the user always knows whether a referral will
// actually be captured on submit.
function referralLookupStatus(inputValue: string, minLength: number, pending: boolean, resolved: { name: string; primaryMobile: string } | null) {
  const trimmed = inputValue.trim();
  const long = (minLength === 10 ? trimmed.replace(/\D/g, "").length : trimmed.length) >= minLength;
  if (!long) return null;
  if (pending) return <p className="text-xs text-gray-500">Looking up referrer…</p>;
  if (resolved) return <p className="text-xs text-green-700 font-medium">Referrer found: {resolved.name} ({resolved.primaryMobile})</p>;
  return <p className="text-xs text-red-600">No matching customer found — this booking will not be linked to a referral.</p>;
}

// Date-certainty option metadata (TASK-BOOKING-UI-04). Three states only,
// matching travelDateStatus exactly (TASK-BOOKING-DOMAIN-02's real,
// shipped field name/values) — do not add a fourth or rename these.
const DATE_CERTAINTY_OPTIONS = [
  { value: "confirmed" as const, label: "Confirmed Date", desc: "Customer knows exactly when they're traveling.", icon: Calendar },
  { value: "range" as const, label: "Sometime in a Range", desc: "Customer has a rough window in mind.", icon: CalendarRange },
  { value: "not_decided" as const, label: "Not Decided Yet", desc: "Date isn't fixed — we'll follow up later.", icon: HelpCircle },
];

// Combines the two independent axes — date-certainty (this task,
// travelDateStatus) and resource-fulfilment (already shipped on the
// inherited branch, resourceMode/selection state) — into ONE coherent
// summary sentence instead of two disconnected badges (spec: "Confirmed
// date, vendor sourcing in progress" as a single line). Reads the
// existing resourceMode/selection values as given; does not change how
// they are computed or what they mean.
function describeCombinedBookingStatus(
  travelDateStatus: "confirmed" | "range" | "not_decided",
  resourceMode: "own_fleet" | "vendor_vehicle" | "outsource",
  hasOwnVehicleSelected: boolean,
  hasVendorVehicleSelected: boolean,
): string {
  const datePhrase =
    travelDateStatus === "confirmed" ? "Confirmed date" :
    travelDateStatus === "range" ? "Flexible date window" :
    "Date not decided yet";

  const resourcePhrase =
    resourceMode === "own_fleet"
      ? (hasOwnVehicleSelected ? "own fleet vehicle assigned" : "own fleet vehicle not yet selected")
      : resourceMode === "vendor_vehicle"
      ? (hasVendorVehicleSelected ? "vendor vehicle selected" : "vendor vehicle sourcing pending")
      : "vendor sourcing in progress";

  return `${datePhrase}, ${resourcePhrase}`;
}

export default function EnhancedBookingForm({ onSuccess, initialValues }: EnhancedBookingFormProps) {
  const [step, setStep] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedPricingType, setSelectedPricingType] = useState<"day" | "km" | "">("");
  // Flexible fulfilment (spec: "Non-Blocking Booking, Vendor/Outsource
  // Vehicle Fulfilment"). "own_fleet" preserves today's exact flow.
  // "vendor_vehicle"/"outsource" let Step 2 be completed without a
  // resolved company vehicle — see docs/BOOKING_RESOURCE_DEAD_END_AUDIT.md.
  const [resourceMode, setResourceMode] = useState<"own_fleet" | "vendor_vehicle" | "outsource">("own_fleet");
  // Self-drive booking-time capture (spec §1-§2, §10): deposit stays a
  // held amount strictly outside fare/advance math; late policy rides to
  // the SelfDriveTrip record right after creation.
  const [sdOps, setSdOps] = useState({
    depositAmount: "", depositMode: "cash", depositReceived: false, depositReference: "",
    lateGrace: "30", lateRate: "200", lateUnit: "per_hour",
  });
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedVendorVehicleId, setSelectedVendorVehicleId] = useState<string>("");
  const [selectedVendorDriverId, setSelectedVendorDriverId] = useState<string>("");
  // Quick Add (spec §13/§9) — add a new Vendor or a new vehicle for the
  // selected Vendor without leaving the wizard. Both reuse the existing,
  // already-tested POST /api/vendors and POST /api/vendors/:id/vehicles
  // routes verbatim (duplicate-mobile / duplicate-registration rejection
  // already enforced there) — no new backend logic, only this dialog UI.
  const [showQuickAddVendor, setShowQuickAddVendor] = useState(false);
  const [quickVendorName, setQuickVendorName] = useState("");
  const [quickVendorContact, setQuickVendorContact] = useState("");
  const [quickVendorMobile, setQuickVendorMobile] = useState("");
  const [showQuickAddVehicle, setShowQuickAddVehicle] = useState(false);
  const [quickVehicleReg, setQuickVehicleReg] = useState("");
  const [quickVehicleModel, setQuickVehicleModel] = useState("");
  const [quickVehicleCategory, setQuickVehicleCategory] = useState("");
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [routeType, setRouteType] = useState<"custom" | "local" | "not_decided">("custom");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  // Referral capture (spec §28) — kept entirely separate from the
  // Booking Source panel above: a Referral is a rewarded relationship
  // between two real Customer records, not a free-text source-category
  // tag. "external"/"hotel_agent_vendor" referral modes intentionally do
  // NOT create a tracked Referral (no real referrer Customer exists to
  // link) — use the existing Booking Source panel for those instead.
  const [referralMode, setReferralMode] = useState<"none" | "existing_customer" | "referral_code">("none");
  const [referralSearch, setReferralSearch] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [resolvedReferrer, setResolvedReferrer] = useState<{ _id: string; name: string; primaryMobile: string } | null>(null);
  // Progressive disclosure for Review & Confirm (spec: "daily-use fields
  // first, expandable detailed sections") — fuel deductions and misc.
  // expenses are normally settled at trip-end, not at booking time, so
  // they start collapsed. Purely a display toggle: no field, validation,
  // or submit-payload change.
  const [showMoreCharges, setShowMoreCharges] = useState(false);
  // One key per booking-creation attempt (this mount, or since the last
  // "Create New Booking" reset) — reused across a retried submit of the
  // SAME booking (e.g. clicking Confirm again after a dropped response),
  // regenerated whenever the form is deliberately reset to start a
  // genuinely new booking. See server/routes.ts's POST /api/bookings
  // duplicate-request guard.
  const bookingIdempotencyKeyRef = useRef<string>(safeRandomUUID());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const totalSteps = 4;

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    mode: "onChange",
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      bookingSource: "direct_customer",
      sourceName: "",
      sourceContact: "",
      sourceVendorId: "",
      sourceReferenceNumber: "",
      sourceCommissionType: undefined,
      sourceCommissionAmount: undefined,
      sourceNotes: "",
      vehicleId: "",
      driverId: "",
      bookingType: "self_drive",
      tripType: "one_way",
      pickupLocation: "",
      dropoffLocation: "",
      pickupDate: "",
      pickupTime: "",
      returnDate: "",
      returnTime: "",
      travelDateStatus: "confirmed",
      tentativeStartDate: "",
      tentativeEndDate: "",
      followUpAt: "",
      amount: 0,
      tollCharges: 0,
      parkingCharges: 0,
      petrolCharges: 0,
      dieselCharges: 0,
      cngCharges: 0,
      miscellaneousAmount: 0,
      miscellaneousDescription: "",
      pricingType: "day",
      notes: "",
      customerDiscussionSummary: "",
      advanceRequested: undefined,
      advanceReceived: undefined,
      advancePaymentMode: "cash",
      advanceTransactionReference: "",
      advanceReceivedBy: "",
      advancePaymentNotes: "",
      driverCollectionAmount: undefined,
      collectionMode: "company",
      redeemPoints: undefined,
    },
  });

  // Applies a Lead-conversion prefill exactly once, on mount, without
  // touching anything the user has already typed if this effect somehow
  // re-ran (it shouldn't, since initialValues is only ever set once by
  // the caller for a fresh "Convert to Booking" navigation).
  useEffect(() => {
    if (initialValues) {
      form.reset({ ...form.getValues(), ...initialValues });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watchedValues = form.watch();

  // Booking wizard draft persistence (auto-save + resume). Deliberately
  // scoped OFF for a Lead-conversion prefill session (initialValues present)
  // — that flow already has its own source of truth (the Lead) and was
  // built/tested as a self-contained path in the previous phase; layering
  // draft-resume on top would only add risk to an already-verified flow for
  // a case (someone abandoning a Lead-conversion mid-way) the spec's actual
  // ask — "don't lose organic Add Booking progress" — doesn't cover.
  const draftEnabled = !initialValues;
  const [draftChecked, setDraftChecked] = useState(!draftEnabled);
  const [pendingDraft, setPendingDraft] = useState<{ step: number; formData: any } | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a race where the mount-time "is there an existing
  // draft?" GET resolves only after the user has already started typing
  // (slow network, or this session's own debounced autosave already fired)
  // — without this, a fast typist could get interrupted by a "resume?"
  // prompt for what is actually their own just-created progress.
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    if (form.formState.isDirty) hasInteractedRef.current = true;
  }, [form.formState.isDirty]);

  useEffect(() => {
    if (!draftEnabled) return;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/booking-drafts/mine");
        const draft = await res.json();
        if (!hasInteractedRef.current && draft && (draft.step > 1 || draft.formData?.customerName || draft.formData?.pickupLocation)) {
          setPendingDraft({ step: draft.step || 1, formData: draft.formData || {} });
        }
      } catch {
        // No draft, or the fetch failed — proceed with a fresh form either way.
      } finally {
        setDraftChecked(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeDraft = () => {
    if (!pendingDraft) return;
    const { __resourceMode, ...draftFormData } = pendingDraft.formData || {};
    form.reset({ ...form.getValues(), ...draftFormData });
    // Re-sync the selection state that lives OUTSIDE react-hook-form and is
    // therefore not covered by form.reset(): the Vehicle step's gate,
    // pricing UI, and the submit payload's resource-mode branch all read
    // these. Without this, a resumed draft looked complete but submitted an
    // own-fleet booking with no vehicle (always a server 400) whenever the
    // draft was saved on a Vendor/Outsource path — resourceMode silently
    // reset to "own_fleet".
    if (__resourceMode === "own_fleet" || __resourceMode === "vendor_vehicle" || __resourceMode === "outsource") {
      setResourceMode(__resourceMode);
    }
    if (draftFormData.vehicleId) setSelectedVehicleId(draftFormData.vehicleId);
    if (draftFormData.pricingType) setSelectedPricingType(draftFormData.pricingType);
    setStep(pendingDraft.step);
    setPendingDraft(null);
  };

  const discardDraft = () => {
    setPendingDraft(null);
    apiRequest("DELETE", "/api/booking-drafts/mine").catch(() => {});
  };

  // Debounced auto-save: only once the initial "resume?" decision is
  // settled (so we never overwrite a just-fetched draft with the form's
  // still-default values), only once the user has actually typed something,
  // and never after a booking has already been confirmed in this session.
  useEffect(() => {
    if (!draftEnabled || !draftChecked || pendingDraft || bookingConfirmed) return;
    if (!form.formState.isDirty) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      // __resourceMode rides inside formData (Mixed on the server) so the
      // resume path can restore the fulfilment mode — it is stripped back
      // out before form.reset() in resumeDraft().
      apiRequest("PUT", "/api/booking-drafts/mine", { step, formData: { ...watchedValues, __resourceMode: resourceMode } }).catch(() => {});
    }, 1200);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues, step, resourceMode, draftChecked, pendingDraft, bookingConfirmed]);

  // Fetch available vehicles.
  // P0 FIX (flexible-fulfilment initiative): this used to omit
  // pickupTime/returnTime entirely, same bug already fixed for driver
  // availability just below — see docs/FLEXIBLE_PIPELINE_CURRENT_AUDIT.md §2.
  const { data: availableVehicles } = useQuery({
    queryKey: ["/api/vehicles/available", watchedValues.pickupDate, watchedValues.pickupTime, watchedValues.returnDate, watchedValues.returnTime],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const params = new URLSearchParams({
        pickupDate: watchedValues.pickupDate,
        returnDate: watchedValues.returnDate,
      });
      if (watchedValues.pickupTime) params.set('pickupTime', watchedValues.pickupTime);
      if (watchedValues.returnTime) params.set('returnTime', watchedValues.returnTime);
      const response = await fetch(`/api/vehicles/available?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate),
  });

  // Fetch available drivers.
  // P0 FIX: this used to omit pickupTime/returnTime from both the query
  // key and the request entirely — the backend received only the calendar
  // dates, so two same-day bookings with different, overlapping times
  // (e.g. an existing 2pm-10pm duty vs. a new 3pm-11pm one) could never be
  // detected as conflicting. A driver already on duty kept showing up as
  // "available" in this dropdown. includeUnavailable=true also pulls back
  // conflicting drivers (with a reason) so they can be shown, disabled,
  // in their own section instead of just vanishing from the list.
  const { data: driverAvailabilityRows } = useQuery({
    queryKey: ["/api/drivers/available", watchedValues.pickupDate, watchedValues.pickupTime, watchedValues.returnDate, watchedValues.returnTime],
    queryFn: async () => {
      if (!watchedValues.pickupDate || !watchedValues.returnDate) return [];
      const params = new URLSearchParams({
        pickupDate: watchedValues.pickupDate,
        returnDate: watchedValues.returnDate,
        includeUnavailable: 'true',
      });
      if (watchedValues.pickupTime) params.set('pickupTime', watchedValues.pickupTime);
      if (watchedValues.returnTime) params.set('returnTime', watchedValues.returnTime);
      const response = await fetch(`/api/drivers/available?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch drivers');
      return response.json();
    },
    enabled: !!(watchedValues.pickupDate && watchedValues.returnDate && watchedValues.bookingType === "with_driver"),
  });
  const availableDrivers = (driverAvailabilityRows || []).filter((d: any) => d.available !== false);
  const unavailableDrivers = (driverAvailabilityRows || []).filter((d: any) => d.available === false);

  // Vendor Vehicle fulfilment path — reuses the existing, already-tested
  // Vendor Master / VendorVehicle / VendorDriver data (see
  // docs/VENDOR_OUTSOURCE_WORKFLOW_AUDIT.md); nothing here is new backend
  // logic, only wiring it into the wizard at creation time. The
  // active-vendors list itself is fetched once, below (activeVendors),
  // shared with the pre-existing Booking Source panel's "link to Vendor
  // Master" select — both need the identical `/api/vendors?status=active`
  // data, so this path just widens that query's `enabled` condition
  // instead of duplicating it.

  const { data: vendorVehiclesList } = useQuery({
    queryKey: ["/api/vendors", selectedVendorId, "vehicles", watchedValues.pickupDate, watchedValues.pickupTime, watchedValues.returnDate, watchedValues.returnTime],
    queryFn: async () => {
      const vehicles = await (await fetch(`/api/vendors/${selectedVendorId}/vehicles`)).json();
      const params = new URLSearchParams();
      if (watchedValues.pickupDate) params.set('pickupDate', watchedValues.pickupDate);
      if (watchedValues.pickupTime) params.set('pickupTime', watchedValues.pickupTime);
      if (watchedValues.returnDate) params.set('returnDate', watchedValues.returnDate);
      if (watchedValues.returnTime) params.set('returnTime', watchedValues.returnTime);
      const withAvailability = await Promise.all((vehicles || []).map(async (v: any) => {
        const availRes = await fetch(`/api/vendors/${selectedVendorId}/vehicles/${v._id || v.id}/availability?${params.toString()}`);
        const avail = availRes.ok ? await availRes.json() : { available: true };
        return { ...v, ...avail };
      }));
      return withAvailability;
    },
    enabled: resourceMode === "vendor_vehicle" && !!selectedVendorId && !!watchedValues.pickupDate && !!watchedValues.returnDate,
  });

  const { data: vendorDriversList } = useQuery({
    queryKey: ["/api/vendors", selectedVendorId, "drivers", watchedValues.pickupDate, watchedValues.pickupTime, watchedValues.returnDate, watchedValues.returnTime],
    queryFn: async () => {
      const drivers = await (await fetch(`/api/vendors/${selectedVendorId}/drivers`)).json();
      const params = new URLSearchParams();
      if (watchedValues.pickupDate) params.set('pickupDate', watchedValues.pickupDate);
      if (watchedValues.pickupTime) params.set('pickupTime', watchedValues.pickupTime);
      if (watchedValues.returnDate) params.set('returnDate', watchedValues.returnDate);
      if (watchedValues.returnTime) params.set('returnTime', watchedValues.returnTime);
      const withAvailability = await Promise.all((drivers || []).map(async (d: any) => {
        const availRes = await fetch(`/api/vendors/${selectedVendorId}/drivers/${d._id || d.id}/availability?${params.toString()}`);
        const avail = availRes.ok ? await availRes.json() : { available: true };
        return { ...d, ...avail };
      }));
      return withAvailability;
    },
    enabled: resourceMode === "vendor_vehicle" && !!selectedVendorId && !!watchedValues.pickupDate && !!watchedValues.returnDate,
  });

  const quickAddVendorMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/vendors", {
        companyName: quickVendorName.trim(),
        contactPerson: quickVendorContact.trim(),
        primaryMobile: quickVendorMobile.trim(),
      });
      return response.json();
    },
    onSuccess: async (vendor) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/vendors", "active"] });
      setSelectedVendorId(vendor._id || vendor.id);
      setSelectedVendorVehicleId("");
      setSelectedVendorDriverId("");
      setShowQuickAddVendor(false);
      setQuickVendorName(""); setQuickVendorContact(""); setQuickVendorMobile("");
      toast({ title: "Vendor added", description: `${vendor.companyName} is now available to select vehicles from.` });
    },
    onError: (err: any) => {
      toast({ title: "Could not add vendor", description: err?.message || "Please check the details and try again.", variant: "destructive" });
    },
  });

  const quickAddVehicleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/vendors/${selectedVendorId}/vehicles`, {
        registrationNumber: quickVehicleReg.trim(),
        vehicleModel: quickVehicleModel.trim(),
        category: quickVehicleCategory.trim(),
      });
      return response.json();
    },
    onSuccess: async (vehicle) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/vendors", selectedVendorId, "vehicles"] });
      setSelectedVendorVehicleId(vehicle._id || vehicle.id);
      setShowQuickAddVehicle(false);
      setQuickVehicleReg(""); setQuickVehicleModel(""); setQuickVehicleCategory("");
      toast({ title: "Vehicle added", description: `${vehicle.registrationNumber} is now selected for this booking.` });
    },
    onError: (err: any) => {
      toast({ title: "Could not add vehicle", description: err?.message || "Please check the registration number and try again.", variant: "destructive" });
    },
  });

  // Backward-edit revalidation (spec: "Travel Date changed -> Driver
  // Availability, Vehicle Availability... require review"). The two
  // queries above already refetch reactively when the date/time window
  // changes, but the SELECTED vehicleId/driverId already sitting in form
  // state was never revalidated against the new list — going back to
  // step 1, changing the date, then returning to step 2 could silently
  // carry forward a vehicle/driver that's no longer actually available,
  // surfacing only as a generic error at final submit. This clears a
  // stale selection and explains why, the moment fresh availability data
  // for the new window arrives — never on first load (only a real
  // in-place edit), and never a false clear of a still-valid selection.
  const availabilityWindowKey = `${watchedValues.pickupDate}|${watchedValues.pickupTime}|${watchedValues.returnDate}|${watchedValues.returnTime}`;
  const prevAvailabilityWindowKeyRef = useRef(availabilityWindowKey);
  const revalidationArmedRef = useRef(false);
  useEffect(() => {
    if (prevAvailabilityWindowKeyRef.current !== availabilityWindowKey) {
      prevAvailabilityWindowKeyRef.current = availabilityWindowKey;
      revalidationArmedRef.current = true;
    }
  }, [availabilityWindowKey]);
  useEffect(() => {
    if (!revalidationArmedRef.current) return;
    if (availableVehicles === undefined && driverAvailabilityRows === undefined) return; // still refetching
    revalidationArmedRef.current = false;

    const vehicleList = Array.isArray(availableVehicles) ? availableVehicles : [];
    if (watchedValues.vehicleId && !vehicleList.some((v: any) => (v._id || v.id) === watchedValues.vehicleId)) {
      form.setValue("vehicleId", "");
      setSelectedVehicleId("");
      toast({
        title: "Review required: Vehicle selection",
        description: "The travel date/time changed, and your previously selected vehicle is no longer available for this window. Please choose again.",
        variant: "destructive",
      });
    }
    if (watchedValues.driverId && driverAvailabilityRows !== undefined) {
      const stillAvailable = availableDrivers.some((d: any) => (d._id || d.id) === watchedValues.driverId);
      if (!stillAvailable) {
        form.setValue("driverId", "");
        toast({
          title: "Review required: Driver selection",
          description: "The travel date/time changed, and your previously selected driver is no longer available for this window. Please choose again.",
          variant: "destructive",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVehicles, driverAvailabilityRows]);

  // Reward points lookup by the phone number already entered on step 3 —
  // shows the customer's real balance for "Apply Reward Points" on step
  // 4 without adding a separate customer-search step to the form.
  const { data: customerLookup } = useQuery<any>({
    queryKey: ["/api/customers/lookup", watchedValues.customerPhone],
    queryFn: async () => {
      const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(watchedValues.customerPhone)}`, { credentials: "include" });
      if (!res.ok) return { customer: null };
      return res.json();
    },
    enabled: !!(watchedValues.customerPhone && watchedValues.customerPhone.replace(/\D/g, "").length >= 10),
  });
  const rewardBalance = customerLookup?.customer?.rewardPointsBalance || 0;

  const { data: rewardRule } = useQuery<any>({
    queryKey: ["/api/reward-rules"],
    queryFn: async () => {
      const res = await fetch("/api/reward-rules", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });
  const redemptionValuePerPoint = rewardRule?.redemptionValuePerPoint ?? 1;
  const minPointsToRedeem = rewardRule?.minPointsToRedeem ?? 100;

  // Resolves a referrer by mobile or code as the user types, so the form
  // can show "Referrer found: <name>" for confirmation before capture
  // rather than sending the booking blind and finding out it failed.
  const { data: referrerLookup, isFetching: referrerLookupPending } = useQuery<{ referrer: { _id: string; name: string; primaryMobile: string } | null }>({
    queryKey: ["/api/referrals/resolve-referrer", referralMode, referralSearch, referralCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (referralMode === "existing_customer") params.set("mobile", referralSearch);
      if (referralMode === "referral_code") params.set("referralCode", referralCode);
      const res = await fetch(`/api/referrals/resolve-referrer?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return { referrer: null };
      return res.json();
    },
    enabled:
      (referralMode === "existing_customer" && referralSearch.replace(/\D/g, "").length >= 10) ||
      (referralMode === "referral_code" && referralCode.trim().length >= 6),
  });
  useEffect(() => {
    setResolvedReferrer(referrerLookup?.referrer || null);
  }, [referrerLookup]);

  // Active vendors — fetched when the Booking Source panel is showing
  // (its "link to Vendor Master" select) OR the Vendor Vehicle fulfilment
  // path is active (Step 2's vendor picker) — same data, two consumers.
  const { data: activeVendors } = useQuery<any[]>({
    queryKey: ["/api/vendors", "active"],
    queryFn: async () => {
      const res = await fetch("/api/vendors?status=active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: EXTERNAL_SOURCE_TYPES.has(watchedValues.bookingSource) || resourceMode === "vendor_vehicle",
  });

  // Tenant service-mode configuration: a Self-Drive-only or With-Driver-only
  // tenant never sees the other mode's selector; the form silently opens in
  // its single enabled mode. Until the query resolves, both stay available
  // (same as a both-modes tenant), so nothing flashes or blocks.
  const { data: tenantServiceModes } = useQuery<{ selfDrive: boolean; withDriver: boolean }>({
    queryKey: ["/api/tenant/service-modes"],
    queryFn: async () => {
      const res = await fetch("/api/tenant/service-modes", { credentials: "include" });
      if (!res.ok) return { selfDrive: true, withDriver: true };
      return res.json();
    },
  });
  const selfDriveEnabled = tenantServiceModes?.selfDrive !== false;
  const withDriverEnabled = tenantServiceModes?.withDriver !== false;
  const singleServiceMode: "self_drive" | "with_driver" | null =
    selfDriveEnabled !== withDriverEnabled
      ? (selfDriveEnabled ? "self_drive" : "with_driver")
      : null;
  useEffect(() => {
    if (singleServiceMode && form.getValues("bookingType") !== singleServiceMode) {
      form.setValue("bookingType", singleServiceMode);
      handleBookingTypeChange(singleServiceMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleServiceMode]);

  // Fetch business profile for logo
  const { data: businessProfile } = useQuery({
    queryKey: ['/api/auth/business-profile-for-documents'],
    queryFn: async () => {
      const response = await fetch('/api/auth/business-profile-for-documents', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch business profile');
      return response.json();
    }
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      // Calculate fuel cost (to be deducted)
      const totalFuelCost = (data.petrolCharges || 0) + (data.dieselCharges || 0) + (data.cngCharges || 0);
      
      // Calculate final total amount: base + toll + parking + misc - fuel
      // NOTE: Third-party driver charges are NOT deducted from the base amount
      // They are stored separately for revenue calculation
      const finalAmount = (data.amount || 0) + (data.tollCharges || 0) + (data.parkingCharges || 0) + (data.miscellaneousAmount || 0) - totalFuelCost;
      
      // Send data with the calculated final amount
      const bookingData = {
        ...data,
        amount: finalAmount,
        // Security deposit is held money, never revenue (Rule A/B): the
        // amount is snapshotted on the booking for the live cards; the
        // actual receipt is recorded through the self-drive deposit
        // endpoint right after creation (chained in onSuccess below).
        ...(data.bookingType === "self_drive" && Number(sdOps.depositAmount) > 0 ? {
          securityDepositAmount: Number(sdOps.depositAmount),
          securityDepositStatus: sdOps.depositReceived ? "collected" : "pending",
        } : {}),
        // Below the minimum, treat it as "not redeeming" rather than
        // sending a value the backend would just reject — the UI already
        // shows the minimum requirement inline while typing.
        redeemPoints: (data.redeemPoints && data.redeemPoints >= minPointsToRedeem) ? data.redeemPoints : undefined,
        // Reset third-party driver fields to default values
        useThirdPartyDriver: false,
        thirdPartyDriverName: "",
        thirdPartyDriverCharges: 0,
        idempotencyKey: bookingIdempotencyKeyRef.current,
        referral: referralMode !== "none" && resolvedReferrer
          ? {
              mode: referralMode,
              referrerCustomerId: referralMode === "existing_customer" ? resolvedReferrer._id : undefined,
              referralCode: referralMode === "referral_code" ? referralCode.trim().toUpperCase() : undefined,
            }
          : undefined,
      };

      // Flexible fulfilment: outside the Own Fleet path, vehicleId is
      // never resolved yet — an explicit resourceAssignmentPending
      // acknowledgement is sent instead (see server/routes.ts's
      // POST /api/bookings, docs/BOOKING_RESOURCE_DEAD_END_AUDIT.md).
      // Vendor vehicle linkage itself is NOT sent here — it's applied via
      // a follow-up assign-vendor call in onSuccess below, reusing that
      // route's real overlap/duty checks rather than duplicating them.
      if (resourceMode !== "own_fleet") {
        delete (bookingData as any).vehicleId;
        (bookingData as any).resourceAssignmentPending = true;
      }

      // TASK-BOOKING-UI-04: date-certainty payload shaping — independent
      // of the resourceMode block above. Only the fields relevant to the
      // selected travelDateStatus are sent; the other axis's now-empty
      // string fields (e.g. pickupDate="" for a 'range'/'not_decided'
      // booking) are dropped rather than sent as empty strings, matching
      // TASK-BOOKING-DOMAIN-02's field contract (absent, not empty-string).
      // lastActivityAt is never sent — server-derived only, per that task's
      // report.
      if ((bookingData as any).travelDateStatus !== "range") {
        delete (bookingData as any).tentativeStartDate;
        delete (bookingData as any).tentativeEndDate;
      }
      if ((bookingData as any).travelDateStatus !== "not_decided") {
        delete (bookingData as any).followUpAt;
      }
      if ((bookingData as any).travelDateStatus !== "confirmed") {
        delete (bookingData as any).pickupDate;
        delete (bookingData as any).pickupTime;
        delete (bookingData as any).returnDate;
        delete (bookingData as any).returnTime;
      }

      const response = await apiRequest("POST", "/api/bookings", bookingData);
      return response.json();
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (draftEnabled) {
        apiRequest("DELETE", "/api/booking-drafts/mine").catch(() => {});
      }

      // Vendor Vehicle path: link the selected vendor vehicle/driver via
      // the existing, already-tested assign-vendor endpoint immediately
      // after creation. Best-effort — a failure here (e.g. the vehicle
      // was taken by someone else in the few seconds since selection)
      // does not undo the booking itself; it just stays Resource Sourcing
      // Pending and can be assigned again from the booking's detail view.
      if (resourceMode === "vendor_vehicle" && selectedVendorId && selectedVendorVehicleId) {
        try {
          const assignRes = await apiRequest("POST", `/api/bookings/${result._id}/assign-vendor`, {
            fulfilmentVendorId: selectedVendorId,
            vendorVehicleId: selectedVendorVehicleId,
            vendorDriverId: selectedVendorDriverId || undefined,
          });
          Object.assign(result, await assignRes.json());
        } catch (err: any) {
          toast({
            title: "Booking saved, but vendor vehicle could not be linked",
            description: "You can assign the vendor vehicle again from the booking's detail view.",
            variant: "destructive",
          });
        }
      }

      // Outsource path: create the actual sourcing request so it's ready
      // to send to vendors from the booking's Resource Fulfilment panel —
      // best-effort, same reasoning as the vendor-vehicle follow-up above.
      // The Add Booking wizard only captures enough to start sourcing
      // (booking's own route/schedule); vendor selection, sending, and
      // quote comparison happen from that panel.
      if (resourceMode === "outsource") {
        try {
          await apiRequest("POST", `/api/bookings/${result._id}/sourcing-requests`, {
            quantity: 1,
          });
        } catch (err: any) {
          toast({
            title: "Booking saved, but a sourcing request could not be started",
            description: "You can start one from the booking's detail view.",
            variant: "destructive",
          });
        }
      }

      setCreatedBooking(result);
      setBookingConfirmed(true);
      // Self-drive chained setup — best-effort; failures surface as toasts
      // but never roll back the created booking (staff can redo them from
      // the workspace's Self-Drive tab).
      if (result?.bookingType === "self_drive" && (result?._id || result?.id)) {
        const sdId = result._id || result.id;
        if (sdOps.depositReceived && Number(sdOps.depositAmount) > 0) {
          apiRequest("POST", `/api/bookings/${sdId}/self-drive/deposit`, {
            amount: Number(sdOps.depositAmount), method: sdOps.depositMode,
            ...(sdOps.depositReference.trim() ? { reference: sdOps.depositReference.trim() } : {}),
          }).catch((err: any) => toast({ title: "Deposit receipt not recorded", description: String(err?.message || ""), variant: "destructive" }));
        }
        if (sdOps.lateGrace !== "30" || sdOps.lateRate !== "200" || sdOps.lateUnit !== "per_hour") {
          apiRequest("PATCH", `/api/bookings/${sdId}/self-drive/late-policy`, {
            graceMinutes: Number(sdOps.lateGrace) || 0, rate: Number(sdOps.lateRate) || 0, unit: sdOps.lateUnit,
          }).catch(() => {});
        }
      }
      toast({
        variant: "success",
        title: "Booking created successfully!",
        description: `Booking ID: ${result.bookingId}`,
      });
    },
    onError: (err: any) => {
      // apiRequest throws Error("<status>: <rawBody>") — parse it back
      // apart so a driver double-booking rejected right at submit time
      // (a driver could go from available to conflicted between the
      // dropdown loading and Confirm being clicked) shows the actual
      // conflict reason instead of a generic "please try again" that
      // gives staff no idea what to do differently.
      let description = "Please try again.";
      // apiRequest surfaces a 401 as a bare "Session expired" (this app is
      // single-session-per-user: logging in from another window/device ends
      // this one) — say that instead of a "try again" that cannot succeed.
      if (err?.message === "Session expired") {
        description = "This login was opened somewhere else, so this session ended. Log in again — your booking is saved as a draft.";
      }
      const match = /^(\d+):\s*([\s\S]*)$/.exec(err?.message || "");
      if (match) {
        try {
          const body = JSON.parse(match[2]);
          // Zod validation failures (400, "Invalid booking data") carry a
          // structured `errors` array pinpointing the exact field — e.g.
          // {path:["customerName"], message:"Customer name is required"}.
          // Surface that instead of the generic top-level message, which
          // was previously the only thing shown, making every validation
          // failure indistinguishable from every other one.
          if (Array.isArray(body?.errors) && body.errors.length > 0) {
            description = body.errors
              .map((e: any) => {
                const field = Array.isArray(e?.path) ? e.path.join('.') : undefined;
                return field ? `${field}: ${e.message}` : e.message;
              })
              .filter(Boolean)
              .join('; ');
          } else if (body?.message) {
            description = body.message;
          }
        } catch { /* not JSON, keep generic message */ }
      }
      toast({
        title: "Failed to create booking",
        description,
        variant: "destructive",
      });
    },
  });

  // Handle download e-receipt - generates PDF and shows WhatsApp share modal
  const handleDownloadReceipt = async () => {
    await generateConfirmationPDF();
  };

  // Generate confirmation PDF and show WhatsApp share modal
  const generateConfirmationPDF = async () => {
    if (!createdBooking) return;

    const vehicleArray = Array.isArray(availableVehicles) ? availableVehicles : [];
    const selectedVehicle = vehicleArray.find((v: any) => (v._id || v.id) === createdBooking.vehicleId);

    const confirmationData = {
      customerName: createdBooking.customerName,
      pickupLocation: createdBooking.pickupLocation,
      dropoffLocation: createdBooking.dropoffLocation,
      pickupDate: createdBooking.pickupDate,
      pickupTime: createdBooking.pickupTime,
      returnDate: createdBooking.returnDate,
      returnTime: createdBooking.returnTime,
      vehicleName: selectedVehicle?.make || 'Vehicle',
      bookingType: createdBooking.bookingType,
      bookingId: createdBooking.bookingId,
      companyLogo: businessProfile?.businessDetails?.logoUrl,
    };

    // Create a temporary container for the confirmation PDF
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    document.body.appendChild(tempDiv);

    // Render the confirmation template
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(tempDiv);
    
    return new Promise<void>((resolve) => {
      root.render(
        <BookingConfirmationPDF booking={confirmationData} />
      );

      // Wait for rendering to complete
      setTimeout(() => {
        const element = tempDiv.querySelector('#booking-confirmation-pdf');
        if (element) {
          const opt = {
            margin: 1,
            filename: `Booking_Confirmation_${createdBooking.bookingId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
          };

          html2pdf().set(opt).from(element).save().then(() => {
            document.body.removeChild(tempDiv);
            setShowConfirmationModal(true);
            resolve();
          });
        } else {
          document.body.removeChild(tempDiv);
          setShowConfirmationModal(true);
          resolve();
        }
      }, 100);
    });
  };

  // Generate WhatsApp share link
  const generateWhatsAppLink = () => {
    if (!createdBooking) return "";

    const customerPhone = createdBooking.customerPhone.replace(/[^\d]/g, ''); // Remove non-digits
    const phoneNumber = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;
    
    const getRouteText = () => {
      if (createdBooking.dropoffLocation === 'Local') {
        return `${createdBooking.pickupLocation} → Local`;
      } else if (createdBooking.dropoffLocation === 'Not Decided Yet') {
        return `${createdBooking.pickupLocation} → Not Decided`;
      } else {
        return `${createdBooking.pickupLocation} → ${createdBooking.dropoffLocation}`;
      }
    };

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    };

    const message = `Hello ${createdBooking.customerName}, your booking from ${getRouteText()} on ${formatDate(createdBooking.pickupDate)} has been confirmed. Please find the confirmation attached.`;
    
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, totalSteps));
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const onSubmit = async (data: BookingFormData) => {
    // A resumed draft restores form fields and step, but resourceMode is
    // component state that used to reset to its "own_fleet" default — that
    // combination (own fleet, no vehicle) reaches Confirm and is then
    // always rejected server-side (VEHICLE_OR_ASSIGNMENT_PENDING_REQUIRED).
    // Catch it before the doomed request and route the user to the Vehicle
    // step with a real instruction instead of a generic failure.
    if (resourceMode === "own_fleet" && !data.vehicleId) {
      toast({
        title: "Select a vehicle first",
        description: "Choose a vehicle from your fleet, or switch to Vendor Vehicle / Outsource on the Vehicle step to continue without one.",
        variant: "destructive",
      });
      setStep(2);
      return;
    }
    // An advance larger than the booking's own final total is an entry
    // mistake (extra collections belong in the ledger later, not here) —
    // catch it before submit so the money state can never start invalid.
    const finalTotal = (data.amount || 0) + (data.tollCharges || 0) + (data.parkingCharges || 0) + (data.miscellaneousAmount || 0)
      - (data.petrolCharges || 0) - (data.dieselCharges || 0) - (data.cngCharges || 0);
    if ((data.advanceReceived || 0) > finalTotal) {
      toast({
        title: "Advance exceeds total amount",
        description: `Advance Received (₹${data.advanceReceived}) cannot be more than the final total (₹${finalTotal}). Please correct the amounts.`,
        variant: "destructive",
      });
      return;
    }
    await createBookingMutation.mutateAsync(data);
  };

  // TASK-BOOKING-UI-04: the caller (Step 1's Continue button below) already
  // validated the correct date fields for the current travelDateStatus
  // before calling this — a 'range'/'not_decided' booking has no
  // pickupDate/returnDate at all, so this no longer re-checks them here
  // (doing so would silently strand those two states on Step 1 forever).
  const handleDateSelection = () => {
    setStep(2);
  };

  const handleVehicleAndPricingSelection = (vehicleId: string, pricingType: "day" | "km") => {
    const vehicleArray = Array.isArray(availableVehicles) ? availableVehicles : [];
    const vehicle = vehicleArray.find((v: any) => v._id === vehicleId || v.id === vehicleId);
    
    if (vehicle) {
      // Set the selected vehicle and pricing type
      setSelectedVehicleId(vehicleId);
      setSelectedPricingType(pricingType);
      form.setValue("vehicleId", vehicleId);
      form.setValue("pricingType", pricingType);
      
      // Calculate amount based on pricing type. pickupDate/returnDate are
      // only optional (TASK-BOOKING-UI-04) for a 'range'/'not_decided'
      // booking — reaching here at all requires a real own-fleet vehicle
      // to have been offered, which only happens once dates are confirmed
      // (see the availableVehicles query's enabled condition above), so
      // the fallback below is a type-satisfier, not a real runtime path.
      const pickupDate = new Date(watchedValues.pickupDate || "");
      const returnDate = new Date(watchedValues.returnDate || "");
      const days = Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      let amount = 0;
      let description = "";
      
      if (pricingType === "day") {
        const pricePerDay = vehicle.pricePerDay || vehicle.ratePerDay || 0;
        amount = days * parseFloat(pricePerDay);
        description = `₹${amount} for ${days} day${days > 1 ? 's' : ''} at ₹${pricePerDay}/day`;
      } else if (pricingType === "km") {
        const pricePerKm = vehicle.pricePerKm || 0;
        if (pricePerKm > 0) {
          // For km-based pricing, we'll set a base amount and allow user to adjust in final step
          amount = parseFloat(pricePerKm) * 100; // Default 100km estimate
          description = `₹${amount} estimated for 100km at ₹${pricePerKm}/km (adjustable in next step)`;
        } else {
          toast({
            title: "Rate per km not available",
            description: "This vehicle doesn't have per-kilometer pricing. Please choose 'By Day' option.",
            variant: "destructive"
          });
          return;
        }
      }
      
      form.setValue("amount", amount);
      
      toast({
        variant: "success",
        title: "Vehicle & pricing selected!",
        description: description,
      });
    }
  };

  // Reset selection when booking type changes. Switching modes must never
  // silently carry the other mode's allocation into the submit payload
  // (e.g. serviceMode=self_drive + a stale chauffeur driverId), so any
  // incompatible unsaved selection is cleared here, with a toast so the
  // removal is visible rather than silent.
  const handleBookingTypeChange = (newBookingType: "self_drive" | "with_driver") => {
    setSelectedVehicleId("");
    setSelectedPricingType("");
    form.setValue("vehicleId", "");
    form.setValue("pricingType", "day");
    form.setValue("amount", 0);
    if (newBookingType === "self_drive" && form.getValues("driverId")) {
      form.setValue("driverId", "");
      toast({
        title: "Driver selection removed",
        description: "Self Drive bookings don't have a chauffeur, so the previously selected driver was cleared.",
      });
    }
    if (newBookingType === "self_drive") setSelectedVendorDriverId("");
  };

  // The mode cards wrap their RadioGroupItem, and Radix bubbles a synthetic
  // `click` from each item's hidden form input whenever its checked state
  // changes — including on UNcheck. A card-level onClick that re-submits its
  // own mode therefore fires for the OLD mode's uncheck too, and the two
  // writers ping-pong until the wrong value wins (the "can't switch back to
  // Self Drive" bug). Only treat clicks as user intent when they did NOT
  // originate from the radio primitive itself (Radix already reports those
  // through onValueChange).
  const isDirectCardClick = (e: React.MouseEvent) =>
    !(e.target as HTMLElement).closest('button[role="radio"], input');

  const stepConfig = [
    { number: 1, title: "Trip Details", icon: MapPin, color: "bg-blue-500" },
    { number: 2, title: "Vehicle & Service", icon: Car, color: "bg-green-500" },
    { number: 3, title: "Customer Info", icon: User, color: "bg-purple-500" },
    { number: 4, title: "Review & Pay", icon: CreditCard, color: "bg-orange-500" }
  ];

  const renderProgressBar = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-6 mb-4 sm:mb-8">
      <div className="flex items-center justify-between mb-3 sm:mb-6">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Create New Booking</h2>
        <Badge variant="outline" className="text-xs sm:text-sm">
          Step {step} of {totalSteps}
        </Badge>
      </div>
      
      <div className="flex items-center justify-between">
        {stepConfig.map((config, index) => {
          const Icon = config.icon;
          const isActive = step === config.number;
          const isCompleted = step > config.number;
          
          return (
            <div key={config.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isActive
                      ? `${config.color} border-transparent text-white shadow-lg sm:scale-110`
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={16} className="sm:w-5 sm:h-5" />
                  ) : (
                    <Icon size={16} className="sm:w-5 sm:h-5" />
                  )}
                </div>
                <div className="mt-1 sm:mt-2 text-center">
                  <div className={`text-xs sm:text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    <span className="hidden sm:inline">{config.title}</span>
                    <span className="sm:hidden">{config.title.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
              
              {index < stepConfig.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-4">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      step > config.number ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Trip Details & Schedule
              </CardTitle>
              <p className="text-blue-100 text-xs sm:text-sm">Tell us when and where you need to go</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              {/* Date-Certainty Section (TASK-BOOKING-UI-04) — positioned
                  before the date-entry section below, per spec. Three
                  states only, matching travelDateStatus exactly
                  (TASK-BOOKING-DOMAIN-02's real field/values). This is an
                  independent axis from the resource-fulfilment selection
                  in Step 2 below (untouched by this task) — the two are
                  only combined for display, in the Review step's summary
                  line. */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                  How certain is the travel date?
                </h3>
                <FormField
                  control={form.control}
                  name="travelDateStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div role="radiogroup" aria-label="How certain is the travel date?" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {DATE_CERTAINTY_OPTIONS.map((option) => (
                            <div
                              key={option.value}
                              id={`date-certainty-${option.value}`}
                              role="radio"
                              aria-checked={field.value === option.value}
                              aria-label={option.label}
                              tabIndex={0}
                              onClick={() => field.onChange(option.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  field.onChange(option.value);
                                }
                              }}
                              className={`min-w-0 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                field.value === option.value
                                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <option.icon className={`w-5 h-5 mb-1.5 ${field.value === option.value ? 'text-blue-600' : 'text-gray-400'}`} />
                              <div className="font-medium text-xs sm:text-sm break-words">{option.label}</div>
                              <div className="text-xs text-gray-500 mt-0.5 break-words hidden sm:block">{option.desc}</div>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator className="my-8" />

              {/* Date & Time Section — only when the date is actually
                  confirmed (travelDateStatus === 'confirmed', the
                  default). Unchanged fields/validation for that case. */}
              {watchedValues.travelDateStatus === "confirmed" && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                  When do you need the vehicle?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="pickupDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Calendar className="w-4 h-4 mr-2" />
                            Pickup Date
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              min={new Date().toISOString().split('T')[0]}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pickupTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Clock className="w-4 h-4 mr-2" />
                            Pickup Time
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="returnDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Calendar className="w-4 h-4 mr-2" />
                            Return Date
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              min={watchedValues.pickupDate || new Date().toISOString().split('T')[0]}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="returnTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                            <Clock className="w-4 h-4 mr-2" />
                            Return Time
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Tentative range — shown only when travelDateStatus === 'range'. */}
              {watchedValues.travelDateStatus === "range" && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <CalendarRange className="w-5 h-5 mr-2 text-blue-500" />
                  What's the earliest and latest date?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="tentativeStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                          <Calendar className="w-4 h-4 mr-2" />
                          Earliest Date
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            min={new Date().toISOString().split('T')[0]}
                            className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tentativeEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                          <Calendar className="w-4 h-4 mr-2" />
                          Latest Date
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            min={watchedValues.tentativeStartDate || new Date().toISOString().split('T')[0]}
                            className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3">Exact pickup/return date and time can be pinned down once the customer confirms — this booking will still show as ready to review.</p>
              </div>
              )}

              {/* Not decided yet — shown only when travelDateStatus === 'not_decided'.
                  followUpAt is optional (no prior concept existed for it —
                  see TASK-BOOKING-DOMAIN-02's report). */}
              {watchedValues.travelDateStatus === "not_decided" && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <HelpCircle className="w-5 h-5 mr-2 text-blue-500" />
                  Follow-up (optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="followUpAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                          <Calendar className="w-4 h-4 mr-2" />
                          When should we follow up?
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            min={new Date().toISOString().split('T')[0]}
                            className="h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3">No travel date is required to save this booking — it will show as Date Pending until the customer decides.</p>
              </div>
              )}

              <Separator className="my-8" />

              {/* Location Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-green-500" />
                  Where are you traveling?
                </h3>
                
                {/* Route Type Selection */}
                <div className="mb-6">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRouteType("custom");
                        form.setValue("dropoffLocation", "");
                        form.setValue("tripType", "one_way"); // Reset to default trip type for custom routes
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
                        routeType === "custom"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      Custom Route
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRouteType("local");
                        form.setValue("dropoffLocation", "Local");
                        form.setValue("tripType", "local");
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
                        routeType === "local"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      ✅ Local
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRouteType("not_decided");
                        form.setValue("dropoffLocation", "Not Decided Yet");
                        form.setValue("tripType", "airport"); // Using airport as the closest existing type for flexible trips
                      }}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
                        routeType === "not_decided"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      ✅ Not Decided Yet
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="pickupLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">From (Pickup Location)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Indore Railway Station" 
                            {...field}
                            className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {routeType === "custom" && (
                    <FormField
                      control={form.control}
                      name="dropoffLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">To (Drop-off Location)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g., Omkareshwar Temple" 
                              {...field}
                              className="h-12 border-2 border-gray-200 focus:border-green-500 rounded-lg"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {routeType !== "custom" && (
                    <div className="flex items-center justify-center h-12 bg-green-50 border-2 border-green-200 rounded-lg">
                      <span className="text-green-700 font-medium">
                        {routeType === "local" ? "📍 Local Trip" : "🤔 Destination Not Decided"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-8" />

              {/* Trip Type Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Choose your trip type</h3>
                <FormField
                  control={form.control}
                  name="tripType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                          {[
                            { value: "one_way", label: "One Way", icon: "→", color: "blue" },
                            { value: "round_trip", label: "Round Trip", icon: "⟷", color: "green" },
                            { value: "local", label: "Local", icon: "📍", color: "purple" },
                            { value: "airport", label: "Airport", icon: "✈️", color: "orange" }
                          ].map((option) => (
                            <div
                              key={option.value}
                              onClick={() => field.onChange(option.value)}
                              className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                                field.value === option.value
                                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="text-center">
                                <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{option.icon}</div>
                                <div className="font-medium text-xs sm:text-sm">{option.label}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4 sm:pt-6">
                <Button 
                  type="button" 
                  onClick={() => {
                    const dropoffValid = routeType !== "custom" || form.getValues("dropoffLocation");
                    // TASK-BOOKING-UI-04: which date fields are required
                    // depends on travelDateStatus — 'confirmed' (default)
                    // keeps today's exact pickup/return date+time
                    // requirement; 'range' requires the tentative window
                    // instead; 'not_decided' requires no date field at all.
                    const travelDateStatus = form.getValues("travelDateStatus");
                    const dateFieldsValid =
                      travelDateStatus === "range"
                        ? !!(form.getValues("tentativeStartDate") && form.getValues("tentativeEndDate"))
                        : travelDateStatus === "not_decided"
                        ? true
                        : !!(form.getValues("pickupDate") && form.getValues("returnDate") &&
                             form.getValues("pickupTime") && form.getValues("returnTime"));
                    const isValid = dateFieldsValid &&
                                   form.getValues("pickupLocation") &&
                                   dropoffValid &&
                                   form.getValues("tripType");

                    if (isValid) {
                      handleDateSelection();
                    } else {
                      toast({
                        title: "Please fill all required fields",
                        description: travelDateStatus === "range"
                          ? "Earliest/latest date, location and trip type fields are required."
                          : travelDateStatus === "not_decided"
                          ? "Location and trip type fields are required."
                          : "All date, time, location and trip type fields are required.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  size="lg"
                >
                  <span className="sm:hidden">Continue</span>
                  <span className="hidden sm:inline">Continue to Vehicle Selection</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <Car className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Select Vehicle & Service Type
              </CardTitle>
              <p className="text-green-100 text-xs sm:text-sm">Choose from our available fleet</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              {/* Service Type Selection — hidden entirely for a tenant that
                  operates only one mode (spec: no dead selector, open the
                  single enabled workflow directly). */}
              {singleServiceMode ? (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Service Type</h3>
                  <Badge variant="outline" data-testid="single-service-mode">
                    {singleServiceMode === "self_drive" ? "Self Drive" : "With Driver"}
                  </Badge>
                </div>
              ) : (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Service Type</h3>
                <FormField
                  control={form.control}
                  name="bookingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleBookingTypeChange(value as "self_drive" | "with_driver");
                          }}
                          value={field.value}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <div
                            onClick={(e) => {
                              if (!isDirectCardClick(e)) return;
                              if (field.value === "self_drive") return;
                              field.onChange("self_drive");
                              handleBookingTypeChange("self_drive");
                            }}
                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                              field.value === "self_drive"
                                ? 'border-green-500 bg-green-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="self_drive" id="self_drive" />
                              <Label htmlFor="self_drive" className="flex-1 cursor-pointer">
                                <div className="font-medium">Self Drive</div>
                                <div className="text-sm text-gray-500">Drive the vehicle yourself</div>
                              </Label>
                            </div>
                          </div>
                          <div
                            onClick={(e) => {
                              if (!isDirectCardClick(e)) return;
                              if (field.value === "with_driver") return;
                              field.onChange("with_driver");
                              handleBookingTypeChange("with_driver");
                            }}
                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                              field.value === "with_driver"
                                ? 'border-green-500 bg-green-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="with_driver" id="with_driver" />
                              <Label htmlFor="with_driver" className="flex-1 cursor-pointer">
                                <div className="font-medium">With Driver</div>
                                <div className="text-sm text-gray-500">Professional driver included</div>
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              )}

              {watchedValues.bookingType === "self_drive" && (
                <div className="mb-8 rounded-lg border border-violet-200 bg-violet-50/50 p-4 space-y-3" data-testid="sd-booking-section">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-semibold text-gray-800">Self Drive — Deposit & Late Charges</h3>
                    <span className="text-sm text-violet-700 font-medium" data-testid="sd-duration-line">
                      {(() => {
                        const start = watchedValues.pickupDate ? new Date(`${watchedValues.pickupDate}T${watchedValues.pickupTime || "00:00"}`) : null;
                        const end = watchedValues.returnDate ? new Date(`${watchedValues.returnDate}T${watchedValues.returnTime || "00:00"}`) : null;
                        if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return "Duration: —";
                        const mins = Math.round((end.getTime() - start.getTime()) / 60000);
                        const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
                        return `Duration: ${d > 0 ? `${d} Day${d > 1 ? "s" : ""} ` : ""}${h > 0 ? `${h} Hour${h > 1 ? "s" : ""}` : ""}${d === 0 && h === 0 ? `${m} Min` : ""}`.trim();
                      })()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Security Deposit (₹)</Label>
                      <Input type="number" min="0" value={sdOps.depositAmount} onChange={(e) => setSdOps({ ...sdOps, depositAmount: e.target.value })} data-testid="sd-wizard-deposit" onWheel={(e) => (e.target as HTMLElement).blur()} />
                    </div>
                    <div>
                      <Label className="text-xs">Deposit Mode</Label>
                      <Select value={sdOps.depositMode} onValueChange={(v) => setSdOps({ ...sdOps, depositMode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="card">Card</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ref / Txn ID</Label>
                      <Input value={sdOps.depositReference} onChange={(e) => setSdOps({ ...sdOps, depositReference: e.target.value })} placeholder="optional" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 pt-5">
                      <input type="checkbox" checked={sdOps.depositReceived} onChange={(e) => setSdOps({ ...sdOps, depositReceived: e.target.checked })} data-testid="sd-wizard-deposit-received" />
                      Deposit received
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                    <div>
                      <Label className="text-xs">Grace (min)</Label>
                      <Input type="number" min="0" value={sdOps.lateGrace} onChange={(e) => setSdOps({ ...sdOps, lateGrace: e.target.value })} onWheel={(e) => (e.target as HTMLElement).blur()} />
                    </div>
                    <div>
                      <Label className="text-xs">Late Rate (₹)</Label>
                      <Input type="number" min="0" value={sdOps.lateRate} onChange={(e) => setSdOps({ ...sdOps, lateRate: e.target.value })} onWheel={(e) => (e.target as HTMLElement).blur()} />
                    </div>
                    <div>
                      <Label className="text-xs">Interval</Label>
                      <Select value={sdOps.lateUnit} onValueChange={(v) => setSdOps({ ...sdOps, lateUnit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_hour">Per Hour</SelectItem><SelectItem value="per_30min">Per 30 Min</SelectItem>
                          <SelectItem value="per_day">Per Day</SelectItem><SelectItem value="fixed">Fixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">Deposit is held separately — it never mixes with fare, advance or balance.</p>
                </div>
              )}

              <Separator className="my-8" />

              {/* Resource Fulfilment mode — always visible, even when the
                  own fleet is empty (spec: a Booking must never be lost
                  merely because the company fleet is unavailable). See
                  docs/RESOURCE_FULFILMENT_MATRIX.md. */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">How will this Booking be fulfilled?</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([
                    { id: "own_fleet" as const, icon: Car, title: "Own Fleet", desc: "Assign a currently available company vehicle." },
                    { id: "vendor_vehicle" as const, icon: Building2, title: "Vendor Vehicle", desc: "Select a vehicle already registered with an existing vendor." },
                    { id: "outsource" as const, icon: Send, title: "Outsource Vehicle", desc: "Continue now; source a vehicle from a vendor afterward." },
                  ]).map((mode) => (
                    <button
                      type="button"
                      key={mode.id}
                      id={`resource-mode-${mode.id}`}
                      onClick={() => setResourceMode(mode.id)}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        resourceMode === mode.id ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <mode.icon className={`w-6 h-6 mb-2 ${resourceMode === mode.id ? 'text-green-600' : 'text-gray-500'}`} />
                      <div className="font-medium">{mode.title}</div>
                      <div className="text-xs text-gray-500">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Own Fleet path — unchanged from the original implementation
                  except that the empty state below is no longer a dead
                  end (spec §7). */}
              {resourceMode === "own_fleet" && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Vehicles</h3>
                {(() => {
                  const vehicles = (availableVehicles as any[]) || [];
                  if (vehicles.length > 0) {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {vehicles.map((vehicle: any) => {
                          const vehicleId = vehicle._id || vehicle.id;
                          const isSelected = selectedVehicleId === vehicleId;

                          return (
                            <div
                              key={vehicleId}
                              className={`p-6 border-2 rounded-lg transition-all hover:shadow-lg ${
                                isSelected
                                  ? 'border-green-500 bg-green-50 shadow-lg'
                                  : 'border-gray-200 hover:border-green-300'
                              }`}
                            >
                              <div className="text-center mb-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <Car className="w-8 h-8 text-green-600" />
                                </div>
                                <h4 className="font-semibold text-lg">{vehicle.make} {vehicle.vehicleModel || vehicle.model || ''}</h4>
                                <p className="text-sm text-gray-600 mb-2">{vehicle.type || vehicle.vehicleType || 'Standard'}</p>
                                <Badge variant="outline" className="mb-3">
                                  {vehicle.licensePlate || vehicle.registrationNumber || 'No Reg'}
                                </Badge>
                              </div>

                              {/* Pricing Options */}
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-gray-700 text-center mb-3">Choose Pricing Method</h5>

                                {/* By Day Option */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVehicleAndPricingSelection(vehicleId, "day");
                                  }}
                                  className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                                    isSelected && selectedPricingType === "day"
                                      ? 'border-green-500 bg-green-100 text-green-800'
                                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-sm">By Day</div>
                                      <div className="text-xs text-gray-600">
                                        ₹{vehicle.pricePerDay || vehicle.ratePerDay || 0}/day
                                      </div>
                                    </div>
                                    {isSelected && selectedPricingType === "day" && (
                                      <Check className="w-4 h-4 text-green-600" />
                                    )}
                                  </div>
                                </button>

                                {/* By Kilometer Option */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (vehicle.pricePerKm && vehicle.pricePerKm > 0) {
                                      handleVehicleAndPricingSelection(vehicleId, "km");
                                    }
                                  }}
                                  disabled={!vehicle.pricePerKm || vehicle.pricePerKm <= 0}
                                  className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                                    !vehicle.pricePerKm || vehicle.pricePerKm <= 0
                                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : isSelected && selectedPricingType === "km"
                                      ? 'border-green-500 bg-green-100 text-green-800'
                                      : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-sm">By Kilometer</div>
                                      <div className="text-xs text-gray-600">
                                        {vehicle.pricePerKm && vehicle.pricePerKm > 0
                                          ? `₹${vehicle.pricePerKm}/km`
                                          : 'Not available'
                                        }
                                      </div>
                                    </div>
                                    {isSelected && selectedPricingType === "km" && (
                                      <Check className="w-4 h-4 text-green-600" />
                                    )}
                                  </div>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else {
                    // Non-blocking empty state (spec §7) — the original
                    // dead-end message is replaced with real alternatives.
                    // The booking is never lost merely because the
                    // company fleet is unavailable for these dates.
                    return (
                      <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                        <p className="font-medium text-gray-700 mb-1">No own-fleet vehicles are available for the selected schedule.</p>
                        <p className="text-sm text-gray-500 mb-5">You can continue using Vendor Vehicle, Outsource Vehicle, or save with assignment pending.</p>
                        <div className="flex flex-wrap justify-center gap-3">
                          <Button type="button" variant="outline" id="empty-state-select-vendor-vehicle" onClick={() => setResourceMode("vendor_vehicle")}>
                            <Building2 className="w-4 h-4 mr-2" /> Select Vendor Vehicle
                          </Button>
                          <Button type="button" variant="outline" id="empty-state-create-outsource-request" onClick={() => setResourceMode("outsource")}>
                            <Send className="w-4 h-4 mr-2" /> Create Outsource Request
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            id="empty-state-save-assignment-pending"
                            onClick={() => {
                              setResourceMode("outsource");
                              toast({ title: "You can now continue — resource assignment will show as pending." });
                            }}
                          >
                            <ArrowRight className="w-4 h-4 mr-2" /> Continue with Assignment Pending
                          </Button>
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>
              )}

              {/* Vendor Vehicle path — reuses the existing Vendor Master /
                  VendorVehicle / VendorDriver data and their already-correct
                  availability checks (docs/VENDOR_OUTSOURCE_WORKFLOW_AUDIT.md).
                  Actual linkage happens via the existing, tested
                  assign-vendor endpoint right after the booking is created
                  (see createBookingMutation's onSuccess below). */}
              {resourceMode === "vendor_vehicle" && (
              <div className="mb-8 space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Vendor Vehicle</h3>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Vendor</Label>
                    <Button type="button" variant="ghost" size="sm" id="quick-add-vendor-open" onClick={() => setShowQuickAddVendor(true)} className="h-7 px-2 text-xs">
                      <Building2 className="w-3.5 h-3.5 mr-1" /> Quick Add Vendor
                    </Button>
                  </div>
                  <Select
                    value={selectedVendorId}
                    onValueChange={(value) => { setSelectedVendorId(value); setSelectedVendorVehicleId(""); setSelectedVendorDriverId(""); }}
                  >
                    <SelectTrigger id="vendor-vehicle-select-vendor" className="h-12">
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(activeVendors || []).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-gray-400">No active vendors yet</div>
                      )}
                      {(activeVendors || []).map((v: any) => (
                        <SelectItem key={v._id || v.id} value={v._id || v.id}>{v.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedVendorId && (
                  <>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label>Vendor Vehicle</Label>
                        <Button type="button" variant="ghost" size="sm" id="quick-add-vehicle-open" onClick={() => setShowQuickAddVehicle(true)} className="h-7 px-2 text-xs">
                          <Car className="w-3.5 h-3.5 mr-1" /> Quick Add Vehicle
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        {(vendorVehiclesList || []).length === 0 && (
                          <p className="text-sm text-gray-400 col-span-2">No vehicles registered for this vendor yet.</p>
                        )}
                        {(vendorVehiclesList || []).map((vv: any) => {
                          const id = vv._id || vv.id;
                          const isSelected = selectedVendorVehicleId === id;
                          const isAvailable = vv.available !== false;
                          return (
                            <button
                              type="button"
                              key={id}
                              disabled={!isAvailable}
                              onClick={() => setSelectedVendorVehicleId(id)}
                              className={`p-3 border-2 rounded-lg text-left transition-all ${
                                !isAvailable
                                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                  : isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                              }`}
                            >
                              <div className="font-medium text-sm">{vv.make ? `${vv.make} ` : ''}{vv.vehicleModel} ({vv.registrationNumber})</div>
                              <div className="text-xs text-gray-500">{vv.category}{vv.seatingCapacity ? ` · ${vv.seatingCapacity} seats` : ''}</div>
                              {!isAvailable && <div className="text-xs text-red-600 mt-1">{vv.reason}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label>Vendor Driver (optional)</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        {(vendorDriversList || []).length === 0 && (
                          <p className="text-sm text-gray-400 col-span-2">No drivers registered for this vendor yet.</p>
                        )}
                        {(vendorDriversList || []).map((vd: any) => {
                          const id = vd._id || vd.id;
                          const isSelected = selectedVendorDriverId === id;
                          const isAvailable = vd.available !== false;
                          return (
                            <button
                              type="button"
                              key={id}
                              disabled={!isAvailable}
                              onClick={() => setSelectedVendorDriverId(id)}
                              className={`p-3 border-2 rounded-lg text-left transition-all ${
                                !isAvailable
                                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                  : isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                              }`}
                            >
                              <div className="font-medium text-sm">{vd.name}</div>
                              <div className="text-xs text-gray-500">{vd.primaryMobile}</div>
                              {!isAvailable && <div className="text-xs text-red-600 mt-1">{vd.reason}</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedVendorVehicleId && (
                      <p className="text-sm text-green-700">Vendor vehicle selected — a confirmation request will be recorded once you save this booking. Vendor commercials (rate, advance) can be set from Assign Vendor after saving.</p>
                    )}
                  </>
                )}
              </div>
              )}

              {/* Outsource path — Phase 3 covers the "continue without
                  blocking" acknowledgement; the full sourcing-request /
                  multi-vendor comparison workflow is a separate, larger
                  build (docs/VENDOR_OUTSOURCE_WORKFLOW_AUDIT.md). */}
              {resourceMode === "outsource" && (
              <div className="mb-8 p-4 border-2 border-dashed border-gray-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Outsource Vehicle</h3>
                <p className="text-sm text-gray-500">The booking will be confirmed now with Resource Sourcing Pending. Vendors can be contacted and a vehicle finalized afterward from the booking's Resource Fulfilment panel.</p>
              </div>
              )}

              {/* Driver Selection */}
              {watchedValues.bookingType === "with_driver" && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Driver Selection</h3>
                  
                  <FormField
                    control={form.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Driver (Optional)</FormLabel>
                        <FormControl>
                          <Select onValueChange={(value) => field.onChange(value)} value={field.value?.toString()}>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Auto-assign driver or select manually" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Available Drivers</SelectLabel>
                                {availableDrivers.length === 0 && (
                                  <div className="px-2 py-1.5 text-sm text-gray-400">No drivers available for this time window</div>
                                )}
                                {availableDrivers.map((driver: any) => (
                                  <SelectItem key={driver._id || driver.id} value={driver._id || driver.id}>
                                    {driver.name} - {driver.phone}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                              {/* Unavailable drivers are shown, disabled, with the exact
                                  conflict reason — never silently hidden, so staff can see
                                  WHY a driver they expected isn't selectable (already
                                  assigned elsewhere, on leave, etc.) instead of assuming
                                  the dropdown is broken. Clicking/selecting these is
                                  impossible: Radix disables pointer + keyboard selection
                                  on a disabled SelectItem. */}
                              {unavailableDrivers.length > 0 && (
                                <>
                                  <SelectSeparator />
                                  <SelectGroup>
                                    <SelectLabel>Unavailable Drivers</SelectLabel>
                                    {unavailableDrivers.map((driver: any) => (
                                      <SelectItem
                                        key={driver._id || driver.id}
                                        value={driver._id || driver.id}
                                        disabled
                                        className="text-gray-400"
                                      >
                                        {driver.name} — {driver.unavailabilityReason}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-6">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    // Non-blocking: the Next action is never disabled purely
                    // because no company vehicle is available (spec §20) —
                    // each resourceMode has its own, real completion
                    // requirement instead of a single global one.
                    if (resourceMode === "own_fleet") {
                      if (selectedVehicleId && selectedPricingType) {
                        nextStep();
                      } else if (!selectedVehicleId) {
                        toast({
                          title: "Please select a vehicle",
                          description: "Choose a vehicle and pricing method to continue.",
                          variant: "destructive"
                        });
                      } else {
                        toast({
                          title: "Please select a pricing method",
                          description: "Choose either 'By Day' or 'By Kilometer' pricing to continue.",
                          variant: "destructive"
                        });
                      }
                    } else if (resourceMode === "vendor_vehicle") {
                      if (selectedVendorId && selectedVendorVehicleId) {
                        nextStep();
                      } else {
                        toast({
                          title: "Please select a vendor vehicle",
                          description: "Choose a vendor and one of their vehicles to continue.",
                          variant: "destructive"
                        });
                      }
                    } else {
                      // outsource — always allowed to continue; the
                      // physical vehicle/driver will be sourced afterward
                      // and are only required before Trip Start.
                      nextStep();
                    }
                  }}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  size="lg"
                >
                  <span className="sm:hidden">Continue</span>
                  <span className="hidden sm:inline">Continue to Customer Info</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <User className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Customer Information
              </CardTitle>
              <p className="text-purple-100 text-xs sm:text-sm">Enter customer details for the booking</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                        <User className="w-4 h-4 mr-2" />
                        Customer Name
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter full name" 
                          {...field} 
                          className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                          <Phone className="w-4 h-4 mr-2" />
                          Phone Number
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="tel"
                            placeholder="Enter phone number (e.g., 9876543210)" 
                            value={field.value || ""}
                            name="customerPhone"
                            onBlur={field.onBlur}
                            className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                            onChange={(e) => {
                              // Allow only numbers and basic formatting
                              const numericValue = e.target.value.replace(/[^\d]/g, '');
                              field.onChange(numericValue);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bookingSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Booking Source
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg">
                            <SelectValue placeholder="Where did this booking come from?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="direct_customer">Direct Customer</SelectItem>
                          <SelectItem value="walk_in">Walk-in</SelectItem>
                          <SelectItem value="phone_call">Phone Call</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="google_business_profile">Google Business Profile</SelectItem>
                          <SelectItem value="google_ads">Google Ads</SelectItem>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="hotel">Hotel</SelectItem>
                          <SelectItem value="corporate_client">Corporate Client</SelectItem>
                          <SelectItem value="travel_agent">Travel Agent</SelectItem>
                          <SelectItem value="vendor_partner">Vendor/Partner</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="online_travel_platform">Online Travel Platform</SelectItem>
                          <SelectItem value="repeat_customer">Repeat Customer</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {EXTERNAL_SOURCE_TYPES.has(watchedValues.bookingSource) && (
                  <div className="md:col-span-2 border-2 border-dashed border-purple-200 rounded-lg p-4 space-y-4 bg-purple-50/30">
                    <p className="text-sm font-medium text-purple-900">
                      This booking came through an outside source — record who gets credit/commission for it.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sourceName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Source Name (Vendor/Agent/Hotel)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Om Travels" {...field} className="h-11 border-2 border-gray-200 rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sourceContact"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Source Contact Number</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 9876543210" {...field} className="h-11 border-2 border-gray-200 rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {activeVendors && activeVendors.length > 0 && (
                        <FormField
                          control={form.control}
                          name="sourceVendorId"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="text-sm font-medium text-gray-700">Link to Vendor Master (Optional)</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  const vendor = activeVendors.find((v: any) => v._id === value);
                                  if (vendor) {
                                    if (!form.getValues("sourceName")) form.setValue("sourceName", vendor.companyName);
                                    if (!form.getValues("sourceContact")) form.setValue("sourceContact", vendor.primaryMobile?.replace(/^91/, ""));
                                  }
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-11 border-2 border-gray-200 rounded-lg">
                                    <SelectValue placeholder="Not linked to a vendor record" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {activeVendors.map((v: any) => (
                                    <SelectItem key={v._id} value={v._id}>{v.companyName} ({v.vendorCode})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name="sourceReferenceNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Source Reference Number (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Their booking/reference ID" {...field} className="h-11 border-2 border-gray-200 rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sourceCommissionType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Commission Type (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 border-2 border-gray-200 rounded-lg">
                                  <SelectValue placeholder="No commission" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sourceCommissionAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">
                              Commission {watchedValues.sourceCommissionType === "percentage" ? "(%)" : "(₹)"} (Optional)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number" min={0} placeholder="0"
                                value={field.value ?? ""}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                                className="h-11 border-2 border-gray-200 rounded-lg"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sourceNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Terms / Billing Notes (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Credit period, billing instructions, etc." {...field} className="h-11 border-2 border-gray-200 rounded-lg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="md:col-span-2 border-2 border-dashed border-green-200 rounded-lg p-4 space-y-3 bg-green-50/30">
                  <p className="text-sm font-medium text-green-900">Was this Booking referred by someone?</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["none", "No Referral"],
                      ["existing_customer", "Search Existing Customer"],
                      ["referral_code", "Enter Referral Code"],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { setReferralMode(mode); setReferralSearch(""); setReferralCode(""); setResolvedReferrer(null); }}
                        className={`px-3 py-1.5 rounded-full text-sm border-2 transition-colors ${
                          referralMode === mode ? "border-green-500 bg-green-100 text-green-800" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* "External Referral" / "Hotel-Agent-Vendor Referral" (spec §28's
                      other two options) are deliberately not repeated here — that's
                      exactly what the Booking Source panel above already captures
                      (hotel/travel_agent/vendor_partner/referral source types with
                      sourceName/sourceContact/commission), for a referrer who is NOT
                      a real, rewardable Customer record. Two separate UI sections
                      for two separate concerns, per spec §28's "keep separate" rule. */}
                  {referralMode === "existing_customer" && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Referrer's mobile number"
                        value={referralSearch}
                        onChange={(e) => setReferralSearch(e.target.value)}
                        className="h-11 border-2 border-gray-200 rounded-lg"
                      />
                      {referralLookupStatus(referralSearch, 10, referrerLookupPending, resolvedReferrer)}
                    </div>
                  )}
                  {referralMode === "referral_code" && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Referral code (e.g. AB12CD)"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="h-11 border-2 border-gray-200 rounded-lg uppercase"
                      />
                      {referralLookupStatus(referralCode, 6, referrerLookupPending, resolvedReferrer)}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center text-sm font-medium text-gray-700">
                        <Mail className="w-4 h-4 mr-2" />
                        Email (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter email address" 
                          type="email"
                          {...field} 
                          className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Special Notes (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Any special requirements"
                          {...field}
                          className="h-12 border-2 border-gray-200 focus:border-purple-500 rounded-lg"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerDiscussionSummary"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Customer Discussion Summary (Optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What was agreed with the customer on the call — e.g. pickup point, fare, what's included. This is shown to the customer and driver."
                          {...field}
                          className="border-2 border-gray-200 focus:border-purple-500 rounded-lg min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-8">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (!watchedValues.customerName || !watchedValues.customerPhone) {
                      toast({
                        title: "Please fill required fields",
                        description: "Customer name and phone are required.",
                        variant: "destructive"
                      });
                      return;
                    }
                    if (EXTERNAL_SOURCE_TYPES.has(watchedValues.bookingSource) && !watchedValues.sourceName?.trim()) {
                      toast({
                        title: "Source name required",
                        description: "This booking source needs a vendor/agent/hotel name for commission and ledger tracking.",
                        variant: "destructive"
                      });
                      return;
                    }
                    nextStep();
                  }}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                  size="lg"
                >
                  <span className="sm:hidden">Review</span>
                  <span className="hidden sm:inline">Review Booking</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        const vehicleArray = Array.isArray(availableVehicles) ? availableVehicles : [];
        const selectedVehicle = vehicleArray.find((v: any) => (v._id || v.id) === watchedValues.vehicleId);
        
        // If booking is confirmed, show success state with download receipt option
        if (bookingConfirmed && createdBooking) {
          return (
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center text-lg sm:text-xl">
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                  Booking Confirmed Successfully!
                </CardTitle>
                <p className="text-green-100 text-xs sm:text-sm">Booking ID: {createdBooking.bookingId}</p>
              </CardHeader>
              <CardContent className="p-4 sm:p-8">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Your booking has been confirmed!</h3>
                  <p className="text-gray-600 mb-6">
                    Booking ID: <span className="font-semibold text-green-600">{createdBooking.bookingId}</span>
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                    <Button
                      type="button"
                      onClick={handleDownloadReceipt}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3"
                      size="lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download E-Receipt
                    </Button>
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        form.reset();
                        bookingIdempotencyKeyRef.current = safeRandomUUID();
                        setStep(1);
                        setSelectedVehicleId("");
                        setSelectedPricingType("");
                        onSuccess(createdBooking);
                        setCreatedBooking(null);
                        setBookingConfirmed(false);
                        setRouteType("custom");
                      }}
                      className="px-6 py-3"
                      size="lg"
                    >
                      Create New Booking
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        
        // Initial confirmation state - show review and confirm booking
        return (
          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Review & Confirm Booking
              </CardTitle>
              <p className="text-orange-100 text-xs sm:text-sm">Review all details before confirming</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-8">
              {/* Combined date-certainty + resource-fulfilment summary
                  (TASK-BOOKING-UI-04) — the two axes read together as ONE
                  coherent line (e.g. "Confirmed date, vendor sourcing in
                  progress"), not two disconnected badges. resourceMode and
                  the vehicle-selection state it reads are the inherited
                  branch's own, untouched values. */}
              <div className="mb-6 p-3 sm:p-4 rounded-lg border-2 border-blue-200 bg-blue-50 flex items-start gap-2 min-w-0">
                <Calendar className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <p id="combined-booking-status-line" className="text-sm sm:text-base font-medium text-blue-900 min-w-0 break-words">
                  {describeCombinedBookingStatus(
                    watchedValues.travelDateStatus || "confirmed",
                    resourceMode,
                    !!selectedVehicleId,
                    !!selectedVendorVehicleId,
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Trip Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Trip Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">From:</span>
                        <span className="font-medium">{watchedValues.pickupLocation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">To:</span>
                        <span className="font-medium">{watchedValues.dropoffLocation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date Certainty:</span>
                        <Badge variant="outline">
                          {watchedValues.travelDateStatus === "range" ? "Flexible Window" :
                           watchedValues.travelDateStatus === "not_decided" ? "Not Decided Yet" : "Confirmed"}
                        </Badge>
                      </div>
                      {watchedValues.travelDateStatus === "range" ? (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Window:</span>
                          <span className="font-medium">{watchedValues.tentativeStartDate} to {watchedValues.tentativeEndDate}</span>
                        </div>
                      ) : watchedValues.travelDateStatus === "not_decided" ? (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Follow up:</span>
                          <span className="font-medium">{watchedValues.followUpAt || "Not set"}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pickup:</span>
                            <span className="font-medium">{watchedValues.pickupDate} at {watchedValues.pickupTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Return:</span>
                            <span className="font-medium">{watchedValues.returnDate} at {watchedValues.returnTime}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trip Type:</span>
                        <Badge variant="outline">
                          {watchedValues.tripType === "round_trip" ? "Round Trip" :
                           watchedValues.tripType === "local" ? "Local" :
                           watchedValues.tripType === "airport" && watchedValues.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                           watchedValues.tripType === "airport" ? "Airport" :
                           watchedValues.dropoffLocation === "Local" ? "Local" :
                           watchedValues.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                           watchedValues.tripType === "one_way" ? "One Way" : "One Way"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Vehicle & Service</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fulfilment:</span>
                        <Badge variant="outline">
                          {resourceMode === "own_fleet" ? "Own Fleet" : resourceMode === "vendor_vehicle" ? "Vendor Vehicle" : "Outsource (sourcing pending)"}
                        </Badge>
                      </div>
                      {resourceMode === "own_fleet" ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Vehicle:</span>
                            <span className="font-medium">{selectedVehicle?.make} {selectedVehicle?.vehicleModel || selectedVehicle?.model || ''}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Type:</span>
                            <span className="font-medium">{selectedVehicle?.type || selectedVehicle?.vehicleType || 'Standard'}</span>
                          </div>
                        </>
                      ) : resourceMode === "vendor_vehicle" ? (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vendor Vehicle:</span>
                          <span className="font-medium">
                            {(vendorVehiclesList || []).find((v: any) => (v._id || v.id) === selectedVendorVehicleId)?.registrationNumber || 'Not selected'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-gray-500">A vehicle will be sourced from a vendor after this booking is confirmed.</div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Service:</span>
                        <Badge variant="outline">{watchedValues.bookingType.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium">{watchedValues.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">{watchedValues.customerPhone}</span>
                      </div>
                      {watchedValues.customerEmail && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium">{watchedValues.customerEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Amount */}
                <div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Booking Summary</h3>
                    <div className="space-y-3">
                      {/* Show pricing details based on selected pricing type */}
                      {selectedPricingType === "day" ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Rate per day:</span>
                            <span>₹{selectedVehicle?.pricePerDay || selectedVehicle?.ratePerDay || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Duration:</span>
                            {/* TASK-BOOKING-UI-04: pickupDate/returnDate
                                are now typed optional, but this branch
                                only renders once selectedPricingType is
                                "day", which only own-fleet's confirmed-date
                                flow can set — the fallback below is a type
                                satisfier, not a real runtime path. */}
                            <span>{Math.ceil((new Date(watchedValues.returnDate || "").getTime() - new Date(watchedValues.pickupDate || "").getTime()) / (1000 * 60 * 60 * 24))} days</span>
                          </div>
                        </>
                      ) : selectedPricingType === "km" ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Rate per km:</span>
                            <span>₹{selectedVehicle?.pricePerKm || 0}</span>
                          </div>
                          {/* Editable Total Kilometers field for Per Km pricing */}
                          <div className="mb-4">
                            <FormField
                              control={form.control}
                              name="totalKilometers"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Total Kilometers</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="Enter total kilometers"
                                      value={field.value ? field.value : ""}
                                      onWheel={(e) => (e.target as HTMLElement).blur()}
                                      onChange={(e) => {
                                        const km = e.target.value === "" ? 0 : parseFloat(e.target.value) || 0;
                                        field.onChange(km);
                                        // Auto-calculate base amount when kilometers change
                                        const rate = selectedVehicle?.pricePerKm || 0;
                                        const newAmount = km * rate;
                                        form.setValue("amount", newAmount);
                                      }}
                                      className="h-10 border border-gray-300 focus:border-orange-500 rounded"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Rate per day:</span>
                            <span>₹{selectedVehicle?.pricePerDay || selectedVehicle?.ratePerDay || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Duration:</span>
                            {/* TASK-BOOKING-UI-04: pickupDate/returnDate are
                                empty for a 'range'/'not_decided' booking
                                (this branch is reached whenever no pricing
                                type has been picked, i.e. the Vendor
                                Vehicle/Outsource paths) — guard against
                                NaN rather than compute a meaningless
                                duration from two empty strings. */}
                            <span>
                              {watchedValues.pickupDate && watchedValues.returnDate
                                ? `${Math.ceil((new Date(watchedValues.returnDate).getTime() - new Date(watchedValues.pickupDate).getTime()) / (1000 * 60 * 60 * 24))} days`
                                : "—"}
                            </span>
                          </div>
                        </>
                      )}
                      
                      {/* Editable Base Amount - Always editable regardless of pricing type */}
                      <div className="mb-4">
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-gray-700">Final Base Amount (Editable)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                                  <Input
                                    type="number"
                                    placeholder="Enter final amount"
                                    value={field.value ? field.value : ""}
                                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    className="h-12 pl-10 text-lg font-medium border-2 border-orange-300 focus:border-orange-500 rounded-lg"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Additional Charges Section */}
                      <div className="mt-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <FormField
                            control={form.control}
                            name="tollCharges"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-600">Toll Charges</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={field.value ? field.value : ""}
                                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    className="h-10 text-sm border border-gray-300 focus:border-orange-500 rounded"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="parkingCharges"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-600">Parking Charges</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={field.value ? field.value : ""}
                                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    className="h-10 text-sm border border-gray-300 focus:border-orange-500 rounded"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        {/* Fuel deductions + misc. expenses are normally
                            settled at trip-end, not at booking time — kept
                            out of the daily-use path by default, per spec's
                            progressive-disclosure ask. Auto-opens (and stays
                            open) if a resumed draft already has any of these
                            set, so existing data is never hidden. */}
                        {(() => {
                          const hasExtraCharges = !!(
                            (watchedValues.petrolCharges && watchedValues.petrolCharges > 0) ||
                            (watchedValues.dieselCharges && watchedValues.dieselCharges > 0) ||
                            (watchedValues.cngCharges && watchedValues.cngCharges > 0) ||
                            (watchedValues.miscellaneousAmount && watchedValues.miscellaneousAmount > 0)
                          );
                          const moreChargesOpen = showMoreCharges || hasExtraCharges;
                          return (
                            <Collapsible>
                              <CollapsibleTrigger
                                type="button"
                                onClick={() => setShowMoreCharges(!moreChargesOpen)}
                                className="border border-dashed border-gray-300 bg-gray-50/50"
                              >
                                <span className="text-sm font-medium text-gray-700">
                                  More charges (fuel deductions, misc. expenses)
                                </span>
                                {moreChargesOpen ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                              </CollapsibleTrigger>
                              <CollapsibleContent isOpen={moreChargesOpen} className="space-y-4 pt-2">
                                {/* Fuel Charges Section */}
                                <div className="space-y-4 p-4 bg-red-50 rounded-lg">
                                  <h4 className="font-semibold text-red-800 flex items-center">
                                    <span className="mr-2">⛽</span>
                                    Fuel Charges (To be deducted from final amount)
                                  </h4>
                                  <div className="grid grid-cols-3 gap-4">
                                    <FormField
                                      control={form.control}
                                      name="petrolCharges"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-sm font-medium text-red-700">Petrol (₹)</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              placeholder="0"
                                              value={field.value ? field.value : ""}
                                              onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                              onWheel={(e) => (e.target as HTMLElement).blur()}
                                              className="h-10 text-sm border border-red-300 focus:border-red-500 rounded"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name="dieselCharges"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-sm font-medium text-red-700">Diesel (₹)</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              placeholder="0"
                                              value={field.value ? field.value : ""}
                                              onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                              onWheel={(e) => (e.target as HTMLElement).blur()}
                                              className="h-10 text-sm border border-red-300 focus:border-red-500 rounded"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name="cngCharges"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-sm font-medium text-red-700">CNG (₹)</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              placeholder="0"
                                              value={field.value ? field.value : ""}
                                              onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                              onWheel={(e) => (e.target as HTMLElement).blur()}
                                              className="h-10 text-sm border border-red-300 focus:border-red-500 rounded"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>

                                {/* Miscellaneous Expenses Section */}
                                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                  <h4 className="font-semibold text-gray-800">Miscellaneous Expenses</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name="miscellaneousAmount"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-sm font-medium">Amount (₹)</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              placeholder="0"
                                              value={field.value ? field.value : ""}
                                              onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                                              onWheel={(e) => (e.target as HTMLElement).blur()}
                                              className="h-10 text-sm border border-gray-300 focus:border-orange-500 rounded"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={form.control}
                                      name="miscellaneousDescription"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-sm font-medium">Description</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              placeholder="e.g., cleaning charges, late return fee, damage cost"
                                              {...field}
                                              className="h-20 text-sm border border-gray-300 focus:border-orange-500 rounded resize-none"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })()}

                        {/* Summary of all charges */}
                        <div className="space-y-2 text-sm">
                          {/* Base amount display */}
                          <div className="flex justify-between">
                            <span>Base amount:</span>
                            <span>₹{watchedValues.amount || 0}</span>
                          </div>
                          
                          {/* Additional charges */}
                          {watchedValues.tollCharges && watchedValues.tollCharges > 0 && (
                            <div className="flex justify-between">
                              <span>Toll charges:</span>
                              <span>₹{watchedValues.tollCharges || 0}</span>
                            </div>
                          )}
                          {watchedValues.parkingCharges && watchedValues.parkingCharges > 0 && (
                            <div className="flex justify-between">
                              <span>Parking charges:</span>
                              <span>₹{watchedValues.parkingCharges || 0}</span>
                            </div>
                          )}
                          {watchedValues.miscellaneousAmount && watchedValues.miscellaneousAmount > 0 && (
                            <div className="flex justify-between">
                              <span>Miscellaneous expenses:</span>
                              <span>₹{watchedValues.miscellaneousAmount || 0}</span>
                            </div>
                          )}
                          {watchedValues.miscellaneousDescription && watchedValues.miscellaneousAmount && watchedValues.miscellaneousAmount > 0 && (
                            <div className="text-xs text-gray-600 italic ml-4">
                              {watchedValues.miscellaneousDescription}
                            </div>
                          )}
                          


                          {/* Fuel charges (deductions) */}
                          {((watchedValues.petrolCharges && watchedValues.petrolCharges > 0) || (watchedValues.dieselCharges && watchedValues.dieselCharges > 0) || (watchedValues.cngCharges && watchedValues.cngCharges > 0)) && (
                            <div className="border-t pt-2">
                              <div className="text-red-600 font-medium">Fuel Charges (Deductions):</div>
                              {watchedValues.petrolCharges && watchedValues.petrolCharges > 0 && (
                                <div className="flex justify-between text-red-600">
                                  <span>- Petrol:</span>
                                  <span>₹{watchedValues.petrolCharges || 0}</span>
                                </div>
                              )}
                              {watchedValues.dieselCharges && watchedValues.dieselCharges > 0 && (
                                <div className="flex justify-between text-red-600">
                                  <span>- Diesel:</span>
                                  <span>₹{watchedValues.dieselCharges || 0}</span>
                                </div>
                              )}
                              {watchedValues.cngCharges && watchedValues.cngCharges > 0 && (
                                <div className="flex justify-between text-red-600">
                                  <span>- CNG:</span>
                                  <span>₹{watchedValues.cngCharges || 0}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Final Total:</span>
                          <span className="text-green-600">
                            ₹{(watchedValues.amount || 0) + (watchedValues.tollCharges || 0) + (watchedValues.parkingCharges || 0) + (watchedValues.miscellaneousAmount || 0) - (watchedValues.petrolCharges || 0) - (watchedValues.dieselCharges || 0) - (watchedValues.cngCharges || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Advance Payment — same Pricing/Payment section,
                          not a separate page. Remaining balance is
                          computed here for display only; the actual
                          source of truth is the server-side ledger
                          (services/paymentLedger.ts), which recomputes it
                          from real payment transactions after submit. */}
                      <Separator />
                      <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold text-blue-900 flex items-center">
                          <IndianRupee className="w-4 h-4 mr-2" />
                          Advance Payment (Optional)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="advanceRequested"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Advance Requested (₹)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number" min={0} placeholder="0"
                                    value={field.value ?? ""}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                    className="h-10 text-sm border border-gray-300 focus:border-blue-500 rounded"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="advanceReceived"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Advance Received (₹)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number" min={0} placeholder="0"
                                    value={field.value ?? ""}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                    className="h-10 text-sm border border-gray-300 focus:border-blue-500 rounded"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {!!watchedValues.advanceReceived && watchedValues.advanceReceived > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="advancePaymentMode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Payment Mode</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-10 text-sm border border-gray-300 rounded">
                                        <SelectValue placeholder="Select mode" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="cash">Cash</SelectItem>
                                      <SelectItem value="upi">UPI</SelectItem>
                                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                      <SelectItem value="card">Card</SelectItem>
                                      <SelectItem value="payment_gateway">Payment Gateway</SelectItem>
                                      <SelectItem value="driver_collection">Driver Collection</SelectItem>
                                      <SelectItem value="vendor_collection">Vendor Collection</SelectItem>
                                      <SelectItem value="credit">Credit</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="advanceTransactionReference"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Transaction Reference (Optional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="UTR / Txn ID" {...field} className="h-10 text-sm border border-gray-300 rounded" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="advanceReceivedBy"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Received By (Optional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Staff name" {...field} className="h-10 text-sm border border-gray-300 rounded" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="advancePaymentNotes"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium text-gray-700">Payment Notes (Optional)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Notes" {...field} className="h-10 text-sm border border-gray-300 rounded" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="driverCollectionAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Amount Driver Must Collect (₹)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number" min={0} placeholder="0"
                                    value={field.value ?? ""}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                    className="h-10 text-sm border border-gray-300 focus:border-blue-500 rounded"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="collectionMode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium text-gray-700">Collection Mode</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-10 text-sm border border-gray-300 rounded">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="company">Company Collects</SelectItem>
                                    <SelectItem value="driver">Driver Collects</SelectItem>
                                    <SelectItem value="vendor">Vendor Collects</SelectItem>
                                    <SelectItem value="split">Split Collection</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Apply Reward Points — only shown once we actually
                            know a real balance for this phone number, and
                            capped at both the available balance and the
                            booking's own value so it can never redeem more
                            than the customer has or the trip is worth. */}
                        {rewardBalance >= minPointsToRedeem && (
                          <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-green-900">Apply Reward Points</span>
                              <span className="text-green-700">{rewardBalance} points available</span>
                            </div>
                            <Input
                              type="number" min={0} max={rewardBalance}
                              placeholder={`Min ${minPointsToRedeem} points`}
                              value={watchedValues.redeemPoints ?? ""}
                              onChange={(e) => {
                                const val = e.target.value === "" ? undefined : Math.min(Number(e.target.value), rewardBalance);
                                form.setValue("redeemPoints", val);
                              }}
                              className="h-10 text-sm border border-green-300 rounded"
                            />
                            {!!watchedValues.redeemPoints && watchedValues.redeemPoints > 0 && (
                              <div className="text-sm text-green-800">
                                {watchedValues.redeemPoints < minPointsToRedeem
                                  ? `Minimum ${minPointsToRedeem} points required to redeem.`
                                  : `Discount: ₹${watchedValues.redeemPoints * redemptionValuePerPoint} · Remaining balance after redemption: ${rewardBalance - watchedValues.redeemPoints} points`}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Remaining Balance — read-only, computed, never
                            a field the user can overwrite directly. */}
                        <div className="flex justify-between text-base font-semibold border-t pt-3">
                          <span>Remaining Balance:</span>
                          <span className="text-blue-700">
                            ₹{Math.max(0,
                              (watchedValues.amount || 0) + (watchedValues.tollCharges || 0) + (watchedValues.parkingCharges || 0) + (watchedValues.miscellaneousAmount || 0)
                              - (watchedValues.petrolCharges || 0) - (watchedValues.dieselCharges || 0) - (watchedValues.cngCharges || 0)
                              - (watchedValues.advanceReceived || 0)
                              - ((watchedValues.redeemPoints && watchedValues.redeemPoints >= minPointsToRedeem) ? watchedValues.redeemPoints * redemptionValuePerPoint : 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-8">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={prevStep}
                  disabled={createBookingMutation.isPending}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                
                <Button 
                  type="submit"
                  disabled={createBookingMutation.isPending}
                  className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  size="lg"
                >
                  {createBookingMutation.isPending ? "Creating..." : "Confirm Booking"}
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, (errors) => {
            // Zod failures on Confirm used to be completely silent — the
            // button just did nothing (e.g. amount stays 0 because the
            // selected vehicle has no rate configured). Name the first
            // failing fields so staff know what to fix instead of
            // re-clicking a dead button.
            const details = Object.entries(errors)
              .slice(0, 3)
              .map(([field, err]: [string, any]) => err?.message || field)
              .join('; ');
            toast({
              title: "Booking is missing required details",
              description: details || "Check the highlighted fields and try again.",
              variant: "destructive",
            });
          })}
          className="space-y-8"
          key={`booking-form-${step}`}
        >
          {renderProgressBar()}
          {renderStep()}
        </form>
      </Form>

      {/* Quick Add Vendor (spec §13) — same duplicate-mobile rejection as
          the standalone Vendor Database page, since both go through the
          identical POST /api/vendors route. Current Booking data is
          untouched by opening/closing this dialog (no navigation). */}
      <Dialog open={showQuickAddVendor} onOpenChange={setShowQuickAddVendor}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Add Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="quick-vendor-name">Company / Vendor Name</Label>
              <Input id="quick-vendor-name" value={quickVendorName} onChange={(e) => setQuickVendorName(e.target.value)} placeholder="e.g. Shree Travels" />
            </div>
            <div>
              <Label htmlFor="quick-vendor-contact">Contact Person</Label>
              <Input id="quick-vendor-contact" value={quickVendorContact} onChange={(e) => setQuickVendorContact(e.target.value)} placeholder="e.g. Ramesh" />
            </div>
            <div>
              <Label htmlFor="quick-vendor-mobile">Primary Mobile</Label>
              <Input id="quick-vendor-mobile" value={quickVendorMobile} onChange={(e) => setQuickVendorMobile(e.target.value)} placeholder="10-digit mobile" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowQuickAddVendor(false)}>Cancel</Button>
            <Button
              type="button"
              id="quick-add-vendor-save"
              disabled={!quickVendorName.trim() || !quickVendorContact.trim() || !quickVendorMobile.trim() || quickAddVendorMutation.isPending}
              onClick={() => quickAddVendorMutation.mutate()}
            >
              {quickAddVendorMutation.isPending ? "Adding..." : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Vendor Vehicle — a REAL vehicle with a real
          registration number, same as the standalone Vendor detail page's
          "Add Vehicle" (POST /api/vendors/:id/vehicles, same duplicate-
          registration rejection). If the registration isn't known yet,
          the Outsource path (not this dialog) is the correct choice —
          spec §9's "no fake physical vehicle" rule means this form never
          accepts a placeholder registration. */}
      <Dialog open={showQuickAddVehicle} onOpenChange={setShowQuickAddVehicle}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Add Vehicle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="quick-vehicle-reg">Registration Number</Label>
              <Input id="quick-vehicle-reg" value={quickVehicleReg} onChange={(e) => setQuickVehicleReg(e.target.value)} placeholder="e.g. MP09AB1234" />
            </div>
            <div>
              <Label htmlFor="quick-vehicle-model">Vehicle Model</Label>
              <Input id="quick-vehicle-model" value={quickVehicleModel} onChange={(e) => setQuickVehicleModel(e.target.value)} placeholder="e.g. Swift Dzire" />
            </div>
            <div>
              <Label htmlFor="quick-vehicle-category">Category</Label>
              <Input id="quick-vehicle-category" value={quickVehicleCategory} onChange={(e) => setQuickVehicleCategory(e.target.value)} placeholder="e.g. sedan, suv" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowQuickAddVehicle(false)}>Cancel</Button>
            <Button
              type="button"
              id="quick-add-vehicle-save"
              disabled={!quickVehicleReg.trim() || !quickVehicleModel.trim() || !quickVehicleCategory.trim() || quickAddVehicleMutation.isPending}
              onClick={() => quickAddVehicleMutation.mutate()}
            >
              {quickAddVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume unfinished booking draft */}
      <Dialog open={!!pendingDraft} onOpenChange={(open) => { if (!open) discardDraft(); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Resume your unfinished booking?</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600 mb-6">
              You have a booking in progress from earlier
              {pendingDraft?.formData?.customerName ? ` for ${pendingDraft.formData.customerName}` : ""}.
              Would you like to continue where you left off, or start a new booking?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={resumeDraft} className="bg-blue-500 hover:bg-blue-600 text-white">
                Resume Booking
              </Button>
              <Button variant="outline" onClick={discardDraft}>
                Start Fresh
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Share Modal */}
      <Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center text-green-600">
              Booking Confirmed! 🎉
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-gray-600 mb-4">
              Your e-receipt has been downloaded successfully.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Would you like to send the confirmation to your customer via WhatsApp?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  window.open(generateWhatsAppLink(), '_blank');
                  setShowConfirmationModal(false);
                }}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                Share via WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowConfirmationModal(false)}
              >
                Skip
              </Button>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  form.reset();
                  bookingIdempotencyKeyRef.current = safeRandomUUID();
                  setStep(1);
                  setSelectedVehicleId("");
                  setSelectedPricingType("");
                  onSuccess(createdBooking);
                  setCreatedBooking(null);
                  setShowConfirmationModal(false);
                  setRouteType("custom");
                }}
                className="w-full"
              >
                Create New Booking
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}