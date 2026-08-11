import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-INCIDENTS-05's proposed
 * `GET /api/vehicles/:vehicleId/breakdowns` endpoint. */
export function BreakdownsTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/breakdowns`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/breakdowns`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No breakdown events recorded."
      notYetAvailableLabel="Breakdown tracking is not yet mounted — see TASK-VEHICLE-INCIDENTS-05's report for the pending route."
      renderRow={(event: any) => (
        <Card key={event._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{event.symptoms}</div>
              <div className="text-xs text-muted-foreground">
                Reported {new Date(event.reportedAt).toLocaleDateString()} · {event.location ?? 'Location not recorded'}
              </div>
            </div>
            <Badge variant={event.currentState === 'available' ? 'default' : 'destructive'}>{event.currentState?.replace(/_/g, ' ')}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
