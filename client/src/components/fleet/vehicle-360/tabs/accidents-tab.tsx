import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-INCIDENTS-05's proposed
 * `GET /api/vehicles/:vehicleId/accidents` endpoint. `reviewStatus` is
 * displayed as-is, never collapsed into a fault/no-fault badge the backend
 * didn't explicitly set — this UI does not decide driver fault either. */
export function AccidentsTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/accidents`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/accidents`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No accident events recorded."
      notYetAvailableLabel="Accident tracking is not yet mounted — see TASK-VEHICLE-INCIDENTS-05's report for the pending route."
      renderRow={(event: any) => (
        <Card key={event._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{new Date(event.occurredAt).toLocaleDateString()} · {event.location ?? 'Location not recorded'}</div>
              <div className="text-xs text-muted-foreground">
                {event.insuranceClaimNumber ? `Claim ${event.insuranceClaimNumber}` : 'No claim number recorded'}
                {event.estimatedCost ? ` · Est. ₹${event.estimatedCost}` : ''}
              </div>
            </div>
            <Badge variant="outline">{event.reviewStatus?.replace(/_/g, ' ')}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
