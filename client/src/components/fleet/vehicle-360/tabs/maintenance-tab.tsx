import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-MAINTENANCE-03's proposed
 * `GET /api/vehicles/:vehicleId/maintenance-records` endpoint. */
export function MaintenanceTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/maintenance-records`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/maintenance-records`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No maintenance records yet."
      notYetAvailableLabel="Maintenance engine is not yet mounted — see TASK-VEHICLE-MAINTENANCE-03's report for the pending route."
      renderRow={(record: any) => (
        <Card key={record._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{record.category?.replace(/_/g, ' ')}</div>
              <div className="text-xs text-muted-foreground">
                {record.serviceDate ? new Date(record.serviceDate).toLocaleDateString() : 'Not yet serviced'}
                {record.triggeredBy ? ` · triggered by ${record.triggeredBy}` : ''}
              </div>
            </div>
            <Badge variant={record.status === 'OVERDUE' ? 'destructive' : 'outline'}>{record.status}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
