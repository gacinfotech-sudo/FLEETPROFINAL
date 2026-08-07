import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-FUEL-EXPENSE-04's proposed
 * `GET /api/vehicles/:vehicleId/fastag` endpoint. Toll expense rows
 * themselves live in the Expenses tab (category = 'toll') once the
 * Integrator wires sync — this tab is the tag-to-vehicle mapping + balance
 * view specifically. */
export function FastagTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/fastag`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/fastag`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No FASTag linked to this vehicle yet."
      notYetAvailableLabel="FASTag integration is not yet mounted — see TASK-VEHICLE-FUEL-EXPENSE-04's report for the pending route."
      renderRow={(tag: any) => (
        <Card key={tag._id}>
          <CardContent className="py-3">
            <div className="text-sm font-medium">Tag {tag.tagId}</div>
            <div className="text-xs text-muted-foreground">
              Balance: {tag.lastKnownBalance !== undefined ? `₹${tag.lastKnownBalance}` : 'Unknown'} · Status: {tag.status}
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
