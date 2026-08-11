import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/**
 * Reads against `GpsVehicleLatestState`'s documented shape from the
 * unmerged GPS telemetry-ingestion work (per this task's own scope: "no new
 * ingestion" — this UI is built against the documented contract, not a live
 * import, matching the whole Vehicle-360 batch's convention for referencing
 * other not-yet-merged batches). Renders an honest "not yet available"
 * state until that module merges and the Integrator mounts its route.
 */
export function GpsTelematicsTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/gps/latest-state`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/gps/latest-state`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        const data = await res.json();
        return Array.isArray(data) ? data : [data];
      }}
      emptyLabel="No GPS device assigned to this vehicle."
      notYetAvailableLabel="GPS telemetry ingestion has not merged into trunk yet — this tab is built against GpsVehicleLatestState's documented shape and will populate automatically once that work lands."
      renderRow={(state: any) => (
        <Card key={state.gpsDeviceId ?? 'latest'}>
          <CardContent className="py-3">
            <div className="text-sm font-medium">{state.movingStatus ?? 'Unknown status'}</div>
            <div className="text-xs text-muted-foreground">
              {state.latitude !== undefined ? `${state.latitude}, ${state.longitude}` : 'No position'} · Speed: {state.speedKph ?? '—'} km/h
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
