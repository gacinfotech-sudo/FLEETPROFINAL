// TASK-ROOT-DASHBOARD-02 — Tenant 360°.
//
// Tabbed workspace for a single tenant. Data tabs (Overview, Users &
// Roles, Customers, Bookings, Drivers, Vehicles, Vendors, Payments,
// Invoices, Inquiries/Leads, GPS, Telephony, WhatsApp, Subscription,
// Usage) load on demand via GET /api/root/tenants/:tenantId/tabs/:tab —
// each is only fetched (react-query `enabled`) once its tab is actually
// selected, never all at once on page open (source brief §44).
//
// Errors / Support / Security / Audit Log tabs are stubs pointing at
// where TASK-ROOT-SUPPORT-03 / TASK-ROOT-SECURITY-05's real UI will
// mount. Configuration / Features tabs are stubs for
// TASK-ROOT-SALES-CONFIG-04. Neither calls a backend route — no fake data.
//
// Proposed mount: `<Route path="/root/tenants/:tenantId">` in
// client/src/App.tsx (Integrator-only, not added here — see this task's
// report).

import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

interface TenantSummary {
  tenantId: string;
  tenantCode?: string;
  name: string;
  businessName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  subscriptionPlan: string;
  status: "active" | "trial" | "suspended" | "expired";
  createdAt: string;
}

interface Tenant360Response {
  tenant: TenantSummary;
  counts: Record<string, number>;
}

type ColumnDef = { key: string; label: string; format?: (row: any) => React.ReactNode };

const DATA_TABS: { value: string; label: string; columns?: ColumnDef[] }[] = [
  { value: "overview", label: "Overview" },
  {
    value: "users", label: "Users & Roles",
    columns: [
      { key: "name", label: "Name" },
      { key: "userId", label: "User ID" },
      { key: "role", label: "Role" },
      { key: "isActive", label: "Active", format: (r) => (r.isActive ? "Yes" : "No") },
    ],
  },
  {
    value: "customers", label: "Customers",
    columns: [
      { key: "name", label: "Name" },
      { key: "primaryMobile", label: "Mobile" },
      { key: "city", label: "City" },
      { key: "totalBookings", label: "Bookings" },
      { key: "customerStatus", label: "Status" },
    ],
  },
  {
    value: "bookings", label: "Bookings",
    columns: [
      { key: "bookingCode", label: "Code", format: (r) => r.bookingCode || r.bookingId },
      { key: "customerName", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "pickupDate", label: "Pickup", format: (r) => (r.pickupDate ? new Date(r.pickupDate).toLocaleDateString() : "—") },
      { key: "totalAmount", label: "Amount", format: (r) => `₹${r.totalAmount ?? 0}` },
    ],
  },
  {
    value: "drivers", label: "Drivers",
    columns: [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "status", label: "Status" },
      { key: "rating", label: "Rating" },
    ],
  },
  {
    value: "vehicles", label: "Vehicles",
    columns: [
      { key: "make", label: "Make" },
      { key: "vehicleModel", label: "Model" },
      { key: "licensePlate", label: "Plate" },
      { key: "status", label: "Status" },
      { key: "type", label: "Type" },
    ],
  },
  {
    value: "vendors", label: "Vendors",
    columns: [
      { key: "companyName", label: "Company" },
      { key: "contactPerson", label: "Contact" },
      { key: "primaryMobile", label: "Mobile" },
      { key: "status", label: "Status" },
    ],
  },
  {
    value: "payments", label: "Payments",
    columns: [
      { key: "amount", label: "Amount", format: (r) => `₹${r.amount ?? 0}` },
      { key: "paymentType", label: "Type" },
      { key: "paymentMode", label: "Mode" },
      { key: "status", label: "Status" },
      { key: "receivedAt", label: "Received", format: (r) => (r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : "—") },
    ],
  },
  {
    value: "invoices", label: "Invoices",
    columns: [
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "documentType", label: "Type" },
      { key: "status", label: "Status" },
      { key: "invoiceDate", label: "Date", format: (r) => (r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString() : "—") },
    ],
  },
  {
    value: "inquiries", label: "Inquiries",
    columns: [
      { key: "inquiryNumber", label: "Inquiry #" },
      { key: "customerName", label: "Customer" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
    ],
  },
  {
    value: "leads", label: "Leads",
    columns: [
      { key: "leadNumber", label: "Lead #" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "assignedExecutive", label: "Assigned To" },
    ],
  },
  { value: "gps", label: "GPS" },
  { value: "telephony", label: "Telephony" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "subscription", label: "Subscription" },
  { value: "usage", label: "Usage" },
];

const STUB_TABS: { value: string; label: string; owner: string }[] = [
  { value: "errors", label: "Errors", owner: "TASK-ROOT-SUPPORT-03" },
  { value: "support", label: "Support", owner: "TASK-ROOT-SUPPORT-03" },
  { value: "security", label: "Security", owner: "TASK-ROOT-SECURITY-05" },
  { value: "audit-log", label: "Audit Log", owner: "TASK-ROOT-SECURITY-05" },
  { value: "configuration", label: "Configuration", owner: "TASK-ROOT-SALES-CONFIG-04" },
  { value: "features", label: "Features", owner: "TASK-ROOT-SALES-CONFIG-04" },
];

function GenericTabTable({ tenantId, tab, columns }: { tenantId: string; tab: string; columns: ColumnDef[] }) {
  const { data, isLoading, error } = useQuery<{ rows: any[]; total: number }>({
    queryKey: [`/api/root/tenants/${tenantId}/tabs/${tab}`],
  });

  if (isLoading) return <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>;
  if (error) return <p className="p-4 text-destructive text-sm">Failed to load: {(error as Error).message}</p>;

  const rows = data?.rows ?? [];
  return (
    <div className="p-2">
      <p className="text-xs text-muted-foreground mb-2">{data?.total ?? 0} total (showing {rows.length})</p>
      <Table>
        <TableHeader>
          <TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={row._id ?? i}>
              {columns.map((c) => <TableCell key={c.key}>{c.format ? c.format(row) : String(row[c.key] ?? "—")}</TableCell>)}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-6">No records.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryPanel({ tenantId, tab }: { tenantId: string; tab: string }) {
  const { data, isLoading, error } = useQuery<Record<string, any>>({
    queryKey: [`/api/root/tenants/${tenantId}/tabs/${tab}`],
  });
  if (isLoading) return <div className="p-4"><Skeleton className="h-24" /></div>;
  if (error) return <p className="p-4 text-destructive text-sm">Failed to load: {(error as Error).message}</p>;
  return (
    <pre className="p-4 text-xs bg-muted rounded overflow-auto max-h-96">{JSON.stringify(data, null, 2)}</pre>
  );
}

function OverviewPanel({ tenant360 }: { tenant360: Tenant360Response }) {
  return (
    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      {Object.entries(tenant360.counts).map(([key, value]) => (
        <Card key={key}>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground capitalize">{key.replace(/Count$/, "")}</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{value}</div></CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function RootTenant360() {
  const [, params] = useRoute("/root/tenants/:tenantId");
  const [, setLocation] = useLocation();
  const tenantId = params?.tenantId
    ?? (typeof window !== "undefined" ? window.location.pathname.split("/root/tenants/")[1]?.split("/")[0] : undefined);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: tenant360, isLoading, error } = useQuery<Tenant360Response>({
    queryKey: [`/api/root/tenants/${tenantId}`],
    enabled: !!tenantId,
  });

  if (!tenantId) {
    return <div className="p-6 text-destructive">No tenant selected.</div>;
  }

  return (
    <div className="space-y-4" data-testid="root-tenant-360-page">
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/root/tenants")} data-testid="button-back-to-tenants">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Tenant Database
        </Button>
      </div>

      {isLoading || !tenant360 ? (
        <div className="p-6"><Skeleton className="h-20" /></div>
      ) : error ? (
        <div className="p-6 text-destructive">Failed to load tenant. {(error as Error).message}</div>
      ) : (
        <>
          {/* Beautiful Gradient Header */}
          <div className="gradient-header bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl mx-6 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">👁️ {tenant360.tenant.businessName || tenant360.tenant.name}</h1>
                <p className="text-violet-100 mt-1">{tenant360.tenant.email} {tenant360.tenant.phone ? `· ${tenant360.tenant.phone}` : ""}</p>
              </div>
              <Badge className={tenant360.tenant.status === 'active' ? 'bg-green-500' : tenant360.tenant.status === 'trial' ? 'bg-blue-500' : tenant360.tenant.status === 'suspended' ? 'bg-red-500' : 'bg-gray-500'}>{tenant360.tenant.status}</Badge>
            </div>
          </div>
        </>
      )}

      {tenant360 && (
        <div className="px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto justify-start gap-1">
            {DATA_TABS.map((t) => <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>{t.label}</TabsTrigger>)}
            {STUB_TABS.map((t) => <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`}>{t.label}</TabsTrigger>)}
          </TabsList>

          <TabsContent value="overview"><OverviewPanel tenant360={tenant360} /></TabsContent>

          {DATA_TABS.filter((t) => t.value !== "overview").map((t) => (
            <TabsContent key={t.value} value={t.value}>
              {activeTab === t.value && (
                t.columns
                  ? <GenericTabTable tenantId={tenantId} tab={t.value} columns={t.columns} />
                  : <SummaryPanel tenantId={tenantId} tab={t.value} />
              )}
            </TabsContent>
          ))}

          {STUB_TABS.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p className="mb-2">{t.label} is not built by this task.</p>
                  <Badge variant="secondary">Owned by {t.owner}</Badge>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        </div>
      )}
    </div>
  );
}
