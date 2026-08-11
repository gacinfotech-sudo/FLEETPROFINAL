import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";

/** Consumes the EXISTING, already-live `GET /api/expenses` endpoint
 * (server/routes.ts:6865, in trunk today) — filtered client-side by
 * vehicleId, since that endpoint returns all tenant expenses with no
 * server-side vehicle filter param. Independent, non-overlapping cost
 * buckets per VEHICLE-EXPENSE-MATRIX.md, not one lump sum. */
export function ExpensesTab({ vehicleId }: { vehicleId: string }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/expenses"], retry: false });
  const expenses = (data ?? []).filter((e) => (e.vehicleId?._id ?? e.vehicleId) === vehicleId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }

  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  if (expenses.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No expenses recorded for this vehicle yet.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(byCategory).map(([category, total]) => (
            <div key={category}>
              <div className="text-xs text-muted-foreground capitalize">{category}</div>
              <div className="text-sm font-medium">₹{total.toFixed(2)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-2">
        {expenses.map((e) => (
          <Card key={e._id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium capitalize">{e.category}</div>
                <div className="text-xs text-muted-foreground">{e.description ?? ''} · {new Date(e.date).toLocaleDateString()}</div>
              </div>
              <div className="text-sm font-medium">₹{e.amount}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
