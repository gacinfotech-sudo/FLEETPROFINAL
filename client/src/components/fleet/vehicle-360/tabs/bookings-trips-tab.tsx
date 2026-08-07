import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";

/** Consumes the EXISTING, already-live `GET /api/bookings` endpoint —
 * filtered client-side by vehicleId (IBooking.vehicleId, no new booking
 * model per this batch's explicit scope boundary). */
export function BookingsTripsTab({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/bookings"], retry: false });
  const bookings = (data ?? [])
    .filter((b) => (b.vehicleId?._id ?? b.vehicleId) === vehicleId)
    .sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }
  if (bookings.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No bookings for this vehicle yet.</p></CardContent></Card>;
  }
  return (
    <div className="space-y-2">
      {bookings.map((b) => (
        <Card key={b._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{b.bookingId} · {b.customerName}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(b.pickupDate).toLocaleDateString()} · {b.pickupLocation} → {b.dropoffLocation ?? '—'}
              </div>
            </div>
            <Badge variant="outline">{b.status}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
