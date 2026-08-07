import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

export function BatteryTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/battery`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/battery`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No battery records yet."
      notYetAvailableLabel="Battery lifecycle tracking is not yet mounted — see TASK-VEHICLE-MAINTENANCE-03's report for the pending route."
      renderRow={(battery: any) => (
        <Card key={battery._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{battery.brand ?? 'Unknown brand'}</div>
              <div className="text-xs text-muted-foreground">
                Installed {new Date(battery.installationDate).toLocaleDateString()}
                {battery.warrantyMonths ? ` · ${battery.warrantyMonths}mo warranty` : ''}
              </div>
            </div>
            <Badge variant="outline">{battery.status}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
