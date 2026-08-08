import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarOff, CheckCircle2 } from "lucide-react";
import {
  DAY_PART_LABEL, LEAVE_TYPE_LABEL, LeaveRecord, driverOf, fmtDateShort, initialsOf, leavesOnDay,
} from "./leave-domain";

// "Today on Leave" — the daily operational answer, shown BEFORE any
// calendar/analytics. Reused on both the Leave Calendar page and the
// Drivers landing screen so the two can never disagree: both derive from
// the same /api/driver-leaves records (approved leave covering today).
export default function TodayOnLeaveStrip({ maxEntries = 4, onViewAll, actionLabel }: {
  maxEntries?: number;
  onViewAll?: () => void;
  actionLabel?: string;
}) {
  const { data } = useQuery({ queryKey: ["/api/driver-leaves"] });
  const leaves = (data as LeaveRecord[]) || [];
  const today = new Date();
  const onLeave = leavesOnDay(leaves, today, ["approved"]);

  return (
    <Card className="shadow-sm" data-testid="today-on-leave">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <CalendarOff size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">
              Today on Leave — {onLeave.length} Driver{onLeave.length === 1 ? "" : "s"}
            </span>
          </div>
          {onViewAll && (
            <Button variant="ghost" size="sm" className="text-blue-600 h-7 px-2" onClick={onViewAll}>
              {actionLabel || "View All"}
            </Button>
          )}
        </div>

        {onLeave.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
            <CheckCircle2 size={15} className="text-green-500" />
            All scheduled drivers available today.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {onLeave.slice(0, maxEntries).map((l) => {
              const d = driverOf(l);
              return (
                <div key={l._id} className="flex items-center gap-2.5 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {initialsOf(d.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{d.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>{l.dayPart && l.dayPart !== "full" ? DAY_PART_LABEL[l.dayPart] : (LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType)}</span>
                      <span>·</span>
                      <span>{fmtDateShort(today)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {onLeave.length > maxEntries && (
              <Badge variant="secondary" className="self-center">+{onLeave.length - maxEntries} more</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
