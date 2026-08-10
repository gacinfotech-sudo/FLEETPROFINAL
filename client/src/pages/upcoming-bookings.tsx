import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, AlertTriangle } from "lucide-react";
import { useBookingWorkspace } from "@/components/booking/booking-workspace-context";

function fmtMoney(n?: number) {
  if (n === undefined || n === null) return "-";
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function UpcomingBookings() {
  const { openBooking } = useBookingWorkspace();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/operations/upcoming-bookings?days=3"],
    refetchInterval: 60000,
  });

  const days: any[] = (data as any[]) || [];

  // Calculate totals across all days
  const todayCount = days[0]?.bookings?.length || 0;
  const tomorrowCount = days[1]?.bookings?.length || 0;
  const dayAfterCount = days[2]?.bookings?.length || 0;
  const totalBookings = todayCount + tomorrowCount + dayAfterCount;
  const totalRevenue = days.flatMap((d: any) => d.bookings || []).reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Beautiful Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
        <div>
          <h1 className="text-3xl font-bold">📅 Upcoming Bookings</h1>
          <p className="text-blue-100 mt-1">Today, tomorrow and the day after — sorted by pickup time</p>
        </div>
      </div>

      {/* Summary Stats Cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">📍 TODAY</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{todayCount}</p>
              <p className="text-xs text-gray-500 mt-1">bookings</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">🔜 TOMORROW</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{tomorrowCount}</p>
              <p className="text-xs text-gray-500 mt-1">bookings</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">📌 DAY AFTER</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">{dayAfterCount}</p>
              <p className="text-xs text-gray-500 mt-1">bookings</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium">💰 REVENUE</p>
              <p className="text-2xl font-bold text-amber-600 mt-2">{fmtMoney(totalRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">3 days total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load upcoming bookings.</p>}

      {days.map((day, idx) => {
        const colors = ["from-green-50 to-emerald-50 border-green-200", "from-blue-50 to-cyan-50 border-blue-200", "from-purple-50 to-pink-50 border-purple-200"];
        const colorClass = colors[idx % colors.length];
        return (
          <Card key={day.date} className={`bg-gradient-to-br ${colorClass}`}>
          <CardHeader className="bg-white/50">
            <CardTitle className="text-base flex items-center gap-3">
              <span className="text-2xl">{idx === 0 ? "📍" : idx === 1 ? "🔜" : "📌"}</span>
              <span className="font-bold text-gray-900">{day.label}</span>
              <Badge className="bg-blue-100 text-blue-700 font-bold">{day.bookings.length} bookings</Badge>
              <span className="text-xs font-normal text-gray-500 ml-auto">{day.date}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {day.bookings.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No bookings.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell>Booking</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Pickup Time</TableCell>
                    <TableCell>Route</TableCell>
                    <TableCell>Vehicle / Driver</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Flags</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {day.bookings.map((b: any) => (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer hover:bg-white/60 transition-all"
                      onClick={() => openBooking(b.id)}
                    >
                      <TableCell className="font-mono text-xs font-bold">
                        <button
                          type="button"
                          className="text-blue-700 hover:underline font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            openBooking(b.id);
                          }}
                        >
                          #{b.bookingId}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{b.customerName}</TableCell>
                      <TableCell className="font-semibold text-blue-600">🕐 {b.pickupTime || "-"}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">
                          {b.pickupLocation}
                          {b.dropoffLocation && (
                            <>
                              <br />
                              <span className="text-gray-500">→ {b.dropoffLocation}</span>
                            </>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.fulfilmentType === "vendor" ? (
                          <Badge className="bg-purple-100 text-purple-700">🏢 {b.vendorName || "unnamed"}</Badge>
                        ) : (
                          <>
                            <div className="font-medium">🚗 {b.vehicle ? `${b.vehicle.make} (${b.vehicle.registrationNumber || "-"})` : "❌ No vehicle"}</div>
                            <div className="text-xs text-gray-600">👤 {b.driver ? b.driver.name : "❌ No driver"}</div>
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium text-green-600">✅ {fmtMoney(b.advanceReceived)}</span>
                          <span className="text-gray-500"> / {fmtMoney(b.totalAmount)}</span>
                          {b.remainingBalance > 0 && (
                            <div className="text-xs text-red-600 font-bold mt-1">❌ Due {fmtMoney(b.remainingBalance)}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {b.flags?.driverNotAssigned && (
                            <button
                              type="button"
                              className="flex items-center text-xs text-amber-600 hover:underline font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                openBooking(b.id, { focus: "allocation" });
                              }}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              No driver
                            </button>
                          )}
                          {b.flags?.vehicleNotAssigned && (
                            <button
                              type="button"
                              className="flex items-center text-xs text-amber-600 hover:underline font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                openBooking(b.id, { focus: "allocation" });
                              }}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              No vehicle
                            </button>
                          )}
                          {b.flags?.invalidCustomerPhone && (
                            <button
                              type="button"
                              className="flex items-center text-xs text-red-600 hover:underline font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                openBooking(b.id, { focus: "customer" });
                              }}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Bad phone
                            </button>
                          )}
                          {!b.flags?.driverNotAssigned && !b.flags?.vehicleNotAssigned && !b.flags?.invalidCustomerPhone && (
                            <span className="text-xs text-green-600 font-medium">✅ All OK</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => openBooking(b.id)}
                          >
                            Open
                          </Button>
                          <a href={`tel:${b.customerPhone}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:bg-blue-50"
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          </a>
                          <a
                            href={`https://wa.me/${(b.customerPhone || "").replace(/\D/g, "")}`}
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      );
      })}
    </div>
  );
}
