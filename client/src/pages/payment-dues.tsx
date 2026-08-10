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
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">💰 Payment Collection Due</h1>
            <p className="text-red-100 mt-1">Outstanding balances • oldest pickup first</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
            <p className="text-red-100 text-sm font-medium">Total Due</p>
            <p className="text-3xl font-bold text-white mt-1">{fmtMoney(totalDue)}</p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">📊 BOOKINGS</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">{rows.length}</p>
            <p className="text-xs text-gray-500 mt-1">With outstanding balance</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">⏰ OVERDUE</p>
            <p className="text-2xl font-bold text-red-600 mt-2">{rows.filter(r => r.daysOverdue > 0).length}</p>
            <p className="text-xs text-gray-500 mt-1">Days past due</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">🎯 UPCOMING</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{rows.filter(r => r.daysOverdue <= 0).length}</p>
            <p className="text-xs text-gray-500 mt-1">Upcoming payments</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardTitle className="text-lg">{rows.length} booking{rows.length === 1 ? "" : "s"} with dues</CardTitle>
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
                {rows.map((r) => {
                  const isOverdue = r.daysOverdue > 0;
                  return (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer transition-all ${
                        isOverdue
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-blue-50"
                      }`}
                      onClick={() => openBooking(r.id, { focus: "payments" })}
                    >
                      <TableCell className="font-mono text-xs font-bold">
                        <button
                          type="button"
                          className="text-blue-700 hover:underline font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            openBooking(r.id, { focus: "payments" });
                          }}
                        >
                          #{r.bookingId}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{r.customerName}</TableCell>
                      <TableCell className="text-sm">
                        {r.pickupDate ? new Date(r.pickupDate).toLocaleDateString("en-IN") : "-"}
                      </TableCell>
                      <TableCell className="font-medium">{fmtMoney(r.totalAmount)}</TableCell>
                      <TableCell className="text-green-600 font-medium">{fmtMoney(r.advanceReceived)}</TableCell>
                      <TableCell className="font-bold text-red-600 text-lg">{fmtMoney(r.remainingBalance)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            isOverdue
                              ? "bg-red-100 text-red-700 font-bold"
                              : "bg-blue-100 text-blue-700"
                          }
                        >
                          {isOverdue ? `⚠️ ${r.daysOverdue}d overdue` : "📅 Upcoming"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gray-100 text-gray-700">
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-8 bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => openBooking(r.id, { focus: "payments" })}
                          >
                            <IndianRupee className="w-3.5 h-3.5 mr-1" /> Collect
                          </Button>
                          <a href={`tel:${r.customerPhone}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:bg-blue-50"
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          </a>
                          <a
                            href={`https://wa.me/${(r.customerPhone || "").replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:bg-green-50"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
