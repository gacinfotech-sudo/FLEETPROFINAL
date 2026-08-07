import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/**
 * Per CURRENT-FLEET-MODULE-AUDIT.md §7: "No 'current Vehicle-Driver
 * assignment' concept exists beyond... the VehicleHandover model
 * (event-based, not a persistent roster field)." This tab reads handover
 * events (documented contract, `server/driver/handover/**`, unmerged) as
 * the driver-assignment history — it does not invent a second assignment
 * concept.
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
      notYetAvailableLabel="Handover/return module has not merged into trunk yet — driver assignment history is derived from it and will populate once that work lands."
      renderRow={(handover: any) => (
        <Card key={handover._id}>
          <CardContent className="py-3">
            <div className="text-sm font-medium">{handover.driverName ?? handover.driverId}</div>
            <div className="text-xs text-muted-foreground">
              Handed over {handover.handoverAt ? new Date(handover.handoverAt).toLocaleDateString() : '—'}
              {handover.returnedAt ? ` · returned ${new Date(handover.returnedAt).toLocaleDateString()}` : ' · currently assigned'}
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
