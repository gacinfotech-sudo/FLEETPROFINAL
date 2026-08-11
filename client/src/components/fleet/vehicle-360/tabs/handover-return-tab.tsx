import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/**
 * Reads/acts against the real, now-merged `server/driver/handover/**`
 * routes — per this task's explicit scope: "you build the UI against that
 * documented contract, you do not build a new backend for it." This is the
 * full handover+return event view; Driver Assignments tab reads the same
 * source summarized as an assignment history.
 *
 * Field names corrected during integration against the real
 * `publicVehicleHandover()` shape — `handoverOdometer`/`returnOdometer`/
 * `damageFlags` don't exist; the real fields are `odometerReading`
 * (one per event, since handover and return are separate direction-tagged
 * events, not one record with two odometer fields), `flags` (array), and
 * `status` ('completed'|'disputed'|etc, not a boolean).
 */
export function HandoverReturnTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/handovers`, 'full']}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/handovers`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No handover/return events recorded yet."
      notYetAvailableLabel="Handover/return records are temporarily unavailable."
      renderRow={(handover: any) => (
        <Card key={handover.id}>
          <CardContent className="py-3">
            <div className="text-sm font-medium">{handover.direction === 'out' ? 'Handover' : 'Return'} · Driver {handover.driverId}</div>
            <div className="text-xs text-muted-foreground">
              Odometer: {handover.odometerReading ?? '—'} km · Fuel: {handover.fuelLevel ?? '—'}
              {handover.flags?.length ? ` · ${handover.flags.length} flag(s)` : ''}
              {handover.status && handover.status !== 'completed' ? ` · ${handover.status}` : ''}
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
