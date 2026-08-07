import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

export function TyresTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/tyres`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/tyres`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No tyre records yet."
      notYetAvailableLabel="Tyre lifecycle tracking is not yet mounted — see TASK-VEHICLE-MAINTENANCE-03's report for the pending route."
      renderRow={(tyre: any) => (
        <Card key={tyre._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{tyre.position?.replace(/_/g, ' ')} — {tyre.brand ?? 'Unknown brand'}</div>
              <div className="text-xs text-muted-foreground">
                Installed at {tyre.installationOdometerKm} km
                {tyre.removalOdometerKm ? ` · removed at ${tyre.removalOdometerKm} km` : ''}
              </div>
            </div>
            <Badge variant="outline">{tyre.status}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
