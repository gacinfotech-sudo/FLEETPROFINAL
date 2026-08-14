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
import AdminPanel from "./pages/admin-panel";
import Dashboard from "./pages/dashboard";
import TenantDashboard360 from "./pages/tenant-360";
import Vehicle360Page from "./pages/vehicle-360";
import ForcedPasswordResetPage from "./pages/forced-password-reset";
import NotFound from "@/pages/not-found";
import ProtectedRoute from "@/components/auth/protected-route";
import DriverLoginPage from "./pages/driver-login";
import DriverPortalPage from "./pages/driver-portal";
// Root Control Plane (Wave 1) additive route registrations — new /root/**
// namespace only. `requiredRole="admin"` is a documented stopgap (per each
// task's report) matching ProtectedRoute's current role-only API; real
// authorization is enforced server-side on every /api/root/** route via
// RootAccessService.requirePlatformRole regardless of this client-side gate.
// See docs/root-control-plane/ROOT-INTEGRATION-report.md.
import RootDashboard from "./pages/root/dashboard";
import RootTenants from "./pages/root/tenants";
import RootTenant360 from "./pages/root/tenant-360";
import RootGlobalCustomers from "./pages/root/global-customers";
import RootCustomer360 from "./pages/root/customer-360";
import SecurityCenter from "./pages/root/security-center";
import AuditLogPage from "./pages/root/audit-log";
import SupportTicketsPage from "./pages/root/support-tickets";
import ErrorCenterPage from "./pages/root/error-center";
import DiagnosticsPage from "./pages/root/diagnostics";
import SalesPipeline from "./pages/root/sales-pipeline";
import ProductConfigPage from "./pages/root/product-config";
import FeatureFlagsPage from "./pages/root/feature-flags";
import SupportAccessBanner from "@/components/root/support-access-banner";
import DriverPayrollDashboard from "./pages/driver-payroll-dashboard";
import VendorSettlementPortal from "./pages/vendor-settlement-portal";
import PlatformAdmin360 from "./pages/platform-admin-360";
import OperationsCenter from "./pages/operations-center";
import LiveBookings from "./pages/live-bookings";
import UpcomingBookings from "./pages/upcoming-bookings";

// SaaS Platform Admin Pages
import SuperAdminDashboard from "./pages/superadmin/dashboard-clickable";
import SuperAdminTenantsList from "./pages/superadmin/tenants-list";
import SuperAdminTenant360 from "./pages/superadmin/tenant-360";
import SuperAdminPlans from "./pages/superadmin/plans";
import SuperAdminCompanyProfile from "./pages/superadmin/company-profile";
import SuperAdminSubscriptions from "./pages/superadmin/subscriptions";
import SuperAdminBilling from "./pages/superadmin/billing";
import SuperAdminSupportTickets from "./pages/superadmin/support-tickets";
import SuperAdminErrorReports from "./pages/superadmin/error-reports";

// Phase 3 WAVE Pages
import NotificationsAnalytics from "./pages/notifications-analytics";
import NotificationPreferences from "./pages/notification-preferences";
import NotificationAdminDashboard from "./pages/notification-admin-dashboard";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  return (
    <>
      {/* TASK-ROOT-SECURITY-05 — rendered once here (not per-route) so it's
          visible across the whole authenticated app shell while a Support
          Access grant is active. Self-gates to null via its own
          server-derived query for any non-platform-staff/unauthenticated
          user — see the component's own header comment. */}
      {user && <SupportAccessBanner />}
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
          // Route authenticated users based on account type
          user.platformRole ? <SuperAdminDashboard key={user.userId} /> : <Dashboard key={user.userId} />
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

      {/* Admin Panel */}
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminPanel key={user?.userId} />
        </ProtectedRoute>
      </Route>

      {/* Root Control Plane (Wave 1) — platform Super Admin console.
          requiredRole="admin" is a documented stopgap; see import comment
          above and docs/root-control-plane/ROOT-INTEGRATION-report.md. */}
      <Route path="/root/dashboard">
        <ProtectedRoute requiredRole="admin">
          <RootDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/root/tenants">
        <ProtectedRoute requiredRole="admin">
          <RootTenants />
        </ProtectedRoute>
      </Route>
      <Route path="/root/tenants/:tenantId/features">
        {(params: { tenantId: string }) => (
          <ProtectedRoute requiredRole="admin">
            <FeatureFlagsPage tenantId={params.tenantId} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/root/tenants/:tenantId">
        <ProtectedRoute requiredRole="admin">
          <RootTenant360 />
        </ProtectedRoute>
      </Route>
      <Route path="/root/customers">
        <ProtectedRoute requiredRole="admin">
          <RootGlobalCustomers />
        </ProtectedRoute>
      </Route>
      <Route path="/root/customers/:customerId">
        <ProtectedRoute requiredRole="admin">
          <RootCustomer360 />
        </ProtectedRoute>
      </Route>
      <Route path="/root/security">
        <ProtectedRoute requiredRole="admin">
          <SecurityCenter />
        </ProtectedRoute>
      </Route>
      <Route path="/root/audit-log">
        <ProtectedRoute requiredRole="admin">
          <AuditLogPage />
        </ProtectedRoute>
      </Route>
      <Route path="/root/support-tickets">
        <ProtectedRoute requiredRole="admin">
          <SupportTicketsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/root/error-center">
        <ProtectedRoute requiredRole="admin">
          <ErrorCenterPage />
        </ProtectedRoute>
      </Route>
      <Route path="/root/diagnostics">
        <ProtectedRoute requiredRole="admin">
          <DiagnosticsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/root/sales">
        <ProtectedRoute requiredRole="admin">
          <SalesPipeline />
        </ProtectedRoute>
      </Route>
      <Route path="/root/product-config">
        <ProtectedRoute requiredRole="admin">
          <ProductConfigPage />
        </ProtectedRoute>
      </Route>

      {/* SaaS Platform Admin Routes — Complete Suite */}
      <Route path="/superadmin/dashboard">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/tenants/:tenantId">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminTenant360 />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/tenants">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminTenantsList />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/plans">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminPlans />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/subscriptions">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminSubscriptions />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/billing">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminBilling />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/support">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminSupportTickets />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/errors">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminErrorReports />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/company-profile">
        <ProtectedRoute requiredRole="admin">
          <SuperAdminCompanyProfile />
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

      {/* Platform Admin 360 - Root/Super Admin */}
      <Route path="/platform-admin">
        <ProtectedRoute requiredRole="admin">
          <PlatformAdmin360 />
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

      {/* Dashboard - Tenant operations only */}
      <Route path="/dashboard">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          {user && user.mustResetPassword ? (
            <ForcedPasswordResetPage />
          ) : (
            <Dashboard key={user?.userId} />
          )}
        </ProtectedRoute>
      </Route>

      {/* Fallback route for any unknown paths - redirects to appropriate dashboard */}
      <Route>
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : user ? (
          // Redirect to appropriate dashboard based on account type
          user.platformRole ? <SuperAdminDashboard key={user.userId} /> : <Dashboard key={user.userId} />
        ) : (
          <LoginPage />
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
