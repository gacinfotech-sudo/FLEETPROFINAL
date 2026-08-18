// TASK-BOOKING-QUEUES-05 — customer previous-booking reuse. Confirmed
// genuinely absent from docs/booking-research/CURRENT-BOOKING-AUDIT.md.
// Distinct from customer-dashboard.tsx's existing "Use as template" button,
// which copies only route + notes ("never dates, driver, vehicle, or
// payment" — its own title text) — this surfaces a vehicle *preference*
// too (category/make/model, never the original vehicleId).
//
// Hard rule: reusing a previous booking must create a NEW booking, never
// touch the historical one, and never lock any field. This component only
// ever reads (GET) and then hands the result to the caller's `onReuse`
// callback — the exact same `(prefill: any) => void` shape
// customer-dashboard.tsx's onNewBooking already uses for both its own
// buttons, which ultimately feeds EnhancedBookingForm's `initialValues`
// prop. Nothing here ever calls a write endpoint, and nothing in
// EnhancedBookingForm is ever told which fields came from history — once
// prefilled, every field is a normal, fully-editable form field like any
// other (see enhanced-booking-form.tsx: `initialValues` is applied once via
// `form.reset()`, not re-applied or re-validated against the source later).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { PreviousBookingOption, ReusePrefill } from "./types";

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Translates the server's ReusePrefill into EnhancedBookingForm's
// `initialValues` shape. vehiclePreference has no matching structured field
// on that form (Vehicle & Service step always requires picking a real,
// currently-available vehicle) — surfaced as a plain-text hint prepended to
// notes instead, exactly as editable as anything else typed into that
// textarea, never a locked/binding field.
export function toBookingFormInitialValues(prefill: ReusePrefill): Record<string, unknown> {
  const vehicleHint = prefill.vehiclePreference
    ? `Previously used: ${[prefill.vehiclePreference.make, prefill.vehiclePreference.model, prefill.vehiclePreference.type ? `(${prefill.vehiclePreference.type})` : ""].filter(Boolean).join(" ")}`
    : "";
  const notes = [vehicleHint, prefill.notes].filter(Boolean).join(vehicleHint && prefill.notes ? " — " : "");

  return {
    customerName: prefill.customerName,
    customerPhone: prefill.customerPhone,
    customerEmail: prefill.customerEmail || undefined,
    pickupLocation: prefill.pickupLocation,
    dropoffLocation: prefill.dropoffLocation || undefined,
    bookingType: prefill.bookingType || undefined,
    tripType: prefill.tripType || undefined,
    pricingType: prefill.pricingType || undefined,
    notes: notes || undefined,
    // pickupDate/pickupTime/returnDate/returnTime, vehicleId/driverId, and
    // status/payment are deliberately NOT set — a new booking always gets
    // its own dates and its own real vehicle/driver assignment.
  };
}

export default function PreviousBookingReuse({ customerId, onReuse }: { customerId: string; onReuse: (prefill: Record<string, unknown>) => void }) {
  const [applying, setApplying] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ options: PreviousBookingOption[] }>({
    queryKey: [`/api/customers/${customerId}/previous-booking-reuse`],
    enabled: !!customerId,
  });

  const options = data?.options || [];

  async function handleReuse(sourceBookingId: string) {
    setApplying(sourceBookingId);
    try {
      const res = await fetch(`/api/customers/${customerId}/previous-booking-reuse?apply=${sourceBookingId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load previous booking");
      const { prefill }: { prefill: ReusePrefill } = await res.json();
      onReuse(toBookingFormInitialValues(prefill));
    } finally {
      setApplying(null);
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading previous bookings...</p>;
  if (options.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reuse a Previous Booking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-gray-500 mb-2">
          Prefills a brand-new booking with this customer's prior route and vehicle preference — the original booking is never changed, and every field stays editable.
        </p>
        {options.map((o) => (
          <div key={o.sourceBookingId} className="flex items-center justify-between border rounded-lg px-3 py-2">
            <div>
              <p className="text-sm font-medium">{o.bookingId} <Badge variant="outline" className="ml-1 capitalize">{o.status?.replace(/_/g, " ")}</Badge></p>
              <p className="text-xs text-gray-500">{o.pickupLocation} {o.dropoffLocation ? `→ ${o.dropoffLocation}` : ""} · {fmtDate(o.pickupDate)}</p>
            </div>
            <Button size="sm" variant="outline" disabled={applying === o.sourceBookingId} onClick={() => handleReuse(o.sourceBookingId)}>
              <Copy className="h-4 w-4 mr-1" /> {applying === o.sourceBookingId ? "Loading..." : "Reuse"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
