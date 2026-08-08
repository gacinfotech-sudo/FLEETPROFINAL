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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upcoming Bookings</h1>
        <p className="text-sm text-gray-500">Today, tomorrow and the day after — sorted by pickup time.</p>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load upcoming bookings.</p>}

      {days.map((day) => (
        <Card key={day.date}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {day.label}
              <Badge variant="secondary">{day.bookings.length}</Badge>
              <span className="text-xs font-normal text-gray-400">{day.date}</span>
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
                    <TableRow key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openBooking(b.id)}>
                      <TableCell className="font-mono text-xs">
                        <button type="button" className="text-blue-700 hover:underline" onClick={(e) => { e.stopPropagation(); openBooking(b.id); }}>
                          {b.bookingId}
                        </button>
                      </TableCell>
                      <TableCell>{b.customerName}</TableCell>
                      <TableCell>{b.pickupTime || "-"}</TableCell>
                      <TableCell className="text-sm">{b.pickupLocation}{b.dropoffLocation ? ` → ${b.dropoffLocation}` : ""}</TableCell>
                      <TableCell className="text-sm">
                        {b.fulfilmentType === "vendor" ? (
                          <Badge variant="secondary">Vendor: {b.vendorName || "unnamed"}</Badge>
                        ) : (
                          <>
                            {b.vehicle ? `${b.vehicle.make} (${b.vehicle.registrationNumber || "-"})` : "No vehicle"}
                            <br />
                            {b.driver ? b.driver.name : "No driver"}
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        {fmtMoney(b.advanceReceived)} / {fmtMoney(b.totalAmount)}
                        {b.remainingBalance > 0 && (
                          <div className="text-xs text-red-600">Due {fmtMoney(b.remainingBalance)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {/* Flags are quick fixes — each opens the workspace on the section that resolves it (§59) */}
                          {b.flags?.driverNotAssigned && <button type="button" className="flex items-center text-xs text-amber-600 hover:underline" onClick={(e) => { e.stopPropagation(); openBooking(b.id, { focus: "allocation" }); }}><AlertTriangle className="w-3 h-3 mr-1" />No driver</button>}
                          {b.flags?.vehicleNotAssigned && <button type="button" className="flex items-center text-xs text-amber-600 hover:underline" onClick={(e) => { e.stopPropagation(); openBooking(b.id, { focus: "allocation" }); }}><AlertTriangle className="w-3 h-3 mr-1" />No vehicle</button>}
                          {b.flags?.invalidCustomerPhone && <button type="button" className="flex items-center text-xs text-red-600 hover:underline" onClick={(e) => { e.stopPropagation(); openBooking(b.id, { focus: "customer" }); }}><AlertTriangle className="w-3 h-3 mr-1" />Bad phone</button>}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" className="h-7" onClick={() => openBooking(b.id)}>Open</Button>
                          <a href={`tel:${b.customerPhone}`}>
                            <Button variant="ghost" size="icon"><Phone className="w-4 h-4" /></Button>
                          </a>
                          <a href={`https://wa.me/${(b.customerPhone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
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
      ))}
    </div>
  );
}
