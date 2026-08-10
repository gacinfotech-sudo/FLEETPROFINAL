// TASK-ROOT-DASHBOARD-02 — Global Customer Database.
//
// Cross-tenant customer search (tenant/name/phone/email/city/customer-ID/
// booking-ID/booking-code/date-range filters). PII is masked by default —
// the API itself returns `maskedPhone`/`maskedEmail` (never the raw
// values), so this page never even receives unmasked data to accidentally
// render. The real "View Sensitive Data" unmask-with-audit flow is
// TASK-ROOT-SECURITY-05's scope and is not built here.
//
// Proposed mount: `<Route path="/root/customers">` in client/src/App.tsx
// (Integrator-only — see this task's report).

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EyeOff } from "lucide-react";

interface MaskedCustomerRow {
  customerId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  maskedPhone: string;
  maskedEmail?: string;
  city?: string;
  totalBookings: number;
  createdAt: string;
}

interface GlobalCustomerResponse {
  customers: MaskedCustomerRow[];
  total: number;
}

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "customerId", label: "Customer ID" },
  { key: "bookingId", label: "Booking ID" },
  { key: "bookingCode", label: "Booking Code" },
] as const;

export default function RootGlobalCustomers() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [debounced, setDebounced] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 300);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => { setPage(1); }, [debounced]);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("pageSize", String(pageSize));
  Object.entries(debounced).forEach(([k, v]) => { if (v) queryParams.set(k, v); });

  const url = `/api/root/customers?${queryParams.toString()}`;
  const { data, isLoading, error } = useQuery<GlobalCustomerResponse>({ queryKey: [url] });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const hasAnyFilter = Object.values(debounced).some(Boolean);

  return (
    <div className="space-y-6" data-testid="root-global-customers-page">
      {/* Beautiful Gradient Header */}
      <div className="gradient-header bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold">🌍 Global Customer Database</h1>
        <p className="text-cyan-100 mt-1">Cross-tenant search • PII masked by default for privacy</p>
      </div>

      <div className="px-6">
      <Card>
        <CardHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FIELDS.map((f) => (
              <Input
                key={f.key}
                placeholder={f.label}
                value={filters[f.key] ?? ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                data-testid={`input-customer-filter-${f.key}`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive text-sm mb-4">Failed to search. {(error as Error).message}</div>}

          {!hasAnyFilter && !isLoading && (data?.customers.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              This is a cross-tenant Root view — searching with no filters returns customers from every tenant.
              Enter a filter above, or leave blank and results will appear below.
            </p>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.customers ?? []).map((c) => (
                    <TableRow
                      key={c.customerId}
                      className="cursor-pointer"
                      onClick={() => setLocation(`/root/customers/${c.customerId}`)}
                      data-testid={`row-customer-${c.customerId}`}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><Badge variant="outline" data-testid={`badge-tenant-${c.customerId}`}>{c.tenantName}</Badge></TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`cell-masked-phone-${c.customerId}`}>{c.maskedPhone || "—"}</TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`cell-masked-email-${c.customerId}`}>{c.maskedEmail || "—"}</TableCell>
                      <TableCell>{c.city || "—"}</TableCell>
                      <TableCell className="text-right">{c.totalBookings}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.customers ?? []).length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No customers match this search.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">{data?.total ?? 0} customer(s) — page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="button-customers-prev-page">Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} data-testid="button-customers-next-page">Next</Button>
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
