import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

/**
 * Genuine gap: no task in the Vehicle 360 batch owns building Daily
 * Inspections / the SAFETY_HOLD flag's data source (TASK-VEHICLE-DOMAIN-01's
 * report defines the `SAFETY_HOLD` type but nothing populates it yet).
 * Rendering an honest "not built yet" state rather than a fake empty list
 * or a crash — see this task's report for the flagged gap recommending a
 * future task own this.
 */
export function DailyInspectionsTab() {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">
        <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Daily Inspections is not built yet in this batch.</p>
        <p className="text-xs mt-1">No task in the Vehicle 360 batch owns this backend — flagged in this task's report for future planning.</p>
      </CardContent>
    </Card>
  );
}
