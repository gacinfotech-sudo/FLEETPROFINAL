import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { BookingWorkspaceProvider } from "@/components/booking/booking-workspace-context";
import { OfflineNotification } from "@/components/offline-notification";
import LandingPage from "./pages/landing";
import LoginPage from "./pages/login";
import AdminPanel from "./pages/admin-panel";
import Dashboard from "./pages/dashboard";
import Vehicle360Page from "./pages/vehicle-360";
import ForcedPasswordResetPage from "./pages/forced-password-reset";
import NotFound from "@/pages/not-found";
import ProtectedRoute from "@/components/auth/protected-route";
import DriverLoginPage from "./pages/driver-login";
import DriverPortalPage from "./pages/driver-portal";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  return (
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
          // Redirect authenticated users to their respective dashboards
          user.role === "admin" ? <AdminPanel key={user.userId} /> : <Dashboard key={user.userId} />
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

      {/* Driver portal — deliberately outside the staff AuthProvider/
          ProtectedRoute context above (separate session mechanism, see
          server/middleware/driverAuth.ts); each page manages its own
          driver-auth state independently. */}
      <Route path="/driver-login" component={DriverLoginPage} />
      <Route path="/driver" component={DriverPortalPage} />

      {/* Vehicle 360 (TASK-VEHICLE-360-UI-06) — must come BEFORE /dashboard
          to avoid being caught by dashboard's :section? param */}
      <Route path="/vehicles/:vehicleId">
        <ProtectedRoute allowedRoles={["client", "manager"]}>
          <Vehicle360Page />
        </ProtectedRoute>
      </Route>

      {/* Dashboard */}
      <Route path="/dashboard/:section?">
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
          // Redirect to appropriate dashboard based on role
          user.role === "admin" ? <AdminPanel key={user.userId} /> : <Dashboard key={user.userId} />
        ) : (
          <LoginPage />
        )}
      </Route>
    </Switch>
  );
}

function Router() {
  return (
    <AuthProvider>
      {/* One provider for the ONE Unified Booking Workspace — every booking
          surface (queues, upcoming, live, history, Customer 360, dashboard,
          search, Vehicle 360) opens the same canonical editor through it. */}
      <BookingWorkspaceProvider>
        <AuthenticatedApp />
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
