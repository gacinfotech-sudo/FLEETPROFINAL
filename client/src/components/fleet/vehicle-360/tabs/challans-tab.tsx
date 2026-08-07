import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-INCIDENTS-05's proposed
 * `GET /api/vehicles/:vehicleId/challans` endpoint. `responsibilityDecision`
 * is displayed as "Not yet decided" when unset — never inferred, matching
 * the backend's explicit no-default rule. This UI never deducts anything;
 * it only ever displays the recorded decision. */
export function ChallansTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/challans`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/challans`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No challans recorded."
      notYetAvailableLabel="Challan tracking is not yet mounted — see TASK-VEHICLE-INCIDENTS-05's report for the pending route."
      renderRow={(challan: any) => (
        <Card key={challan._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{challan.challanNumber} · ₹{challan.amount}</div>
              <div className="text-xs text-muted-foreground">
                {challan.violation} · {new Date(challan.eventDate).toLocaleDateString()} ·
                {' '}{challan.responsibilityDecision ? challan.responsibilityDecision.replace(/_/g, ' ') : 'Not yet decided'}
              </div>
            </div>
            <Badge variant={challan.paidStatus === 'paid' ? 'default' : 'outline'}>{challan.paidStatus}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
