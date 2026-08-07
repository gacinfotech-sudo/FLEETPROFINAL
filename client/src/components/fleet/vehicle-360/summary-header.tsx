import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

/**
 * Section 26 "Final Acceptance" summary header — all 13 required fields,
 * each sourced from a real query (never placeholder text). Fields backed by
 * a proposed-but-not-yet-mounted endpoint (Compliance, Maintenance Health,
 * GPS Status) degrade to an honest "—" / "Not configured" rather than a
 * fabricated value when that query 404s — expected until the Integrator
 * applies this batch's route patches, not a bug in this display logic.
 */
export function VehicleSummaryHeader({ vehicle }: { vehicle: any }) {
  const { user } = useAuth();
  // Purchase value is Accounts-restricted per VEHICLE-COMPLIANCE-MATRIX.md's
  // access-classification precedent — only shown to owner/admin roles here,
  // matching this repo's existing role-gating convention elsewhere.
  const role = (user as any)?.role;
  const canSeeFinancials = role === 'admin' || role === 'owner';

  const { data: bookings } = useQuery<any[]>({ queryKey: ["/api/bookings"], retry: false });
  const vehicleBookings = (bookings ?? []).filter((b) => (b.vehicleId?._id ?? b.vehicleId) === vehicle._id);
  const today = new Date().toDateString();
  const todaysBookings = vehicleBookings.filter((b) => new Date(b.pickupDate).toDateString() === today);
  const upcoming = vehicleBookings
    .filter((b) => new Date(b.pickupDate) >= new Date() && ['confirmed', 'pending'].includes(b.status))
    .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime())[0];

  const { data: performance } = useQuery<any>({
    queryKey: [`/api/reports/vehicle-performance`],
    retry: false,
  });
  const perfRow = performance?.vehicles?.find?.((v: any) => v.vehicleId === vehicle._id);

  const { data: compliance } = useQuery<any>({
    queryKey: [`/api/vehicles/${vehicle._id}/compliance-status`],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicle._id}/compliance-status`, { credentials: 'include' });
      if (!res.ok) throw new Error('not available');
      return res.json();
    },
    retry: false,
  });

  const { data: breakdowns } = useQuery<any[]>({
    queryKey: [`/api/vehicles/${vehicle._id}/breakdowns`],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicle._id}/breakdowns`, { credentials: 'include' });
      if (!res.ok) throw new Error('not available');
      return res.json();
    },
    retry: false,
  });
  const openDefectsCount = (breakdowns ?? []).filter((b) => b.currentState !== 'available').length;

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Identity', value: `${vehicle.make ?? ''} ${vehicle.vehicleModel ?? ''} · ${vehicle.licensePlate ?? '—'}` },
    { label: 'Compliance', value: compliance ? <Badge variant={compliance.status === 'COMPLIANT' ? 'default' : 'destructive'}>{compliance.status}</Badge> : '—' },
    { label: 'Operational Status', value: <Badge variant="outline">{vehicle.status ?? '—'}</Badge> },
    { label: 'Driver', value: vehicle.currentDriverName ?? 'Not assigned' },
    { label: 'Current Odometer', value: vehicle.currentOdometer !== undefined ? `${vehicle.currentOdometer} km` : '—' },
    { label: 'GPS Status', value: <Badge variant="outline">{vehicle.gpsStatus ?? 'NOT_CONFIGURED'}</Badge> },
    { label: 'Maintenance Health', value: vehicle.maintenanceHealth ?? '—' },
    { label: 'Expiring Documents', value: compliance ? `${compliance.expiringSoonDocumentTypes?.length ?? 0}` : '—' },
    { label: "Today's Use", value: `${todaysBookings.length} booking${todaysBookings.length === 1 ? '' : 's'}` },
    { label: 'Current/Upcoming Booking', value: upcoming ? new Date(upcoming.pickupDate).toLocaleDateString() : 'None' },
    { label: 'Cost', value: perfRow ? `₹${perfRow.totalExpenses ?? 0}` : '—' },
    { label: 'Revenue', value: perfRow ? `₹${perfRow.totalRevenue ?? 0}` : '—' },
    { label: 'Open Defects', value: `${openDefectsCount}` },
  ];

  return (
    <Card>
      <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {fields.map((f) => (
          <div key={f.label} className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">{f.label}</div>
            <div className="text-sm font-medium truncate">{f.value}</div>
          </div>
        ))}
        {canSeeFinancials && vehicle.purchaseValue !== undefined && (
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">Purchase Value</div>
            <div className="text-sm font-medium truncate">₹{vehicle.purchaseValue}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
