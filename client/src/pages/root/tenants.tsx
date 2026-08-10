// TASK-ROOT-DASHBOARD-02 — Tenant Master Database.
//
// Searchable/filterable/paginated tenant list, extending the existing
// `/api/admin/tenants` basic listing (admin-panel.tsx) with server-side
// search, status filtering, and pagination against the new
// GET /api/root/tenants endpoint. Reads the initial `status` filter from
// the URL query string so Root Dashboard's status cards can deep-link here
// (e.g. `/root/tenants?status=suspended`).
//
// Clicking a row opens Tenant 360 (`/root/tenants/:tenantId`, proposed
// route — see this task's report).

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";

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
  healthRiskFlag?: "none" | "watch" | "at_risk";
  userCount: number;
  vehicleCount: number;
  driverCount: number;
  bookingCount: number;
}

interface TenantListResponse {
  tenants: TenantSummary[];
  total: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-300",
  trial: "bg-blue-100 text-blue-800 border-blue-300",
  suspended: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-gray-100 text-gray-800 border-gray-300",
};

function initialStatusFromUrl(): string {
  if (typeof window === "undefined") return "all";
  const params = new URLSearchParams(window.location.search);
  return params.get("status") ?? "all";
}

export default function RootTenants() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>(initialStatusFromUrl);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("pageSize", String(pageSize));
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (status !== "all") queryParams.set("status", status);

  const url = `/api/root/tenants?${queryParams.toString()}`;
  const { data, isLoading, error } = useQuery<TenantListResponse>({ queryKey: [url] });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-6" data-testid="root-tenants-page">
      {/* Beautiful Gradient Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">🏢 Tenant Master Database</h1>
        <p className="text-purple-100 mt-1">All tenants on the platform • Click a row to open Tenant 360</p>
      </div>

      <div className="px-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name, business, email, phone, tenant code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-tenant-search"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-tenant-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-destructive text-sm mb-4">
              Failed to load tenants. {(error as Error).message}
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Vehicles</TableHead>
                    <TableHead className="text-right">Drivers</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.tenants ?? []).map((t) => (
                    <TableRow
                      key={t.tenantId}
                      className="cursor-pointer"
                      onClick={() => setLocation(`/root/tenants/${t.tenantId}`)}
                      data-testid={`row-tenant-${t.tenantId}`}
                    >
                      <TableCell>
                        <div className="font-medium">{t.businessName || t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.email || t.phone || "—"}</div>
                      </TableCell>
                      <TableCell>{t.tenantCode ?? "—"}</TableCell>
                      <TableCell className="capitalize">{t.subscriptionPlan}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[t.status]}>{t.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{t.userCount}</TableCell>
                      <TableCell className="text-right">{t.vehicleCount}</TableCell>
                      <TableCell className="text-right">{t.driverCount}</TableCell>
                      <TableCell className="text-right">{t.bookingCount}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.tenants ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No tenants match this search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {data?.total ?? 0} tenant{(data?.total ?? 0) === 1 ? "" : "s"} — page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    data-testid="button-tenants-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    data-testid="button-tenants-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
