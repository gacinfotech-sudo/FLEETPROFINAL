import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/**
 * Reads/acts against the existing `server/driver/handover/**` routes (once
 * merged) — per this task's explicit scope: "you build the UI against that
 * documented contract, you do not build a new backend for it." This is the
 * full handover+return event view; Driver Assignments tab reads the same
 * source summarized as an assignment history.
 */
export function HandoverReturnTab({ vehicleId }: { vehicleId: string }) {
  return (
    <TabDataList<any>
      queryKey={[`/api/vehicles/${vehicleId}/handovers`, 'full']}
      queryFn={async () => {
        const res = await fetch(`/api/vehicles/${vehicleId}/handovers`, { credentials: 'include' });
        if (!res.ok) throw new Error('not available');
        return res.json();
      }}
      emptyLabel="No handover/return events recorded yet."
      notYetAvailableLabel="Handover/return module has not merged into trunk yet — see server/driver/handover/** (Driver Lifecycle batch)."
      renderRow={(handover: any) => (
        <Card key={handover._id}>
          <CardContent className="py-3">
            <div className="text-sm font-medium">{handover.driverName ?? handover.driverId}</div>
            <div className="text-xs text-muted-foreground">
              Odometer at handover: {handover.handoverOdometer ?? '—'} km
              {handover.returnOdometer ? ` · at return: ${handover.returnOdometer} km` : ''}
              {handover.damageFlags?.length ? ` · ${handover.damageFlags.length} damage flag(s)` : ''}
            </div>
          </CardContent>
        </Card>
      )}
    />
  );
}
