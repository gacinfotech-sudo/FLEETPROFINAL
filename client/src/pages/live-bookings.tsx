import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";

export type Bucket = "startDue" | "startDelayed" | "startingSoon" | "ongoing" | "endingSoon" | "completionOverdue" | "paymentPending" | "completedToday" | "delayed" | "unassigned" | "cancelled";

const TABS: { key: Bucket; label: string }[] = [
  { key: "startDue", label: "Start Due" },
  { key: "startDelayed", label: "Start Delayed" },
  { key: "startingSoon", label: "Starting Soon" },
  { key: "ongoing", label: "Ongoing Trips" },
  { key: "endingSoon", label: "Ending Soon" },
  { key: "completionOverdue", label: "Completion Overdue" },
  { key: "paymentPending", label: "Payment Pending" },
  { key: "completedToday", label: "Completed Today" },
  { key: "delayed", label: "Delayed / Attention" },
  { key: "unassigned", label: "Unassigned" },
  { key: "cancelled", label: "Cancelled" },
];

function fmtDate(d?: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatMoney(n?: number) {
  if (n === undefined || n === null) return "-";
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function LiveBookings({ initialTab }: { initialTab?: Bucket } = {}) {
  const { toast } = useToast();
  const { openBooking } = useBookingWorkspace();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Bucket>(initialTab || "startDue");
  const [startingWindow, setStartingWindow] = useState("today");
  const [endingWindow, setEndingWindow] = useState("today");

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/operations/live-bookings?startingWindow=${startingWindow}&endingWindow=${endingWindow}`],
    refetchInterval: 60000, // gentle auto-refresh, not a tight poll loop
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("POST", `/api/bookings/${id}/status`, { status });
      return res.json();
    },
    onSuccess: (booking: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/operations/live-bookings?startingWindow=${startingWindow}&endingWindow=${endingWindow}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      // Completing/closing a booking here is also the one place that
      // credits reward points and recomputes spend/tier server-side (see
      // POST /api/bookings/:id/status). Without this, a customer's 360
      // view — reward balance, financial summary, booking/payment lists —
      // stayed stale (showing pre-completion numbers) until an unrelated
      // full page reload happened to refetch it.
      const customerId = booking?.customerId ? String(booking.customerId) : undefined;
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/rewards`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/bookings`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/payments`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/financial-summary`] });
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/timeline`] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      }
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Could not change status", description: err.message, variant: "destructive" });
    },
  });

  const rows: any[] = (data as any)?.[activeTab] || [];

  const nextActionFor = (status: string): { label: string; next: string } | null => {
    const map: Record<string, { label: string; next: string }> = {
      confirmed: { label: "Assign Vehicle", next: "vehicle_assigned" },
      vehicle_assigned: { label: "Assign Driver", next: "driver_assigned" },
      driver_assigned: { label: "Ready for Dispatch", next: "ready_for_dispatch" },
      ready_for_dispatch: { label: "Start Trip", next: "trip_started" },
      trip_started: { label: "Mark Ongoing", next: "ongoing" },
      ongoing: { label: "Return Pending", next: "return_pending" },
      return_pending: { label: "Complete Trip", next: "completed" },
      completed: { label: "Close Booking", next: "closed" },
    };
    return map[status] || null;
  };

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">🚗 Live Bookings</h1>
            <p className="text-blue-100 mt-1">
              Real-time booking management • {(data as any)?.generatedAt ? `Updated ${new Date((data as any).generatedAt).toLocaleTimeString()}` : "Loading..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={startingWindow} onValueChange={setStartingWindow}>
              <SelectTrigger className="w-40 bg-white/20 border-white/30 text-white"><SelectValue placeholder="Starting window" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Next 1 hour</SelectItem>
                <SelectItem value="3h">Next 3 hours</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
              </SelectContent>
            </Select>
            <Select value={endingWindow} onValueChange={setEndingWindow}>
              <SelectTrigger className="w-40 bg-white/20 border-white/30 text-white"><SelectValue placeholder="Ending window" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Next 1 hour</SelectItem>
                <SelectItem value="3h">Next 3 hours</SelectItem>
                <SelectItem value="today">Today</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/operations/live-bookings?startingWindow=${startingWindow}&endingWindow=${endingWindow}`] })}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">🔴 URGENT</p>
            <p className="text-2xl font-bold text-red-600">
              {((data as any)?.startDelayed || []).length + ((data as any)?.completionOverdue || []).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Delayed or Overdue</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">🔵 ACTIVE</p>
            <p className="text-2xl font-bold text-blue-600">
              {((data as any)?.ongoing || []).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Currently On Trip</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-medium">✅ COMPLETED</p>
            <p className="text-2xl font-bold text-green-600">
              {((data as any)?.completedToday || []).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Completed Today</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Bucket)}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              {data ? <Badge variant="secondary" className="ml-2">{((data as any)[t.key] || []).length}</Badge> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : isError ? (
                  <p className="text-sm text-red-600">Failed to load live bookings.</p>
                ) : rows.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No bookings in this bucket.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell>Booking</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Pickup</TableCell>
                        <TableCell>Vehicle / Driver</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Payment</TableCell>
                        <TableCell>Flags</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((b) => {
                        const nextAction = nextActionFor(b.status);
                        const isUrgent = activeTab === "startDelayed" || activeTab === "completionOverdue";
                        const isOngoing = activeTab === "ongoing";

                        return (
                          <TableRow
                            key={b.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              isUrgent ? "bg-red-50 hover:bg-red-100" :
                              isOngoing ? "bg-blue-50 hover:bg-blue-100" :
                              "hover:bg-gray-50"
                            }`}
                            onClick={() => openBooking(b.id)}
                          >
                            <TableCell className="font-mono text-xs font-bold">
                              <button type="button" className="text-blue-700 hover:underline font-bold" onClick={(e) => { e.stopPropagation(); openBooking(b.id); }}>
                                #{b.bookingId}
                              </button>
                            </TableCell>
                            <TableCell className="font-medium">{b.customerName}</TableCell>
                            <TableCell className="text-sm">
                              <span className="font-medium">{fmtDate(b.pickupDate)}</span>
                              {b.pickupTime && <span className="ml-2 text-gray-600">{b.pickupTime}</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {b.fulfilmentType === "vendor" ? (
                                <Badge className="mb-1 bg-purple-100 text-purple-700">🏢 {b.vendorName || "unnamed"}</Badge>
                              ) : (
                                <>
                                  <div className="font-medium">{b.vehicle ? `${b.vehicle.make} (${b.vehicle.registrationNumber || "-"})` : "❌ No vehicle"}</div>
                                  <div className="text-xs text-gray-600">{b.driver ? `👤 ${b.driver.name}` : (b.bookingType === "self_drive" ? "🚗 Self-drive" : "❌ No driver")}</div>
                                </>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  isUrgent ? "bg-red-100 text-red-700" :
                                  isOngoing ? "bg-blue-100 text-blue-700" :
                                  "bg-gray-100 text-gray-700"
                                }
                              >
                                {b.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-gray-900">{formatMoney(b.totalAmount)}</div>
                              <Badge
                                className={`text-xs mt-1 ${b.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                              >
                                {b.paymentStatus === "paid" ? "✅ Paid" : "❌ Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {b.flags?.driverNotAssigned && <span className="flex items-center text-xs text-amber-600 font-medium"><AlertTriangle className="w-3 h-3 mr-1" />No driver</span>}
                                {b.flags?.vehicleNotAssigned && <span className="flex items-center text-xs text-amber-600 font-medium"><AlertTriangle className="w-3 h-3 mr-1" />No vehicle</span>}
                                {b.flags?.advancePaymentPending && <span className="flex items-center text-xs text-red-600 font-medium"><AlertTriangle className="w-3 h-3 mr-1" />Payment due</span>}
                                {!b.flags?.driverNotAssigned && !b.flags?.vehicleNotAssigned && !b.flags?.advancePaymentPending && (
                                  <span className="text-xs text-green-600 font-medium">✅ All OK</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button
                                  size="sm"
                                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => openBooking(b.id)}
                                >
                                  Open
                                </Button>
                                <a href={`tel:${b.customerPhone}`} title="Call customer">
                                  <Button variant="ghost" size="icon" className="text-blue-600 hover:bg-blue-50"><Phone className="w-4 h-4" /></Button>
                                </a>
                                <a href={`https://wa.me/${b.customerPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp customer">
                                  <Button variant="ghost" size="icon" className="text-green-600 hover:bg-green-50"><MessageCircle className="w-4 h-4" /></Button>
                                </a>
                                {nextAction && (
                                  <Button
                                    size="sm"
                                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                    disabled={statusMutation.isPending}
                                    onClick={() => statusMutation.mutate({ id: b.id, status: nextAction.next })}
                                  >
                                    {nextAction.label}
                                  </Button>
                                )}
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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
