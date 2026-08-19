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
import VendorInvoices from "./pages/vendor-invoices";
import TemplatesLibrary from "./pages/templates-library";
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
import WhatsAppReminderSettings from "./pages/tenant/whatsapp-reminder-settings";
import WhatsAppSettingsHub from "./pages/whatsapp-settings-hub";

// SuperAdmin Pages
import SuperAdminDashboard from "./pages/superadmin/dashboard";
import SuperAdminTenants from "./pages/superadmin/tenants";
import CreateTenant from "./pages/superadmin/create-tenant";
import TenantManage from "./pages/superadmin/tenant-manage";
import Tenant360 from "./pages/superadmin/tenant-360";
import TenantBilling from "./pages/superadmin/tenant-billing";
import TenantAdvanced from "./pages/superadmin/tenant-advanced";
import AdvancedConsole from "./pages/superadmin/advanced-console-live";
import RevenueIntelligence from "./pages/superadmin/revenue-intelligence";
import UserManagement from "./pages/superadmin/user-management";
import SettingsConfig from "./pages/superadmin/settings-config";
import AuditLogs from "./pages/superadmin/audit-logs";
import PlansEnhanced from "./pages/superadmin/plans-enhanced";
import SubscriptionsPage from "./pages/superadmin/subscriptions";
import BillingPage from "./pages/superadmin/billing";
import AdvancedAnalytics from "./pages/superadmin/advanced-analytics";
import CustomerSuccessDashboard from "./pages/superadmin/customer-success";
import ComplianceSecurityDashboard from "./pages/superadmin/compliance-security";
import TenantPortalDashboard from "./pages/tenant-portal/dashboard";
import SupportTicketingDashboard from "./pages/superadmin/support-ticketing";

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
        ) : (
          // P0 FIX: BACKEND is authoritative
          // Login page only shows login form, backend handles redirect via window.location
          <LoginPage />
        )}
      </Route>

      {/* SuperAdmin Tenant Management */}
      <Route path="/superadmin">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !user ? (
          <LoginPage />
        ) : user.platformRole !== 'PLATFORM_ROOT' ? (
          // P0 FIX: Tenant users MUST NOT access /superadmin
          <Dashboard key={user.userId} />
        ) : (
          // Root users only
          <SuperAdminDashboard />
        )}
      </Route>

      <Route path="/superadmin/dashboard">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !user ? (
          <LoginPage />
        ) : user.platformRole !== 'PLATFORM_ROOT' ? (
          // P0 FIX: Tenant users redirected to their dashboard
          <Dashboard key={user.userId} />
        ) : (
          <SuperAdminDashboard />
        )}
      </Route>

      <Route path="/superadmin/tenants">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <SuperAdminTenants />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/tenants/create">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <CreateTenant />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/tenants/:tenantId">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <TenantManage />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/tenants/:id/edit">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <CreateTenant />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/tenants/:id/360">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <Tenant360 />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/tenants/:tenantId/billing">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <TenantBilling />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/tenants/:tenantId/advanced">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <TenantAdvanced />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/console">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <AdvancedConsole />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/plans">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <PlansEnhanced />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/subscriptions">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <SubscriptionsPage />
        ) : (
          <LoginPage />
        )}
      </Route>

      <Route path="/superadmin/billing">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <BillingPage />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Revenue Intelligence Dashboard */}
      <Route path="/superadmin/revenue">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <RevenueIntelligence />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* User Management */}
      <Route path="/superadmin/users">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <UserManagement />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Settings & Configuration */}
      <Route path="/superadmin/settings">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <SettingsConfig />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Audit Logs */}
      <Route path="/superadmin/audit">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <AuditLogs />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Advanced Analytics Engine */}
      <Route path="/superadmin/analytics">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <AdvancedAnalytics />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Customer Success Dashboard */}
      <Route path="/superadmin/cs">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <CustomerSuccessDashboard />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Compliance & Security Dashboard */}
      <Route path="/superadmin/compliance">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <ComplianceSecurityDashboard />
        ) : (
          <LoginPage />
        )}
      </Route>

      {/* Tenant Portal Dashboard */}
      <Route path="/tenant/portal">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !user ? (
          <LoginPage />
        ) : (
          <TenantPortalDashboard />
        )}
      </Route>

      {/* Support Ticketing System */}
      <Route path="/superadmin/support">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user?.platformRole ? (
          <SupportTicketingDashboard />
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

      {/* Driver portal — deliberately outside the staff AuthProvider/
          ProtectedRoute context above (separate session mechanism, see
          server/middleware/driverAuth.ts); each page manages its own
          driver-auth state independently. */}
      <Route path="/driver-login" component={DriverLoginPage} />
      <Route path="/driver" component={DriverPortalPage} />

      {/* Vehicle 360 (TASK-VEHICLE-360-UI-06) */}
      <Route path="/vehicles/:vehicleId">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <Vehicle360Page />
        </ProtectedRoute>
      </Route>

      {/* Tenant Dashboard 360 */}
      <Route path="/tenant-360">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <TenantDashboard360 />
        </ProtectedRoute>
      </Route>

      {/* Driver Payroll Dashboard */}
      <Route path="/driver-payroll">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <DriverPayrollDashboard />
        </ProtectedRoute>
      </Route>

      {/* Vendor Settlement Portal */}
      <Route path="/vendor-settlement">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <VendorSettlementPortal />
        </ProtectedRoute>
      </Route>

      {/* Vendor Invoices */}
      <Route path="/vendor-invoices">
        <ProtectedRoute allowedRoles={["client", "manager", "admin"]}>
          <VendorInvoices />
        </ProtectedRoute>
      </Route>

      {/* Templates Library */}
      <Route path="/templates">
        <ProtectedRoute allowedRoles={["client", "manager", "admin"]}>
          <TemplatesLibrary />
        </ProtectedRoute>
      </Route>

      {/* Operations Center - Command Center */}
      <Route path="/operations">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <OperationsCenter />
        </ProtectedRoute>
      </Route>

      {/* Bookings */}
      <Route path="/bookings/live">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <LiveBookings />
        </ProtectedRoute>
      </Route>
      <Route path="/bookings/upcoming">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <UpcomingBookings />
        </ProtectedRoute>
      </Route>

      {/* Notifications Analytics - WAVE 22A */}
      <Route path="/notifications/analytics">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <NotificationsAnalytics />
        </ProtectedRoute>
      </Route>

      {/* Notification Preferences - WAVE 24A */}
      <Route path="/notifications/preferences">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <NotificationPreferences />
        </ProtectedRoute>
      </Route>

      {/* Notification Admin Dashboard - WAVE 29A */}
      <Route path="/notifications/admin">
        <ProtectedRoute requiredRole="admin">
          <NotificationAdminDashboard />
        </ProtectedRoute>
      </Route>

      {/* Template Editor - WAVE 30A */}
      <Route path="/notifications/templates">
        <ProtectedRoute requiredRole="admin">
          <TemplateEditor />
        </ProtectedRoute>
      </Route>

      {/* Scheduled Notifications - WAVE 31A */}
      <Route path="/notifications/schedule">
        <ProtectedRoute requiredRole="admin">
          <ScheduledNotifications />
        </ProtectedRoute>
      </Route>

      {/* Notification Monitor - WAVE 32A */}
      <Route path="/notifications/monitor">
        <ProtectedRoute requiredRole="admin">
          <NotificationMonitor />
        </ProtectedRoute>
      </Route>

      {/* Event Triggers - WAVE 33A */}
      <Route path="/notifications/triggers">
        <ProtectedRoute requiredRole="admin">
          <EventTriggers />
        </ProtectedRoute>
      </Route>

      {/* A/B Testing - WAVE 34A */}
      <Route path="/notifications/ab-testing">
        <ProtectedRoute requiredRole="admin">
          <NotificationABTesting />
        </ProtectedRoute>
      </Route>

      {/* Insights & Analytics - WAVE 35A */}
      <Route path="/notifications/insights">
        <ProtectedRoute requiredRole="admin">
          <NotificationInsights />
        </ProtectedRoute>
      </Route>

      {/* SMS Optimizer - WAVE 36A */}
      <Route path="/notifications/sms-optimizer">
        <ProtectedRoute requiredRole="admin">
          <SMSOptimizer />
        </ProtectedRoute>
      </Route>

      {/* Predictive Send Time - WAVE 37A */}
      <Route path="/notifications/predictive-send-time">
        <ProtectedRoute requiredRole="admin">
          <PredictiveSendTime />
        </ProtectedRoute>
      </Route>

      {/* Audience Segmentation - WAVE 38A */}
      <Route path="/notifications/segmentation">
        <ProtectedRoute requiredRole="admin">
          <AudienceSegmentation />
        </ProtectedRoute>
      </Route>

      {/* Content Recommendations - WAVE 39A */}
      <Route path="/notifications/content-recommendations">
        <ProtectedRoute requiredRole="admin">
          <ContentRecommendations />
        </ProtectedRoute>
      </Route>

      {/* Campaign Predictor - WAVE 40A */}
      <Route path="/notifications/campaign-predictor">
        <ProtectedRoute requiredRole="admin">
          <CampaignPredictor />
        </ProtectedRoute>
      </Route>

      {/* Campaign Journey Builder - WAVE 41A */}
      <Route path="/notifications/journey-builder">
        <ProtectedRoute requiredRole="admin">
          <CampaignJourneyBuilder />
        </ProtectedRoute>
      </Route>

      {/* Smart Channel Selection - WAVE 42A */}
      <Route path="/notifications/channel-selection">
        <ProtectedRoute requiredRole="admin">
          <SmartChannelSelection />
        </ProtectedRoute>
      </Route>

      {/* Tenant WhatsApp Profile - WAVE 43A */}
      <Route path="/settings/whatsapp-profile">
        <ProtectedRoute requiredRole="admin">
          <TenantWhatsAppProfile />
        </ProtectedRoute>
      </Route>

      {/* WhatsApp Templates - WAVE 44A */}
      <Route path="/settings/whatsapp-templates">
        <ProtectedRoute requiredRole="admin">
          <WhatsAppTemplates />
        </ProtectedRoute>
      </Route>

      {/* WhatsApp Template Editor - WAVE 45A */}
      <Route path="/settings/whatsapp-template-editor">
        <ProtectedRoute requiredRole="admin">
          <WhatsAppTemplateEditor />
        </ProtectedRoute>
      </Route>

      <Route path="/settings/whatsapp-template-history/:templateId*">
        <ProtectedRoute requiredRole="admin">
          <WhatsAppTemplateHistory />
        </ProtectedRoute>
      </Route>

      <Route path="/settings/whatsapp-approvals">
        <ProtectedRoute requiredRole="admin">
          <WhatsAppApprovalQueue />
        </ProtectedRoute>
      </Route>

      <Route path="/settings/whatsapp-approval-config">
        <ProtectedRoute requiredRole="admin">
          <WhatsAppApprovalConfig />
        </ProtectedRoute>
      </Route>

      <Route path="/settings/whatsapp-settings">
        <ProtectedRoute requiredRole="admin">
          <WhatsAppSettingsHub />
        </ProtectedRoute>
      </Route>

      {/* Dashboard - Tenant operations only */}
      <Route path="/dashboard">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !user ? (
          <LoginPage />
        ) : user.platformRole === 'PLATFORM_ROOT' ? (
          // P0 FIX: Root users MUST NOT access /dashboard
          <SuperAdminDashboard key={user.userId} />
        ) : (
          // Tenant users only
          user.mustResetPassword ? (
            <ForcedPasswordResetPage />
          ) : (
            <Dashboard key={user?.userId} />
          )
        )}
      </Route>

      {/* Fallback route for any unknown paths */}
      <Route>
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !user ? (
          <LoginPage />
        ) : user.platformRole === 'PLATFORM_ROOT' ? (
          // P0 FIX: Root redirects to superadmin
          <SuperAdminDashboard key={user.userId} />
        ) : (
          // Tenant redirects to dashboard
          <Dashboard key={user.userId} />
        )}
      </Route>
      </Switch>
    </>
  );
}

function ProtectedRouterShell() {
  return (
    <ErrorBoundary>
      <AuthenticatedApp />
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <AuthProvider>
      {/* One provider for the ONE Unified Booking Workspace — every booking
          surface (queues, upcoming, live, history, Customer 360, dashboard,
          search, Vehicle 360) opens the same canonical editor through it. */}
      <BookingWorkspaceProvider>
        <ProtectedRouterShell />
      </BookingWorkspaceProvider>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <OfflineNotification />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
