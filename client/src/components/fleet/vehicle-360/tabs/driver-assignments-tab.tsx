import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/**
 * Per CURRENT-FLEET-MODULE-AUDIT.md §7: "No 'current Vehicle-Driver
 * assignment' concept exists beyond... the VehicleHandover model
 * (event-based, not a persistent roster field)." This tab reads handover
 * events as the driver-assignment history — it does not invent a second
 * assignment concept.
 *
 * Field names corrected during integration against the real, now-merged
 * `publicVehicleHandover()` shape (server/driver/handover/serialization.ts)
 * — the original build was against a documented-but-unmerged contract and
 * guessed `driverName`/`handoverAt`/`returnedAt`, which don't exist. Real
 * shape: `direction` ('out'|'in'), `conductedAt`, `driverId` only (no name
 * resolution server-side yet), `status`. One handover event = one
 * direction; "currently assigned" is derived from `isOpenForVehicle` on the
 * most recent 'out' event, not a returnedAt field.
 */
export function DriverAssignmentsTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/handovers`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/handovers`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No driver assignment history yet."
      notYetAvailableLabel="Handover/return records are temporarily unavailable."
      renderRow={(handover: any) => (
        <Card key={handover.id}>
          <CardContent className="py-3">
            <div className="text-sm font-medium">Driver {handover.driverId}</div>
            <div className="text-xs text-muted-foreground">
              {handover.direction === 'out' ? 'Handed over' : 'Returned'} {handover.conductedAt ? new Date(handover.conductedAt).toLocaleDateString() : '—'}
              {handover.direction === 'out' && handover.isOpenForVehicle ? ' · currently assigned' : ''}
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
