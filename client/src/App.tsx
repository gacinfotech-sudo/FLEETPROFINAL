import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { BookingWorkspaceProvider } from "@/components/booking/booking-workspace-context";
import { OfflineNotification } from "@/components/offline-notification";
import ErrorBoundary from "@/components/error-boundary";
import LandingPage from "./pages/landing";
import LoginPage from "./pages/login";
import Dashboard from "./pages/dashboard";

import TenantDashboard360 from "./pages/tenant-360";
import Vehicle360Page from "./pages/vehicle-360";
import ForcedPasswordResetPage from "./pages/forced-password-reset";
import NotFound from "@/pages/not-found";
import ProtectedRoute from "@/components/auth/protected-route";
import DriverLoginPage from "./pages/driver-login";
import DriverPortalPage from "./pages/driver-portal";
import DriverPayrollDashboard from "./pages/driver-payroll-dashboard";
import VendorSettlementPortal from "./pages/vendor-settlement-portal";
import OperationsCenter from "./pages/operations-center";
import LiveBookings from "./pages/live-bookings";
import UpcomingBookings from "./pages/upcoming-bookings";

// Phase 3 WAVE Pages
import NotificationsAnalytics from "./pages/notifications-analytics";
import NotificationPreferences from "./pages/notification-preferences";
import NotificationAdminDashboard from "./pages/notification-admin-dashboard";
import TemplateEditor from "./pages/template-editor";
import ScheduledNotifications from "./pages/scheduled-notifications";
import NotificationMonitor from "./pages/notification-monitor";
import EventTriggers from "./pages/event-triggers";
import NotificationABTesting from "./pages/notification-ab-testing";
import NotificationInsights from "./pages/notification-insights";
import SMSOptimizer from "./pages/sms-optimizer";

// Phase 4 WAVE Pages
import PredictiveSendTime from "./pages/predictive-send-time";
import AudienceSegmentation from "./pages/audience-segmentation";
import ContentRecommendations from "./pages/content-recommendations";
import CampaignPredictor from "./pages/campaign-predictor";

// Phase 5 WAVE Pages
import CampaignJourneyBuilder from "./pages/campaign-journey-builder";
import SmartChannelSelection from "./pages/smart-channel-selection";
import TenantWhatsAppProfile from "./pages/tenant-whatsapp-profile";
import WhatsAppTemplates from "./pages/whatsapp-templates";
import WhatsAppTemplateEditor from "./pages/whatsapp-template-editor";
import WhatsAppTemplateHistory from "./pages/whatsapp-template-history";
import WhatsAppApprovalQueue from "./pages/whatsapp-approval-queue";
import WhatsAppApprovalConfig from "./pages/whatsapp-approval-config";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  return (
    <>
      <Switch>
      {/* Public Landing Page */}
      <Route path="/" component={LandingPage} />
      
      {/* Login Page */}
      <Route path="/login">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user ? (
          // Route authenticated users to dashboard
          <Dashboard key={user.userId} />
        ) : (
          <LoginPage />
        )}
      </Route>
      
      {/* Password Reset Page */}
      <Route path="/reset-password">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          {user && user.mustResetPassword ? (
            <ForcedPasswordResetPage />
          ) : (
            <Dashboard key={user?.userId} />
          )}
        </ProtectedRoute>
      </Route>

