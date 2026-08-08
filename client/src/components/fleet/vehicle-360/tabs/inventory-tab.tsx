import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-MAINTENANCE-03's proposed
 * `GET /api/vehicles/:vehicleId/inventory` endpoint (VehicleInventoryItem —
 * the structured, purchase-dated catalog, distinct from Handover's
 * free-text per-event checklist). */
export function InventoryTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/inventory`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/inventory`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No inventory items catalogued yet."
      notYetAvailableLabel="Inventory catalog is not yet mounted — see TASK-VEHICLE-MAINTENANCE-03's report for the pending route."
      renderRow={(item: any) => (
        <Card key={item._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{item.name}</div>
              <div className="text-xs text-muted-foreground">
                {item.category?.replace(/_/g, ' ')}
                {item.purchaseDate ? ` · Purchased ${new Date(item.purchaseDate).toLocaleDateString()}` : ''}
              </div>
            </div>
            <Badge variant={item.status === 'PRESENT' ? 'default' : 'destructive'}>{item.status}</Badge>
          </CardContent>
        </Card>
      )}
    />
  );
}
