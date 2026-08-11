import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/** Consumes the EXISTING, already-live `GET /api/reports/vehicle-performance`
 * endpoint — never mixes customer fare with internal cost data (Cost and
 * Revenue are shown as separate figures, never netted into one ambiguous
 * number, per VEHICLE-EXPENSE-MATRIX.md's "independent, non-overlapping
 * buckets" instruction). */
export function ProfitabilityTab({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/reports/vehicle-performance"], retry: false });
  const row = data?.vehicles?.find?.((v: any) => v.vehicleId === vehicleId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }
  if (!row) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground"><p>No revenue/expense activity recorded for this vehicle this month.</p></CardContent></Card>;
  }

  const kmDriven = row.totalKm ?? 0;
  const costPerKm = kmDriven > 0 ? (row.totalExpenses ?? 0) / kmDriven : undefined;

  const fields: [string, string][] = [
    ['Revenue', `₹${row.totalRevenue ?? 0}`],
    ['Cost', `₹${row.totalExpenses ?? 0}`],
    ['Net', `₹${(row.totalRevenue ?? 0) - (row.totalExpenses ?? 0)}`],
    ['KM Driven', `${kmDriven}`],
    ['Cost / KM', costPerKm !== undefined ? `₹${costPerKm.toFixed(2)}` : '—'],
    ['Trips', `${row.tripCount ?? 0}`],
  ];

  return (
    <Card>
      <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm font-medium">{value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
