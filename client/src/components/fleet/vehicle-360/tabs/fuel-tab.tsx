import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/** Consumes TASK-VEHICLE-FUEL-EXPENSE-04's proposed
 * `GET /api/vehicles/:vehicleId/fuel-transactions` endpoint. */
export function FuelTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/fuel-transactions`]}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/fuel-transactions`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No fuel/CNG/EV transactions recorded yet."
      notYetAvailableLabel="Fuel analytics are not yet mounted — see TASK-VEHICLE-FUEL-EXPENSE-04's report for the pending route."
      renderRow={(t: any) => (
        <Card key={t._id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t.fuelType?.toUpperCase()} · ₹{t.amount}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.date).toLocaleDateString()} · {t.quantity} {t.fuelType === 'cng' ? 'kg' : (t.fuelType === 'electric' || t.fuelType === 'hybrid') ? 'kWh' : 'L'}
                {t.computedKmPerLitre ? ` · ${t.computedKmPerLitre.toFixed(1)} km/L` : ''}
                {t.computedKmPerKg ? ` · ${t.computedKmPerKg.toFixed(1)} km/kg` : ''}
                {t.computedKmPerKwh ? ` · ${t.computedKmPerKwh.toFixed(1)} km/kWh` : ''}
              </div>
            </div>
            {t.flaggedAbnormal && <Badge variant="destructive">Abnormal</Badge>}
          </CardContent>
        </Card>
      )}
    />
  );
}
