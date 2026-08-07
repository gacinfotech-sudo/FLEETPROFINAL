import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Overview tab — the vehicle's own core fields (TASK-VEHICLE-DOMAIN-01),
 * already available on the vehicle object the page shell fetched, no
 * additional query needed. */
export function OverviewTab({ vehicle }: { vehicle: any }) {
  const rows: [string, unknown][] = [
    ['Make', vehicle.make], ['Model', vehicle.vehicleModel], ['Variant', vehicle.variant],
    ['Year', vehicle.year], ['Registration Number', vehicle.licensePlate],
    ['Vehicle Category', vehicle.vehicleCategory], ['Fuel Type', vehicle.fuelType],
    ['Seating Capacity', vehicle.capacity], ['Ownership Type', vehicle.ownershipType],
    ['Branch / Base Location', vehicle.branch], ['VIN', vehicle.vin],
    ['Chassis Number', vehicle.chassisNumber], ['Engine Number', vehicle.engineNumber],
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Vehicle Identity</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm">{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
