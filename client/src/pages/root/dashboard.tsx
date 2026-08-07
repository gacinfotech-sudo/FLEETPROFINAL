// TASK-ROOT-DASHBOARD-02 — Root Dashboard.
//
// Aggregate platform metrics from GET /api/root/dashboard. Every card is
// clickable and navigates to the underlying filtered list (Tenant Master
// Database / Global Customer Database), per this task's acceptance
// criteria. Integration/system-health cards (errors, queue, webhooks,
// GPS/WhatsApp/Telephony) are stubs — TASK-ROOT-SUPPORT-03's Error Center
// owns real data for those; they render "Coming soon" instead of a number.
//
// Proposed mount: this task's report lists the exact `<Route path="/root/dashboard">`
// entry for client/src/App.tsx (Integrator-only, not added here).

import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, UserCheck, Contact, CalendarCheck, Car, IdCard, AlertTriangle } from "lucide-react";

interface RootDashboardData {
  tenants: { total: number; active: number; trial: number; suspended: number; expired: number; linkTo: string };
  users: { total: number; active: number; linkTo: string };
  customers: { total: number; linkTo: string };
  bookings: { total: number; linkTo: string };
  drivers: { total: number };
  vehicles: { total: number };
  systemHealth: Record<string, { available: boolean; message: string }>;
}

function StatCard({
  icon: Icon, label, value, sublabel, onClick, testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sublabel?: string;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer transition-shadow hover:shadow-md" : undefined}
      onClick={onClick}
      data-testid={testId}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function StubCard({ label }: { label: string }) {
  return (
    <Card className="opacity-70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">Coming soon</Badge>
      </CardContent>
    </Card>
  );
}

export default function RootDashboard() {
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<RootDashboardData>({
    queryKey: ["/api/root/dashboard"],
  });

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-destructive">
            Failed to load the Root Dashboard. {(error as Error).message}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="root-dashboard-page">
      <div>
        <h1 className="text-2xl font-bold">Root Dashboard</h1>
        <p className="text-muted-foreground text-sm">Platform-wide metrics across every tenant.</p>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Tenants</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                icon={Building2}
                label="Total Tenants"
                value={data.tenants.total}
                onClick={() => setLocation("/root/tenants")}
                testId="stat-total-tenants"
              />
              <StatCard
                icon={Building2}
                label="Active"
                value={data.tenants.active}
                onClick={() => setLocation("/root/tenants?status=active")}
                testId="stat-active-tenants"
              />
              <StatCard
                icon={Building2}
                label="Trial"
                value={data.tenants.trial}
                onClick={() => setLocation("/root/tenants?status=trial")}
                testId="stat-trial-tenants"
              />
              <StatCard
                icon={Building2}
                label="Suspended"
                value={data.tenants.suspended}
                onClick={() => setLocation("/root/tenants?status=suspended")}
                testId="stat-suspended-tenants"
              />
              <StatCard
                icon={Building2}
                label="Expired"
                value={data.tenants.expired}
                onClick={() => setLocation("/root/tenants?status=expired")}
                testId="stat-expired-tenants"
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Users &amp; Activity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Total Users"
                value={data.users.total}
                onClick={() => setLocation("/root/tenants")}
                testId="stat-total-users"
              />
              <StatCard
                icon={UserCheck}
                label="Active Users"
                value={data.users.active}
                onClick={() => setLocation("/root/tenants")}
                testId="stat-active-users"
              />
              <StatCard
                icon={Contact}
                label="Total Customers"
                value={data.customers.total}
                onClick={() => setLocation("/root/customers")}
                testId="stat-total-customers"
              />
              <StatCard
                icon={CalendarCheck}
                label="Total Bookings"
                value={data.bookings.total}
                onClick={() => setLocation("/root/customers")}
                testId="stat-total-bookings"
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Fleet</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={IdCard} label="Total Drivers" value={data.drivers.total} testId="stat-total-drivers" />
              <StatCard icon={Car} label="Total Vehicles" value={data.vehicles.total} testId="stat-total-vehicles" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">System Health (TASK-ROOT-SUPPORT-03)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(data.systemHealth).map(([key]) => (
                <StubCard key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
