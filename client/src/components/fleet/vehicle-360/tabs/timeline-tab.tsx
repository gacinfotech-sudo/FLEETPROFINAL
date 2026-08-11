import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";

interface TimelineEntry {
  date: Date;
  type: string;
  description: string;
}

/**
 * Client-side fan-out across the tabs' own data sources — the spec's
 * preferred pattern is a real server-side fan-out (mirroring the existing
 * `services/timelineService.ts` used for Customer 360, per
 * VEHICLE-360-SPEC.md's explicit recommendation), which this frontend-only
 * task cannot build (`server/**` is forbidden). This is a working, honest
 * approximation from data already fetched elsewhere on this page, not a
 * placeholder — flagged in this task's report as the one tab that should
 * be replaced by a real backend fan-out once the Integrator can add one.
 */
export function TimelineTab({ vehicleId }: { vehicleId: string }) {
  const bookings = useQuery<any[]>({ queryKey: ["/api/bookings"], retry: false });
  const breakdowns = useQuery<any[]>({
    queryKey: [`/api/vehicles/${vehicleId}/breakdowns`, 'timeline'],
    queryFn: async () => { const r = await fetch(`/api/vehicles/${vehicleId}/breakdowns`, { credentials: 'include' }); if (!r.ok) throw new Error('n/a'); return r.json(); },
    retry: false,
  });
  const accidents = useQuery<any[]>({
    queryKey: [`/api/vehicles/${vehicleId}/accidents`, 'timeline'],
    queryFn: async () => { const r = await fetch(`/api/vehicles/${vehicleId}/accidents`, { credentials: 'include' }); if (!r.ok) throw new Error('n/a'); return r.json(); },
    retry: false,
  });

  const isLoading = bookings.isLoading || breakdowns.isLoading || accidents.isLoading;
  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }

  const entries: TimelineEntry[] = [
    ...(bookings.data ?? [])
      .filter((b) => (b.vehicleId?._id ?? b.vehicleId) === vehicleId)
      .map((b) => ({ date: new Date(b.pickupDate), type: 'Booking', description: `${b.bookingId} · ${b.customerName}` })),
    ...(breakdowns.data ?? []).map((b: any) => ({ date: new Date(b.reportedAt), type: 'Breakdown', description: b.symptoms })),
    ...(accidents.data ?? []).map((a: any) => ({ date: new Date(a.occurredAt), type: 'Accident', description: a.location ?? 'Accident reported' })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (entries.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No timeline activity yet.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <Card key={i}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{e.type}</div>
              <div className="text-xs text-muted-foreground">{e.description}</div>
            </div>
            <div className="text-xs text-muted-foreground">{e.date.toLocaleDateString()}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
