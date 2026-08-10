import { Component, type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IndianRupee, CalendarDays, Car, Users, AlertTriangle, MapPin, ArrowRight,
  UserRoundPlus, CalendarPlus, Satellite, Radio, Clock, TimerReset, PlayCircle,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie, LabelList,
} from "recharts";

// ------------------------------------------------------------------
// Shared bits
// ------------------------------------------------------------------

// CVD-validated chart colors (scripts: dataviz validate_palette — all
// adjacent pairs pass ΔE floors on the white card surface). Gray is used
// only as a *labeled* neutral status (Inactive), never as a series color.
const CHART = {
  revenue: "#2563eb",
  collections: "#059669",
  available: "#16a34a",
  onTrip: "#2563eb",
  maintenance: "#d97706",
  inactive: "#6b7280",
  neutralBar: "#2563eb",
};

function inr(n: number): string {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function inrCompact(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n}`;
}

function shortDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// One failed widget must never take down the whole Dashboard.
class WidgetBoundary extends Component<{ title: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <p className="text-sm text-muted-foreground">{this.title ?? "This section"} couldn't render.</p>
          <Button variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>Retry</Button>
        </div>
      );
    }
    return this.props.children;
  }
  private get title() { return this.props.title; }
}

// The one canonical dashboard card: same radius/border/header treatment
// everywhere. `action` renders the consistent "View All"-style CTA.
function DashCard({ title, subtitle, action, children, className }: {
  title?: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`shadow-sm border-gray-200 transition-all duration-300 hover:shadow-md hover:border-blue-200 ${className || ""} page-transition`}>
      {title && (
        <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action && (
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 shrink-0 -mr-2 transition-all duration-200 hover:translate-x-1"
              onClick={action.onClick}
            >
              {action.label} <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform duration-200" />
            </Button>
          )}
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : undefined}>
        <WidgetBoundary title={title || "Section"}>{children}</WidgetBoundary>
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ active, payload, label, money }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-md text-xs">
      {label && <div className="font-medium text-gray-900 mb-1">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-gray-700">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}:</span>
          <span className="font-semibold">{money ? inr(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

interface OverviewData {
  periodDays: number;
  kpis: {
    revenue: { allTime: number; period: number; collectionsPeriod: number; completedTrips: number };
    bookings: { total: number; active: number; pipeline: number };
    vehicles: { total: number; available: number; onTrip: number; maintenance: number };
    drivers: { total: number; available: number; onDuty: number; inactive: number };
  };
  revenueTrend: Array<{ date: string; revenue: number; collections: number }>;
  bookingGroups: { pipeline: number; confirmed: number; running: number; completed: number; cancelled: number };
  attention: Array<{ id: string; severity: "critical" | "warning"; label: string; detail: string; count: number; view: string }>;
  attentionTotal: number;
  recentCustomers: Array<{ _id: string; name: string; primaryMobile?: string; totalBookings?: number; lastBookingDate?: string; status?: string }>;
  gps: { configured: boolean; online: number; offline: number; idle: number };
}

interface DashboardOverviewProps {
  onNavigate: (view: string) => void;
  onViewBooking: (booking: any) => void;
  onSelectCustomer: (customerId: string) => void;
  // Navigate to the Fleet/Drivers list pre-filtered to a status — reuses
  // dashboard.tsx's existing goToFleetStatus/goToDriverStatus helpers.
  onFleetStatusClick: (status: string) => void;
  onDriverStatusClick: (status: string) => void;
  canViewRevenue: boolean;
}

export default function DashboardOverview({ onNavigate, onViewBooking, onSelectCustomer, onFleetStatusClick, onDriverStatusClick, canViewRevenue }: DashboardOverviewProps) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [upcomingTab, setUpcomingTab] = useState<"today" | "tomorrow" | "future">("today");

  const { data: overview, isLoading, isError, refetch } = useQuery<OverviewData>({
    queryKey: ["/api/dashboard/overview", days],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/overview?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load dashboard overview");
      return res.json();
    },
  });

  const {
    data: classifiedUpcoming,
    isLoading: isUpcomingLoading,
    isError: isUpcomingError,
    refetch: refetchUpcoming,
  } = useQuery<{ today: any[]; tomorrow: any[]; future: any[]; all: any[] }>({
    queryKey: ["/api/dashboard/upcoming-bookings"],
  });

  const { data: liveOps, isLoading: isLiveOpsLoading } = useQuery<Record<string, any[]>>({
    queryKey: ["/api/operations/live-bookings"],
  });

  const k = overview?.kpis;

  // -------------------- header --------------------
  const header = (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live overview of your fleet operations</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10" onClick={() => onNavigate("customers-add")}>
          <UserRoundPlus className="mr-1.5 h-4 w-4" /> Add Customer
        </Button>
        <Button className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => onNavigate("bookings")}>
          <CalendarPlus className="mr-1.5 h-4 w-4" /> Create Booking
        </Button>
        <Button variant="outline" className="h-10" onClick={() => onNavigate("fleet")}>
          <Car className="mr-1.5 h-4 w-4" /> Manage Fleet
        </Button>
      </div>
    </div>
  );

  // -------------------- KPI cards --------------------
  const kpiCards = (
    <div className={`grid grid-cols-2 ${canViewRevenue ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 lg:gap-4`}>
      {isLoading || !k ? (
        [...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-sm"><CardContent className="p-4 lg:p-5">
            <Skeleton className="h-4 w-20 mb-3" /><Skeleton className="h-8 w-28 mb-2" /><Skeleton className="h-3 w-24" />
          </CardContent></Card>
        ))
      ) : (
        <>
          {canViewRevenue && (
            <KpiCard
              icon={<IndianRupee size={18} className="text-green-700" />} iconBg="bg-green-100"
              label={`Revenue · ${days}d`} value={inrCompact(k.revenue.period)}
              sub={`${inrCompact(k.revenue.collectionsPeriod)} collected · ${inrCompact(k.revenue.allTime)} all-time`}
              onClick={() => onNavigate("revenue")} aria="Revenue — view Revenue Report"
            />
          )}
          <KpiCard
            icon={<CalendarDays size={18} className="text-blue-700" />} iconBg="bg-blue-100"
            label="Bookings" value={String(k.bookings.total)}
            sub={`${k.bookings.active} active · ${k.bookings.pipeline} in pipeline`}
            onClick={() => onNavigate("history")} aria="Bookings — view Booking History"
          />
          <KpiCard
            icon={<Car size={18} className="text-purple-700" />} iconBg="bg-purple-100"
            label="Vehicles" value={String(k.vehicles.total)}
            sub={`${k.vehicles.available} available · ${k.vehicles.onTrip} on trip`}
            onClick={() => onNavigate("fleet")} aria="Vehicles — view Fleet"
          />
          <KpiCard
            icon={<Users size={18} className="text-orange-700" />} iconBg="bg-orange-100"
            label="Drivers" value={String(k.drivers.total)}
            sub={`${k.drivers.available} available · ${k.drivers.onDuty} on duty`}
            onClick={() => onNavigate("drivers")} aria="Drivers — view Manage Drivers"
          />
        </>
      )}
    </div>
  );

  // -------------------- revenue trend --------------------
  const trend = overview?.revenueTrend || [];
  const trendHasData = trend.some((t) => t.revenue > 0 || t.collections > 0);
  const revenueChart = (
    <DashCard
      title="Revenue Trend"
      subtitle="Completed trips vs money actually collected (payment ledger)"
      className="lg:col-span-8"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {([7, 30, 90] as const).map((d) => (
            <Button
              key={d} size="sm" variant={days === d ? "default" : "ghost"}
              className={`h-7 px-2.5 text-xs ${days === d ? "bg-blue-600 hover:bg-blue-700" : "text-gray-600"}`}
              onClick={() => setDays(d)}
            >
              {d}D
            </Button>
          ))}
        </div>
        {overview && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: CHART.revenue }} />Revenue {inrCompact(overview.kpis.revenue.period)}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: CHART.collections }} />Collections {inrCompact(overview.kpis.revenue.collectionsPeriod)}</span>
          </div>
        )}
      </div>
      {isError ? (
        <ChartError onRetry={refetch} label="Revenue chart unavailable." />
      ) : isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : !trendHasData ? (
        <div className="h-56 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-sm text-muted-foreground">No completed trips or payments recorded in the last {days} days.</p>
          <Button size="sm" variant="outline" onClick={() => onNavigate("bookings")}>Create Booking</Button>
        </div>
      ) : (
        <div className="h-56 chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.revenue} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART.revenue} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.collections} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART.collections} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickFormatter={(v) => inrCompact(v)} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<ChartTooltip money />} labelFormatter={shortDay} cursor={{ fill: "rgba(37, 99, 235, 0.05)" }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART.revenue} strokeWidth={2.5} fill="url(#revFill)" dot={false} activeDot={{ r: 5, fill: CHART.revenue }} />
              <Area type="monotone" dataKey="collections" name="Collections" stroke={CHART.collections} strokeWidth={2.5} fill="url(#colFill)" dot={false} activeDot={{ r: 5, fill: CHART.collections }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashCard>
  );

  // -------------------- fleet donut --------------------
  const fleetData = k ? [
    { name: "Available", value: k.vehicles.available, color: CHART.available, view: "available" },
    { name: "On Trip", value: k.vehicles.onTrip, color: CHART.onTrip, view: "on_trip" },
    { name: "Maintenance", value: k.vehicles.maintenance, color: CHART.maintenance, view: "maintenance" },
  ] : [];
  const fleetChart = (
    <DashCard title="Fleet Status" className="lg:col-span-4" action={{ label: "View All", onClick: () => onNavigate("fleet") }}>
      <StatusDonut
        loading={isLoading}
        data={fleetData}
        total={k?.vehicles.total || 0}
        totalLabel="vehicles"
        emptyText="No vehicles added yet."
        emptyAction={{ label: "View Fleet", onClick: () => onNavigate("fleet") }}
        onSegmentClick={(seg) => onFleetStatusClick(seg.view!)}
      />
    </DashCard>
  );

  // -------------------- booking activity --------------------
  const groups = overview?.bookingGroups;
  const bookingBars = groups ? [
    { name: "Pipeline", value: groups.pipeline },
    { name: "Confirmed", value: groups.confirmed },
    { name: "Running", value: groups.running },
    { name: "Completed", value: groups.completed },
    { name: "Cancelled", value: groups.cancelled },
  ] : [];
  const bookingChart = (
    <DashCard
      title="Booking Activity"
      subtitle="All bookings by operational stage"
      className="lg:col-span-8"
      action={{ label: "View All", onClick: () => onNavigate("history") }}
    >
      {isLoading ? (
        <Skeleton className="h-44 w-full" />
      ) : !groups || bookingBars.every((b) => b.value === 0) ? (
        <div className="h-44 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
          <Button size="sm" variant="outline" onClick={() => onNavigate("bookings")}>Create Booking</Button>
        </div>
      ) : (
        <div className="h-44 chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bookingBars} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={8}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} tickLine={false} axisLine={false} width={78} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
              <Bar dataKey="value" name="Bookings" fill={CHART.neutralBar} radius={[0, 6, 6, 0]} maxBarSize={20} animationDuration={400}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashCard>
  );

  // -------------------- driver donut --------------------
  const driverData = k ? [
    { name: "Available", value: k.drivers.available, color: CHART.available, view: "available" },
    { name: "On Duty", value: k.drivers.onDuty, color: CHART.onTrip, view: "on_duty" },
    { name: "Inactive", value: k.drivers.inactive, color: CHART.inactive, view: "inactive" },
  ] : [];
  const driverChart = (
    <DashCard title="Driver Status" className="lg:col-span-4" action={{ label: "View All", onClick: () => onNavigate("drivers") }}>
      <StatusDonut
        loading={isLoading}
        data={driverData}
        total={k?.drivers.total || 0}
        totalLabel="drivers"
        emptyText="No drivers added yet."
        emptyAction={{ label: "Manage Drivers", onClick: () => onNavigate("drivers") }}
        onSegmentClick={(seg) => onDriverStatusClick(seg.view!)}
      />
    </DashCard>
  );

  // -------------------- attention required --------------------
  const attention = overview?.attention || [];
  const attentionCard = (
    <DashCard
      title="Attention Required"
      subtitle="Highest-priority operational issues"
      className="lg:col-span-5"
      action={attention.length > 0 ? { label: "View All", onClick: () => onNavigate("live-bookings") } : undefined}
    >
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : isError ? (
        <ChartError onRetry={refetch} label="Couldn't load attention items." />
      ) : attention.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">✓ All clear — nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attention.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`w-full text-left flex items-center gap-3 rounded-lg border p-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                item.severity === "critical"
                  ? "border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300"
                  : "border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300"
              }`}
            >
              <AlertTriangle className={`h-4 w-4 shrink-0 transition-transform duration-200 ${item.severity === "critical" ? "text-red-600" : "text-amber-600"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">{item.label}</div>
                <div className="text-xs text-gray-600 truncate">{item.detail}</div>
              </div>
              <Badge variant="secondary" className={`shrink-0 transition-transform duration-200 ${item.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                {item.count}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </DashCard>
  );

  // -------------------- upcoming bookings (compact, max 3) --------------------
  const upcomingList = (classifiedUpcoming?.[upcomingTab] ?? []).slice(0, 3);
  const upcomingCount = classifiedUpcoming?.[upcomingTab]?.length ?? 0;
  const upcomingCard = (
    <DashCard
      title="Upcoming Bookings"
      className="lg:col-span-7"
      action={{ label: "View All", onClick: () => onNavigate("upcoming-bookings") }}
    >
      <div className="flex gap-1 mb-3">
        {(["today", "tomorrow", "future"] as const).map((tab) => (
          <Button
            key={tab} size="sm" variant={upcomingTab === tab ? "default" : "ghost"}
            className={`h-7 px-2.5 text-xs capitalize ${upcomingTab === tab ? "bg-blue-600 hover:bg-blue-700" : "text-gray-600"}`}
            onClick={() => setUpcomingTab(tab)}
          >
            {tab} ({classifiedUpcoming?.[tab]?.length ?? 0})
          </Button>
        ))}
      </div>
      {isUpcomingError ? (
        <ChartError onRetry={refetchUpcoming} label="Couldn't load upcoming bookings." />
      ) : isUpcomingLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : upcomingList.length === 0 ? (
        <div className="py-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {upcomingTab === "today" ? "No bookings scheduled today." : upcomingTab === "tomorrow" ? "No bookings tomorrow." : "No future bookings yet."}
          </p>
          <Button size="sm" variant="outline" onClick={() => onNavigate("bookings")}>Create Booking</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {upcomingList.map((booking: any) => {
            const vehicle = booking.vehicleId && typeof booking.vehicleId === "object" ? booking.vehicleId : null;
            return (
              <button
                key={booking._id || booking.id}
                type="button"
                onClick={() => onViewBooking(booking)}
                className="w-full text-left flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm hover:scale-[1.01] group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">{booking.customerName}</span>
                    <span className="text-xs text-muted-foreground group-hover:text-blue-600">{booking.bookingCode || booking.bookingId}</span>
                  </div>
                  <div className="text-xs text-gray-600 truncate mt-0.5 group-hover:text-gray-700">
                    {new Date(booking.pickupDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {booking.pickupTime ? ` · ${booking.pickupTime}` : ""}
                    {vehicle ? ` · ${[vehicle.make, vehicle.model].filter(Boolean).join(" ")}` : " · Vehicle unassigned"}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize transition-all duration-200 group-hover:bg-blue-100 group-hover:text-blue-700">{String(booking.status || "").replace(/_/g, " ")}</Badge>
              </button>
            );
          })}
          {upcomingCount > 3 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Showing 3 of {upcomingCount} — use View All for the rest.
            </p>
          )}
        </div>
      )}
    </DashCard>
  );

  // -------------------- live operations (compact strip) --------------------
  const liveTiles = [
    { key: "startDue", label: "Start Due", icon: Clock },
    { key: "startDelayed", label: "Delayed Pickup", icon: TimerReset },
    { key: "ongoing", label: "Running Trips", icon: PlayCircle },
    { key: "endingSoon", label: "Ending Soon", icon: Radio },
  ] as const;
  const liveTotal = liveTiles.reduce((s, t) => s + (liveOps?.[t.key]?.length ?? 0), 0);
  const liveOpsCard = (
    <DashCard
      title="Live Operations"
      className="lg:col-span-12"
      action={{ label: "View All", onClick: () => onNavigate("live-bookings") }}
    >
      {isLiveOpsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : liveTotal === 0 ? (
        <p className="text-sm text-muted-foreground py-1">Quiet right now — no trips due, delayed, running, or ending soon.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {liveTiles.map(({ key, label, icon: Icon }) => {
            const count = liveOps?.[key]?.length ?? 0;
            const isCritical = key === "startDelayed" && count > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate("live-bookings")}
                className={`text-left rounded-lg border p-3 flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:-translate-y-1 ${
                  isCritical ? "border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300" : "border-gray-100 hover:bg-blue-50 hover:border-blue-200"
                }`}
              >
                <Icon className={`h-5 w-5 transition-colors duration-200 ${isCritical ? "text-red-600" : "text-blue-600"}`} />
                <div>
                  <div className={`text-xl font-bold transition-colors duration-200 ${isCritical ? "text-red-700" : "text-gray-900"}`}>{count}</div>
                  <div className="text-xs text-gray-600">{label}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </DashCard>
  );

  // -------------------- GPS --------------------
  const gps = overview?.gps;
  const gpsCard = (
    <DashCard title="Live Fleet GPS" className="lg:col-span-7" action={gps?.configured ? { label: "View Full GPS", onClick: () => onNavigate("gps-tracking") } : undefined}>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !gps?.configured ? (
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Satellite className="h-5 w-5 text-gray-400" /></div>
            <div>
              <p className="text-sm font-medium text-gray-900">GPS not connected</p>
              <p className="text-xs text-muted-foreground">Connect a GPS provider to see live vehicle positions.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onNavigate("gps-tracking")}>Configure GPS</Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Online", value: gps.online, cls: "text-green-700 bg-green-50 border-green-200" },
            { label: "Idle / Unassigned", value: gps.idle, cls: "text-gray-700 bg-gray-50 border-gray-200" },
            { label: "Offline / Faulty", value: gps.offline, cls: "text-red-700 bg-red-50 border-red-200" },
          ].map((t) => (
            <div key={t.label} className={`rounded-lg border p-3 ${t.cls}`}>
              <div className="text-xl font-bold">{t.value}</div>
              <div className="text-xs">{t.label}</div>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );

  // -------------------- recent customers (max 4) --------------------
  const recent = overview?.recentCustomers || [];
  const recentCard = (
    <DashCard title="Recent Customers" className="lg:col-span-5" action={{ label: "View All", onClick: () => onNavigate("customers") }}>
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : recent.length === 0 ? (
        <div className="py-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No customers yet.</p>
          <Button size="sm" variant="outline" onClick={() => onNavigate("customers-add")}>Add Customer</Button>
        </div>
      ) : (
        <div className="space-y-1">
          {recent.slice(0, 4).map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => onSelectCustomer(c._id)}
              className="w-full text-left flex items-center justify-between gap-3 rounded-lg p-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(c.primaryMobile || "").replace(/^91(\d{10})$/, "$1").replace(/^(\d{2})\d{4}(\d{4})$/, "$1····$2")}
                  {c.lastBookingDate ? ` · last trip ${new Date(c.lastBookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{c.totalBookings || 0} trips</span>
            </button>
          ))}
        </div>
      )}
    </DashCard>
  );

  // -------------------- quick actions --------------------
  const quickActions = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "Add Customer", icon: UserRoundPlus, view: "customers-add" },
        { label: "Create Booking", icon: CalendarPlus, view: "bookings" },
        { label: "Add Driver", icon: Users, view: "drivers" },
        { label: "Add Vehicle", icon: Car, view: "fleet" },
      ].map(({ label, icon: Icon, view }) => (
        <button
          key={view + label}
          type="button"
          onClick={() => onNavigate(view)}
          className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-blue-700" /></div>
          <span className="text-sm font-medium text-gray-900">{label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5 max-w-[var(--content-max-width)] mx-auto">
      {header}
      {isError && !overview ? (
        <Card className="shadow-sm"><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-red-600">Couldn't load the dashboard overview.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      ) : (
        kpiCards
      )}
      {/* On mobile, operational sections (attention/upcoming) outrank the
          analytics charts; on desktop the grid reads top-down analytics-first. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="contents">
          <div className="order-3 lg:order-none lg:col-span-8 grid">{revenueChart}</div>
          <div className="order-4 lg:order-none lg:col-span-4 grid">{fleetChart}</div>
          <div className="order-5 lg:order-none lg:col-span-8 grid">{bookingChart}</div>
          <div className="order-6 lg:order-none lg:col-span-4 grid">{driverChart}</div>
          <div className="order-1 lg:order-none lg:col-span-5 grid">{attentionCard}</div>
          <div className="order-2 lg:order-none lg:col-span-7 grid">{upcomingCard}</div>
          <div className="order-7 lg:order-none lg:col-span-12 grid">{liveOpsCard}</div>
          <div className="order-8 lg:order-none lg:col-span-7 grid">{gpsCard}</div>
          <div className="order-9 lg:order-none lg:col-span-5 grid">{recentCard}</div>
        </div>
      </div>
      {quickActions}
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function KpiCard({ icon, iconBg, label, value, sub, onClick, aria }: {
  icon: ReactNode; iconBg: string; label: string; value: string; sub: string;
  onClick: () => void; aria: string;
}) {
  return (
    <Card
      role="button" tabIndex={0} aria-label={aria}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="shadow-sm cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-gray-200 hover:border-blue-200 page-transition"
    >
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110`}>{icon}</div>
        </div>
        <div className="text-2xl font-bold text-gray-900 tabular-nums truncate">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ChartError({ onRetry, label }: { onRetry: () => void; label: string }) {
  return (
    <div className="py-8 text-center space-y-3">
      <p className="text-sm text-red-600">{label}</p>
      <Button variant="outline" size="sm" onClick={() => onRetry()}>Retry</Button>
    </div>
  );
}

// Donut + always-visible numeric legend: the chart is the visualization,
// the numbers are the source of truth (accessibility requirement — data is
// never color-alone).
function StatusDonut({ loading, data, total, totalLabel, emptyText, emptyAction, onSegmentClick }: {
  loading: boolean;
  data: Array<{ name: string; value: number; color: string; view?: string }>;
  total: number;
  totalLabel: string;
  emptyText: string;
  emptyAction: { label: string; onClick: () => void };
  onSegmentClick?: (segment: { name: string; view?: string }) => void;
}) {
  if (loading) {
    return <div className="flex items-center gap-4"><Skeleton className="h-32 w-32 rounded-full" /><div className="flex-1 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div></div>;
  }
  if (total === 0) {
    return (
      <div className="py-6 text-center space-y-2">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
        <Button size="sm" variant="outline" onClick={emptyAction.onClick}>{emptyAction.label}</Button>
      </div>
    );
  }
  const nonZero = data.filter((d) => d.value > 0);
  return (
    <div className="flex items-center gap-4 chart-container">
      <div className="relative h-36 w-36 shrink-0 transition-transform duration-300 hover:scale-105" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={nonZero} dataKey="value" nameKey="name"
              innerRadius={42} outerRadius={62} paddingAngle={nonZero.length > 1 ? 3 : 0}
              stroke="#ffffff" strokeWidth={2}
              onClick={(entry: any) => onSegmentClick?.(entry)}
              className={onSegmentClick ? "cursor-pointer" : undefined}
            >
              {nonZero.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(59, 130, 246, 0.05)" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">{total}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{totalLabel}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        {data.map((d) => (
          <button
            key={d.name}
            type="button"
            disabled={!onSegmentClick}
            onClick={() => onSegmentClick?.(d)}
            className="w-full flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1.5 transition-all duration-200 enabled:hover:bg-blue-50 enabled:cursor-pointer enabled:hover:shadow-sm enabled:hover:border-l-4 enabled:hover:border-l-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex items-center gap-2 text-gray-700 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0 transition-transform duration-200" style={{ background: d.color }} />
              <span className="truncate font-medium">{d.name}</span>
            </span>
            <span className="font-semibold text-gray-900 tabular-nums">{d.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
