import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, Building2, CheckCircle2, AlertTriangle, CalendarClock } from "lucide-react";

// Spec §26 — every card here is clickable and loads the real underlying
// bookings, same pattern as the Rewards & Referrals dashboard from the
// prior initiative. No card shows a number with no way to see what it's
// made of. Counts come from a dedicated aggregation
// (server/services/vendorSourcingService.ts's buildResourceFulfilmentDashboard)
// so this page never has to fetch the full, very large bookings list.

interface DashboardData {
  ownFleetAssigned: number;
  vendorConfirmationPending: number;
  resourceSecured: number;
  resourceNotSecured: number;
  outsourcingRequestsPending: number;
  vendorResponsesPending: number;
  upcomingWithoutResource: number;
}

type Category = "own_fleet_assigned" | "vendor_confirmation_pending" | "resource_secured" | "resource_not_secured" | "upcoming_without_resource";

const FULFILMENT_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  resource_secured: "default",
  vendor_confirmation_pending: "outline",
  not_started: "secondary",
  resource_sourcing_pending: "secondary",
  vendor_quotes_pending: "outline",
};

export default function ResourceFulfilmentDashboard() {
  const [category, setCategory] = useState<{ key: Category; label: string } | null>(null);

  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/resource-fulfilment-dashboard"] });

  const { data: rows } = useQuery<any[]>({
    queryKey: ["/api/resource-fulfilment-bookings", category?.key],
    queryFn: async () => {
      const res = await fetch(`/api/resource-fulfilment-bookings?category=${category!.key}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!category,
  });

  const cards: { key: string; label: string; value: string; icon: any; color: string; onClick: { key: Category; label: string } | null }[] = data ? [
    { key: "ownFleet", label: "Own Fleet Assigned", value: String(data.ownFleetAssigned), icon: Car, color: "text-blue-600",
      onClick: { key: "own_fleet_assigned", label: "Own Fleet Assigned Bookings" } },
    { key: "vendorPending", label: "Vendor Confirmation Pending", value: String(data.vendorConfirmationPending), icon: Building2, color: "text-amber-600",
      onClick: { key: "vendor_confirmation_pending", label: "Vendor Confirmation Pending" } },
    { key: "secured", label: "Resource Secured", value: String(data.resourceSecured), icon: CheckCircle2, color: "text-emerald-600",
      onClick: { key: "resource_secured", label: "Resource Secured (via Sourcing)" } },
    { key: "notSecured", label: "Resource Not Secured", value: String(data.resourceNotSecured), icon: AlertTriangle, color: "text-red-600",
      onClick: { key: "resource_not_secured", label: "Bookings With No Resource Yet" } },
    { key: "outsourcingPending", label: "Outsourcing Requests Pending", value: String(data.outsourcingRequestsPending), icon: Building2, color: "text-purple-600", onClick: null },
    { key: "responsesPending", label: "Vendor Responses Pending", value: String(data.vendorResponsesPending), icon: AlertTriangle, color: "text-purple-600", onClick: null },
    { key: "upcomingWithout", label: "Upcoming (7d) Without Resource", value: String(data.upcomingWithoutResource), icon: CalendarClock, color: "text-red-600",
      onClick: { key: "upcoming_without_resource", label: "Upcoming Bookings Without a Resource" } },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Resource Fulfilment</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(7)].map((_, i) => <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const isActive = category && card.onClick && category.key === card.onClick.key;
            return (
              <button
                key={card.key}
                type="button"
                id={`fulfilment-card-${card.key}`}
                disabled={!card.onClick}
                onClick={() => card.onClick && setCategory(card.onClick)}
                className={`text-left rounded-lg border bg-white p-4 transition-all ${
                  card.onClick ? "hover:shadow-md hover:border-gray-300 cursor-pointer" : "cursor-default"
                } ${isActive ? "ring-2 ring-emerald-500 border-emerald-500" : ""}`}
              >
                <Icon className={`h-5 w-5 mb-2 ${card.color}`} />
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {category && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {(rows || []).length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No matching bookings.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>Fulfilment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rows || []).map((b: any) => (
                      <TableRow key={b._id}>
                        <TableCell className="font-medium">{b.bookingId}</TableCell>
                        <TableCell>{b.customerName}</TableCell>
                        <TableCell className="text-gray-500">{b.pickupDate ? new Date(b.pickupDate).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={FULFILMENT_BADGE[b.resourceFulfilmentStatus] || "secondary"}>
                            {(b.resourceFulfilmentStatus || "own fleet").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-gray-500">{(b.status || "").replace(/_/g, " ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
