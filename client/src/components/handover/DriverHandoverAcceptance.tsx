// Embedded in client/src/pages/driver-portal.tsx — the driver-facing side of
// TASK-VEHICLE-HANDOVER-05. Renders each of the driver's pending handovers
// (sourced from GET /api/driver-portal/me's `pendingHandovers` field — see
// this task's proposed server/routes.ts patch) and lets the driver accept
// one via the ONE new driver-portal route this task adds:
// POST /api/driver-portal/handovers/:id/accept.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Car, Gauge, Fuel, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DriverPortalHandoverSummary } from "./types";

interface Props {
  handovers: DriverPortalHandoverSummary[];
}

function directionLabel(direction: string) {
  return direction === 'handover' ? 'Vehicle handover to you' : 'Vehicle return';
}

export default function DriverHandoverAcceptance({ handovers }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: async (handoverId: string) => (await apiRequest("POST", `/api/driver-portal/handovers/${handoverId}/accept`, {})).json(),
    onSuccess: () => {
      toast({ title: "Acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["/api/driver-portal/me"] });
    },
    onError: (err: any) => toast({ title: "Could not acknowledge", description: err.message, variant: "destructive" }),
  });

  if (!handovers || handovers.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Vehicle Handover</h2>
      {handovers.map((h) => (
        <Card key={h.id} data-testid={`handover-${h.id}`} className={h.status === 'disputed' ? 'border-amber-400' : undefined}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-gray-400" /> {directionLabel(h.direction)}
              </CardTitle>
              {h.status === 'disputed' ? (
                <Badge variant="outline" className="text-amber-700 border-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Flagged for review
                </Badge>
              ) : (
                <Badge variant="outline" className="capitalize">{h.status.replace(/_/g, ' ')}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-4 text-gray-600">
              <span className="flex items-center gap-1"><Gauge className="h-4 w-4 text-gray-400" /> {h.odometerReading} km</span>
              <span className="flex items-center gap-1"><Fuel className="h-4 w-4 text-gray-400" /> {h.fuelLevel}%</span>
            </div>
            {h.removableItemInventory?.length > 0 && (
              <div className="text-gray-600">
                Items: {h.removableItemInventory.map((i) => `${i.item}${i.present ? '' : ' (missing)'}`).join(', ')}
              </div>
            )}
            {h.damageNoted && <div className="text-amber-700">Noted: {h.damageNoted}</div>}
            {h.flagCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> {h.flagCount} item{h.flagCount > 1 ? 's' : ''} flagged for office review — this does not block anything on your end.
              </div>
            )}
            <Button
              size="sm"
              className="w-full mt-1"
              disabled={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate(h.id)}
              data-testid={`accept-handover-${h.id}`}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Acknowledge
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
