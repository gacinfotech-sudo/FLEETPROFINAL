// Customer 360 — Self Drive history + risk flags (spec §22-§23, §37).
// History rows come from GET /api/customers/:id/self-drive (canonical
// Booking + SelfDriveTrip join, computed server-side). Risk flags reuse the
// existing customer tag system (audited add/remove with actor events) —
// warnings, never automatic blocks.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeySquare, AlertTriangle, IndianRupee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";
import ProcessRefundDialog from "@/components/self-drive/process-refund-dialog";

const money = (n?: number | null) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

export const RISK_FLAGS = [
  "Frequent Late Return", "Multiple Challans", "Damage History",
  "Refund Dispute", "Payment Issues", "Good Customer",
];

const STAGE_BADGE: Record<string, string> = {
  refund_pending: "bg-amber-100 text-amber-800 border-amber-200",
  settled: "bg-emerald-100 text-emerald-800 border-emerald-200",
  on_trip: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function CustomerSelfDrive({ customerId, tags = [] }: { customerId: string; tags?: string[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openBooking } = useBookingWorkspace();
  const [refunding, setRefunding] = useState<{ bookingId: string; bookingCode?: string } | null>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/customers/${customerId}/self-drive`],
  });

  const tagMutation = useMutation({
    mutationFn: async ({ tag, add }: { tag: string; add: boolean }) =>
      add
        ? (await apiRequest("POST", `/api/customers/${customerId}/tags`, { tag })).json()
        : (await apiRequest("DELETE", `/api/customers/${customerId}/tags/${encodeURIComponent(tag)}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      toast({ title: "Risk flag updated" });
    },
    onError: (err: any) => toast({ title: "Could not update flag", description: err?.message, variant: "destructive" }),
  });

  if (isLoading) return null;
  if (rows.length === 0 && !RISK_FLAGS.some((f) => tags.includes(f))) return null;

  const pendingRefunds = rows.filter((r) => r.refund && ["pending", "partially_refunded"].includes(r.refund.status));
  const pendingAmount = pendingRefunds.reduce((s, r) => s + (r.refund?.balance || 0), 0);

  return (
    <Card data-testid="customer-self-drive">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeySquare size={16} className="text-violet-600" /> Self Drive History
        </CardTitle>
        {pendingRefunds.length > 0 && (
          <Badge className="bg-red-600 text-white" data-testid="customer-refund-pending-badge">
            REFUND PENDING {money(pendingAmount)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk flags — reuse tag system; warnings only, never auto-blocks */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1 flex items-center gap-1"><AlertTriangle size={12} />Flags:</span>
          {RISK_FLAGS.map((f) => {
            const on = tags.includes(f);
            return (
              <button
                key={f}
                onClick={() => tagMutation.mutate({ tag: f, add: !on })}
                disabled={tagMutation.isPending}
                className={`text-xs rounded-full border px-2 py-0.5 transition-colors ${
                  on
                    ? f === "Good Customer" ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-red-100 border-red-300 text-red-800"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
                data-testid={`risk-flag-${f.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead><TableHead>Vehicle</TableHead><TableHead>Pickup</TableHead>
                  <TableHead>Rental</TableHead><TableHead>Deposit</TableHead><TableHead>Deductions</TableHead>
                  <TableHead>Refund</TableHead><TableHead>Fuel Δ</TableHead><TableHead>KM</TableHead>
                  <TableHead>Flags</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <button className="text-blue-700 hover:underline" onClick={() => openBooking(r.id)}>{r.bookingCode}</button>
                      <Badge variant="outline" className={`block mt-0.5 w-fit text-[10px] capitalize ${STAGE_BADGE[r.stage] || ""}`}>{r.stage.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.vehicle ? `${r.vehicle.make || ""} ${r.vehicle.registrationNumber || ""}` : "—"}</TableCell>
                    <TableCell className="text-sm">{r.pickupDate ? new Date(r.pickupDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</TableCell>
                    <TableCell className="text-sm">{money(r.rental)}</TableCell>
                    <TableCell className="text-sm">{r.deposit ? money(r.deposit.amount) : "—"}</TableCell>
                    <TableCell className="text-sm text-red-700">{r.refund ? money(r.refund.totalDeduction) : "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.refund ? (
                        <>
                          {money(r.refund.refunded)}
                          <Badge variant="outline" className="ml-1 text-[10px] capitalize">{r.refund.status.replace(/_/g, " ")}</Badge>
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.fuelOut !== null && r.fuelIn !== null ? (
                        <span className={r.fuelIn < r.fuelOut ? "text-red-700" : "text-emerald-700"}>{r.fuelIn - r.fuelOut > 0 ? "+" : ""}{r.fuelIn - r.fuelOut}%</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.kmOut !== null && r.kmIn !== null ? `${(r.kmIn - r.kmOut).toLocaleString("en-IN")} km` : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.wasLate && <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 mr-1">Late</Badge>}
                      {r.challanFound && <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 mr-1">Challan</Badge>}
                      {r.damage && <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200">Damage</Badge>}
                    </TableCell>
                    <TableCell>
                      {r.refund && ["pending", "partially_refunded"].includes(r.refund.status) && (
                        <Button size="sm" className="h-7" onClick={() => setRefunding({ bookingId: r.id, bookingCode: r.bookingCode })}>
                          <IndianRupee size={12} className="mr-0.5" />Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {refunding && (
        <ProcessRefundDialog
          bookingId={refunding.bookingId}
          bookingCode={refunding.bookingCode}
          onClose={() => setRefunding(null)}
          onDone={() => {
            setRefunding(null);
            queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/self-drive`] });
          }}
        />
      )}
    </Card>
  );
}
