import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, IndianRupee } from "lucide-react";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";

function fmtMoney(n?: number) {
  if (n === undefined || n === null) return "-";
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PaymentDues() {
  const { openBooking } = useBookingWorkspace();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/operations/payment-dues"],
    refetchInterval: 60000,
  });

  const rows: any[] = (data as any[]) || [];
  const totalDue = rows.reduce((sum, r) => sum + (r.remainingBalance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Collection Due</h1>
          <p className="text-sm text-gray-500">Every booking with an outstanding balance, oldest pickup first.</p>
        </div>
        <Badge className="bg-red-600 text-base px-3 py-1">Total due: {fmtMoney(totalDue)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} booking{rows.length === 1 ? "" : "s"} with dues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : isError ? (
            <p className="text-sm text-red-600">Failed to load payment dues.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">Nothing outstanding.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Booking</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Pickup Date</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Days</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openBooking(r.id, { focus: "payments" })}>
                    <TableCell className="font-mono text-xs">
                      <button type="button" className="text-blue-700 hover:underline" onClick={(e) => { e.stopPropagation(); openBooking(r.id, { focus: "payments" }); }}>
                        {r.bookingId}
                      </button>
                    </TableCell>
                    <TableCell>{r.customerName}</TableCell>
                    <TableCell>{r.pickupDate ? new Date(r.pickupDate).toLocaleDateString("en-IN") : "-"}</TableCell>
                    <TableCell>{fmtMoney(r.totalAmount)}</TableCell>
                    <TableCell>{fmtMoney(r.advanceReceived)}</TableCell>
                    <TableCell className="font-semibold text-red-600">{fmtMoney(r.remainingBalance)}</TableCell>
                    <TableCell>
                      {r.daysOverdue > 0 ? <Badge variant="destructive">{r.daysOverdue}d overdue</Badge> : <Badge variant="outline">upcoming</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{r.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {/* Collect: opens the same workspace focused on the Payment section (§54) */}
                        <Button variant="outline" size="sm" className="h-7" onClick={() => openBooking(r.id, { focus: "payments" })}>
                          <IndianRupee className="w-3.5 h-3.5 mr-1" /> Collect
                        </Button>
                        <a href={`tel:${r.customerPhone}`}>
                          <Button variant="ghost" size="icon"><Phone className="w-4 h-4" /></Button>
                        </a>
                        <a href={`https://wa.me/${(r.customerPhone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon"><MessageCircle className="w-4 h-4" /></Button>
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
