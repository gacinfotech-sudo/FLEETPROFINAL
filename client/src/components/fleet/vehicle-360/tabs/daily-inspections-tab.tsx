import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TabDataList } from "../tab-data-list";

/**
 * Final Vehicle 360 Integrator — Open follow-up #5: no task in the original
 * batch owned Daily Inspections or the SAFETY_HOLD flag's data source
 * (server/vehicle/core/types.ts's SafetyHoldFlag comment: "a vehicle with an
 * unresolved CRITICAL Daily Inspection defect is SAFETY_HOLD"). Built here:
 * server/vehicle/inspections/{models,service,routes}.ts, mounted at
 * GET/POST /api/vehicles/:vehicleId/inspections and
 * GET /api/vehicles/:vehicleId/safety-hold.
 *
 * Read-only, matching every other Vehicle 360 tab's convention in this
 * batch (list view built against a real backend; no tab anywhere in this
 * batch has a create form yet — entry UI is a further follow-up, not
 * introduced here to avoid this tab being the sole exception).
 */
function SafetyHoldBanner({ vehicleId }: { vehicleId: string }) {
  const { data } = useQuery<{ safetyHold: boolean; openCriticalDefects: Array<{ description: string; inspectedAt: string }> }>({
    queryKey: [`/api/vehicles/${vehicleId}/safety-hold`],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}/safety-hold`, { credentials: 'include' });
      if (!res.ok) throw new Error('not available');
      return res.json();
    },
    retry: false,
  });

  if (!data) return null;

  if (data.safetyHold) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-3 flex items-start gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold">SAFETY_HOLD — {data.openCriticalDefects.length} unresolved critical defect(s)</div>
            <div className="text-xs mt-1 space-y-0.5">
              {data.openCriticalDefects.map((d, i) => (
                <div key={i}>{d.description} ({new Date(d.inspectedAt).toLocaleDateString()})</div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-3 flex items-center gap-2 text-muted-foreground">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <div className="text-sm">No unresolved critical defects — not under SAFETY_HOLD.</div>
      </CardContent>
    </Card>
  );
}

export function DailyInspectionsTab({ vehicleId }: { vehicleId: string }) {
  return (
    <div className="space-y-4">
      <SafetyHoldBanner vehicleId={vehicleId} />
      <TabDataList<any>
        queryKey={[`/api/vehicles/${vehicleId}/inspections`]}
        queryFn={async () => {
          const res = await fetch(`/api/vehicles/${vehicleId}/inspections`, { credentials: 'include' });
          if (!res.ok) throw new Error('not available');
          return res.json();
        }}
        emptyLabel="No inspections recorded for this vehicle yet."
        notYetAvailableLabel="Daily Inspections could not be loaded."
        renderRow={(inspection: any) => (
          <Card key={inspection._id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {new Date(inspection.inspectedAt).toLocaleString()} · Inspector: {inspection.inspectedBy}
                </div>
                {inspection.odometerReading !== undefined && (
                  <span className="text-xs text-muted-foreground">{inspection.odometerReading} km</span>
                )}
              </div>
              {inspection.notes && <div className="text-xs text-muted-foreground mt-1">{inspection.notes}</div>}
              {inspection.defects?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {inspection.defects.map((d: any) => (
                    <Badge key={d._id} variant={d.severity === 'CRITICAL' && !d.resolvedAt ? 'destructive' : 'outline'} className="text-xs">
                      {d.severity} — {d.description}{d.resolvedAt ? ' (resolved)' : ''}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      />
    </div>
  );
}
