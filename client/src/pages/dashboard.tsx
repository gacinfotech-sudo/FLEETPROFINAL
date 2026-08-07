import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { usePermissions } from "../hooks/use-permissions";
import { useLocation, useParams } from "wouter";
import Sidebar from "../components/layout/sidebar";
import EnhancedStats from "../components/dashboard/enhanced-stats";
import EnhancedBookingForm from "../components/booking/enhanced-booking-form";
import VehicleForm from "../components/fleet/vehicle-form";
import VehicleFeedbackProfile from "../components/fleet/vehicle-feedback-profile";
import DriverForm from "../components/drivers/driver-form";
import DriverFeedbackProfile from "../components/drivers/driver-feedback-profile";
import RevenueReport from "../components/reports/revenue-report";
import VendorSettlementPage from "./vendor-settlement";
import BookingHistoryPDF from "../components/reports/booking-history-pdf";
import EnhancedInvoiceGenerator from "../components/invoice/enhanced-invoice-generator";
import UserManagement from "../components/user-management";
import BusinessProfile from "../components/business-profile";
import InvoiceSettingsPanel from "../components/invoice/invoice-settings-panel";
import RewardReferralSettingsPanel from "../components/settings/reward-referral-settings-panel";
import OnboardingWizard from "../components/onboarding/onboarding-wizard";
import ManageExpenses from "./manage-expenses";
import LiveBookings, { type Bucket as LiveOpsBucket } from "./live-bookings";
import CustomersPage from "./customers";
import AfterSalesPage from "./after-sales";
import CampaignsPage from "./campaigns";
import RewardsReferralsDashboard from "./rewards-referrals-dashboard";
import InquiriesPage from "./inquiries";
import LeadsPage from "./leads";
import FollowUpsPage from "./followups";
import VendorsPage from "./vendors";
import UpcomingBookings from "./upcoming-bookings";
import BookingQueuesPanel from "@/components/booking-queues/booking-queues-panel";
import PaymentDues from "./payment-dues";
import DriverLeavePage from "./driver-leave";
import DriverAttendancePage from "./driver-attendance";
import DriverPerformancePage from "./driver-performance";
import VehiclePerformancePage from "./vehicle-performance";
import WhatsAppPanel from "./whatsapp-panel";
import DailyOperationsPopup from "../components/dashboard/daily-operations-popup";
import BookingCommunication from "../components/booking/booking-communication";
import ExtendBookingDialog from "../components/booking/extend-booking-dialog";
import AssignVendorDialog from "../components/booking/assign-vendor-dialog";
import ResourceFulfilmentPanel from "../components/booking/resource-fulfilment-panel";
import PaymentSection from "../components/booking/payment-section";
import TripCostSummary from "../components/booking/trip-cost-summary";
import SetDriverPinDialog from "../components/drivers/set-driver-pin-dialog";
import PipelineStepper from "../components/pipeline/pipeline-stepper";
import { bookingPipelineInfo } from "../lib/pipelineStages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, Menu, LogOut, Star, Car, Users, UserCheck, Phone, Mail, MessageCircle, Banknote, Plus, User, FileText, Trash2 } from "lucide-react";

type ViewType = "dashboard" | "bookings" | "fleet" | "drivers" | "history" | "revenue" | "vendor-settlement" | "expenses" | "salary" | "profile" | "users" | "live-bookings" | "whatsapp" | "upcoming-bookings" | "booking-queues" | "payment-dues" | "driver-leave" | "driver-performance" | "vehicle-performance" | "driver-attendance" | "customers" | "after-sales" | "campaigns" | "inquiries" | "leads" | "followups" | "vendors" | "rewards-referrals";

// apiRequest() throws Error("<status>: <raw response text>") on a non-2xx
// response (queryClient.ts:throwIfResNotOk) — without this, a rejected
// mutation's toast showed the whole raw JSON body instead of the actual
// human-readable reason. Same fix already applied in leads.tsx /
// quotation-panel.tsx for the same underlying gotcha.
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

export default function Dashboard() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  // Separate from statusFilter/typeFilter above (which are Booking History's
  // own domain — booking statuses like "confirmed"/"cancelled") since
  // Vehicle/Driver status values ("available"/"on_trip"/"maintenance" vs
  // "available"/"on_duty"/"inactive") would otherwise collide with whatever
  // was last selected on a completely different screen.
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("all");
  const [driverStatusFilter, setDriverStatusFilter] = useState("all");
  // Fleet and Drivers each get their own search box state — they used to
  // share the single `searchTerm` above (which Booking History also uses),
  // so a search typed on one tab silently carried into another when
  // switching tabs without clearing it first.
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState("");
  const [driverSearchTerm, setDriverSearchTerm] = useState("");
  // Set by the Dashboard Overview's Lead/Booking Source chart right before
  // navigating into Booking History; own domain (booking source values)
  // kept separate from statusFilter/typeFilter for the same reason
  // vehicleStatusFilter/driverStatusFilter are — no collision with an
  // unrelated filter left selected on this same "history" screen.
  const [sourceFilter, setSourceFilter] = useState("all");
  // Set right before navigating from the Dashboard Overview's Live
  // Operations mini-board so the existing Live Bookings page opens on the
  // matching tab; cleared whenever navigating anywhere else so a later
  // normal sidebar click into Live Bookings still defaults normally.
  const [liveOpsInitialTab, setLiveOpsInitialTab] = useState<LiveOpsBucket | undefined>(undefined);
  // Set by LeadsPage's "Convert to Booking" action right before navigating
  // here — pre-fills the existing, unmodified booking form (spec §24
  // "Do not re-enter the same information manually") without skipping any
  // of its own validation/availability checks. __leadId is carried along
  // only so the booking-created callback below can link the two records;
  // it is stripped before being handed to the form itself.
  const [bookingPrefill, setBookingPrefill] = useState<any>(null);
  // Set by the Sidebar's Global Customer Search right before navigating to
  // the Customers view, so it can auto-open that customer's 360 dialog on
  // arrival instead of landing on the plain, unfiltered list. Cleared
  // whenever navigating anywhere else, same pattern as bookingPrefill above.
  const [pendingCustomerId, setPendingCustomerId] = useState<string | null>(null);
  // Same pattern, for Customer 360°'s timeline click-through to the
  // originating Inquiry/Lead record (docs/PIPELINE_BUG_REPORT.md #10).
  const [pendingInquiryId, setPendingInquiryId] = useState<string | null>(null);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [viewingVehicle, setViewingVehicle] = useState<any>(null);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [viewingDriver, setViewingDriver] = useState<any>(null);
  const [viewingBooking, setViewingBooking] = useState<any>(null);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [showEditBookingForm, setShowEditBookingForm] = useState(false);
  
  // Cancel booking states
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  
  // Invoice generation states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceBooking, setInvoiceBooking] = useState<any>(null);

  // Onboarding states - automatically show for first-time users
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canManageFleet, canManageDrivers, canViewRevenue, canDeleteBooking, canGenerateInvoice } = usePermissions();

  // Sync URL with current view on mount with role-based access control
  useEffect(() => {
    const section = params.section as ViewType;
    const allowedSections = ["dashboard", "inquiries", "leads", "followups", "live-bookings", "upcoming-bookings", "booking-queues", "payment-dues", "bookings", "fleet", "vehicle-performance", "drivers", "driver-leave", "driver-performance", "driver-attendance", "history", "customers", "after-sales", "campaigns", "rewards-referrals", "vendors", "revenue", "vendor-settlement", "expenses", "salary", "whatsapp", "profile"];
    
    // Add "users" section only for admin and client roles
    if (user?.role === 'admin' || user?.role === 'client') {
      allowedSections.push("users");
    }
    
    // Remove restricted sections for manager roles
    if (user?.role === 'manager') {
      const restrictedSections = ["revenue", "vendor-settlement", "drivers", "driver-leave", "driver-performance", "vehicle-performance", "driver-attendance", "after-sales", "campaigns", "rewards-referrals", "vendors"];
      restrictedSections.forEach(section => {
        const index = allowedSections.indexOf(section);
        if (index > -1) {
          allowedSections.splice(index, 1);
        }
      });
    }
    
    if (section && allowedSections.includes(section)) {
      setCurrentView(section);
    } else if (!section) {
      setCurrentView("dashboard");
      // Redirect to /dashboard/dashboard if no section is specified
      setLocation("/dashboard/dashboard");
    } else {
      // If user tries to access unauthorized section, redirect to dashboard
      setCurrentView("dashboard");
      setLocation("/dashboard/dashboard");
    }
  }, [params.section, setLocation, user?.role]);

  // Check if onboarding should be shown for client users
  useEffect(() => {
    if (user && user.role === 'client') {
      // Show onboarding only if explicitly false (not undefined or true)
      if (user.hasCompletedOnboarding === false) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    }
  }, [user]);

  // Update URL when view changes
  const handleViewChange = (view: ViewType) => {
    if (view !== "live-bookings") setLiveOpsInitialTab(undefined);
    if (view !== "bookings") setBookingPrefill(null);
    if (view !== "history") setSourceFilter("all");
    if (view !== "customers") setPendingCustomerId(null);
    if (view !== "inquiries") setPendingInquiryId(null);
    if (view !== "leads") setPendingLeadId(null);
    setCurrentView(view);
    setLocation(`/dashboard/${view}`);
  };

  const handleConvertLeadToBooking = (prefill: any) => {
    setBookingPrefill(prefill);
    handleViewChange("bookings");
  };

  const handleSelectCustomerFromSearch = (customerId: string) => {
    setPendingCustomerId(customerId);
    handleViewChange("customers");
  };

  const handleNavigateToInquiry = (inquiryId: string) => {
    setPendingInquiryId(inquiryId);
    handleViewChange("inquiries");
  };

  const handleNavigateToLead = (leadId: string) => {
    setPendingLeadId(leadId);
    handleViewChange("leads");
  };

  const linkBookingMutation = useMutation({
    mutationFn: async ({ leadId, bookingId }: { leadId: string; bookingId: string }) =>
      apiRequest("POST", `/api/leads/${leadId}/link-booking`, { bookingId }),
  });

  const handleBookingCreatedFromLead = (booking: any) => {
    const leadId = bookingPrefill?.__leadId;
    if (leadId && booking?._id) {
      linkBookingMutation.mutate({ leadId, bookingId: booking._id });
    }
    setCurrentView("dashboard");
  };

  const goToLiveOpsBucket = (bucket: LiveOpsBucket) => {
    setLiveOpsInitialTab(bucket);
    handleViewChange("live-bookings");
  };

  const goToFleetStatus = (status: string) => {
    setVehicleStatusFilter(status);
    handleViewChange("fleet");
  };

  const goToDriverStatus = (status: string) => {
    setDriverStatusFilter(status);
    handleViewChange("drivers");
  };

  const goToBookingSource = (source: string) => {
    setSourceFilter(source);
    handleViewChange("history");
  };

  // Delete mutations
  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/vehicles/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete vehicle');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const deleteDriverMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drivers/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete driver');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const completeBookingMutation = useMutation({
    // Was PUT /api/bookings/:id — that route explicitly rejects any
    // `status` field ("Use POST /api/bookings/:id/status to change booking
    // status") specifically so status changes always go through the one
    // state-machine-validated path that also credits reward points and
    // recomputes customer stats. This "Complete" button (Booking History)
    // was therefore always failing with a 400 — and, with no onError
    // handler below, failing completely silently. A completed booking
    // credited via Live Bookings' own working status control was fine;
    // this one, wherever it was used instead, never actually completed
    // anything.
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/bookings/${id}/status`, { status: 'completed' });
      return res.json();
    },
    onSuccess: (booking: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/upcoming-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      const customerId = booking?.customerId ? String(booking.customerId) : undefined;
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/rewards`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/bookings`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/payments`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/financial-summary`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      }
      toast({ variant: "success", title: "Booking completed" });
    },
    onError: (error: any) => {
      toast({ title: "Could not complete booking", description: extractApiErrorMessage(error), variant: "destructive" });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PUT', `/api/bookings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/upcoming-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowEditBookingForm(false);
      setEditingBooking(null);
      toast({
        variant: "success",
        title: "Booking Updated",
        description: "Booking details have been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking",
        variant: "destructive",
      });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async ({ id, cancellationReason }: { id: string; cancellationReason: string }) => {
      return await apiRequest('POST', `/api/bookings/${id}/cancel`, { cancellationReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/upcoming-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setShowCancelDialog(false);
      setCancellingBooking(null);
      setCancellationReason("");
      toast({
        variant: "success",
        title: "Booking Cancelled",
        description: "The booking has been successfully cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel booking",
        variant: "destructive",
      });
    },
  });

  const handleEditVehicle = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setShowVehicleForm(true);
  };

  const handleViewVehicle = (vehicle: any) => {
    setViewingVehicle(vehicle);
  };

  const handleEditDriver = (driver: any) => {
    setEditingDriver(driver);
    setShowDriverForm(true);
  };

  const handleViewDriver = (driver: any) => {
    setViewingDriver(driver);
  };

  const handleViewBooking = (booking: any) => {
    setViewingBooking(booking);
  };

  const handleEditBooking = (booking: any) => {
    setEditingBooking(booking);
    setShowEditBookingForm(true);
  };

  const handleDeleteVehicle = (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      deleteVehicleMutation.mutate(id);
    }
  };

  const handleDeleteDriver = (id: string) => {
    if (confirm('Are you sure you want to delete this driver?')) {
      deleteDriverMutation.mutate(id);
    }
  };

  const handleCompleteBooking = (id: string) => {
    if (confirm('Are you sure you want to mark this booking as completed?')) {
      completeBookingMutation.mutate(id);
    }
  };

  const handleCancelBooking = (booking: any) => {
    setCancellingBooking(booking);
    setShowCancelDialog(true);
  };

  const handleGenerateInvoice = (booking: any) => {
    setInvoiceBooking(booking);
    setShowInvoiceModal(true);
  };

  const handleConfirmCancelBooking = () => {
    if (!cancellationReason.trim()) {
      toast({
        title: "Cancellation Reason Required",
        description: "Please provide a reason for cancelling this booking",
        variant: "destructive",
      });
      return;
    }

    cancelBookingMutation.mutate({
      id: cancellingBooking._id || cancellingBooking.id,
      cancellationReason: cancellationReason.trim()
    });
  };

  const { data: upcomingBookings = [] } = useQuery<any[]>({
    queryKey: ["/api/bookings/upcoming"],
  });

  // Today/Tomorrow/Future/All Upcoming tabs on the Dashboard Overview's
  // "Upcoming Bookings" card. Deliberately a separate query from
  // upcomingBookings above (which stays wired to its existing invalidations
  // untouched) — see docs/DASHBOARD_SAFE_CHANGE_PLAN.md for why the old
  // /api/bookings/upcoming source isn't reused here (stale status filter).
  const [upcomingTab, setUpcomingTab] = useState<"today" | "tomorrow" | "future" | "all">("today");
  const {
    data: classifiedUpcoming,
    isLoading: isUpcomingLoading,
    isError: isUpcomingError,
    refetch: refetchUpcoming,
    dataUpdatedAt: upcomingUpdatedAt,
  } = useQuery<{ today: any[]; tomorrow: any[]; future: any[]; all: any[]; truncated: boolean }>({
    queryKey: ["/api/dashboard/upcoming-bookings"],
  });

  // Live Operations mini-board on the Dashboard Overview. Reuses the
  // already-existing, already-correct /api/operations/live-bookings
  // endpoint (same one the standalone Live Bookings page uses) — no new
  // backend aggregation needed here.
  const {
    data: liveOps,
    isLoading: isLiveOpsLoading,
    isError: isLiveOpsError,
    refetch: refetchLiveOps,
  } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/operations/live-bookings"],
  });

  // Finance overview (Today's cash/UPI/bank/card split) — ledger-sourced
  // (PaymentTransaction, never a raw booking-field sum), role-gated behind
  // the same canViewRevenue() check the Revenue KPI card already uses.
  const {
    data: financeSummary,
    isLoading: isFinanceLoading,
    isError: isFinanceError,
    refetch: refetchFinance,
  } = useQuery<{ cash: number; upi: number; bank: number; card: number; other: number; total: number }>({
    queryKey: ["/api/dashboard/finance-summary"],
    enabled: canViewRevenue(),
  });

  // Lead/Booking source chart — all-time count per Booking.bookingSource.
  const {
    data: leadSources,
    isLoading: isLeadSourcesLoading,
    isError: isLeadSourcesError,
    refetch: refetchLeadSources,
  } = useQuery<{ source: string; count: number }[]>({
    queryKey: ["/api/dashboard/lead-sources"],
  });

  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ["/api/drivers"],
  });

  const { data: bookings = [] } = useQuery<any[]>({
    queryKey: ["/api/bookings"],
  });

  // viewingBooking/editingBooking are snapshots taken at click-time, not derived from
  // the `bookings` query — so when a payment is recorded (or any other mutation
  // invalidates /api/bookings), the refetched list has the correct new
  // totalAmount/advanceReceived/paymentStatus, but the open dialog kept showing the
  // stale snapshot, most visibly as an incorrect "Remaining Due" in PaymentSection.
  // Re-sync both to the latest matching record whenever the list refetches.
  useEffect(() => {
    if (!bookings.length) return;
    setViewingBooking((prev: any) => {
      if (!prev) return prev;
      const fresh = bookings.find((b: any) => (b._id || b.id) === (prev._id || prev.id));
      return fresh || prev;
    });
    setEditingBooking((prev: any) => {
      if (!prev) return prev;
      const fresh = bookings.find((b: any) => (b._id || b.id) === (prev._id || prev.id));
      return fresh || prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users/sub-users"],
    enabled: user?.role === 'client' || user?.role === 'admin',
  });

  // Calculate manager count for current user
  const managersCount = (users as any[])?.filter(u => u.role === 'manager').length || 0;

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 lg:mb-6">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Dashboard Overview</h1>
              <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
                <Button
                  onClick={() => handleViewChange("bookings")}
                  className="w-full sm:w-auto h-10 lg:h-11 text-sm lg:text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Create New Booking
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleViewChange("fleet")}
                  className="w-full sm:w-auto h-10 lg:h-11 text-sm lg:text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Manage Fleet
                </Button>
              </div>
            </div>
            
            <EnhancedStats />
            
            {/* Upcoming Bookings */}
            <Card>
              <CardHeader className="pb-4 lg:pb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 lg:gap-4">
                  <CardTitle className="text-lg sm:text-xl lg:text-2xl">Upcoming Bookings</CardTitle>
                  {upcomingUpdatedAt > 0 && (
                    <span className="text-xs text-gray-500">
                      Last updated {new Date(upcomingUpdatedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isUpcomingError ? (
                  <div className="text-center py-10 space-y-3">
                    <p className="text-sm text-red-600">Couldn't load upcoming bookings.</p>
                    <Button variant="outline" size="sm" onClick={() => refetchUpcoming()}>Retry</Button>
                  </div>
                ) : isUpcomingLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <Tabs value={upcomingTab} onValueChange={(v) => setUpcomingTab(v as typeof upcomingTab)}>
                    <TabsList>
                      <TabsTrigger value="today">Today ({classifiedUpcoming?.today.length ?? 0})</TabsTrigger>
                      <TabsTrigger value="tomorrow">Tomorrow ({classifiedUpcoming?.tomorrow.length ?? 0})</TabsTrigger>
                      <TabsTrigger value="future">Future ({classifiedUpcoming?.future.length ?? 0})</TabsTrigger>
                      <TabsTrigger value="all">All Upcoming ({classifiedUpcoming?.all.length ?? 0})</TabsTrigger>
                    </TabsList>

                    {(["today", "tomorrow", "future", "all"] as const).map((tabKey) => {
                      const list = classifiedUpcoming?.[tabKey] ?? [];
                      const emptyMessage =
                        tabKey === "today" ? "No upcoming bookings for today." :
                        tabKey === "tomorrow" ? "No upcoming bookings for tomorrow." :
                        tabKey === "future" ? "No bookings scheduled beyond tomorrow." :
                        "No upcoming bookings.";
                      return (
                        <TabsContent key={tabKey} value={tabKey}>
                          {list.length === 0 ? (
                            <div className="text-center text-gray-500 py-12 space-y-3">
                              <div className="text-base">{emptyMessage}</div>
                              <Button size="sm" onClick={() => handleViewChange("bookings")}>Create Booking</Button>
                            </div>
                          ) : (
                            <>
                              {/* Mobile Card View */}
                              <div className="block sm:hidden space-y-3">
                                {list.map((booking: any) => {
                                  const vehicle = booking.vehicleId && typeof booking.vehicleId === "object" ? booking.vehicleId : null;
                                  const driver = booking.driverId && typeof booking.driverId === "object" ? booking.driverId : null;
                                  const balanceDue = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0));
                                  return (
                                    <button
                                      key={booking._id || booking.id}
                                      type="button"
                                      onClick={() => setViewingBooking(booking)}
                                      className="w-full text-left border rounded-lg p-4 space-y-2 hover:bg-gray-50 transition-colors"
                                    >
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="font-medium">{booking.customerName}</div>
                                          <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                                        </div>
                                        <Badge variant="default">{booking.status}</Badge>
                                      </div>
                                      <div className="text-sm">
                                        <div><span className="font-medium">Pickup:</span> {new Date(booking.pickupDate).toLocaleDateString()} at {booking.pickupTime} — {booking.pickupLocation || "Not specified"}</div>
                                        <div><span className="font-medium">Route:</span> {booking.pickupLocation || "Not specified"} to {booking.dropoffLocation || "Not specified"}</div>
                                        <div><span className="font-medium">Vehicle:</span> {vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "Not assigned"}</div>
                                        <div><span className="font-medium">Driver:</span> {driver ? driver.name : (booking.bookingType === "self_drive" ? "Self Drive" : "Not assigned")}</div>
                                        <div><span className="font-medium">Balance Due:</span> ₹{balanceDue}</div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Desktop Table View */}
                              <div className="hidden sm:block overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50 lg:h-12">
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Booking</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Customer</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Pickup</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Route</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Vehicle</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Driver</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Status</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Payment</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Assignment</TableHead>
                                      <TableHead className="font-semibold lg:text-base lg:px-6">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {list.map((booking: any) => {
                                      const vehicle = booking.vehicleId && typeof booking.vehicleId === "object" ? booking.vehicleId : null;
                                      const driver = booking.driverId && typeof booking.driverId === "object" ? booking.driverId : null;
                                      const balanceDue = Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0));
                                      const vehicleAssigned = !!vehicle;
                                      const driverAssigned = booking.bookingType === "self_drive" ? true : !!driver;
                                      const assignmentLabel = vehicleAssigned && driverAssigned ? "Fully Assigned" : (!vehicleAssigned && !driverAssigned ? "Unassigned" : "Partially Assigned");
                                      return (
                                        <TableRow
                                          key={booking._id || booking.id}
                                          className="hover:bg-gray-50 lg:h-16 cursor-pointer"
                                          onClick={() => setViewingBooking(booking)}
                                        >
                                          <TableCell className="lg:px-6 lg:py-4 font-medium">{booking.bookingId}</TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            <div className="font-medium lg:text-base">{booking.customerName}</div>
                                            <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            <div className="lg:text-base">{new Date(booking.pickupDate).toLocaleDateString()}</div>
                                            <div className="text-sm text-gray-500">{booking.pickupTime}</div>
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            <div className="font-medium lg:text-base">{booking.pickupLocation || "Not specified"}</div>
                                            <div className="text-sm text-gray-500">to {booking.dropoffLocation || "Not specified"}</div>
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            {vehicle ? (
                                              <>
                                                <div className="font-medium lg:text-base">{vehicle.make} {vehicle.model}</div>
                                                {vehicle.licensePlate && <div className="text-sm text-gray-500">{vehicle.licensePlate}</div>}
                                              </>
                                            ) : <span className="text-gray-400">Not assigned</span>}
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            {driver ? (
                                              <>
                                                <div className="font-medium lg:text-base">{driver.name}</div>
                                                {driver.phone && <div className="text-sm text-gray-500">{driver.phone}</div>}
                                              </>
                                            ) : booking.bookingType === "self_drive" ? (
                                              <span className="text-gray-500">Self Drive</span>
                                            ) : <span className="text-gray-400">Not assigned</span>}
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            <Badge variant="default" className="lg:text-sm lg:px-3 lg:py-1">{booking.status}</Badge>
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            <div className="font-semibold lg:text-base text-green-600">₹{booking.totalAmount || 0}</div>
                                            <div className="text-sm text-gray-500">Due ₹{balanceDue}</div>
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            <Badge variant={assignmentLabel === "Fully Assigned" ? "default" : assignmentLabel === "Unassigned" ? "destructive" : "secondary"} className="lg:text-sm lg:px-3 lg:py-1">
                                              {assignmentLabel}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="lg:px-6 lg:py-4">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => { e.stopPropagation(); setViewingBooking(booking); }}
                                            >
                                              View
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                                {tabKey !== "today" && tabKey !== "tomorrow" && classifiedUpcoming?.truncated && (
                                  <div className="text-center py-4">
                                    <Button variant="outline" size="sm" onClick={() => handleViewChange("history")}>
                                      Showing first 200 — View All in Booking History
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                )}
              </CardContent>
            </Card>

            {/* Live Operations */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl">Live Operations</CardTitle>
              </CardHeader>
              <CardContent>
                {isLiveOpsError ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-sm text-red-600">Couldn't load live operations.</p>
                    <Button variant="outline" size="sm" onClick={() => refetchLiveOps()}>Retry</Button>
                  </div>
                ) : isLiveOpsLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-lg" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {([
                      { key: "startDue", label: "Start Due", emphasis: "neutral" },
                      { key: "startDelayed", label: "Delayed Pickup", emphasis: "critical" },
                      { key: "ongoing", label: "Running Trips", emphasis: "neutral" },
                      { key: "endingSoon", label: "Ending Soon", emphasis: "warn" },
                      { key: "completionOverdue", label: "Completion Overdue", emphasis: "critical" },
                      { key: "paymentPending", label: "Payment Pending", emphasis: "warn" },
                      { key: "unassigned", label: "Unassigned", emphasis: "critical" },
                    ] as const).map(({ key, label, emphasis }) => {
                      const count = liveOps?.[key]?.length ?? 0;
                      const colorClasses =
                        emphasis === "critical" ? "border-red-200 bg-red-50 hover:bg-red-100" :
                        emphasis === "warn" ? "border-amber-200 bg-amber-50 hover:bg-amber-100" :
                        "border-blue-200 bg-blue-50 hover:bg-blue-100";
                      const textClasses =
                        emphasis === "critical" ? "text-red-700" :
                        emphasis === "warn" ? "text-amber-700" :
                        "text-blue-700";
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => goToLiveOpsBucket(key)}
                          className={`text-left border rounded-lg p-3 lg:p-4 transition-colors ${colorClasses}`}
                        >
                          <div className={`text-2xl font-bold ${textClasses}`}>{count}</div>
                          <div className="text-xs lg:text-sm text-gray-700">{label}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fleet and Driver Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">Fleet Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { status: "available", label: "Available", color: "bg-green-50 border-green-200 hover:bg-green-100 text-green-700" },
                      { status: "on_trip", label: "On Trip", color: "bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700" },
                      { status: "maintenance", label: "Maintenance", color: "bg-red-50 border-red-200 hover:bg-red-100 text-red-700" },
                    ] as const).map(({ status, label, color }) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() => goToFleetStatus(status)}
                        className={`text-left border rounded-lg p-3 transition-colors ${color}`}
                      >
                        <div className="text-xl font-bold">{vehicles.filter((v: any) => v.status === status).length}</div>
                        <div className="text-xs text-gray-700">{label}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">Driver Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { status: "available", label: "Available", color: "bg-green-50 border-green-200 hover:bg-green-100 text-green-700" },
                      { status: "on_duty", label: "On Duty", color: "bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700" },
                      { status: "inactive", label: "Inactive", color: "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700" },
                    ] as const).map(({ status, label, color }) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() => goToDriverStatus(status)}
                        className={`text-left border rounded-lg p-3 transition-colors ${color}`}
                      >
                        <div className="text-xl font-bold">{drivers.filter((d: any) => d.status === status).length}</div>
                        <div className="text-xs text-gray-700">{label}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Finance Overview and Lead/Booking Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {canViewRevenue() && (
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => handleViewChange("revenue")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleViewChange("revenue"); } }}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg sm:text-xl">Today's Collection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isFinanceError ? (
                      <div className="text-center py-6 space-y-3">
                        <p className="text-sm text-red-600">Couldn't load today's collection.</p>
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); refetchFinance(); }}>Retry</Button>
                      </div>
                    ) : isFinanceLoading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />)}
                      </div>
                    ) : (
                      <>
                        <div className="text-3xl font-bold text-green-700 mb-4">
                          ₹{(financeSummary?.total ?? 0).toLocaleString('en-IN')}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {([
                            { key: "cash", label: "Cash" },
                            { key: "upi", label: "UPI" },
                            { key: "bank", label: "Bank" },
                            { key: "card", label: "Card" },
                            { key: "other", label: "Other" },
                          ] as const).map(({ key, label }) => (
                            <div key={key} className="border rounded-lg p-3 bg-gray-50">
                              <div className="text-lg font-semibold text-gray-900">₹{(financeSummary?.[key] ?? 0).toLocaleString('en-IN')}</div>
                              <div className="text-xs text-gray-600">{label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg sm:text-xl">Booking Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLeadSourcesError ? (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-sm text-red-600">Couldn't load booking sources.</p>
                      <Button variant="outline" size="sm" onClick={() => refetchLeadSources()}>Retry</Button>
                    </div>
                  ) : isLeadSourcesLoading ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-8 bg-gray-100 rounded-lg" />)}
                    </div>
                  ) : !leadSources || leadSources.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">No bookings yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const maxCount = Math.max(...leadSources.map((s) => s.count), 1);
                        return leadSources.map(({ source, count }) => (
                          <button
                            type="button"
                            key={source}
                            onClick={() => goToBookingSource(source)}
                            className="w-full text-left group"
                          >
                            <div className="flex justify-between items-center text-sm mb-1">
                              <span className="text-gray-700 capitalize group-hover:text-blue-700">{source.replace(/_/g, ' ')}</span>
                              <span className="font-medium text-gray-900">{count}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400 group-hover:bg-blue-600 transition-colors rounded-full"
                                style={{ width: `${Math.max(4, Math.round((count / maxCount) * 100))}%` }}
                              />
                            </div>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewChange("bookings")}>
                <CardContent className="p-4 lg:p-6 text-center">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3 lg:mb-4">
                    <span className="text-blue-600 text-xl lg:text-2xl">+</span>
                  </div>
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Add Booking</h3>
                  <p className="text-sm text-gray-600 mb-3 lg:mb-4">Create a new booking for your customers</p>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    Get Started
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewChange("fleet")}>
                <CardContent className="p-4 lg:p-6 text-center">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3 lg:mb-4">
                    <span className="text-green-600 text-xl lg:text-2xl">🚗</span>
                  </div>
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Manage Fleet</h3>
                  <p className="text-sm text-gray-600 mb-3 lg:mb-4">Add, edit or view your vehicle fleet</p>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    View Fleet
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleViewChange("revenue")}>
                <CardContent className="p-4 lg:p-6 text-center">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3 lg:mb-4">
                    <span className="text-purple-600 text-xl lg:text-2xl">📊</span>
                  </div>
                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Revenue Report</h3>
                  <p className="text-sm text-gray-600 mb-3 lg:mb-4">View detailed revenue analytics</p>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    View Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "bookings": {
        const { __leadId, ...formPrefill } = bookingPrefill || {};
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Booking</h1>
            </div>
            <EnhancedBookingForm
              onSuccess={bookingPrefill ? handleBookingCreatedFromLead : () => setCurrentView("dashboard")}
              initialValues={bookingPrefill ? formPrefill : undefined}
            />
          </div>
        );
      }

      case "fleet":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fleet Management</h1>
              {canManageFleet() && (
                <Dialog open={showVehicleForm} onOpenChange={(open) => {
                  setShowVehicleForm(open);
                  if (!open) {
                    setEditingVehicle(null); // Reset editing state when dialog closes
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      onClick={() => setEditingVehicle(null)} // Reset editing state when adding new vehicle
                    >
                      Add Vehicle
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
                  </DialogHeader>
                  <VehicleForm 
                    vehicle={editingVehicle} 
                    onSuccess={() => {
                      setShowVehicleForm(false);
                      setEditingVehicle(null);
                    }} 
                  />
                </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600">🚗</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">{vehicles.length}</h3>
                      <p className="text-gray-600">Total Vehicles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600">✓</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {vehicles.filter((v: any) => v.status === "available").length}
                      </h3>
                      <p className="text-gray-600">Available</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <span className="text-yellow-600">⏰</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {vehicles.filter((v: any) => v.status === "on_trip").length}
                      </h3>
                      <p className="text-gray-600">On Trip</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <span className="text-red-600">🔧</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {vehicles.filter((v: any) => v.status === "maintenance").length}
                      </h3>
                      <p className="text-gray-600">Maintenance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <CardTitle className="text-lg sm:text-xl">Vehicle List</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Input
                      placeholder="Search vehicles..."
                      value={vehicleSearchTerm}
                      onChange={(e) => setVehicleSearchTerm(e.target.value)}
                      className="w-full sm:w-48 lg:w-64"
                    />
                    <Select value={vehicleStatusFilter} onValueChange={setVehicleStatusFilter}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="on_trip">On Trip</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredVehicles = vehicles.filter((v: any) => {
                    const matchesStatus = vehicleStatusFilter === "all" || v.status === vehicleStatusFilter;
                    const term = vehicleSearchTerm.trim().toLowerCase();
                    const matchesSearch = term === "" ||
                      `${v.make || ""} ${v.vehicleModel || v.model || ""}`.toLowerCase().includes(term) ||
                      (v.licensePlate || v.registrationNumber || "").toLowerCase().includes(term);
                    return matchesStatus && matchesSearch;
                  });
                  return (
                <>
                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-3">
                  {filteredVehicles.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      {vehicles.length === 0 ? "No vehicles found" : "No vehicles match your search/filter"}
                    </div>
                  ) : (
                    filteredVehicles.map((vehicle: any) => (
                      <div key={vehicle._id || vehicle.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <span className="text-blue-600">🚗</span>
                            </div>
                            <div className="ml-3">
                              <div className="font-medium">{vehicle.make} {vehicle.vehicleModel || vehicle.model || ''}</div>
                              <div className="text-sm text-gray-500">{vehicle.licensePlate || vehicle.registrationNumber || 'No registration'}</div>
                            </div>
                          </div>
                          <Badge variant={vehicle.status === "available" ? "default" : vehicle.status === "on_trip" ? "secondary" : "destructive"}>
                            {vehicle.status}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Type:</span> {vehicle.type || vehicle.vehicleType || 'Not specified'}</div>
                          <div><span className="font-medium">Rate:</span> ₹{vehicle.pricePerDay || vehicle.ratePerDay || 0}/day</div>
                          <div><span className="font-medium">Rate/km:</span> {vehicle.pricePerKm ? `₹${vehicle.pricePerKm}/km` : <span className="text-gray-400">Not set</span>}</div>
                          <div><span className="font-medium">Year:</span> {vehicle.year || 'Not specified'}</div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleViewVehicle(vehicle)}>
                            View Profile
                          </Button>
                          {canManageFleet() && <>
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditVehicle(vehicle)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDeleteVehicle(vehicle._id || vehicle.id)}>
                              Delete
                            </Button>
                          </>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Registration</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Rate/Day</TableHead>
                        <TableHead>Rate/Km</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVehicles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                            {vehicles.length === 0 ? "No vehicles found" : "No vehicles match your search/filter"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVehicles.map((vehicle: any) => (
                          <TableRow key={vehicle._id || vehicle.id}>
                            <TableCell>
                              <div className="flex items-center">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <span className="text-blue-600">🚗</span>
                                </div>
                                <div className="ml-4">
                                  <div className="font-medium">{vehicle.make} {vehicle.vehicleModel || vehicle.model || ''}</div>
                                  <div className="text-sm text-gray-500">{vehicle.year ? `${vehicle.year} Model` : 'Vehicle'}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{vehicle.licensePlate || vehicle.registrationNumber || 'Not specified'}</TableCell>
                            <TableCell className="capitalize">{vehicle.type || vehicle.vehicleType || 'Not specified'}</TableCell>
                            <TableCell>₹{vehicle.pricePerDay || vehicle.ratePerDay || 0}</TableCell>
                            <TableCell>
                              {vehicle.pricePerKm ? (
                                <span>₹{vehicle.pricePerKm}/km</span>
                              ) : (
                                <span className="text-gray-400">Not set</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={vehicle.status === "available" ? "default" : "secondary"}>
                                {vehicle.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700"
                                  onClick={() => handleViewVehicle(vehicle)}
                                >
                                  View Profile
                                </Button>
                                {canManageFleet() && <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditVehicle(vehicle)}
                                  >
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteVehicle(vehicle._id || vehicle.id)}
                                    disabled={deleteVehicleMutation.isPending}
                                  >
                                    Delete
                                  </Button>
                                </>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        );

      case "drivers":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Driver Management</h1>
              <Dialog open={showDriverForm} onOpenChange={(open) => {
                setShowDriverForm(open);
                if (!open) {
                  setEditingDriver(null); // Reset editing state when dialog closes
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    onClick={() => setEditingDriver(null)} // Reset editing state when adding new driver
                  >
                    Add Driver
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
                  </DialogHeader>
                  <DriverForm 
                    driver={editingDriver} 
                    onSuccess={() => {
                      setShowDriverForm(false);
                      setEditingDriver(null);
                    }} 
                  />
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-lg sm:text-xl">Drivers</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Input
                      placeholder="Search drivers..."
                      value={driverSearchTerm}
                      onChange={(e) => setDriverSearchTerm(e.target.value)}
                      className="w-full sm:w-48 lg:w-64"
                    />
                    <Select value={driverStatusFilter} onValueChange={setDriverStatusFilter}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="on_duty">On Duty</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filteredDrivers = drivers.filter((d: any) => {
                    const matchesStatus = driverStatusFilter === "all" || d.status === driverStatusFilter;
                    const term = driverSearchTerm.trim().toLowerCase();
                    const matchesSearch = term === "" ||
                      (d.name || "").toLowerCase().includes(term) ||
                      (d.phone || "").toLowerCase().includes(term);
                    return matchesStatus && matchesSearch;
                  });
                  return (
                <>
                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-3">
                  {filteredDrivers.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      {drivers.length === 0 ? "No drivers found" : "No drivers match your search/filter"}
                    </div>
                  ) : (
                    filteredDrivers.map((driver: any) => (
                      <div key={driver._id || driver.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <span className="text-green-600">👤</span>
                            </div>
                            <div className="ml-3">
                              <div className="font-medium">{driver.name}</div>
                              <div className="text-sm text-gray-500">{driver.phone}</div>
                            </div>
                          </div>
                          <Badge variant={driver.status === "available" ? "default" : driver.status === "on_duty" ? "secondary" : "destructive"}>
                            {driver.status}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">License:</span> {driver.licenseNumber || "N/A"}</div>
                          <div><span className="font-medium">Experience:</span> {driver.experience || "N/A"} years</div>
                          <div className="flex items-center">
                            <span className="font-medium">Rating:</span>
                            <span className="text-yellow-500 ml-2">⭐</span>
                            <span className="ml-1">{driver.rating ?? "Not rated"}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleViewDriver(driver)}>
                            View Profile
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditDriver(driver)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDeleteDriver(driver._id || driver.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDrivers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                          {drivers.length === 0 ? "No drivers found" : "No drivers match your search/filter"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDrivers.map((driver: any) => (
                        <TableRow key={driver._id || driver.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-green-600">👤</span>
                              </div>
                              <div className="ml-4">
                                <div className="font-medium">{driver.name}</div>
                                <div className="text-sm text-gray-500">ID: {driver.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{driver.phone}</TableCell>
                          <TableCell>{driver.licenseNumber}</TableCell>
                          <TableCell>{driver.experience} years</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className="text-yellow-500">⭐</span>
                              <span className="ml-1">{driver.rating ?? "Not rated"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={driver.status === "available" ? "default" : 
                                      driver.status === "on_duty" ? "secondary" : "destructive"}
                            >
                              {driver.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => handleViewDriver(driver)}
                              >
                                View Profile
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditDriver(driver)}
                              >
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteDriver(driver._id || driver.id)}
                                disabled={deleteDriverMutation.isPending}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  </Table>
                </div>
                </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        );

      case "customers":
        return <CustomersPage onEditBooking={handleEditBooking} onNewBooking={handleConvertLeadToBooking} initialCustomerId={pendingCustomerId} onNavigateToInquiry={handleNavigateToInquiry} onNavigateToLead={handleNavigateToLead} />;

      case "after-sales":
        return <AfterSalesPage />;

      case "campaigns":
        return <CampaignsPage />;

      case "rewards-referrals":
        return <RewardsReferralsDashboard />;

      case "inquiries":
        return <InquiriesPage initialInquiryId={pendingInquiryId} />;

      case "leads":
        return <LeadsPage onConvertToBooking={handleConvertLeadToBooking} initialLeadId={pendingLeadId} />;

      case "followups":
        return <FollowUpsPage />;

      case "vendors":
        return <VendorsPage />;

      case "history":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking History</h1>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bookings</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filter by Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="self_drive">Self Drive</SelectItem>
                    <SelectItem value="with_driver">With Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">All Bookings</CardTitle>
                    {(statusFilter !== "all" || typeFilter !== "all" || sourceFilter !== "all") && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-500">Filters active:</span>
                        {statusFilter !== "all" && <Badge variant="secondary" className="text-xs">{statusFilter}</Badge>}
                        {typeFilter !== "all" && <Badge variant="secondary" className="text-xs">{typeFilter.replace('_', ' ')}</Badge>}
                        {sourceFilter !== "all" && <Badge variant="secondary" className="text-xs capitalize">{sourceFilter.replace(/_/g, ' ')}</Badge>}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {setStatusFilter("all"); setTypeFilter("all"); setSourceFilter("all");}}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Clear filters
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Search bookings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full sm:w-48 lg:w-64"
                    />
                    <BookingHistoryPDF 
                      bookings={bookings as any[]} 
                      vehicles={vehicles as any[]} 
                      drivers={drivers as any[]} 
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Show all bookings (filtered by search term if any) */}
                    {(bookings as any[])
                      .filter((booking: any) => {
                        // Search filter
                        const matchesSearch = searchTerm === "" ||
                          booking.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (booking.bookingCode && booking.bookingCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          booking.customerPhone.includes(searchTerm);
                        
                        // Status filter
                        const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
                        
                        // Type filter
                        const matchesType = typeFilter === "all" || booking.bookingType === typeFilter;

                        // Source filter — matches the same fallback the
                        // /api/dashboard/lead-sources aggregation uses
                        // (a booking with no bookingSource groups under
                        // "direct_customer"), so clicking that bar there
                        // actually shows the bookings it counted.
                        const matchesSource = sourceFilter === "all" || (booking.bookingSource || "direct_customer") === sourceFilter;

                        return matchesSearch && matchesStatus && matchesType && matchesSource;
                      })
                      .sort((a: any, b: any) => {
                        // Sort by createdAt date in descending order (newest first)
                        const dateA = new Date(a.createdAt || a.pickupDate).getTime();
                        const dateB = new Date(b.createdAt || b.pickupDate).getTime();
                        return dateB - dateA;
                      })
                      .map((booking: any) => (
                      <TableRow key={booking._id || booking.id}>
                        <TableCell>
                          <div className="font-medium">{booking.bookingId}</div>
                          {booking.bookingCode && (
                            <div className="text-xs text-gray-500 font-mono">{booking.bookingCode}</div>
                          )}
                          <div className="text-sm text-gray-500">
                            {new Date(booking.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {(booking.bookingSource || "direct_customer").replace(/_/g, " ")}
                          </Badge>
                          {booking.sourceName && (
                            <div className="text-xs text-gray-500 mt-1">{booking.sourceName}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{booking.customerName}</div>
                          <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                              <span className="text-blue-600">🚗</span>
                            </div>
                            <div>
                              <div className="font-medium">
                                {(vehicles as any[]).find(v => (v._id || v.id) === booking.vehicleId)?.make} {(vehicles as any[]).find(v => (v._id || v.id) === booking.vehicleId)?.model}
                              </div>
                              <div className="text-sm text-gray-500">
                                {(vehicles as any[]).find(v => (v._id || v.id) === booking.vehicleId)?.registrationNumber}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {booking.pickupLocation || "Not specified"}
                          </div>
                          <div className="text-sm text-gray-500">
                            to {booking.dropoffLocation || "Not specified"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {booking.bookingType === "with_driver" ? (
                            <div>
                              <div className="font-medium">
                                {(drivers as any[]).find(d => d.id === booking.driverId)?.name || "Assigned"}
                              </div>
                              <div className="text-sm text-gray-500">With Driver</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-gray-500">Self Drive</div>
                            </div>
                          )}
                          <div className="mt-1">
                            <Badge variant="outline" className="text-xs">
                              {booking.tripType === "round_trip" ? "Round Trip" :
                               booking.tripType === "local" ? "Local" :
                               booking.tripType === "airport" && booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                               booking.tripType === "airport" ? "Airport" :
                               booking.dropoffLocation === "Local" ? "Local" :
                               booking.dropoffLocation === "Not Decided Yet" ? "Not Decided" :
                               booking.tripType === "one_way" ? "One Way" : "One Way"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {new Date(booking.pickupDate).toLocaleDateString()} at {booking.pickupTime}
                          </div>
                          <div className="text-sm text-gray-500">
                            to {new Date(booking.returnDate).toLocaleDateString()} at {booking.returnTime}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">₹{booking.totalAmount || booking.amount || 0}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                booking.status === "confirmed" ? "default" : 
                                booking.status === "completed" ? "secondary" : 
                                booking.status === "cancelled" ? "destructive" :
                                "destructive"
                              }
                              className={
                                booking.status === "cancelled" ? "bg-red-100 text-red-800 hover:bg-red-200" : ""
                              }
                            >
                              {booking.status}
                            </Badge>
                            {booking.status === "cancelled" && booking.cancellationReason && (
                              <span 
                                className="text-xs text-gray-500 cursor-help" 
                                title={`Reason: ${booking.cancellationReason}`}
                              >
                                ⓘ
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {booking.createdBy?.userId || 'System'}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {booking.createdBy?.role || 'admin'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {booking.createdAt ? new Date(booking.createdAt).toLocaleTimeString() : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewBooking(booking)}
                            >
                              View
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleGenerateInvoice(booking)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Generate Invoice
                            </Button>
                            {booking.status === "confirmed" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditBooking(booking)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelBooking(booking)}
                                  disabled={cancelBookingMutation.isPending}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                            {/* "completed" is only a valid next status from these
                                four (server/services/bookingStateMachine.ts) — a
                                "confirmed" booking hasn't even had a vehicle/
                                driver assigned or been dispatched yet. This
                                button used to show (and only show) for
                                "confirmed", where clicking it could never
                                succeed regardless of which endpoint it called. */}
                            {["trip_started", "ongoing", "extended", "return_pending"].includes(booking.status) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCompleteBooking(booking._id || booking.id)}
                                disabled={completeBookingMutation.isPending}
                                className="text-green-600 hover:text-green-700"
                              >
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Show message if no bookings */}
                    {(bookings as any[]).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-gray-500 py-8">
                          No booking history found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600">📊</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600">✅</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Completed</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).filter(b => b.status === 'completed').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <span className="text-yellow-600">⏳</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Confirmed</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).filter(b => b.status === 'confirmed').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <span className="text-red-600">❌</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Cancelled</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(bookings as any[]).filter(b => b.status === 'cancelled').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case "revenue":
        return <RevenueReport />;

      case "vendor-settlement":
        return <VendorSettlementPage />;

      case "profile":
        return (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Profile Management</h1>
            </div>
            
            {/* Account Information */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Shield className="text-blue-600" size={20} />
                  <span>Account Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">User ID</Label>
                    <p className="text-sm text-gray-900 break-all">{user?.userId}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Role</Label>
                    <div>
                      <Badge variant="default" className="text-xs capitalize">
                        {user?.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Account Status</Label>
                    <div>
                      <Badge variant={(user as any)?.isActive ? "default" : "secondary"} className="text-xs">
                        {(user as any)?.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Account Created</Label>
                    <p className="text-sm text-gray-900">
                      {(user as any)?.tenantId?.createdAt ? new Date((user as any).tenantId.createdAt).toLocaleDateString() : 'Not available'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Plan Section */}
            {user?.role === 'client' && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <Star className="text-purple-600" size={20} />
                    <span>Subscription Plan</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Current Plan Info */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 capitalize">
                            {(user as any)?.tenantId?.subscriptionPlan || 'Starter'} Plan
                          </h3>
                          <p className="text-sm text-gray-600">Your current subscription</p>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant="outline" 
                            className={`text-xs border-2 ${
                              (user as any)?.tenantId?.subscriptionPlan === 'pro' 
                                ? 'border-blue-500 text-blue-700 bg-blue-50'
                                : (user as any)?.tenantId?.subscriptionPlan === 'custom'
                                ? 'border-purple-500 text-purple-700 bg-purple-50'
                                : 'border-green-500 text-green-700 bg-green-50'
                            }`}
                          >
                            {(user as any)?.tenantId?.subscriptionPlan === 'pro' ? 'PRO' :
                             (user as any)?.tenantId?.subscriptionPlan === 'custom' ? 'CUSTOM' : 'STARTER'}
                          </Badge>
                        </div>
                      </div>

                      {/* Plan Limits with Usage */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Car className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium">Vehicles</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {(vehicles as any[])?.length || 0} / {(user as any)?.tenantId?.limits?.vehicles || 6}
                            </span>
                            <div className="text-xs text-gray-500">used</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium">Drivers</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {(drivers as any[])?.length || 0} / {(user as any)?.tenantId?.limits?.drivers || 3}
                            </span>
                            <div className="text-xs text-gray-500">used</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <UserCheck className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium">Managers</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              {managersCount || 0} / {(user as any)?.tenantId?.limits?.managers || 1}
                            </span>
                            <div className="text-xs text-gray-500">used</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upgrade Section */}
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="text-md font-semibold text-gray-900 mb-2">Need More Resources?</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Upgrade your plan to get more vehicles, drivers, and advanced features.
                        </p>
                        <Button 
                          onClick={() => setShowContactModal(true)}
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Upgrade Plan
                        </Button>
                      </div>
                      
                      <div className="text-center text-xs text-gray-500">
                        Need help? Contact support for assistance
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Business Profile Section */}
            <BusinessProfile
              userRole={user?.role || ''}
              onShowOnboarding={() => setShowOnboarding(true)}
            />

            {/* Invoice Settings Section */}
            <InvoiceSettingsPanel userRole={user?.role || ''} />

            {/* Rewards and Referrals Settings Section */}
            <div className="mb-6">
              <RewardReferralSettingsPanel userRole={user?.role || ''} />
            </div>

            {/* Security Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Shield className="text-blue-600" size={20} />
                  <span>Security Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Password Security</h4>
                    <p className="text-sm text-gray-600">
                      Keep your account secure by updating your password regularly
                    </p>
                    <Button 
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        toast({
                          title: "Password Reset",
                          description: "Contact your administrator to reset your password",
                          duration: 4000,
                        });
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Request Password Reset
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Account Security</h4>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-800">Account Secure</span>
                      </div>
                      <p className="text-xs text-green-700 mt-1">
                        Your account is protected with secure authentication
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Login Activity</h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-800">Last Login</span>
                          <span className="text-xs text-blue-700">
                            {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-800">Login Count</span>
                          <span className="text-xs text-blue-700">{user?.loginAttempts || 0}</span>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Enhanced security monitoring active
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Features */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-4">Security Features</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Rate Limiting</p>
                        <p className="text-xs text-gray-600">Protected from brute force</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Session Security</p>
                        <p className="text-xs text-gray-600">Single session enforcement</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Password Strength</p>
                        <p className="text-xs text-gray-600">Strong password required</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Audit Tracking</p>
                        <p className="text-xs text-gray-600">All activities logged</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "expenses":
        return <ManageExpenses />;

      case "live-bookings":
        return <LiveBookings initialTab={liveOpsInitialTab} />;

      case "upcoming-bookings":
        return <UpcomingBookings />;

      case "booking-queues":
        return <BookingQueuesPanel onRowClick={(row) => handleEditBooking(row)} />;

      case "payment-dues":
        return <PaymentDues />;

      case "driver-attendance":
        return <DriverAttendancePage />;

      case "driver-leave":
        return <DriverLeavePage />;

      case "driver-performance":
        return <DriverPerformancePage />;

      case "vehicle-performance":
        return <VehiclePerformancePage />;

      case "whatsapp":
        return <WhatsAppPanel />;

      case "salary":
        // Coming Soon Message - Original salary management system is preserved below for easy restoration
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-dashed border-blue-200 max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Banknote className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
              <p className="text-gray-600 mb-4">
                The Salary Management feature is currently under development and will be available in a future update.
              </p>
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-700 font-medium">What's Coming:</p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>• Driver salary management</li>
                  <li>• Automated salary calculations</li>
                  <li>• Salary slip generation</li>
                  <li>• Role-based salary tracking</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Stay tuned for updates!
              </p>
            </div>
          </div>
        );
        
        // ORIGINAL SALARY MANAGEMENT SYSTEM - PRESERVED FOR EASY RESTORATION
        // To restore: uncomment the code below and comment out the "Coming Soon" section above
        /*
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Salary Management</h1>
              <Button
                onClick={() => setShowSalarySidebar(!showSalarySidebar)}
                variant="outline"
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Menu className="w-4 h-4" />
                {showSalarySidebar ? 'Hide' : 'Show'} Salary Menu
              </Button>
            </div>
            
            {selectedSalaryRole ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedSalaryRole} Salary Management
                    </h2>
                    <Button
                      onClick={() => setSelectedSalaryRole(null)}
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ← Back to Roles
                    </Button>
                  </div>
                  
                  {selectedSalaryRole === 'Driver' ? (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h3 className="text-lg font-medium text-gray-900">Driver Management</h3>
                        <Button
                          onClick={() => setShowDriverSelection(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Drivers for Salary
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-gray-800">All Drivers ({drivers?.length || 0})</h4>
                        
                        {drivers && drivers.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {drivers.map((driver) => (
                              <div key={driver._id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900">{driver.name}</h5>
                                    <p className="text-sm text-gray-500">{driver.phone}</p>
                                    <p className="text-xs text-gray-400">License: {driver.licenseNumber}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                  <div className="flex items-center space-x-2">
                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                      driver.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {driver.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs w-full sm:w-auto"
                                    onClick={() => {
                                      const isAlreadyAdded = driverCards.some(d => d._id === driver._id);
                                      if (!isAlreadyAdded) {
                                        setDriverCards(prev => [...prev, driver]);
                                        toast({
                                          variant: "success",
                                          title: "Driver Added",
                                          description: `${driver.name} added to salary management.`,
                                        });
                                      } else {
                                        toast({
                                          title: "Already Added",
                                          description: `${driver.name} is already in salary management.`,
                                        });
                                      }
                                    }}
                                  >
                                    {driverCards.some(d => d._id === driver._id) ? 'Added' : 'Add to Salary'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg">
                            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <p className="text-gray-600 mb-2">No drivers found</p>
                            <p className="text-sm text-gray-500">Add drivers to your fleet first</p>
                          </div>
                        )}
                      </div>
                      
                      {driverCards.length > 0 && (
                        <div className="space-y-4 mt-6">
                          <h4 className="text-md font-medium text-gray-800">Selected for Salary ({driverCards.length})</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {driverCards.map((driver) => (
                              <div key={driver._id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900">{driver.name}</h5>
                                    <p className="text-sm text-gray-500">{driver.phone}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-col sm:flex-row sm:justify-between gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                                    onClick={() => {
                                      toast({
                                        variant: "success",
                                        title: "Salary Slip Created",
                                        description: `Salary slip created for ${driver.name}.`,
                                      });
                                    }}
                                  >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Create Salary Slip
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 flex-1 sm:flex-none"
                                    onClick={() => {
                                      setDriverCards(prev => prev.filter(d => d._id !== driver._id));
                                      toast({
                                        title: "Driver Removed",
                                        description: `${driver.name} removed from salary management.`,
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {driverCards.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg mt-6">
                          <Banknote className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <p className="text-gray-600 mb-2">No drivers selected for salary management</p>
                          <p className="text-sm text-gray-500">Click "Add to Salary" on any driver above or use "Add Drivers for Salary" button</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Banknote className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">{selectedSalaryRole} Salary Management</p>
                      <p className="text-sm text-gray-500">Role-specific salary management features coming soon</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Select a role from the salary menu</p>
                <p className="text-sm text-gray-500">
                  Use the salary menu on the left to select a role and manage salary entries
                </p>
              </div>
            )}
          </div>
        );
        */

      case "users":
        return (
          <div>
            {/* Only show user management for admin and client users */}
            {(user?.role === 'admin' || user?.role === 'client') ? (
              <UserManagement />
            ) : (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Access Denied
                </h2>
                <p className="text-gray-600">You don't have permission to manage users.</p>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Unknown View
            </h2>
            <p className="text-gray-600">This section is not available.</p>
          </div>
        );
    }
  };

  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleOnboardingComplete = () => {
    console.log('Onboarding completed, hiding wizard');
    setShowOnboarding(false);
    // Refetch user data to update hasCompletedOnboarding status
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    toast({
      title: "Welcome to FleetPro!",
      description: "Your setup guide is complete. Explore your dashboard!",
    });
  };

  const handleOnboardingSkip = () => {
    console.log('Onboarding skipped, hiding wizard');
    setShowOnboarding(false);
    // Refetch user data to update hasCompletedOnboarding status
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    toast({
      title: "Setup Skipped",
      description: "You can access the setup guide anytime from your profile.",
    });
  };

  // Check if user should see onboarding wizard (first-time login)
  useEffect(() => {
    if (user && user.role === 'client') {
      console.log('User onboarding status:', user.hasCompletedOnboarding);
      if (user.hasCompletedOnboarding === false || user.hasCompletedOnboarding === undefined) {
        console.log('First-time client user detected, showing onboarding wizard');
        setShowOnboarding(true);
      }
    }
  }, [user]);

  return (
    <>
      {/* Onboarding Wizard for Client Users */}
      {showOnboarding && user?.role === 'client' && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {!showOnboarding && <DailyOperationsPopup />}

      <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mr-3"
            >
              <Menu size={20} />
            </Button>
            <h1 className="text-xl font-bold text-blue-600">FleetPro</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>

      <Sidebar
        currentView={currentView}
        onViewChange={(view) => handleViewChange(view as ViewType)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSelectCustomer={handleSelectCustomerFromSearch}
      />
      
      {/* min-w-0: flex items default to min-width:auto, which let wide
          content (e.g. tables) push this whole panel past the viewport
          instead of scrolling internally. */}
      <main className="flex-1 min-w-0 overflow-y-auto lg:ml-0 pt-16 lg:pt-0 transition-all duration-300 ease-in-out">
        <div className="px-3 sm:px-6 lg:px-8 py-4 lg:py-8">
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* View Booking Dialog */}
      <Dialog open={!!viewingBooking} onOpenChange={() => setViewingBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {viewingBooking && (
            <div className="space-y-6">
              {/* Read-only — this dialog's own contextual actions
                  (AssignVendorDialog/ExtendBookingDialog/PaymentSection/
                  TripCostSummary/BookingCommunication below) already cover
                  every status-changing action for a Booking; the stepper
                  exists to show where this record sits without duplicating
                  those, not to add a second action surface. */}
              <PipelineStepper info={bookingPipelineInfo(viewingBooking)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Booking ID</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.bookingId}</p>
                </div>
                {viewingBooking.bookingCode && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Booking Code</Label>
                    <p className="text-sm text-gray-900 font-mono tracking-wide">{viewingBooking.bookingCode}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                  <Badge variant={viewingBooking.status === "confirmed" ? "default" : viewingBooking.status === "completed" ? "secondary" : "destructive"}>
                    {viewingBooking.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Customer Name</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.customerName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Customer Phone</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.customerPhone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Booking Source</Label>
                  <p className="text-sm text-gray-900 capitalize">{(viewingBooking.bookingSource || "direct_customer").replace(/_/g, " ")}</p>
                </div>
                {viewingBooking.sourceName && (
                  <div className="md:col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <Label className="text-sm font-medium text-gray-700">Source Details</Label>
                    <p className="text-sm text-gray-900 mt-1">
                      <strong>{viewingBooking.sourceName}</strong>
                      {viewingBooking.sourceContact ? ` — ${viewingBooking.sourceContact}` : ""}
                      {viewingBooking.sourceReferenceNumber ? ` (Ref: ${viewingBooking.sourceReferenceNumber})` : ""}
                    </p>
                    {(viewingBooking.sourceCommissionType && viewingBooking.sourceCommissionAmount) ? (
                      <p className="text-sm text-gray-900">
                        Commission: {viewingBooking.sourceCommissionType === "percentage"
                          ? `${viewingBooking.sourceCommissionAmount}%`
                          : `₹${viewingBooking.sourceCommissionAmount}`}
                      </p>
                    ) : null}
                    {viewingBooking.sourceNotes && (
                      <p className="text-sm text-gray-600 mt-1">{viewingBooking.sourceNotes}</p>
                    )}
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-700">Fulfilment</Label>
                  <p className="text-sm text-gray-900">
                    {viewingBooking.fulfilmentType === "vendor" ? (
                      <>Vendor — {viewingBooking.vendorName || "unnamed"}{viewingBooking.vendorDriverName ? ` (${viewingBooking.vendorDriverName})` : ""}</>
                    ) : (
                      "Own Vehicle"
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Pickup Location</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.pickupLocation || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Drop-off Location</Label>
                  <p className="text-sm text-gray-900">{viewingBooking.dropoffLocation || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Pickup Date & Time</Label>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingBooking.pickupDate).toLocaleDateString()} at {viewingBooking.pickupTime}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Return Date & Time</Label>
                  <p className="text-sm text-gray-900">
                    {new Date(viewingBooking.returnDate).toLocaleDateString()} at {viewingBooking.returnTime}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Trip Type</Label>
                  <p className="text-sm text-gray-900">
                    {viewingBooking.tripType === "round_trip" ? "Round Trip" :
                     viewingBooking.tripType === "local" ? "Local" :
                     viewingBooking.tripType === "airport" && viewingBooking.dropoffLocation === "Not Decided Yet" ? "Not Decided Yet" :
                     viewingBooking.tripType === "airport" ? "Airport" :
                     viewingBooking.dropoffLocation === "Local" ? "Local" :
                     viewingBooking.dropoffLocation === "Not Decided Yet" ? "Not Decided Yet" :
                     viewingBooking.tripType === "one_way" ? "One Way" : "One Way"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Service Type</Label>
                  <p className="text-sm text-gray-900">
                    {viewingBooking.bookingType === "self_drive" ? "Self Drive" : "With Driver"}
                  </p>
                </div>
                {viewingBooking.thirdPartyDriverName && (
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Third-party Driver Details</Label>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-1">
                      <p className="text-sm text-gray-900">
                        <strong>Name:</strong> {viewingBooking.thirdPartyDriverName}
                      </p>
                      {viewingBooking.thirdPartyDriverPhone && (
                        <p className="text-sm text-gray-900">
                          <strong>Phone:</strong> {viewingBooking.thirdPartyDriverPhone}
                        </p>
                      )}
                      {viewingBooking.thirdPartyDriverAddress && (
                        <p className="text-sm text-gray-900">
                          <strong>Address:</strong> {viewingBooking.thirdPartyDriverAddress}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-700">Vehicle</Label>
                  <p className="text-sm text-gray-900">
                    {(() => {
                      const vehicle = (vehicles as any[]).find(v => v.id === viewingBooking.vehicleId);
                      return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber})` : "N/A";
                    })()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Total Amount</Label>
                  <p className="text-lg font-semibold text-green-600">₹{viewingBooking.totalAmount || viewingBooking.amount || 0}</p>
                </div>
                {viewingBooking.tollCharges && parseFloat(viewingBooking.tollCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Toll Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.tollCharges}</p>
                  </div>
                )}
                {viewingBooking.parkingCharges && parseFloat(viewingBooking.parkingCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Parking Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.parkingCharges}</p>
                  </div>
                )}
                {viewingBooking.petrolCharges && parseFloat(viewingBooking.petrolCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Petrol Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.petrolCharges}</p>
                  </div>
                )}
                {viewingBooking.dieselCharges && parseFloat(viewingBooking.dieselCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Diesel Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.dieselCharges}</p>
                  </div>
                )}
                {viewingBooking.cngCharges && parseFloat(viewingBooking.cngCharges) > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">CNG Charges</Label>
                    <p className="text-sm text-gray-900">₹{viewingBooking.cngCharges}</p>
                  </div>
                )}
                {viewingBooking.customerDiscussionSummary && (
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Customer Discussion Summary</Label>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{viewingBooking.customerDiscussionSummary}</p>
                  </div>
                )}
                {viewingBooking.notes && (
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Notes / Instructions</Label>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{viewingBooking.notes}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">Payment</Label>
                <PaymentSection booking={viewingBooking} />
              </div>

              {/* Renders nothing for users without trip.profitability.view —
                  not a permission-gated placeholder, genuinely absent. */}
              <TripCostSummary booking={viewingBooking} />

              {/* Renders nothing once fulfilment is already resolved and no
                  sourcing request was ever started — see the component. */}
              <ResourceFulfilmentPanel booking={viewingBooking} />

              <div className="flex justify-end gap-2">
                <AssignVendorDialog booking={viewingBooking} />
                <ExtendBookingDialog booking={viewingBooking} />
              </div>

              <BookingCommunication booking={viewingBooking} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={showEditBookingForm} onOpenChange={() => {
        setShowEditBookingForm(false);
        setEditingBooking(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking Details</DialogTitle>
          </DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Booking ID</Label>
                <p className="text-sm text-gray-900">{editingBooking.bookingId}</p>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const customerName = formData.get('customerName') as string || '';
                const baseAmount = parseFloat(formData.get('baseAmount') as string) || 0;
                const tollCharges = parseFloat(formData.get('tollCharges') as string) || 0;
                const parkingCharges = parseFloat(formData.get('parkingCharges') as string) || 0;
                const petrolCharges = parseFloat(formData.get('petrolCharges') as string) || 0;
                const dieselCharges = parseFloat(formData.get('dieselCharges') as string) || 0;
                const cngCharges = parseFloat(formData.get('cngCharges') as string) || 0;
                const thirdPartyDriverCharges = parseFloat(formData.get('thirdPartyDriverCharges') as string) || 0;
                const thirdPartyDriverName = formData.get('thirdPartyDriverName') as string || '';
                const thirdPartyDriverPhone = formData.get('thirdPartyDriverPhone') as string || '';
                const thirdPartyDriverAddress = formData.get('thirdPartyDriverAddress') as string || '';
                
                // Calculate total fuel cost and third-party driver charges (both are deductions)
                const totalFuelCost = petrolCharges + dieselCharges + cngCharges;
                const totalDeductions = totalFuelCost + thirdPartyDriverCharges;
                
                // Calculate final amount (base - toll - parking - fuel - third-party driver)
                const finalAmount = baseAmount - tollCharges - parkingCharges - totalDeductions;
                
                updateBookingMutation.mutate({
                  id: editingBooking._id || editingBooking.id,
                  data: {
                    customerName: customerName,
                    totalAmount: finalAmount,
                    tollCharges: tollCharges,
                    parkingCharges: parkingCharges,
                    petrolCharges: petrolCharges,
                    dieselCharges: dieselCharges,
                    cngCharges: cngCharges,
                    thirdPartyDriverCharges: thirdPartyDriverCharges,
                    thirdPartyDriverName: thirdPartyDriverName,
                    thirdPartyDriverPhone: thirdPartyDriverPhone,
                    thirdPartyDriverAddress: thirdPartyDriverAddress,
                  }
                });
              }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      name="customerName"
                      type="text"
                      defaultValue={editingBooking.customerName || ""}
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="baseAmount">Base Amount (₹)</Label>
                    <Input
                      id="baseAmount"
                      name="baseAmount"
                      type="number"
                      step="0.01"
                      defaultValue={(() => {
                        const currentAmount = parseFloat(editingBooking.totalAmount || editingBooking.amount) || 0;
                        const tollCharges = parseFloat(editingBooking.tollCharges) || 0;
                        const parkingCharges = parseFloat(editingBooking.parkingCharges) || 0;
                        const petrolCharges = parseFloat(editingBooking.petrolCharges) || 0;
                        const dieselCharges = parseFloat(editingBooking.dieselCharges) || 0;
                        const cngCharges = parseFloat(editingBooking.cngCharges) || 0;
                        const thirdPartyDriverCharges = parseFloat(editingBooking.thirdPartyDriverCharges) || 0;
                        const totalFuelCost = petrolCharges + dieselCharges + cngCharges;
                        const totalDeductions = totalFuelCost + thirdPartyDriverCharges;
                        return (currentAmount + tollCharges + parkingCharges + totalDeductions).toString();
                      })()}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="tollCharges">Toll Charges (₹)</Label>
                    <Input
                      id="tollCharges"
                      name="tollCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.tollCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="parkingCharges">Parking Charges (₹)</Label>
                    <Input
                      id="parkingCharges"
                      name="parkingCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.parkingCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="petrolCharges">Petrol Charges (₹)</Label>
                    <Input
                      id="petrolCharges"
                      name="petrolCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.petrolCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dieselCharges">Diesel Charges (₹)</Label>
                    <Input
                      id="dieselCharges"
                      name="dieselCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.dieselCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cngCharges">CNG Charges (₹)</Label>
                    <Input
                      id="cngCharges"
                      name="cngCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.cngCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="thirdPartyDriverCharges">Third Party Driver Charges (₹)</Label>
                    <Input
                      id="thirdPartyDriverCharges"
                      name="thirdPartyDriverCharges"
                      type="number"
                      step="0.01"
                      defaultValue={editingBooking.thirdPartyDriverCharges || "0"}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                {/* Third Party Driver Details Section */}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Third Party Driver Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="thirdPartyDriverName">Driver Name</Label>
                      <Input
                        id="thirdPartyDriverName"
                        name="thirdPartyDriverName"
                        type="text"
                        defaultValue={editingBooking.thirdPartyDriverName || ""}
                        placeholder="Enter driver name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="thirdPartyDriverPhone">Driver Phone</Label>
                      <Input
                        id="thirdPartyDriverPhone"
                        name="thirdPartyDriverPhone"
                        type="tel"
                        defaultValue={editingBooking.thirdPartyDriverPhone || ""}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="thirdPartyDriverAddress">Driver Address</Label>
                      <Input
                        id="thirdPartyDriverAddress"
                        name="thirdPartyDriverAddress"
                        type="text"
                        defaultValue={editingBooking.thirdPartyDriverAddress || ""}
                        placeholder="Enter driver address"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditBookingForm(false);
                      setEditingBooking(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateBookingMutation.isPending}
                    className="flex-1"
                  >
                    {updateBookingMutation.isPending ? "Updating..." : "Update Booking"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel this booking for {cancellingBooking?.customerName}?
            </p>
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">Reason for Cancellation*</Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Please provide a reason for cancelling this booking (e.g., customer request, vehicle unavailable, weather conditions)"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancellingBooking(null);
                setCancellationReason("");
              }}
              className="flex-1"
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancelBooking}
              disabled={cancelBookingMutation.isPending || !cancellationReason.trim()}
              className="flex-1"
            >
              {cancelBookingMutation.isPending ? "Cancelling..." : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Invoice Generator Modal */}
      <EnhancedInvoiceGenerator
        booking={invoiceBooking}
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setInvoiceBooking(null);
        }}
      />

      {/* Read-only Vehicle Profile added without replacing Fleet Management or editing. */}
      <Dialog open={!!viewingVehicle} onOpenChange={() => setViewingVehicle(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Car className="text-blue-600" size={24} />
              <span>Vehicle Profile</span>
            </DialogTitle>
          </DialogHeader>
          {viewingVehicle && <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center"><Car className="h-8 w-8 text-blue-600" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 capitalize">{[viewingVehicle.make, viewingVehicle.vehicleModel || viewingVehicle.model].filter(Boolean).join(' ')}</h2>
                  <p className="text-gray-600">{viewingVehicle.licensePlate || viewingVehicle.registrationNumber || 'No registration'}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap text-sm">
                <Badge variant={viewingVehicle.status === 'available' ? 'default' : 'secondary'} className="capitalize">{viewingVehicle.status}</Badge>
                <Badge variant="outline" className="capitalize">{viewingVehicle.type || viewingVehicle.vehicleType || 'Uncategorised'}</Badge>
                {viewingVehicle.year && <Badge variant="outline">{viewingVehicle.year}</Badge>}
              </div>
            </div>
            <VehicleFeedbackProfile
              vehicleId={viewingVehicle._id || viewingVehicle.id}
              onOpenBooking={(booking) => { setViewingVehicle(null); handleViewBooking(booking); }}
            />
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setViewingVehicle(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Driver Profile Modal */}
      <Dialog open={!!viewingDriver} onOpenChange={() => setViewingDriver(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="text-blue-600" size={24} />
              <span>Driver Profile</span>
            </DialogTitle>
          </DialogHeader>
          {viewingDriver && (
            <div className="space-y-6">
              {/* Header with driver photo and basic info */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-2xl">👤</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{viewingDriver.name}</h2>
                  <p className="text-gray-600">{viewingDriver.phone}</p>
                  <Badge
                    variant={viewingDriver.status === "available" ? "default" :
                            viewingDriver.status === "on_duty" ? "secondary" : "destructive"}
                  >
                    {viewingDriver.status}
                  </Badge>
                </div>
                <div className="ml-auto">
                  <SetDriverPinDialog driverId={viewingDriver._id || viewingDriver.id} driverName={viewingDriver.name} />
                </div>
              </div>

              {/* Main driver details in grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Full Name</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.phone}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Email</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.email || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Age</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.age || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Experience</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.experience || "Not provided"} years</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Legacy Manual Rating</Label>
                      <div className="flex items-center">
                        <span className="text-yellow-500">⭐</span>
                        <span className="ml-1 text-sm text-gray-900">{viewingDriver.rating ?? "Not rated"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* License Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">License Information</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">License Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.licenseNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">License Type</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.licenseType || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">License Expiry</Label>
                      <p className="text-sm text-gray-900">
                        {viewingDriver.licenseExpiry ? new Date(viewingDriver.licenseExpiry).toLocaleDateString() : "Not provided"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Current Status</Label>
                      <Badge 
                        variant={viewingDriver.status === "available" ? "default" : 
                                viewingDriver.status === "on_duty" ? "secondary" : "destructive"}
                      >
                        {viewingDriver.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Additional Personal Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Personal Details</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Permanent Address</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.permanentAddress || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Current Address</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.currentAddress || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Marital Status</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.maritalStatus || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Date of Joining</Label>
                      <p className="text-sm text-gray-900">
                        {viewingDriver.dateOfJoining ? new Date(viewingDriver.dateOfJoining).toLocaleDateString() : "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Government Documents */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Government Documents</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Aadhar Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.aadharNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">PAN Number</Label>
                      <p className="text-sm text-gray-900">{viewingDriver.panNumber || "Not provided"}</p>
                    </div>

                  </div>
                </div>
              </div>

              {/* Additional notes or comments if any */}
              {viewingDriver.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Notes</h3>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{viewingDriver.notes}</p>
                </div>
              )}

              <DriverFeedbackProfile
                driverId={viewingDriver._id || viewingDriver.id}
                onOpenBooking={(booking) => { setViewingDriver(null); handleViewBooking(booking); }}
              />
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setViewingDriver(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Star className="text-purple-600" size={20} />
              <span>Upgrade Your Plan</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Ready to unlock more features and expand your fleet management capabilities? 
              Contact us to upgrade your subscription plan.
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={() => window.open('tel:+919876543210', '_self')}
                className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors w-full text-left"
              >
                <Phone className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Phone Support</p>
                  <p className="text-sm text-gray-600">+91 98765 43210</p>
                </div>
              </button>
              
              <button 
                onClick={() => {
                  const subject = encodeURIComponent('FleetPro - Plan Upgrade Request');
                  const body = encodeURIComponent(`Hello FleetPro Support Team,

I am interested in upgrading my subscription plan. 

Current Plan: ${(user as any)?.tenantId?.subscriptionPlan || 'Starter'}
Business Name: ${(user as any)?.tenantId?.businessName || ''}
User ID: ${user?.userId || ''}

Please provide me with information about available upgrade options and pricing.

Thank you!`);
                  window.open(`mailto:support@fleetpro.com?subject=${subject}&body=${body}`, '_self');
                }}
                className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-green-50 rounded-lg transition-colors w-full text-left"
              >
                <Mail className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Email Support</p>
                  <p className="text-sm text-gray-600">support@fleetpro.com</p>
                </div>
              </button>
              
              <button 
                onClick={() => {
                  const message = encodeURIComponent(`Hello! I'm interested in upgrading my FleetPro subscription plan.

Current Plan: ${(user as any)?.tenantId?.subscriptionPlan || 'Starter'}
Business: ${(user as any)?.tenantId?.businessName || ''}

Please help me with upgrade options. Thank you!`);
                  window.open(`https://wa.me/919876543210?text=${message}`, '_blank');
                }}
                className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors w-full text-left"
              >
                <MessageCircle className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">WhatsApp Support</p>
                  <p className="text-sm text-gray-600">Available 24/7</p>
                </div>
              </button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Pro Tip:</strong> Mention your current plan and desired features for personalized recommendations.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowContactModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </>
  );
}
