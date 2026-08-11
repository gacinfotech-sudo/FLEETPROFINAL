// TASK-ROOT-DASHBOARD-02 — Root Customer 360.
//
// Single-customer detail from GET /api/root/customers/:id, masked by
// default (same PII-masking contract as the Global Customer Database).
// No "View Sensitive Data" control is rendered — that unmask-with-audit
// flow belongs to TASK-ROOT-SECURITY-05 and isn't stubbed here as a fake
// button, since a fake control would be misleading.
//
// Proposed mount: `<Route path="/root/customers/:customerId">` in
// client/src/App.tsx (Integrator-only — see this task's report).

import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, EyeOff } from "lucide-react";

interface CustomerDetail {
  customerId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  customerCode?: string;
  maskedPhone: string;
  maskedEmail?: string;
  city?: string;
  state?: string;
  customerType: string;
  customerStatus: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpending: number;
  firstBookingDate?: string;
  lastBookingDate?: string;
  createdAt: string;
  recentBookings: Array<{
    _id: string;
    bookingId: string;
    bookingCode?: string;
    status: string;
    pickupLocation: string;
    dropoffLocation?: string;
    pickupDate?: string;
    totalAmount: number;
  }>;
}

export default function RootCustomer360() {
  const [, params] = useRoute("/root/customers/:customerId");
  const [, setLocation] = useLocation();
  const customerId = params?.customerId
    ?? (typeof window !== "undefined" ? window.location.pathname.split("/root/customers/")[1]?.split("/")[0] : undefined);

  const { data, isLoading, error } = useQuery<CustomerDetail>({
    queryKey: [`/api/root/customers/${customerId}`],
    enabled: !!customerId,
  });

  if (!customerId) return <div className="p-6 text-destructive">No customer selected.</div>;

  return (
    <div className="p-6 space-y-4" data-testid="root-customer-360-page">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/root/customers")} data-testid="button-back-to-customers">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Global Customer Database
      </Button>

      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <p className="text-destructive">Failed to load customer. {(error as Error).message}</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{data.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="outline">{data.tenantName}</Badge>
                <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> {data.maskedPhone}{data.maskedEmail ? ` · ${data.maskedEmail}` : ""}</span>
              </p>
            </div>
            <Badge>{data.customerStatus}</Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Bookings</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{data.totalBookings}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{data.completedBookings}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Cancelled</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{data.cancelledBookings}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Spending</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">₹{data.totalSpending}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Bookings</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentBookings.map((b) => (
                    <TableRow key={b._id}>
                      <TableCell>{b.bookingCode || b.bookingId}</TableCell>
                      <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                      <TableCell>{b.pickupLocation} {b.dropoffLocation ? `→ ${b.dropoffLocation}` : ""}</TableCell>
                      <TableCell>{b.pickupDate ? new Date(b.pickupDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right">₹{b.totalAmount ?? 0}</TableCell>
                    </TableRow>
                  ))}
                  {data.recentBookings.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No bookings yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
