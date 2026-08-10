import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { usePermissions } from "../hooks/use-permissions";
import { useLocation, useParams, Link } from "wouter";
import Sidebar from "../components/layout/sidebar";
import DashboardOverview from "../components/dashboard/overview";
import EnhancedBookingForm from "../components/booking/enhanced-booking-form";
import VehicleForm from "../components/fleet/vehicle-form";
import VehicleFeedbackProfile from "../components/fleet/vehicle-feedback-profile";
import DriverForm from "../components/drivers/driver-form";
import Driver360 from "../components/drivers/driver-360";
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
import LiveOperations from "./live-operations";
import SelfDrivePage from "./self-drive";
import OperationsAlertStrip from "../components/operations/operations-alert-strip";
import LiveOperationsSummary from "../components/operations/live-operations-summary";
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
import TodayOnLeaveStrip from "../components/drivers/leave/today-on-leave-strip";
import DriverAttendancePage from "./driver-attendance";
import DriverPerformancePage from "./driver-performance";
import VehiclePerformancePage from "./vehicle-performance";
import GpsSettingsPage from "./gps-settings";
import WhatsAppPanel from "./whatsapp-panel";
import DailyOperationsPopup from "../components/dashboard/daily-operations-popup";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";
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

type ViewType = "dashboard" | "bookings" | "fleet" | "drivers" | "history" | "revenue" | "vendor-settlement" | "expenses" | "salary" | "profile" | "users" | "live-bookings" | "live-operations" | "self-drive" | "whatsapp" | "upcoming-bookings" | "booking-queues" | "payment-dues" | "driver-leave" | "driver-performance" | "vehicle-performance" | "driver-attendance" | "customers" | "customers-add" | "drivers-add" | "after-sales" | "campaigns" | "inquiries" | "leads" | "followups" | "vendors" | "rewards-referrals" | "gps-tracking";

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
  const { openBooking } = useBookingWorkspace();

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
    const allowedSections = ["dashboard", "inquiries", "leads", "followups", "live-bookings", "live-operations", "self-drive", "upcoming-bookings", "booking-queues", "payment-dues", "bookings", "fleet", "vehicle-performance", "drivers", "drivers-add", "driver-leave", "driver-performance", "driver-attendance", "history", "customers", "customers-add", "after-sales", "campaigns", "rewards-referrals", "vendors", "revenue", "vendor-settlement", "expenses", "salary", "whatsapp", "profile", "gps-tracking"];
    
    // Add "users" section only for admin and client roles
    if (user?.role === 'admin' || user?.role === 'client') {
      allowedSections.push("users");
    }
    
    // Remove restricted sections for manager roles
    if (user?.role === 'manager') {
      const restrictedSections = ["revenue", "vendor-settlement", "drivers", "drivers-add", "driver-leave", "driver-performance", "vehicle-performance", "driver-attendance", "after-sales", "campaigns", "rewards-referrals", "vendors"];
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

  // Sidebar "Add Driver": the same Drivers screen with the canonical Add
  // Driver wizard already open — mirrors the "customers-add" pattern, so
  // there is exactly one driver-creation flow.
  useEffect(() => {
    if (currentView === "drivers-add") {
      setEditingDriver(null);
      setShowDriverForm(true);
    }
  }, [currentView]);

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

  // Generic booking field edits now happen inside the Unified Booking
  // Workspace (canonical PUT + one shared cache-invalidation helper) — the
  // old updateBookingMutation that backed the deleted Edit Booking dialog
  // is gone with it.

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

  // Both "view" and "edit" open the ONE Unified Booking Workspace over the
  // canonical record (fetched fresh by id inside the workspace — the stale
  // row object passed here is only used for its id).
  const handleViewBooking = (booking: any) => {
    openBooking(booking);
  };

  const handleEditBooking = (booking: any) => {
    openBooking(booking);
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

  // All Dashboard-overview data (KPIs, trends, statuses, attention,
  // upcoming, live ops) now lives in components/dashboard/overview.tsx,
  // which fetches the aggregated /api/dashboard/overview endpoint itself —
  // this shell no longer pre-fetches those datasets for every view.

  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ["/api/drivers"],
  });

  const { data: bookings = [] } = useQuery<any[]>({
    queryKey: ["/api/bookings"],
  });


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
            <LiveOperationsSummary onViewAll={() => handleViewChange("live-operations")} />
            <DashboardOverview
              onNavigate={(view) => handleViewChange(view as ViewType)}
              onViewBooking={(booking) => openBooking(booking)}
              onSelectCustomer={handleSelectCustomerFromSearch}
              onFleetStatusClick={goToFleetStatus}
              onDriverStatusClick={goToDriverStatus}
              canViewRevenue={user?.role !== 'manager' && canViewRevenue()}
            />
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
                          <Link href={`/vehicles/${vehicle._id || vehicle.id}`} className="flex-1">
                            <Button size="sm" variant="outline" className="w-full">View 360</Button>
                          </Link>
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
                                <Link href={`/vehicles/${vehicle._id || vehicle.id}`}>
                                  <Button variant="ghost" size="sm">View 360</Button>
                                </Link>
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

      case "drivers-add":
      case "drivers":
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Driver Management</h1>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleViewChange("driver-attendance")}>
                  Attendance
                </Button>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleViewChange("driver-leave")}>
                  Leave
                </Button>
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
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
            </div>

            {/* Daily operational info first: who is on leave today (same
                canonical records as the Leave Calendar). */}
            <div className="mb-4">
              <TodayOnLeaveStrip maxEntries={4} onViewAll={() => handleViewChange("driver-leave")} actionLabel="View Leave Calendar" />
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

      // Sidebar "Add Customer": the same Customers page with the intake
      // (Quick Inquiry) dialog already open — new customers enter through
      // the canonical inquiry funnel, not a separate create form.
      case "customers-add":
        return <CustomersPage onEditBooking={handleEditBooking} onNewBooking={handleConvertLeadToBooking} initialCustomerId={pendingCustomerId} onNavigateToInquiry={handleNavigateToInquiry} onNavigateToLead={handleNavigateToLead} initialShowIntake />;

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
        // Defensive: ensure bookings is a valid array with required fields
        const validBookings = Array.isArray(bookings)
          ? bookings.filter((b: any) => {
              try {
                return b && typeof b === 'object' && b.bookingId && b.customerName && b.status !== undefined;
              } catch {
                return false;
              }
            })
          : [];

        try {
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
                        bookings={validBookings as any[]}
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
                      {(validBookings as any[])
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
        } catch (error) {
          console.error('History render error:', error);
          return (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800">Error Loading Booking History</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-red-700">
                <p>An error occurred while rendering the booking history page.</p>
                <p className="mt-2 text-xs font-mono">{String(error)}</p>
              </CardContent>
            </Card>
          );
        }

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

      case "self-drive":
        return <SelfDrivePage />;

      case "live-operations":
        return <LiveOperations />;

      case "upcoming-bookings":
        return <UpcomingBookings />;

      case "booking-queues":
        return <BookingQueuesPanel />;

      case "payment-dues":
        return <PaymentDues />;

      case "driver-attendance":
        return <DriverAttendancePage />;

      case "driver-leave":
        return <DriverLeavePage onOpenDriver={(d) => setViewingDriver(d)} />;

      case "driver-performance":
        return <DriverPerformancePage />;

      case "vehicle-performance":
        return <VehiclePerformancePage />;

      case "gps-tracking":
        return <GpsSettingsPage />;

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
            <button
              type="button"
              aria-label="Go to Dashboard"
              onClick={() => handleViewChange("dashboard")}
              className="text-xl font-bold text-blue-600 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              FleetPro
            </button>
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
          {/* Persistent operational alert strip — booking-end reminders,
              overdue returns, payment due. Renders nothing when no open
              alerts; never covers the working UI. */}
          <OperationsAlertStrip
            onViewAll={() => handleViewChange("live-operations")}
            onOpenBooking={(id) => openBooking(id)}
          />
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* View Booking Dialog */}
      {/* The legacy View/Edit Booking dialogs (pre-Unified-Workspace) were
          resurrected by the final-canonical merge with all their state and
          imports missing — every booking surface opens the ONE canonical
          Booking Workspace instead (openBooking). */}

      {/* Edit Booking Dialog */}

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

      {/* View Driver Profile Modal — real Driver 360° view (contacts,
          documents with compliance/expiry status, employment history,
          lifecycle stage). See client/src/components/drivers/driver-360.tsx
          for the dead viewingDriver.age/.licenseType/.licenseExpiry/.notes
          resolution. */}
      <Dialog open={!!viewingDriver} onOpenChange={() => setViewingDriver(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="text-blue-600" size={24} />
              <span>Driver Profile</span>
            </DialogTitle>
          </DialogHeader>
          {viewingDriver && (
            <Driver360
              driver={viewingDriver}
              onOpenBooking={(booking) => { setViewingDriver(null); handleViewBooking(booking); }}
            />
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
